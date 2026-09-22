using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Nexus.Graph;
using Nexus.Ingestion.Normalization;

namespace Nexus.Ingestion.Documents;

// ───────────────────────────── Modèles ─────────────────────────────

/// <summary>Une section du document, analysée en un appel au modèle.</summary>
public sealed record DocumentChunk(int Index, string Section, string Text);

public sealed record RawEntity(string Name, string Type, int Criticality, IReadOnlyList<string> Aliases, string? Description);
public sealed record RawRelation(string Source, string SourceType, string Target, string TargetType, string RelationType, double Confidence, string? Evidence);
public sealed record RawRisk(string Title, string Severity, string Detail, IReadOnlyList<string> Entities, string? Evidence);

/// <summary>Élément déjà relevé, transmis à la passe de liens (avec ses identifiants et sigles).</summary>
public sealed record NamedEntity(string Name, string Type, IReadOnlyList<string>? Aliases = null);

/// <summary>Ce que le modèle a trouvé dans UNE section.</summary>
public sealed record ChunkExtraction(IReadOnlyList<RawEntity> Entities, IReadOnlyList<RawRelation> Relations, IReadOnlyList<RawRisk> Risks);

/// <summary>Élément proposé, recoupé avec le graphe (« existing » : déjà présent, sous MatchName).</summary>
public sealed record CandidateEntity(
    string Name, string Type, int Criticality, IReadOnlyList<string> Aliases, string? Description,
    string Status, string? MatchId, string? MatchName, int? GraphCriticality, int Mentions);

public sealed record CandidateRelation(
    string Source, string SourceType, string Target, string TargetType, string RelationType,
    double Confidence, string? Evidence, string Status);

public sealed record DocumentFinding(string Kind, string Severity, string Title, string Detail, IReadOnlyList<string> Entities);

public sealed record DocumentStats(
    int Sections, int SectionsAnalyzed, int Entities, int NewEntities, int ExistingEntities,
    int Relations, int NewRelations, int ExistingRelations, int Risks);

public sealed record DocumentAnalysisResult(
    DocumentStats Stats,
    IReadOnlyList<CandidateEntity> Entities,
    IReadOnlyList<CandidateRelation> Relations,
    IReadOnlyList<RawRisk> Risks,
    IReadOnlyList<DocumentFinding> Findings,
    IReadOnlyList<string> Warnings);

/// <summary>
/// Analyse d'un document : découpage en sections, extraction par le modèle
/// section par section, fusion, recoupement avec le graphe et constats.
///
/// Principe : le modèle PROPOSE (entités, liens, risques cités), le code
/// CONSOLIDE et CALCULE (doublons, correspondance avec le graphe, points de
/// concentration, dépendance à une personne, criticités divergentes). Aucun
/// constat chiffré n'est laissé à l'appréciation du modèle.
/// </summary>
public static class DocumentAnalyzer
{
    public const int MaxChunkChars = 6500;
    public const int MaxChunks = 40;

    private static readonly string[] EntityTypeHints =
    [
        "Location (site, agence, siège, datacenter)", "Organization", "BusinessUnit (direction, département)",
        "Person (personne nommée)", "Role (poste, fonction)", "Team (équipe)",
        "Supplier (fournisseur, prestataire, partenaire externe, opérateur)", "Contract",
        "BusinessProcess (activité métier : octroi de crédit, paie, facturation…)", "BusinessService (service rendu aux clients)",
        "Application", "System", "Service", "Database", "DataStore", "Server", "Device", "Network (réseau, liaison, VSAT, fibre)",
        "CloudResource", "Infrastructure (énergie, groupe électrogène, climatisation…)",
        "Identity", "Control (mesure de sécurité)", "Policy", "Document (procédure, runbook)",
        "Incident (incident passé)", "Dataset", "AiService", "AiModel", "AiProvider",
    ];

    private static readonly string[] RelationTypeHints =
    [
        "DEPENDS_ON (A a besoin de B pour fonctionner)", "RUNS_ON (A tourne sur B)", "HOSTS (A héberge B)",
        "USES (A utilise B)", "SUPPLIED_BY (A est fourni par le fournisseur B)", "SERVED_BY", "LOCATED_IN (A est situé dans le site B)",
        "PART_OF (A fait partie de B)", "OPERATED_BY / MANAGED_BY (A est exploité ou géré par B)",
        "RESPONSIBLE_FOR (la personne A est responsable de B)", "KNOWS (la personne A sait faire fonctionner B)",
        "MAINTAINS (la personne A maintient B)", "CONNECTS_TO", "AUTHENTICATES (A authentifie les accès à B)",
        "STORES", "PROCESSES", "BACKED_UP_BY (A est secouru par B)", "REPLACED_BY", "RECOVERS_WITH",
        "IMPACTS (l'incident A a touché B)", "HAS_ACCESS_TO", "DOCUMENTED_BY", "SUPPORTS", "CONTRACTED_BY",
    ];

    // Relations « x dépend de y » (x → y) et relations inverses (y → x).
    private static readonly HashSet<string> Dependency = new(StringComparer.OrdinalIgnoreCase)
        { "DEPENDS_ON", "RUNS_ON", "USES", "REQUIRES", "SUPPLIED_BY", "SERVED_BY", "CONTRACTED_BY" };
    private static readonly HashSet<string> ReverseDependency = new(StringComparer.OrdinalIgnoreCase)
        { "HOSTS", "AUTHENTICATES", "SUPPORTS" };
    private static readonly HashSet<string> Redundancy = new(StringComparer.OrdinalIgnoreCase)
        { "BACKED_UP_BY", "REPLACED_BY", "RECOVERS_WITH" };
    private static readonly HashSet<string> HolderToAsset = new(StringComparer.OrdinalIgnoreCase)
        { "KNOWS", "MAINTAINS", "RESPONSIBLE_FOR" };
    private static readonly HashSet<string> AssetToHolder = new(StringComparer.OrdinalIgnoreCase)
        { "OPERATED_BY", "MANAGED_BY" };
    private static readonly HashSet<string> PeopleTypes = new(StringComparer.OrdinalIgnoreCase) { "Person", "Role" };
    // La dépendance à une personne vise ce qu'elle seule sait faire tourner
    // (systèmes, processus, services). Qu'un chef d'agence dirige son agence
    // relève de l'organigramme, pas d'une fragilité de savoir-faire.
    private static readonly HashSet<string> NotKnowledgeAssets = new(StringComparer.OrdinalIgnoreCase)
        { "Person", "Role", "Team", "Location", "Organization", "BusinessUnit", "Supplier", "Contract", "Incident", "Risk", "Event" };
    private static readonly HashSet<string> GenericTypes = new(StringComparer.OrdinalIgnoreCase) { "Asset", "System", "Service", "Infrastructure" };

