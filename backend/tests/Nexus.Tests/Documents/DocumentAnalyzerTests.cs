using System.IO.Compression;
using System.Text;
using Nexus.Graph;
using Nexus.Ingestion.Documents;
using Xunit;

namespace Nexus.Tests.Documents;

public class DocumentAnalyzerTests
{
    private static readonly Guid T = Guid.NewGuid();

    // ───────────── Lecture des fichiers ─────────────

    [Fact]
    public void Table_rows_become_self_describing_sentences()
    {
        var lines = DocumentTextExtractor.TableToLines(
        [
            ["ID", "Site", "Criticité"],
            ["AGE-006", "Agence Garoua (Nord)", "Élevée"],
            ["AGE-009", "Agence Kribi (Sud)", ""],
        ]).ToList();

        Assert.Equal("ID : AGE-006 ; Site : Agence Garoua (Nord) ; Criticité : Élevée", lines[0]);
        Assert.Equal("ID : AGE-009 ; Site : Agence Kribi (Sud)", lines[1]);
    }

    [Fact]
    public void Docx_keeps_headings_paragraphs_and_tables_in_order()
    {
        using var file = Docx(
            """<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>3. Systèmes</w:t></w:r></w:p>""" +
            """<w:p><w:r><w:t>Le core banking dépend du serveur SRV-01.</w:t></w:r></w:p>""" +
            """<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Système</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Fournisseur</w:t></w:r></w:p></w:tc></w:tr>""" +
            """<w:tr><w:tc><w:p><w:r><w:t>Core banking</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Orabank Tech</w:t></w:r></w:p></w:tc></w:tr></w:tbl>""");

        var doc = DocumentTextExtractor.Extract(file, "profil.docx");

        Assert.Equal("docx", doc.Format);
        Assert.Equal(1, doc.Tables);
        Assert.Contains("## 3. Systèmes", doc.Text);
        Assert.Contains("Le core banking dépend du serveur SRV-01.", doc.Text);
        Assert.Contains("[Tableau 1 : 3. Systèmes]", doc.Text);
        Assert.Contains("Système : Core banking ; Fournisseur : Orabank Tech", doc.Text);
        Assert.True(doc.Text.IndexOf("SRV-01", StringComparison.Ordinal) < doc.Text.IndexOf("Orabank", StringComparison.Ordinal));
    }

    [Fact]
    public void Legacy_doc_and_unknown_formats_are_refused_clearly()
    {
        Assert.False(DocumentTextExtractor.IsSupported("vieux.doc"));
        Assert.True(DocumentTextExtractor.IsSupported("profil.DOCX"));
        Assert.True(DocumentTextExtractor.IsSupported("rapport.pdf"));
        Assert.Throws<NotSupportedException>(() => DocumentTextExtractor.Extract(new MemoryStream([1, 2]), "vieux.doc"));
    }

    // ───────────── Découpage ─────────────

    [Fact]
    public void Long_text_is_split_without_cutting_table_rows_and_keeps_context()
    {
        var sb = new StringBuilder("## 4. Réseau d'agences\n[Tableau 2 : 4. Réseau d'agences]\n");
        for (var i = 0; i < 120; i++) sb.AppendLine($"ID : AGE-{i:000} ; Site : Agence numéro {i} de la région ; Criticité : Modérée ; Responsable : Chef d'agence {i}");
        var chunks = DocumentAnalyzer.Plan(sb.ToString(), maxChars: 2000);

        Assert.True(chunks.Count > 3);
        Assert.All(chunks, c => Assert.True(c.Text.Length <= 2000));
        Assert.All(chunks.Skip(1), c =>
        {
            Assert.StartsWith("Section : 4. Réseau d'agences", c.Text);
            Assert.Contains("[Tableau 2 : 4. Réseau d'agences] (suite)", c.Text);
        });
        // Aucune ligne coupée : chaque ligne de données est complète dans sa section.
        var rows = chunks.SelectMany(c => c.Text.Split('\n')).Where(l => l.StartsWith("ID : ")).ToList();
        Assert.Equal(120, rows.Count);
        Assert.All(rows, r => Assert.EndsWith(r.Split("Chef d'agence ")[1], r));
    }