    // ───────────────────────────── Découpage ─────────────────────────────

    /// <summary>
    /// Découpe en sections d'au plus <paramref name="maxChars"/> caractères, aux
    /// frontières de lignes (une ligne de tableau n'est jamais coupée). Chaque
    /// section reçoit le titre courant, et l'étiquette du tableau en cours si elle
    /// commence au milieu d'un tableau : le modèle garde ainsi le contexte.
    /// </summary>
    public static IReadOnlyList<DocumentChunk> Plan(string text, int maxChars = MaxChunkChars)
    {
        var chunks = new List<DocumentChunk>();
        if (string.IsNullOrWhiteSpace(text)) return chunks;

        var sb = new StringBuilder();
        string heading = "", sectionOfChunk = "", table = "";
        void Flush()
        {
            var body = sb.ToString().Trim();
            if (body.Length > 0) chunks.Add(new DocumentChunk(chunks.Count, sectionOfChunk, body));
            sb.Clear();
        }

        foreach (var raw in text.Split('\n'))
        {
            var line = raw.TrimEnd();
            if (line.StartsWith('#')) { heading = line.TrimStart('#', ' '); table = ""; }
            else if (line.StartsWith("[Tableau", StringComparison.Ordinal)) table = line;
            else if (line.Length == 0) table = "";

            // Une ligne démesurée (paragraphe sans retour) est coupée en morceaux.
            foreach (var piece in SplitLong(line, maxChars - 400))
            {
                if (sb.Length > 0 && sb.Length + piece.Length + 1 > maxChars)
                {
                    Flush();
                    sectionOfChunk = heading;
                    if (heading.Length > 0) sb.Append("Section : ").AppendLine(heading);
                    if (table.Length > 0 && piece != table) sb.AppendLine(table + " (suite)");
                }
                if (sb.Length == 0) sectionOfChunk = heading;
                sb.AppendLine(piece);
            }
        }
        Flush();
        return chunks;
    }

    private static IEnumerable<string> SplitLong(string line, int max)
    {
        if (line.Length <= max) { yield return line; yield break; }
        var start = 0;
        while (start < line.Length)
        {
            var len = Math.Min(max, line.Length - start);
            if (start + len < line.Length)
            {
                var cut = line.LastIndexOfAny(['.', ';', ' '], start + len - 1, len);
                if (cut > start + max / 2) len = cut - start + 1;
            }
            yield return line.Substring(start, len).Trim();
            start += len;
        }
    }

    // ───────────────────────────── Consignes au modèle ─────────────────────────────

    public static string SystemPrompt(string lang)
    {
        var language = lang == "en" ? "anglais" : "français";
        return
            "Tu es analyste en continuité d'activité. À partir d'un EXTRAIT de document d'entreprise, tu relèves " +
            "les éléments dont l'organisation dépend, les liens entre eux, et les risques que le texte décrit.\n" +
            "Renvoie STRICTEMENT un objet JSON, sans aucun texte autour :\n" +
            "{\"entities\":[{\"name\":\"\",\"type\":\"\",\"criticality\":0,\"aliases\":[],\"description\":\"\"}]," +
            "\"relations\":[{\"source\":\"\",\"sourceType\":\"\",\"target\":\"\",\"targetType\":\"\",\"relationType\":\"\",\"confidence\":0.5,\"evidence\":\"\"}]," +
            "\"risks\":[{\"title\":\"\",\"severity\":\"high\",\"detail\":\"\",\"entities\":[],\"evidence\":\"\"}]}\n" +
            "Règles :\n" +
            "1. N'invente rien. Chaque élément, lien ou risque doit figurer dans l'extrait. evidence est une citation exacte et courte (moins de 160 caractères).\n" +
            $"2. Types d'entités autorisés : {string.Join(", ", EntityTypeHints)}.\n" +
            $"3. Types de liens autorisés : {string.Join(", ", RelationTypeHints)}.\n" +
            "4. criticality de 0 à 100 d'après le document (Critique 90, Élevée 75, Modérée 50, Faible 25) ; sans indication, estime selon le rôle décrit.\n" +
            "5. confidence : 0.9 si le texte l'affirme explicitement, 0.6 s'il le suggère fortement, 0.4 pour une déduction raisonnable.\n" +
            "6. Noms : reprends le nom exact et le plus complet du document. Si l'élément figure dans « Noms connus », réutilise EXACTEMENT ce nom. Mets les sigles et variantes dans aliases.\n" +
            "7. Les tableaux sont donnés ligne par ligne, sous la forme « En-tête : valeur ; … » : chaque ligne décrit un élément. Relie-le à ce que ses colonnes indiquent (site, responsable, fournisseur, système, rôle, usage). Exemple : un fournisseur dont le rôle est « Éditeur du Core Banking System » donne le lien Core Banking System SUPPLIED_BY ce fournisseur.\n" +
            "7 bis. Relie chaque élément aux autres éléments nommés dans le document chaque fois que le texte ou une colonne l'indique : un élément sans aucun lien est rarement utile. Ne relie jamais sans appui dans le texte.\n" +
            "7 quater. Un tableau de relations qui relie des identifiants (ID Source, Relation, ID Cible) donne un lien par ligne : écris source et target avec les identifiants tels quels ; ils seront rapprochés des éléments ensuite. N'en fais pas des éléments.\n" +
            "8. Les personnes sont des Person, les postes des Role. Un incident passé est un Incident relié par IMPACTS à ce qu'il a touché.\n" +
            "9. risks : les risques, fragilités ou incidents que le texte décrit ou rend évidents (dépendance unique, absence de secours, personne seule à savoir, fournisseur sans alternative…). Chaque ligne d'un tableau de risques est un risque à reporter (title = son libellé, severity d'après sa criticité). severity : high, medium ou low. Un risque n'est pas une entité.\n" +
            $"10. Rédige description, title et detail en {language}. Garde les noms propres tels quels.\n" +
            "11. Les mentions « fictif », « test », « exemple » ou « données synthétiques » n'empêchent pas l'extraction : analyse le contenu tel qu'il est écrit.\n" +
            "12. Si l'extrait ne contient vraiment rien de pertinent (sommaire, mentions légales), renvoie des listes vides.";
    }

    /// <summary>
    /// Consigne de la seconde passe, dédiée aux liens : une tâche plus étroite
    /// que la première, que les petits modèles réussissent beaucoup mieux. Elle ne
    /// peut relier que des éléments déjà identifiés.
    /// </summary>
    public static string LinksSystemPrompt() =>
        "Tu relies des éléments déjà identifiés dans un extrait de document d'entreprise. " +
        "Renvoie STRICTEMENT du JSON : {\"relations\":[{\"source\":\"\",\"sourceType\":\"\",\"target\":\"\",\"targetType\":\"\",\"relationType\":\"\",\"confidence\":0.5,\"evidence\":\"\"}]}.\n" +
        "Règles :\n" +
        "1. source et target sont recopiés EXACTEMENT depuis la liste des éléments fournie ; jamais d'autre nom. Si l'extrait désigne un élément par un identifiant (APP-001, SRV-002…) figurant entre crochets, écris le nom exact de cet élément.\n" +
        "2. Chaque lien est appuyé par l'extrait : evidence est une citation exacte et courte (moins de 160 caractères).\n" +
        $"3. Types de liens autorisés : {string.Join(", ", RelationTypeHints)}.\n" +
        "4. Cherche d'abord les liens opérationnels, ce sont eux qui révèlent les fragilités : pour chaque activité, processus ou service, les systèmes, fournisseurs et sites dont il a besoin (DEPENDS_ON) ; " +
        "pour chaque système, ce sur quoi il tourne (RUNS_ON), qui le fournit (SUPPLIED_BY), ce qui le secourt (BACKED_UP_BY), qui en est responsable, le maintient ou sait le faire fonctionner (RESPONSIBLE_FOR, MAINTAINS, KNOWS) ; " +
        "pour chaque fournisseur, ce qu'il fournit d'après son rôle ; pour chaque incident, ce qu'il a touché (IMPACTS).\n" +
        "5. Les liens d'organigramme ou de localisation (PART_OF, LOCATED_IN) seulement s'ils sont explicites, et après les liens opérationnels.\n" +
        "6. confidence : 0.9 si le texte l'affirme, 0.6 s'il le suggère fortement, 0.4 pour une déduction raisonnable.\n" +
        "7. Les mentions « fictif » ou « test » n'empêchent rien. Liste vide si aucun lien n'est appuyé par le texte.";

    public static string LinksUserPrompt(DocumentChunk chunk, IEnumerable<NamedEntity> entities)
    {
        var sb = new StringBuilder("Éléments du document (nom exact, type, puis identifiants ou sigles entre crochets) :\n");
        foreach (var e in entities.Take(400))
        {
            sb.Append("- ").Append(e.Name).Append(" (").Append(e.Type).Append(')');
            if (e.Aliases is { Count: > 0 }) sb.Append(" [").Append(string.Join(", ", e.Aliases.Take(4))).Append(']');
            sb.AppendLine();
        }
        sb.AppendLine().AppendLine("Extrait :").AppendLine("\"\"\"").AppendLine(chunk.Text).AppendLine("\"\"\"");
        return sb.ToString();
    }

    public static string UserPrompt(DocumentChunk chunk, int total, IEnumerable<string> knownNames)
    {
        var known = new List<string>();
        var size = 0;
        foreach (var n in knownNames.Where(n => !string.IsNullOrWhiteSpace(n)).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (size + n.Length > 4000 || known.Count >= 250) break;
            known.Add(n); size += n.Length + 2;
        }
        var sb = new StringBuilder();
        if (known.Count > 0) sb.Append("Noms connus : ").AppendLine(string.Join(" | ", known)).AppendLine();
        sb.Append("Extrait ").Append(chunk.Index + 1).Append(" sur ").Append(total);
        if (chunk.Section.Length > 0) sb.Append(", section « ").Append(chunk.Section).Append(" »");
        sb.AppendLine(" :").AppendLine("\"\"\"").AppendLine(chunk.Text).AppendLine("\"\"\"");
        return sb.ToString();
    }

    // ───────────────────────────── Réconciliation ─────────────────────────────

    /// <summary>
    /// Consigne de la passe de réconciliation : repérer les éléments qui désignent
    /// la même chose sous deux noms (forme courte en prose, forme complète dans un
    /// tableau, sigle). Le modèle propose ; le code n'applique que les groupes de
    /// types compatibles (voir Consolidate).
    /// </summary>
    public static string ReconcileSystemPrompt() =>
        "Tu reçois la liste des éléments extraits d'un même document, avec leur type. Certains désignent la même chose " +
        "sous des noms différents (forme courte et forme complète, sigle, variante d'écriture). " +
        "Renvoie STRICTEMENT du JSON : {\"groups\":[[\"nom exact 1\",\"nom exact 2\"]]}. " +
        "Règles : ne regroupe que des éléments qui désignent CERTAINEMENT la même chose ; en cas de doute, ne regroupe pas. " +
        "Deux agences, deux personnes, deux sites, deux fournisseurs ou deux incidents distincts ne se regroupent jamais. " +
        "Recopie les noms exactement. Ne renvoie que des groupes d'au moins deux noms ; liste vide si aucun doublon.";

    public static string ReconcileUserPrompt(IEnumerable<(string Name, string Type)> entities)
        => "Éléments :\n" + string.Join("\n", entities.Take(400).Select(e => $"- {e.Name} ({e.Type})"));