    // ───────────── Réponse du modèle ─────────────

    [Fact]
    public void Model_answer_is_read_leniently()
    {
        var answer = """
            Voici le résultat :
            ```json
            {"entities":[{"name":"Core banking","type":"application","criticality":"90","aliases":["CBS"],},
                         {"name":"Orabank Tech","type":"fournisseur","criticality":60}],
             "relations":[{"source":"Core banking","sourceType":"Application","target":"Orabank Tech","targetType":"Supplier","relationType":"fourni par","confidence":0.9,"evidence":"maintenu par Orabank Tech"}],
             "risks":[{"title":"Fournisseur unique","severity":"élevée","detail":"Aucune alternative","entities":["Orabank Tech"]}]}
            ```
            """;
        var x = DocumentAnalyzer.ParseChunk(answer);

        Assert.NotNull(x);
        Assert.Equal(2, x!.Entities.Count);
        Assert.Equal(90, x.Entities[0].Criticality);
        Assert.Equal("Supplier", x.Entities[1].Type);
        Assert.Equal("SUPPLIED_BY", x.Relations[0].RelationType);
        Assert.Equal("high", x.Risks[0].Severity);
    }

    [Fact]
    public void Unusable_answer_returns_null()
    {
        Assert.Null(DocumentAnalyzer.ParseChunk(null));
        Assert.Null(DocumentAnalyzer.ParseChunk("Je ne peux pas répondre."));
        Assert.Null(DocumentAnalyzer.ParseChunk("{ pas du json"));
    }

    // ───────────── Consolidation et recoupement ─────────────

    private static RawEntity E(string name, string type, int crit = 50, params string[] aliases) => new(name, type, crit, aliases, null);
    private static RawRelation R(string s, string st, string t, string tt, string rel, double c = 0.9) => new(s, st, t, tt, rel, c, null);
    private static GraphEntityRecord G(string name, string type, int crit, params string[] aliases)
        => new(Guid.NewGuid(), T, type, name, crit, aliases, null, "test");

    [Fact]
    public void Duplicates_across_sections_are_merged_regardless_of_case_accents_and_aliases()
    {
        var parts = new List<ChunkExtraction>
        {
            new([E("Système Core Banking", "Application", 80, "CBS")], [], []),
            new([E("systeme core banking", "System", 95)], [R("CBS", "Application", "Agence Garoua (Nord)", "Location", "LOCATED_IN")], []),
        };
        var r = DocumentAnalyzer.Consolidate(parts, [], [], "fr", 2);

        var cbs = Assert.Single(r.Entities, e => e.Name == "Système Core Banking");
        Assert.Equal(95, cbs.Criticality);           // criticité la plus haute retenue
        Assert.Equal("Application", cbs.Type);      // type précis préféré au type générique
        Assert.Equal(2, cbs.Mentions);
        Assert.Contains(r.Entities, e => e.Name == "Agence Garoua (Nord)" && e.Type == "Location");  // extrémité créée
        Assert.Single(r.Relations);
    }

    [Fact]
    public void Elements_already_in_the_graph_are_recognised()
    {
        var graph = new List<GraphEntityRecord> { G("Agence Garoua", "Location", 70), G("Amplitude", "Application", 90, "Core banking") };
        var parts = new List<ChunkExtraction> { new([E("Agence Garoua (Nord)", "Location", 75), E("Core Banking", "Application", 90), E("MTN MoMo", "Supplier", 60)], [], []) };

        var r = DocumentAnalyzer.Consolidate(parts, graph, [], "fr", 1);

        Assert.Equal("existing", r.Entities.Single(e => e.Name == "Agence Garoua (Nord)").Status);
        var core = r.Entities.Single(e => e.Name == "Core Banking");
        Assert.Equal("existing", core.Status);
        Assert.Equal("Amplitude", core.MatchName);
        Assert.Equal("new", r.Entities.Single(e => e.Name == "MTN MoMo").Status);
        Assert.Equal(2, r.Stats.ExistingEntities);
        Assert.Equal(1, r.Stats.NewEntities);
    }