    /// <summary>Groupes de noms proposés comme doublons ; vide si la réponse est inexploitable.</summary>
    public static IReadOnlyList<IReadOnlyList<string>> ParseGroups(string? completion)
    {
        if (string.IsNullOrWhiteSpace(completion)) return [];
        var s = completion.IndexOf('{'); var e = completion.LastIndexOf('}');
        if (s < 0 || e <= s) return [];
        try
        {
            using var doc = JsonDocument.Parse(completion[s..(e + 1)], Lenient);
            if (!doc.RootElement.TryGetProperty("groups", out var g) || g.ValueKind != JsonValueKind.Array) return [];
            return g.EnumerateArray()
                .Where(x => x.ValueKind == JsonValueKind.Array)
                .Select(x => (IReadOnlyList<string>)x.EnumerateArray().Where(n => n.ValueKind == JsonValueKind.String)
                    .Select(n => (n.GetString() ?? "").Trim()).Where(n => n.Length > 0).Distinct().ToList())
                .Where(x => x.Count >= 2).ToList();
        }
        catch (JsonException) { return []; }
    }

    // ───────────────────────────── Lecture de la réponse ─────────────────────────────

    private static readonly JsonDocumentOptions Lenient = new() { AllowTrailingCommas = true, CommentHandling = JsonCommentHandling.Skip };

    /// <summary>Lit la réponse du modèle ; null si elle est inexploitable.</summary>
    public static ChunkExtraction? ParseChunk(string? completion)
    {
        if (string.IsNullOrWhiteSpace(completion)) return null;
        var s = completion.IndexOf('{');
        var e = completion.LastIndexOf('}');
        if (s < 0 || e <= s) return null;
        try
        {
            using var doc = JsonDocument.Parse(completion[s..(e + 1)], Lenient);
            var root = doc.RootElement;
            var entities = Array(root, "entities").Select(x => new RawEntity(
                    Str(x, "name"), OntologyResolver.ResolveEntityType(Str(x, "type")).Name,
                    Math.Clamp(Int(x, "criticality"), 0, 100), Strings(x, "aliases"), NullIfEmpty(Str(x, "description"))))
                .Where(x => x.Name.Length > 0).ToList();
            var relations = Array(root, "relations").Select(x => new RawRelation(
                    Str(x, "source"), OntologyResolver.ResolveEntityType(Str(x, "sourceType")).Name,
                    Str(x, "target"), OntologyResolver.ResolveEntityType(Str(x, "targetType")).Name,
                    (OntologyResolver.TryResolveRelationType(Str(x, "relationType")) ?? Nexus.Domain.Ontology.RelationType.FromName("RELATED_TO").Value).Name,
                    Math.Clamp(Dbl(x, "confidence", 0.5), 0.05, 0.95), Clip(NullIfEmpty(Str(x, "evidence")), 240)))
                .Where(x => x.Source.Length > 0 && x.Target.Length > 0).ToList();
            var risks = Array(root, "risks").Select(x => new RawRisk(
                    Str(x, "title"), Severity(Str(x, "severity")), Str(x, "detail"), Strings(x, "entities"), Clip(NullIfEmpty(Str(x, "evidence")), 240)))
                .Where(x => x.Title.Length > 0).ToList();
            return new ChunkExtraction(entities, relations, risks);
        }
        catch (JsonException) { return null; }
    }

    // ───────────────────────────── Consolidation ─────────────────────────────

    public static DocumentAnalysisResult Consolidate(
        IReadOnlyList<ChunkExtraction> parts,
        IReadOnlyList<GraphEntityRecord> graph,
        IReadOnlyList<GraphEdgeRecord> edges,
        string lang,
        int sections,
        IEnumerable<string>? warnings = null,
        IReadOnlyList<IReadOnlyList<string>>? sameAs = null,
        int? analyzed = null)
    {
        var en = lang == "en";

        // 1. Entités fusionnées par nom normalisé (et par alias).
        var byKey = new Dictionary<string, MergedEntity>();
        var alias = new Dictionary<string, string>();
        MergedEntity? Find(string name)
        {
            var k = Key(name);
            if (byKey.TryGetValue(k, out var m)) return m;
            if (alias.TryGetValue(k, out var a) && byKey.TryGetValue(a, out m)) return m;
            foreach (var k2 in AltKeys(name))
            {
                if (byKey.TryGetValue(k2, out m)) return m;
                if (alias.TryGetValue(k2, out a) && byKey.TryGetValue(a, out m)) return m;
            }
            return null;
        }
        MergedEntity Upsert(string name, string type, int crit, IEnumerable<string> aliases, string? description)
        {
            var m = Find(name);
            if (m is null)
            {
                m = new MergedEntity(name.Trim(), type);
                byKey[Key(name)] = m;
                foreach (var k2 in AltKeys(name)) alias.TryAdd(k2, Key(name));
            }
            m.Mentions++;
            m.Criticality = Math.Max(m.Criticality, crit);
            if (GenericTypes.Contains(m.Type) && !GenericTypes.Contains(type) && type != "Asset") m.Type = type;
            m.Description ??= description;
            foreach (var a in aliases.Where(a => !string.IsNullOrWhiteSpace(a)))
            {
                if (!m.Aliases.Contains(a, StringComparer.OrdinalIgnoreCase) && Key(a) != Key(m.Name)) m.Aliases.Add(a.Trim());
                alias.TryAdd(Key(a), Key(m.Name));
            }
            return m;
        }

        foreach (var p in parts)
            foreach (var e in p.Entities) Upsert(e.Name, e.Type, e.Criticality, e.Aliases, e.Description);

        // 1 bis. Doublons signalés par la réconciliation : fusionnés dans le nom le
        // plus complet, seulement entre types compatibles (même type, ou un type générique).
        foreach (var group in sameAs ?? [])
        {
            var members = group.Select(Find).OfType<MergedEntity>().Distinct().ToList();
            if (members.Count < 2) continue;
            var specific = members.Select(m => m.Type).Where(t => !GenericTypes.Contains(t)).Distinct().ToList();
            if (specific.Count > 1) continue;
            var canon = members.OrderByDescending(m => m.Name.Length).First();
            foreach (var m in members.Where(m => !ReferenceEquals(m, canon)))
            {
                canon.Criticality = Math.Max(canon.Criticality, m.Criticality);
                canon.Mentions += m.Mentions;
                canon.Description ??= m.Description;
                if (GenericTypes.Contains(canon.Type) && specific.Count == 1) canon.Type = specific[0];
                foreach (var a in m.Aliases.Append(m.Name))
                    if (!canon.Aliases.Contains(a, StringComparer.OrdinalIgnoreCase) && Key(a) != Key(canon.Name)) canon.Aliases.Add(a);
                var oldKey = Key(m.Name);
                byKey.Remove(oldKey);
                alias[oldKey] = Key(canon.Name);
                foreach (var k in alias.Where(kv => kv.Value == oldKey).Select(kv => kv.Key).ToList()) alias[k] = Key(canon.Name);
            }
        }

        // 2. Liens : extrémités résolues sur les entités fusionnées (créées au besoin).
        var relations = new Dictionary<(string, string, string), MergedRelation>();
        foreach (var p in parts)
            foreach (var r in p.Relations)
            {
                // Un identifiant de tableau (« APP-001 ») que rien ne définit ne devient
                // pas un élément fantôme : le lien est écarté.
                if ((Find(r.Source) is null && IsBareId(r.Source)) || (Find(r.Target) is null && IsBareId(r.Target))) continue;
                var s = Find(r.Source) ?? Upsert(r.Source, r.SourceType, 0, [], null);
                var t = Find(r.Target) ?? Upsert(r.Target, r.TargetType, 0, [], null);
                if (ReferenceEquals(s, t)) continue;
                var key = (Key(s.Name), Key(t.Name), r.RelationType);
                if (relations.TryGetValue(key, out var existing))
                {
                    existing.Confidence = Math.Max(existing.Confidence, r.Confidence);
                    existing.Evidence ??= r.Evidence;
                }
                else relations[key] = new MergedRelation(s, t, r.RelationType, r.Confidence, r.Evidence);
            }

        // 3. Risques cités : dédoublonnés par titre.
        var risks = new Dictionary<string, RawRisk>();
        foreach (var r in parts.SelectMany(p => p.Risks))
        {
            var k = Key(r.Title);
            if (risks.TryGetValue(k, out var prev))
                risks[k] = prev with
                {
                    Severity = Rank(r.Severity) > Rank(prev.Severity) ? r.Severity : prev.Severity,
                    Entities = prev.Entities.Union(r.Entities, StringComparer.OrdinalIgnoreCase).ToList(),
                    Evidence = prev.Evidence ?? r.Evidence,
                };
            else risks[k] = r;
        }

        // 4. Recoupement avec le graphe en direct.
        var graphIndex = new Dictionary<string, GraphEntityRecord>();
        // Noms exacts d'abord : ils l'emportent sur les alias et les clés secondaires.
        foreach (var g in graph) graphIndex.TryAdd(Key(g.Name), g);
        foreach (var g in graph) foreach (var a in g.Aliases) graphIndex.TryAdd(Key(a), g);
        foreach (var g in graph) foreach (var k2 in AltKeys(g.Name)) graphIndex.TryAdd(k2, g);
        foreach (var m in byKey.Values)
        {
            m.Match = graphIndex.GetValueOrDefault(Key(m.Name))
                ?? AltKeys(m.Name).Select(k => graphIndex.GetValueOrDefault(k)).FirstOrDefault(x => x is not null)
                ?? m.Aliases.Select(a => graphIndex.GetValueOrDefault(Key(a))).FirstOrDefault(x => x is not null);
            if (m.Criticality == 0) m.Criticality = m.Match?.Criticality is > 0 ? m.Match.Criticality : DefaultCriticality(m.Type);
        }

        var graphEdges = new HashSet<(Guid, Guid, string)>(edges.Select(e => (e.Source, e.Target, e.Type.ToUpperInvariant())));
        var candidateRelations = relations.Values.Select(r => new CandidateRelation(
            r.Source.Name, r.Source.Type, r.Target.Name, r.Target.Type, r.Type, Math.Round(r.Confidence, 2), r.Evidence,
            r.Source.Match is not null && r.Target.Match is not null && graphEdges.Contains((r.Source.Match.Id, r.Target.Match.Id, r.Type.ToUpperInvariant()))
                ? "existing" : "new")).ToList();

        var candidateEntities = byKey.Values
            .OrderByDescending(m => m.Criticality).ThenBy(m => m.Name, StringComparer.CurrentCultureIgnoreCase)
            .Select(m => new CandidateEntity(
                m.Name, m.Type, m.Criticality, m.Aliases, m.Description,
                m.Match is null ? "new" : "existing", m.Match?.Id.ToString(), m.Match?.Name, m.Match?.Criticality, m.Mentions))
            .ToList();

        // 5. Constats calculés sur la vue fusionnée (graphe + document).
        var findings = Findings(byKey.Values.ToList(), relations.Values.ToList(), graph, edges, en);

        var stats = new DocumentStats(
            sections, analyzed ?? parts.Count(p => p.Entities.Count > 0 || p.Risks.Count > 0),
            candidateEntities.Count, candidateEntities.Count(e => e.Status == "new"), candidateEntities.Count(e => e.Status == "existing"),
            candidateRelations.Count, candidateRelations.Count(r => r.Status == "new"), candidateRelations.Count(r => r.Status == "existing"),
            risks.Count);

        var orderedRisks = risks.Values.OrderByDescending(r => Rank(r.Severity)).ToList();
        return new DocumentAnalysisResult(stats, candidateEntities, candidateRelations, orderedRisks, findings, (warnings ?? []).ToList());
    }