    [Fact]
    public void Concentration_points_and_key_person_are_computed_not_guessed()
    {
        var parts = new List<ChunkExtraction>
        {
            new(
                [E("Serveur SRV-01", "Server", 90), E("Core banking", "Application"), E("Paie", "BusinessProcess"),
                 E("Mobile Money", "BusinessService"), E("Jean Tchoupo", "Person")],
                [R("Core banking", "Application", "Serveur SRV-01", "Server", "RUNS_ON"),
                 R("Paie", "BusinessProcess", "Serveur SRV-01", "Server", "DEPENDS_ON"),
                 R("Mobile Money", "BusinessService", "Serveur SRV-01", "Server", "DEPENDS_ON"),
                 R("Jean Tchoupo", "Person", "Core banking", "Application", "KNOWS")],
                []),
        };
        var r = DocumentAnalyzer.Consolidate(parts, [], [], "fr", 1);

        var conc = Assert.Single(r.Findings, f => f.Kind == "concentration");
        Assert.Contains("Serveur SRV-01", conc.Title);
        Assert.Contains("3 éléments en dépendent", conc.Detail);
        var person = Assert.Single(r.Findings, f => f.Kind == "key-person");
        Assert.Contains("Core banking", person.Title);
        Assert.Contains("Jean Tchoupo", person.Detail);
    }

    [Fact]
    public void A_documented_backup_removes_the_concentration_finding()
    {
        var parts = new List<ChunkExtraction>
        {
            new([],
                [R("A", "Application", "SRV", "Server", "RUNS_ON"), R("B", "Application", "SRV", "Server", "RUNS_ON"),
                 R("C", "Application", "SRV", "Server", "RUNS_ON"), R("SRV", "Server", "SRV-SECOURS", "Server", "BACKED_UP_BY")],
                []),
        };
        var r = DocumentAnalyzer.Consolidate(parts, [], [], "fr", 1);
        Assert.DoesNotContain(r.Findings, f => f.Kind == "concentration");
    }

    [Fact]
    public void Diverging_criticality_with_the_graph_is_flagged()
    {
        var graph = new List<GraphEntityRecord> { G("Agence Kribi", "Location", 85) };
        var parts = new List<ChunkExtraction> { new([E("Agence Kribi", "Location", 25)], [], []) };
        var r = DocumentAnalyzer.Consolidate(parts, graph, [], "fr", 1);
        Assert.Single(r.Findings, f => f.Kind == "criticality-gap");
    }

    [Fact]
    public async Task A_failing_section_does_not_stop_the_analysis()
    {
        var text = string.Join("\n", Enumerable.Range(0, 200).Select(i => $"Ligne {i} : le processus P{i} dépend du système S{i} hébergé au siège."));
        var calls = 0;
        Task<string?> Fake(string system, string user, CancellationToken ct)
        {
            calls++;
            return Task.FromResult<string?>(calls <= 2   // les deux tentatives de la section 1 échouent
                ? "réponse illisible"
                : """{"entities":[{"name":"Siège","type":"Location","criticality":90}],"relations":[],"risks":[]}""");
        }

        var r = await DocumentAnalyzer.RunAsync(text, Fake, [], [], "fr");

        Assert.True(calls >= 3);
        Assert.Contains(r.Warnings, w => w.Contains("section 1"));
        Assert.Equal(r.Stats.Sections - 1, r.Stats.SectionsAnalyzed);
    }