    private static List<DocumentFinding> Findings(
        List<MergedEntity> doc, List<MergedRelation> docRelations,
        IReadOnlyList<GraphEntityRecord> graph, IReadOnlyList<GraphEdgeRecord> edges, bool en)
    {
        // Nœuds : graphe (clé = id) + éléments nouveaux du document (clé = nom normalisé).
        var name = new Dictionary<string, string>();
        var type = new Dictionary<string, string>();
        foreach (var g in graph) { name[g.Id.ToString()] = g.Name; type[g.Id.ToString()] = g.EntityType; }
        string Node(MergedEntity m) => m.Match?.Id.ToString() ?? "doc:" + Key(m.Name);
        foreach (var m in doc) { name.TryAdd(Node(m), m.Name); type.TryAdd(Node(m), m.Type); }

        var links = edges.Select(e => (S: e.Source.ToString(), T: e.Target.ToString(), Type: e.Type))
            .Concat(docRelations.Select(r => (S: Node(r.Source), T: Node(r.Target), Type: r.Type)))
            .Distinct().ToList();

        var dependents = new Dictionary<string, HashSet<string>>();
        var backedUp = new HashSet<string>();
        var holders = new Dictionary<string, HashSet<string>>();
        void Add(Dictionary<string, HashSet<string>> map, string k, string v)
        {
            if (!map.TryGetValue(k, out var set)) map[k] = set = [];
            set.Add(v);
        }
        foreach (var (s, t, rel) in links)
        {
            if (Dependency.Contains(rel)) Add(dependents, t, s);
            else if (ReverseDependency.Contains(rel)) Add(dependents, s, t);
            if (Redundancy.Contains(rel)) backedUp.Add(s);
            if (HolderToAsset.Contains(rel) && PeopleTypes.Contains(type.GetValueOrDefault(s, ""))) Add(holders, t, s);
            if (AssetToHolder.Contains(rel) && PeopleTypes.Contains(type.GetValueOrDefault(t, ""))) Add(holders, s, t);
        }

        // Ce dont chaque élément dépend. Un élément qui dépend de PLUSIEURS éléments
        // du même type (un produit offert dans neuf agences) a des alternatives :
        // aucun d'eux n'est, pour lui, un point de concentration.
        var dependsOn = new Dictionary<string, HashSet<string>>();
        foreach (var (target, set) in dependents) foreach (var d in set) Add(dependsOn, d, target);
        bool HasAlternative(string dependent, string provider)
            => dependsOn.TryGetValue(dependent, out var ps)
               && ps.Any(p => p != provider && type.GetValueOrDefault(p, "") == type.GetValueOrDefault(provider, ""));

        var touched = doc.Select(Node).ToHashSet();
        var findings = new List<DocumentFinding>();

        foreach (var n in touched)
        {
            if (!dependents.TryGetValue(n, out var all) || backedUp.Contains(n)) continue;
            var deps = all.Where(d => !HasAlternative(d, n)).ToHashSet();
            if (deps.Count < 3) continue;
            var names = deps.Select(d => name.GetValueOrDefault(d, "?")).OrderBy(x => x).ToList();
            var list = string.Join(", ", names.Take(5)) + (names.Count > 5 ? (en ? $" and {names.Count - 5} more" : $" et {names.Count - 5} autre(s)") : "");
            findings.Add(new DocumentFinding("concentration", deps.Count >= 5 ? "high" : "medium",
                en ? $"{Q(name[n])} is a concentration point" : $"{Q(name[n])} est un point de concentration",
                en ? $"{deps.Count} elements depend on it ({list}), and no backup is linked to it, neither in the document as analyzed nor in your graph. If a backup exists, link it (BACKED_UP_BY) to clear this finding."
                   : $"{deps.Count} éléments en dépendent ({list}), et aucun secours ne lui est relié, ni dans le document tel qu'analysé ni dans votre graphe. Si un secours existe, reliez-le (secouru par) pour lever ce constat.",
                [name[n], .. names]));
        }

        // Un élément dont une seule personne (ou fonction) est dépositaire ; regroupé
        // par personne pour qu'une même fragilité n'apparaisse qu'une fois.
        var soleHolder = touched
            .Where(n => holders.TryGetValue(n, out var hs) && hs.Count == 1 && !NotKnowledgeAssets.Contains(type.GetValueOrDefault(n, "")))
            .GroupBy(n => holders[n].First());
        foreach (var g in soleHolder)
        {
            var who = name.GetValueOrDefault(g.Key, "?");
            var assets = g.Select(n => name[n]).OrderBy(x => x).ToList();
            var list = string.Join(", ", assets);
            // Un poste (« Chef d'agence ») peut être tenu par plusieurs personnes :
            // la fragilité est réelle mais moindre, et la formulation doit le dire.
            if (type.GetValueOrDefault(g.Key, "") == "Role")
            {
                findings.Add(new DocumentFinding("key-person", "medium",
                    assets.Count == 1
                        ? (en ? $"{Q(assets[0])} relies on a single role" : $"{Q(assets[0])} repose sur une seule fonction")
                        : (en ? $"{assets.Count} elements rely on the {Q(who)} role alone" : $"{assets.Count} éléments reposent sur la seule fonction {Q(who)}"),
                    en ? $"Only the {Q(who)} role is documented as knowing, maintaining or being responsible for: {list}. Check that several people hold it or are trained for it."
                       : $"Seule la fonction {Q(who)} est documentée comme sachant, maintenant ou étant responsable de : {list}. Vérifiez que plusieurs personnes l'occupent ou y sont formées.",
                    [who, .. assets]));
                continue;
            }
            findings.Add(new DocumentFinding("key-person", "high",
                assets.Count == 1
                    ? (en ? $"{Q(assets[0])} relies on a single person" : $"{Q(assets[0])} repose sur une seule personne")
                    : (en ? $"{assets.Count} elements rely on {Q(who)} alone" : $"{assets.Count} éléments reposent sur {Q(who)} seul"),
                en ? $"{Q(who)} is the only one documented as knowing, maintaining or being responsible for: {list}. An absence or departure leaves no one to take over."
                   : $"{Q(who)} est le seul documenté comme sachant, maintenant ou étant responsable de : {list}. Une absence ou un départ ne laisse personne pour prendre le relais.",
                [who, .. assets]));
        }

        foreach (var m in doc.Where(m => m.Match is { Criticality: > 0 } && Math.Abs(m.Match.Criticality - m.Criticality) >= 30))
        {
            findings.Add(new DocumentFinding("criticality-gap", "medium",
                en ? $"Diverging criticality for {Q(m.Match!.Name)}" : $"Criticité divergente pour {Q(m.Match!.Name)}",
                en ? $"The document suggests {m.Criticality}/100, your graph says {m.Match.Criticality}/100. One of the two deserves review."
                   : $"Le document indique {m.Criticality}/100, votre graphe {m.Match.Criticality}/100. L'une des deux valeurs mérite d'être revue.",
                [m.Match.Name]));
        }

        return findings.OrderByDescending(f => Rank(f.Severity)).ThenBy(f => f.Kind).ToList();
    }