    [Fact]
    public void Reconciliation_merges_short_and_full_names_but_never_across_types()
    {
        var parts = new List<ChunkExtraction>
        {
            new([E("plateforme Mobile Money", "Application", 70), E("site de repli à Douala", "Location", 60)],
                [R("Octroi de crédit", "BusinessProcess", "plateforme Mobile Money", "Application", "DEPENDS_ON")], []),
            new([E("Plateforme Mobile Money / Agrégateur de paiement", "Application", 90), E("Serveur de secours (Douala)", "Server", 90)], [], []),
        };
        var groups = DocumentAnalyzer.ParseGroups(
            """{"groups":[["plateforme Mobile Money","Plateforme Mobile Money / Agrégateur de paiement"],["site de repli à Douala","Serveur de secours (Douala)"]]}""");

        var r = DocumentAnalyzer.Consolidate(parts, [], [], "fr", 2, sameAs: groups);

        var mm = Assert.Single(r.Entities, e => e.Name.Contains("Mobile Money", StringComparison.OrdinalIgnoreCase));
        Assert.Equal("Plateforme Mobile Money / Agrégateur de paiement", mm.Name);   // nom le plus complet
        Assert.Equal(90, mm.Criticality);
        Assert.Contains("plateforme Mobile Money", mm.Aliases);
        Assert.Equal("Plateforme Mobile Money / Agrégateur de paiement", Assert.Single(r.Relations).Target);  // lien redirigé
        Assert.Contains(r.Entities, e => e.Name == "site de repli à Douala");          // Location et Server : jamais fusionnés
        Assert.Contains(r.Entities, e => e.Name == "Serveur de secours (Douala)");
    }

    [Fact]
    public void Several_assets_held_by_one_person_give_a_single_grouped_finding()
    {
        var parts = new List<ChunkExtraction>
        {
            new([E("Cyrille", "Person")],
                [R("Cyrille", "Person", "OPTIMA-CBS", "Application", "RESPONSIBLE_FOR"),
                 R("Cyrille", "Person", "Sauvegarde cloud", "CloudResource", "RESPONSIBLE_FOR"),
                 R("Cyrille", "Person", "Serveurs principaux", "Server", "MAINTAINS")], []),
        };
        var r = DocumentAnalyzer.Consolidate(parts, [], [], "fr", 1);
        var f = Assert.Single(r.Findings, x => x.Kind == "key-person");
        Assert.Contains("3 éléments reposent sur « Cyrille » seul", f.Title);
    }

    [Fact]
    public void A_short_name_quoted_in_a_graph_element_is_recognised()
    {
        var graph = new List<GraphEntityRecord> { G("Core Banking System « OPTIMA-CBS »", "Application", 95), G("Agence Douala", "Location", 60), G("Agence Douala (Akwa)", "Location", 70) };
        var parts = new List<ChunkExtraction> { new([E("optima-cbs", "Application", 90), E("Agence Douala", "Location", 60)], [], []) };

        var r = DocumentAnalyzer.Consolidate(parts, graph, [], "fr", 1);

        Assert.Equal("Core Banking System « OPTIMA-CBS »", r.Entities.Single(e => e.Name == "optima-cbs").MatchName);
        Assert.Equal("Agence Douala", r.Entities.Single(e => e.Name == "Agence Douala").MatchName);   // le nom exact l'emporte
    }

    [Fact]
    public async Task An_empty_answer_on_a_substantial_section_is_retried()
    {
        var calls = 0;
        Task<string?> Fake(string s, string u, CancellationToken ct) => Task.FromResult<string?>(++calls == 1
            ? """{"entities":[],"relations":[],"risks":[]}"""
            : """{"entities":[{"name":"Serveur central","type":"Server","criticality":90}],"relations":[],"risks":[]}""");
        var chunk = new DocumentChunk(0, "", new string('x', 1200));

        var x = await DocumentAnalyzer.ExtractSectionAsync(chunk, 1, [], "fr", Fake);

        Assert.Equal(2, calls);
        Assert.Single(x!.Entities);
    }

    private static MemoryStream Docx(string bodyXml)
    {
        var ms = new MemoryStream();
        using (var zip = new ZipArchive(ms, ZipArchiveMode.Create, leaveOpen: true))
        {
            var entry = zip.CreateEntry("word/document.xml");
            using var w = new StreamWriter(entry.Open(), new UTF8Encoding(false));
            w.Write($"""<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>{bodyXml}</w:body></w:document>""");
        }
        ms.Position = 0;
        return ms;
    }
}