    // ───────────────────────────── Extraction d'une section ─────────────────────────────

    /// <summary>
    /// Analyse une section, avec une seconde tentative si le modèle ne renvoie
    /// rien d'exploitable, ou une réponse vide pour un extrait substantiel : les
    /// petits modèles le font de façon intermittente, et une section perdue est
    /// un pan entier du document qui manque.
    /// </summary>
    public static async Task<ChunkExtraction?> ExtractSectionAsync(
        DocumentChunk chunk, int total, IEnumerable<string> knownNames, string lang,
        Func<string, string, CancellationToken, Task<string?>> complete, CancellationToken ct = default)
    {
        // Lignes de tableau structurées : lues exactement, sans IA.
        var facts = DocumentTables.Read(chunk.Text);
        if (DocumentTables.IsMostlyStructured(chunk.Text, facts)) return facts;

        var system = SystemPrompt(lang);
        var user = UserPrompt(chunk, total, knownNames);
        ChunkExtraction? best = null;
        for (var attempt = 0; attempt < 2; attempt++)
        {
            var parsed = ParseChunk(await complete(system, user, ct));
            if (parsed is not null && (best is null || Size(parsed) > Size(best))) best = parsed;
            if (best is not null && (Size(best) > 0 || chunk.Text.Length < 800)) break;
        }
        if (best is null && Size(facts) == 0) return null;
        return DocumentTables.Merge(best, facts);
    }

    /// <summary>
    /// Seconde passe sur une section : les liens, et seulement eux, entre TOUS les
    /// éléments du document. Indispensable : une phrase de la section 1 (« le Core
    /// Banking dépend du serveur central ») relie souvent des éléments que seul un
    /// tableau de la section 2 nomme complètement. Les liens vers un nom absent de
    /// la liste sont écartés : cette passe ne peut rien inventer.
    /// </summary>
    public static async Task<IReadOnlyList<RawRelation>> ExtractLinksAsync(
        DocumentChunk chunk, IReadOnlyList<NamedEntity> entities,
        Func<string, string, CancellationToken, Task<string?>> complete, CancellationToken ct = default)
    {
        if (entities.Count < 2) return [];
        // Une section faite de lignes structurées a déjà livré ses liens exacts.
        if (DocumentTables.IsMostlyStructured(chunk.Text, DocumentTables.Read(chunk.Text))) return [];
        var parsed = ParseChunk(await complete(LinksSystemPrompt(), LinksUserPrompt(chunk, entities), ct));
        if (parsed is null) return [];

        // Un lien peut viser un élément par son nom OU par un alias (identifiant de
        // tableau comme APP-001, sigle) : il est ramené au nom complet.
        var known = new Dictionary<string, NamedEntity>();
        foreach (var e in entities) known.TryAdd(Key(e.Name), e);
        foreach (var e in entities) foreach (var a in e.Aliases ?? []) known.TryAdd(Key(a), e);
        foreach (var e in entities) foreach (var k in AltKeys(e.Name)) known.TryAdd(k, e);

        var result = new List<RawRelation>();
        foreach (var r in parsed.Relations)
        {
            if (!known.TryGetValue(Key(r.Source), out var s) || !known.TryGetValue(Key(r.Target), out var t) || ReferenceEquals(s, t)) continue;
            // Un dépositaire « responsable de l'organisation entière » n'apprend rien sur les fragilités.
            if (HolderToAsset.Contains(r.RelationType) && t.Type == "Organization") continue;
            result.Add(r with { Source = s.Name, SourceType = s.Type, Target = t.Name, TargetType = t.Type });
        }
        return result;
    }

    /// <summary>Liste dédoublonnée des éléments relevés dans toutes les sections.</summary>
    public static IReadOnlyList<NamedEntity> AllEntities(IEnumerable<ChunkExtraction> parts)
        => parts.SelectMany(p => p.Entities)
            .GroupBy(e => Key(e.Name))
            .Select(g => new NamedEntity(g.First().Name, g.First().Type, g.SelectMany(e => e.Aliases).Distinct(StringComparer.OrdinalIgnoreCase).ToList()))
            .ToList();

    private static int Size(ChunkExtraction x) => x.Entities.Count + x.Relations.Count + x.Risks.Count;

    // ───────────────────────────── Enchaînement complet ─────────────────────────────

    /// <summary>
    /// Analyse tout le document en un appel (section par section, puis
    /// consolidation). Une section qui échoue n'arrête pas l'analyse : elle est
    /// signalée dans les avertissements, et le résultat reste partiel mais honnête.
    /// </summary>
    public static async Task<DocumentAnalysisResult> RunAsync(
        string text,
        Func<string, string, CancellationToken, Task<string?>> complete,
        IReadOnlyList<GraphEntityRecord> graph,
        IReadOnlyList<GraphEdgeRecord> edges,
        string lang,
        CancellationToken ct = default)
    {
        var all = Plan(text);
        var warnings = new List<string>();
        var chunks = all.Take(MaxChunks).ToList();
        if (all.Count > MaxChunks)
            warnings.Add(lang == "en"
                ? $"Very long document: the first {MaxChunks} sections out of {all.Count} were analyzed."
                : $"Document très long : les {MaxChunks} premières sections sur {all.Count} ont été analysées.");

        var known = graph.Select(g => g.Name).ToList();
        var parts = new List<ChunkExtraction>();
        foreach (var c in chunks)
        {
            ct.ThrowIfCancellationRequested();
            var parsed = await ExtractSectionAsync(c, chunks.Count, known, lang, complete, ct);
            if (parsed is null)
            {
                warnings.Add(lang == "en"
                    ? $"Section {c.Index + 1} could not be analyzed (no usable answer from the model)."
                    : $"La section {c.Index + 1} n'a pas pu être analysée (pas de réponse exploitable du modèle).");
                continue;
            }
            parts.Add(parsed);
            known.AddRange(parsed.Entities.Select(e => e.Name));
        }

        // Second temps : les liens, section par section, avec tous les éléments du document.
        var entities = AllEntities(parts);
        var linkParts = new List<ChunkExtraction>();
        foreach (var c in chunks)
        {
            ct.ThrowIfCancellationRequested();
            var links = await ExtractLinksAsync(c, entities, complete, ct);
            if (links.Count > 0) linkParts.Add(new ChunkExtraction([], links, []));
        }

        var groups = await ReconcileAsync(parts, complete, ct);
        return Consolidate([.. parts, .. linkParts], graph, edges, lang, chunks.Count, warnings, groups, analyzed: parts.Count);
    }

    /// <summary>Passe de réconciliation (un appel) quand plusieurs sections ont été analysées.</summary>
    public static async Task<IReadOnlyList<IReadOnlyList<string>>> ReconcileAsync(
        IReadOnlyList<ChunkExtraction> parts, Func<string, string, CancellationToken, Task<string?>> complete, CancellationToken ct)
    {
        var entities = parts.SelectMany(p => p.Entities).Select(e => (e.Name, e.Type))
            .DistinctBy(e => Key(e.Name)).ToList();
        if (parts.Count(p => p.Entities.Count > 0) < 2 || entities.Count < 2) return [];
        try { return ParseGroups(await complete(ReconcileSystemPrompt(), ReconcileUserPrompt(entities), ct)); }
        catch (OperationCanceledException) { throw; }
        catch { return []; }   // la réconciliation améliore le résultat, elle ne doit jamais le bloquer
    }

    // ───────────────────────────── Outils ─────────────────────────────

    /// <summary>Nom entre guillemets, sauf s'il en contient déjà (« Core Banking « OPTIMA » »).</summary>
    private static string Q(string name) => name.Contains('«') ? name : $"« {name} »";

    private sealed class MergedEntity(string name, string type)
    {
        public string Name { get; } = name;
        public string Type { get; set; } = type;
        public int Criticality { get; set; }
        public string? Description { get; set; }
        public List<string> Aliases { get; } = [];
        public int Mentions { get; set; }
        public GraphEntityRecord? Match { get; set; }
    }

    private sealed class MergedRelation(MergedEntity source, MergedEntity target, string type, double confidence, string? evidence)
    {
        public MergedEntity Source { get; } = source;
        public MergedEntity Target { get; } = target;
        public string Type { get; } = type;
        public double Confidence { get; set; } = confidence;
        public string? Evidence { get; set; } = evidence;
    }

    /// <summary>Clé de comparaison : minuscules, sans accents ni ponctuation.</summary>
    public static string Key(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return "";
        var d = TextFold.RemoveDiacritics(value);
        var sb = new StringBuilder(d.Length);
        foreach (var c in d) sb.Append(char.IsLetterOrDigit(c) ? char.ToLowerInvariant(c) : ' ');
        return Regex.Replace(sb.ToString(), @"\s+", " ").Trim();
    }

    /// <summary>Identifiant de tableau seul (APP-001, SRV_002, RSK12…), sans nom lisible.</summary>
    public static bool IsBareId(string? s) => s is not null && Regex.IsMatch(s.Trim(), @"^[A-Za-z]{2,6}[-_ ]?\d{1,5}$");

    private static string StripParens(string s) => Regex.Replace(s, @"\([^)]*\)", " ").Trim();

    /// <summary>
    /// Autres clés sous lesquelles un élément peut être désigné : le nom sans ses
    /// précisions entre parenthèses (« Agence Garoua (Nord) » : « Agence Garoua »),
    /// et le nom propre cité entre guillemets (« Core Banking System « OPTIMA-CBS » » :
    /// « OPTIMA-CBS »). Le contenu des parenthèses n'est jamais une clé : trop générique.
    /// </summary>
    public static IEnumerable<string> AltKeys(string? name)
    {
        if (string.IsNullOrWhiteSpace(name)) yield break;
        var main = Key(name);
        var stripped = Key(StripParens(name));
        if (stripped.Length > 0 && stripped != main) yield return stripped;
        foreach (Match m in Regex.Matches(name, "[«\"“]\\s*([^»\"”]{3,})\\s*[»\"”]"))
        {
            var k = Key(m.Groups[1].Value);
            if (k.Length >= 3 && k != main) yield return k;
        }
    }

    private static int DefaultCriticality(string type) => type switch
    {
        "BusinessProcess" or "BusinessService" => 70,
        "Application" or "System" or "Database" or "Server" or "Network" => 60,
        "Supplier" or "Location" => 55,
        "Person" or "Role" => 50,
        _ => 40,
    };

    private static string Severity(string s) => s.Trim().ToLowerInvariant() switch
    {
        "high" or "élevée" or "elevee" or "critique" or "critical" => "high",
        "low" or "faible" => "low",
        _ => "medium",
    };
    private static int Rank(string s) => s switch { "high" => 3, "medium" => 2, _ => 1 };

    private static IEnumerable<JsonElement> Array(JsonElement root, string prop)
        => root.ValueKind == JsonValueKind.Object && root.TryGetProperty(prop, out var a) && a.ValueKind == JsonValueKind.Array
            ? a.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.Object).ToList() : [];
    private static string Str(JsonElement e, string p) => e.TryGetProperty(p, out var v) && v.ValueKind == JsonValueKind.String ? (v.GetString() ?? "").Trim() : "";
    private static int Int(JsonElement e, string p) => e.TryGetProperty(p, out var v)
        ? v.ValueKind == JsonValueKind.Number && v.TryGetDouble(out var d) ? (int)Math.Round(d)
          : v.ValueKind == JsonValueKind.String && int.TryParse(v.GetString(), out var i) ? i : 0
        : 0;
    private static double Dbl(JsonElement e, string p, double def) => e.TryGetProperty(p, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetDouble(out var d) ? d : def;
    private static IReadOnlyList<string> Strings(JsonElement e, string p) => e.TryGetProperty(p, out var v) && v.ValueKind == JsonValueKind.Array
        ? v.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.String).Select(x => (x.GetString() ?? "").Trim()).Where(x => x.Length > 0).ToList()
        : [];
    private static string? NullIfEmpty(string s) => s.Length == 0 ? null : s;
    private static string? Clip(string? s, int max) => s is null || s.Length <= max ? s : s[..max].TrimEnd() + "…";
}
