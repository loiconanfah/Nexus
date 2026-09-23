using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using Nexus.Ingestion.Normalization;

namespace Nexus.Ingestion.Documents;

/// <summary>
/// Lecture EXACTE, sans IA, des lignes de tableau structurées que produit
/// DocumentTextExtractor (« En-tête : valeur ; … »).
///
/// Trois principes, tirés de documents réels :
///
/// 1. UN IDENTIFIANT N'EST PAS UN ÉLÉMENT. « APP-CORE-01 » ne dit rien à
///    personne ; « Core banking FiadBank » si. L'identifiant devient un alias,
///    et c'est par lui que les lignes de relations retrouvent l'élément.
/// 2. LA COLONNE DU NOM NE S'APPELLE PAS « Nom ». Elle s'appelle Agence,
///    Composant, Actif, Fournisseur, Processus, Produit, Risque, selon le
///    tableau. On ne la cherche donc pas par son intitulé mais par sa PLACE :
///    c'est la première colonne descriptive qui suit l'identifiant.
/// 3. UNE COLONNE QUI CITE UN IDENTIFIANT EST UNE RELATION. « Suppléant :
///    PER-002 » est une dépendance humaine, « Propriétaire : UNI-IT » un
///    rattachement. C'est là que se trouve l'essentiel des liens d'un document
///    d'entreprise, bien plus que dans sa prose.
///
/// Ces faits n'ont pas besoin d'être interprétés, seulement lus : sur un
/// classeur de 148 éléments et 391 liens, le modèle n'en recopiait qu'une
/// partie, variable d'un passage à l'autre.
/// </summary>
public static class DocumentTables
{
    private static readonly string[] IdKeys = ["id", "code", "identifiant", "reference", "ref"];
    private static readonly string[] NameKeys = ["nom", "name", "libelle", "intitule", "designation", "titre"];
    private static readonly string[] TypeKeys = ["type", "type d element", "type d entite", "nature"];
    private static readonly string[] CritKeys = ["criticite", "criticality", "niveau de criticite", "priorite"];
    private static readonly string[] DescKeys = ["description", "detail", "commentaire", "note"];
    private static readonly string[] SourceKeys = ["id source", "source", "origine", "element source", "code source"];
    private static readonly string[] TargetKeys = ["id cible", "cible", "target", "destination", "element cible", "code cible"];
    private static readonly string[] RelationKeys = ["relation", "type de relation", "type de lien", "lien", "relationship"];

    /// <summary>
    /// Intitulés qui décrivent une PROPRIÉTÉ, jamais le nom de l'élément. Sans
    /// cette liste, « Criticité : Critique » deviendrait le nom d'un actif.
    /// </summary>
    private static readonly HashSet<string> AttributeKeys = new(StringComparer.Ordinal)
    {
        "criticite", "criticality", "priorite", "rto", "rpo", "rto rpo", "sla", "disponibilite", "statut", "etat",
        "effectif", "ville", "site", "localisation", "emplacement", "lieu", "pays", "region",
        "dependances", "dependance", "depend de", "prerequis", "proprietaire", "owner", "responsable",
        "suppleant", "suppleance", "backup", "secours", "remplacant", "unite", "departement", "direction",
        "equipe", "rattachement", "systeme", "systemes", "application", "applications", "fournisseur",
        "prestataire", "editeur", "client cible", "conditions de test", "valeur fictive", "valeur",
        "impact", "controle", "plan", "etapes essentielles", "resultat", "declencheur", "reponse attendue",
        "propagation", "lien principal", "prestation", "substitution", "objet lie", "attributs utiles",
        "exemples synthetiques", "date", "cout", "montant", "duree", "frequence", "version",
    };

    /// <summary>
    /// Colonnes qui DÉSIGNENT un autre élément. Chacune donne un lien quand sa
    /// valeur cite un identifiant. « Reverse » signale que le lien part de la
    /// valeur vers la ligne : un contrôle protège un risque, pas l'inverse.
    /// </summary>
    private static readonly Dictionary<string, (string Type, bool Reverse)> ReferenceColumns = new(StringComparer.Ordinal)
    {
        ["suppleant"] = ("BACKED_UP_BY", false), ["suppleance"] = ("BACKED_UP_BY", false),
        ["backup"] = ("BACKED_UP_BY", false), ["secours"] = ("BACKED_UP_BY", false), ["remplacant"] = ("BACKED_UP_BY", false),
        ["unite"] = ("PART_OF", false), ["departement"] = ("PART_OF", false), ["direction"] = ("PART_OF", false),
        ["equipe"] = ("PART_OF", false), ["rattachement"] = ("PART_OF", false),
        ["proprietaire"] = ("OWNED_BY", false), ["owner"] = ("OWNED_BY", false),
        ["responsable"] = ("MANAGED_BY", false), ["gestionnaire"] = ("MANAGED_BY", false), ["pilote"] = ("MANAGED_BY", false),
        ["dependances"] = ("DEPENDS_ON", false), ["dependance"] = ("DEPENDS_ON", false),
        ["depend de"] = ("DEPENDS_ON", false), ["prerequis"] = ("DEPENDS_ON", false),
        ["systeme"] = ("DEPENDS_ON", false), ["systemes"] = ("DEPENDS_ON", false),
        ["application"] = ("DEPENDS_ON", false), ["applications"] = ("DEPENDS_ON", false),
        ["fournisseur"] = ("SUPPLIED_BY", false), ["prestataire"] = ("SUPPLIED_BY", false), ["editeur"] = ("SUPPLIED_BY", false),
        ["site"] = ("LOCATED_IN", false), ["localisation"] = ("LOCATED_IN", false), ["emplacement"] = ("LOCATED_IN", false),
        ["controle"] = ("PROTECTS", true), ["plan"] = ("PROTECTS", true),
        ["objet lie"] = ("RELATED_TO", false), ["impact"] = ("IMPACTS", false),
    };

    /// <summary>
    /// Verbes de lien, avec leur sens. « A POSSEDE B » : c'est B qui appartient à
    /// A, le lien est donc inversé. Même chose pour « DR backup_for DC » : c'est
    /// le site principal qui est secouru. Un verbe inconnu donne un lien neutre
    /// (RELATED_TO), jamais une dépendance inventée.
    /// </summary>
    private static readonly Dictionary<string, (string Type, bool Reverse)> Verbs = new()
    {
        ["dependde"] = ("DEPENDS_ON", false), ["depend"] = ("DEPENDS_ON", false), ["alimentepar"] = ("DEPENDS_ON", false),
        ["necessite"] = ("DEPENDS_ON", false), ["reposesur"] = ("DEPENDS_ON", false),
        ["dependon"] = ("DEPENDS_ON", false), ["dependson"] = ("DEPENDS_ON", false), ["dependsupon"] = ("DEPENDS_ON", false),
        ["requires"] = ("DEPENDS_ON", false), ["needs"] = ("DEPENDS_ON", false),
        ["utilise"] = ("USES", false), ["uses"] = ("USES", false),
        ["hebergesur"] = ("RUNS_ON", false), ["tournesur"] = ("RUNS_ON", false), ["runson"] = ("RUNS_ON", false),
        ["heberge"] = ("HOSTS", false), ["hosts"] = ("HOSTS", false),
        ["fournipar"] = ("SUPPLIED_BY", false), ["fourniepar"] = ("SUPPLIED_BY", false), ["assurepar"] = ("SUPPLIED_BY", false),
        ["suppliedby"] = ("SUPPLIED_BY", false),
        ["fournit"] = ("SUPPLIED_BY", true), ["supplies"] = ("SUPPLIED_BY", true), ["provides"] = ("SUPPLIED_BY", true),
        ["responsablede"] = ("RESPONSIBLE_FOR", false), ["responsiblefor"] = ("RESPONSIBLE_FOR", false),
        ["maintient"] = ("MAINTAINS", false), ["maintains"] = ("MAINTAINS", false),
        ["connait"] = ("KNOWS", false), ["knows"] = ("KNOWS", false),
        ["travaillea"] = ("LOCATED_IN", false), ["situea"] = ("LOCATED_IN", false), ["situedans"] = ("LOCATED_IN", false),
        ["baseea"] = ("LOCATED_IN", false), ["basea"] = ("LOCATED_IN", false),
        ["locatedat"] = ("LOCATED_IN", false), ["locatedin"] = ("LOCATED_IN", false),
        ["possede"] = ("OWNED_BY", true), ["ownedby"] = ("OWNED_BY", false), ["owns"] = ("OWNED_BY", true),
        ["dirige"] = ("MANAGED_BY", true), ["gere"] = ("MANAGED_BY", true), ["managedby"] = ("MANAGED_BY", false),
        ["exploite"] = ("OPERATED_BY", true), ["operatedby"] = ("OPERATED_BY", false),
        ["offre"] = ("SERVED_BY", true), ["propose"] = ("SERVED_BY", true),
        ["affecte"] = ("IMPACTS", false), ["impacte"] = ("IMPACTS", false), ["impacts"] = ("IMPACTS", false),
        ["survenua"] = ("IMPACTS", false),
        ["protege"] = ("PROTECTS", false), ["couvre"] = ("PROTECTS", false), ["protects"] = ("PROTECTS", false),
        ["mitigates"] = ("PROTECTS", false), ["mitige"] = ("PROTECTS", false), ["reduit"] = ("PROTECTS", false),
        ["sauvegardesur"] = ("BACKED_UP_BY", false), ["sauvegardeesur"] = ("BACKED_UP_BY", false),
        ["secourupar"] = ("BACKED_UP_BY", false), ["backedupby"] = ("BACKED_UP_BY", false),
        ["repliquede"] = ("BACKED_UP_BY", true), ["seconde"] = ("BACKED_UP_BY", true),
        ["backupfor"] = ("BACKED_UP_BY", true), ["backupde"] = ("BACKED_UP_BY", true), ["secours"] = ("BACKED_UP_BY", true),
        ["stockeesur"] = ("STORES", true), ["stockesur"] = ("STORES", true), ["stocke"] = ("STORES", false),
        ["documentepar"] = ("DOCUMENTED_BY", false), ["detaille"] = ("DOCUMENTED_BY", true),
        ["declenche"] = ("TRIGGERS", false), ["causepar"] = ("TRIGGERS", true),
        ["faitpartiede"] = ("PART_OF", false), ["appartienta"] = ("PART_OF", false), ["partof"] = ("PART_OF", false),
        ["supports"] = ("SUPPORTS", false), ["soutient"] = ("SUPPORTS", false),
    };

    /// <summary>
    /// Préfixes d'identifiants, en DERNIER recours : l'intitulé de la colonne et
    /// le titre du tableau priment toujours. Seuls les préfixes sans ambiguïté
    /// figurent ici (SRV veut dire serveur dans un document et service dans un
    /// autre : il n'y est donc pas).
    /// </summary>
    private static readonly Dictionary<string, string> IdPrefixTypes = new(StringComparer.Ordinal)
    {
        ["per"] = "Person", ["emp"] = "Person", ["usr"] = "Person",
        ["frn"] = "Supplier", ["four"] = "Supplier", ["sup"] = "Supplier", ["vnd"] = "Supplier",
        ["rsk"] = "Risk", ["ris"] = "Risk", ["inc"] = "Incident",
        ["prc"] = "BusinessProcess", ["proc"] = "BusinessProcess",
        ["net"] = "Network", ["uni"] = "BusinessUnit", ["ctrl"] = "Control",
        ["app"] = "Application", ["db"] = "Database", ["dc"] = "Location", ["ag"] = "Location",
    };

    private static readonly Regex IdToken = new(@"\b[A-Z][A-Z0-9]{1,9}(?:-[A-Z0-9]{1,9}){1,3}\b", RegexOptions.Compiled);
    private static readonly Regex Caption = new(@"^\[\s*Tableau[^:]*:\s*(.+?)\s*\]$", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    /// <summary>Faits lus directement dans les lignes de tableau d'un extrait.</summary>
    public static ChunkExtraction Read(string text)
    {
        var entities = new List<RawEntity>();
        var relations = new List<RawRelation>();
        var risks = new List<RawRisk>();
        var caption = "";      // titre du tableau courant, indice de type
        var heading = "";      // titre de section courant, indice de dernier recours

        foreach (var raw in text.Split('\n'))
        {
            var line = raw.Trim();
            if (line.Length == 0) continue;
            if (line.StartsWith('#')) { heading = line.TrimStart('#').Trim(); caption = ""; continue; }
            var cap = Caption.Match(line);
            if (cap.Success) { caption = cap.Groups[1].Value; continue; }
            if (!line.Contains(" : ")) continue;

            var cells = Cells(line);
            if (cells.Count < 2) continue;

            // 1. Ligne de relation explicite : source, cible, et souvent un verbe.
            var source = Get(cells, SourceKeys);
            var target = Get(cells, TargetKeys);
            if (source is not null && target is not null)
            {
                var (type, reverse) = Relation(Get(cells, RelationKeys));
                var (s, t) = reverse ? (target, source) : (source, target);
                relations.Add(new RawRelation(Label(s), "Asset", Label(t), "Asset", type, 0.9, Clip(line)));
                continue;
            }

            // 2. Ligne d'élément : un identifiant, puis son nom lisible.
            var row = ReadRow(cells, caption, heading);
            if (row is null) continue;

            if (row.Type == "Risk")
            {
                // Un risque sans niveau declare n'est pas un petit risque : le
                // document a juge utile de l'inscrire. « medium » par defaut, ni
                // minimise ni gonfle.
                risks.Add(new RawRisk(row.Name, row.Criticality >= 75 ? "high" : row.Criticality == 0 || row.Criticality >= 45 ? "medium" : "low",
                    row.Description ?? row.Name, [], Clip(line)));
                // Le risque est AUSSI un élément : sans lui, « ce contrôle couvre
                // ce risque » ne se rattacherait à rien.
            }
            entities.Add(new RawEntity(row.Name, row.Type, row.Criticality, row.Aliases, row.Description));

            // 3. Colonnes qui citent un autre élément : autant de liens.
            foreach (var (key, value) in cells)
            {
                if (!ReferenceColumns.TryGetValue(key, out var link)) continue;
                foreach (Match m in IdToken.Matches(value))
                {
                    var other = m.Value;
                    if (row.Aliases.Contains(other, StringComparer.OrdinalIgnoreCase)) continue;
                    var (s, t) = link.Reverse ? (other, row.Name) : (row.Name, other);
                    relations.Add(new RawRelation(s, "Asset", t, "Asset", link.Type, 0.9, Clip(line)));
                }
            }
        }
        return new ChunkExtraction(entities, relations, risks);
    }

    private sealed record Row(string Name, string Type, int Criticality, List<string> Aliases, string? Description);

    /// <summary>
    /// Lit une ligne d'élément. L'identifiant peut être dans une colonne « ID »,
    /// être une valeur à lui seul (« Unité : UNI-DG »), ou ouvrir une cellule
    /// (« Risque : RSK-001 Panne CORE »). Le nom est la première colonne
    /// descriptive qui suit, quel que soit son intitulé.
    /// </summary>
    private static Row? ReadRow(List<(string Key, string Value)> cells, string caption, string heading)
    {
        string? id = null, name = null, nameHeader = null, idHeader = null;
        var idIndex = -1;
        var bareId = false;

        for (var i = 0; i < cells.Count; i++)
        {
            var (key, value) = cells[i];
            var declared = IdKeys.Contains(key);
            var bare = IsBareIdValue(value);
            if (!declared && !bare && !(i == 0 && StartsWithId(value, out _, out _))) continue;

            if (declared || bare) { id = value.Trim(); idIndex = i; idHeader = key; bareId = !declared; }
            else if (StartsWithId(value, out var lead, out var rest)) { id = lead; idIndex = i; name = rest; nameHeader = key; idHeader = key; }
            if (id is not null) break;
        }
        if (id is null) return null;

        // Un identifiant SEUL dans une cellule peut designer le sujet de la ligne
        // (« Unite : UNI-DG ») ou un element defini ailleurs, dont la ligne ne
        // fait que parler (« Element : APP-CORE-01 ; Scenario : Indisponibilite
        // totale »). Sans cette distinction, un tableau de scenarios REBAPTISE
        // les applications. On n'accepte donc la ligne que si son en-tete nomme
        // une sorte de chose connue.
        if (bareId && name is null && TypeOf(idHeader) == "Asset") return null;
        // Une valeur d'identifiant peut elle-même porter le nom : « RSK-001 Panne CORE ».
        if (name is null && StartsWithId(id, out var head, out var tail) && tail.Length > 1) { id = head; name = tail; }

        if (name is null)
        {
            var explicitName = Get(cells, NameKeys);
            if (explicitName is not null) { name = explicitName; nameHeader = NameKeys.FirstOrDefault(k => cells.Any(c => c.Key == k)); }
        }
        if (name is null)
        {
            for (var i = idIndex + 1; i < cells.Count; i++)
            {
                var (key, value) = cells[i];
                if (AttributeKeys.Contains(key) || ReferenceColumns.ContainsKey(key)) continue;
                if (!LooksLikeLabel(value)) continue;
                name = StartsWithId(value, out _, out var rest) && rest.Length > 1 ? rest : value;
                nameHeader = key;
                break;
            }
        }
        if (name is null || name.Length < 2) return null;

        var aliases = new List<string> { id };
        var crit = Criticality(Get(cells, CritKeys));
        var type = ResolveType(Get(cells, TypeKeys), idHeader, nameHeader, caption, heading, id);
        var desc = Get(cells, DescKeys) ?? Describe(cells, idIndex, nameHeader);
        return new Row(name.Trim(), type, crit, aliases, desc);
    }

    /// <summary>
    /// Type de l'élément. Dans l'ordre : une colonne « Type » si elle existe,
    /// l'intitulé de la colonne du nom (« Fournisseur fictif »), le titre du
    /// tableau (« Infrastructure critique »), celui de la section, et enfin le
    /// préfixe de l'identifiant. Le premier qui donne mieux que « Asset » gagne.
    /// </summary>
    private static string ResolveType(string? declared, string? idHeader, string? nameHeader, string caption, string heading, string id)
    {
        // Un intitule est teste en entier PUIS mot a mot : « Infrastructure
        // critique » ne figure dans aucun referentiel, « infrastructure » si.
        // Le NOM de l'element n'est pas un indice : « Personnel et paie » est une
        // application de paie, pas une personne.
        foreach (var hint in new[] { declared, idHeader, nameHeader, caption, heading })
        {
            var t = TypeOf(hint);
            if (t != "Asset") return t;
        }
        var dash = id.IndexOf('-');
        var prefix = (dash > 0 ? id[..dash] : id).ToLowerInvariant();
        return IdPrefixTypes.TryGetValue(prefix, out var byPrefix) ? byPrefix : "Asset";
    }

    /// <summary>Type deduit d'un intitule, teste en entier puis mot a mot.</summary>
    private static string TypeOf(string? hint)
    {
        if (string.IsNullOrWhiteSpace(hint)) return "Asset";
        var whole = OntologyResolver.ResolveEntityType(hint).Name;
        if (whole != "Asset") return whole;
        foreach (var word in hint.Split([' ', ',', '(', ')', '/', '-'], StringSplitOptions.RemoveEmptyEntries))
        {
            if (word.Length < 3) continue;
            var t = OntologyResolver.ResolveEntityType(word).Name;
            if (t != "Asset") return t;
            // Les referentiels sont au singulier ; les titres de tableaux au pluriel.
            if (word.Length > 4 && (word[^1] == 's' || word[^1] == 'S'))
            {
                t = OntologyResolver.ResolveEntityType(word[..^1]).Name;
                if (t != "Asset") return t;
            }
        }
        return "Asset";
    }

    /// <summary>
    /// Description : les autres colonnes de la ligne, telles quelles. C'est ce
    /// qui rend un actif compréhensible dans l'écran, au lieu d'un nom seul.
    /// </summary>
    private static string? Describe(List<(string Key, string Value)> cells, int idIndex, string? nameHeader)
    {
        var sb = new StringBuilder();
        for (var i = 0; i < cells.Count; i++)
        {
            if (i == idIndex) continue;
            var (key, value) = cells[i];
            if (key == nameHeader || IdKeys.Contains(key)) continue;
            if (sb.Length > 0) sb.Append(" ; ");
            sb.Append(char.ToUpperInvariant(key[0])).Append(key.AsSpan(1)).Append(" : ").Append(value);
            if (sb.Length > 240) break;
        }
        return sb.Length == 0 ? null : Clip(sb.ToString());
    }

    /// <summary>Un identifiant seul en valeur de cellule : « UNI-DG », « PER-002 ».</summary>
    private static bool IsBareIdValue(string value)
    {
        var v = value.Trim();
        return v.Length <= 24 && IdToken.IsMatch(v) && IdToken.Match(v).Value.Length == v.Length;
    }

    /// <summary>Un identifiant en tête de valeur : « PER-001 Amina Ngono ».</summary>
    private static bool StartsWithId(string value, out string id, out string rest)
    {
        id = ""; rest = "";
        var v = value.Trim();
        var m = IdToken.Match(v);
        if (!m.Success || m.Index != 0) return false;
        id = m.Value;
        rest = v[m.Length..].Trim(' ', ':', '-', '—');
        return true;
    }

    /// <summary>Un nom, pas une mesure : ni un nombre, ni une durée, ni un pourcentage.</summary>
    private static bool LooksLikeLabel(string value)
    {
        var v = value.Trim();
        if (v.Length < 2 || v.Length > 160) return false;
        if (char.IsDigit(v[0])) return false;
        if (!v.Any(char.IsLetter)) return false;
        return true;
    }

    /// <summary>Un identifiant suivi d'un libellé est ramené à son identifiant.</summary>
    private static string Label(string value)
        => StartsWithId(value, out var id, out var rest) && rest.Length > 1 ? id : value.Trim();

    /// <summary>
    /// Vrai si l'extrait est presque entièrement fait de lignes de tableau lues
    /// exactement : l'envoyer au modèle n'apporterait rien, coûterait du quota et
    /// introduirait de la variabilité.
    /// </summary>
    public static bool IsMostlyStructured(string text, ChunkExtraction facts)
    {
        // On compte les LIGNES lues, pas les faits : une ligne de tableau en
        // produit souvent trois, ce qui suffisait à faire passer pour
        // « entièrement structurée » une section à moitié rédigée, dont la prose
        // n'était alors plus analysée du tout.
        _ = facts;
        var total = 0;
        var used = 0;
        foreach (var raw in text.Split('\n'))
        {
            var line = raw.Trim();
            if (line.Length == 0 || line.StartsWith('#') || line.StartsWith('[')
                || line.StartsWith("Section :", StringComparison.Ordinal)) continue;
            total++;
            var one = Read(line);
            if (one.Entities.Count + one.Relations.Count + one.Risks.Count > 0) used++;
        }
        return total > 0 && used >= 0.85 * total;
    }

    /// <summary>Réunit ce que le modèle a proposé et ce qui a été lu exactement.</summary>
    public static ChunkExtraction Merge(ChunkExtraction? model, ChunkExtraction table)
        => model is null
            ? table
            : new ChunkExtraction(
                [.. table.Entities, .. model.Entities],
                [.. table.Relations, .. model.Relations],
                [.. table.Risks, .. model.Risks]);

    /// <summary>Cellules de la ligne, DANS L'ORDRE : la place d'une colonne porte du sens.</summary>
    private static List<(string Key, string Value)> Cells(string line)
    {
        var list = new List<(string, string)>();
        foreach (var part in line.Split(" ; "))
        {
            var i = part.IndexOf(" : ", StringComparison.Ordinal);
            if (i <= 0) continue;
            var key = Fold(part[..i]);
            var value = part[(i + 3)..].Trim();
            if (key.Length > 0 && value.Length > 0) list.Add((key, value));
        }
        return list;
    }

    private static string? Get(List<(string Key, string Value)> cells, string[] keys)
    {
        foreach (var k in keys)
            foreach (var c in cells)
                if (c.Key == k) return c.Value;
        return null;
    }

    private static (string Type, bool Reverse) Relation(string? verb)
    {
        if (string.IsNullOrWhiteSpace(verb)) return ("RELATED_TO", false);
        var norm = new string(Fold(verb).Where(char.IsLetterOrDigit).ToArray());
        if (Verbs.TryGetValue(norm, out var v)) return v;
        var known = OntologyResolver.TryResolveRelationType(verb);
        return (known?.Name ?? "RELATED_TO", false);
    }

    /// <summary>Critique 90, Élevée 75, Modérée 50, Faible 25 ; un nombre est pris tel quel.</summary>
    private static int Criticality(string? v)
    {
        if (string.IsNullOrWhiteSpace(v)) return 0;
        if (double.TryParse(v.Replace(',', '.').TrimEnd('%', ' '), NumberStyles.Float, CultureInfo.InvariantCulture, out var n))
            return (int)Math.Clamp(n <= 5 ? n * 20 : n, 0, 100);
        var f = Fold(v);
        if (f.StartsWith("crit")) return 90;
        if (f.StartsWith("elev") || f.StartsWith("haut") || f.StartsWith("high")) return 75;
        if (f.StartsWith("mod") || f.StartsWith("moy") || f.StartsWith("med")) return 50;
        if (f.StartsWith("faib") || f.StartsWith("bas") || f.StartsWith("low")) return 25;
        return 0;
    }

    private static string Fold(string s) => Regex.Replace(TextFold.RemoveDiacritics(s).ToLowerInvariant().Replace('’', '\''), @"[^a-z0-9]+", " ").Trim();
    private static string Clip(string s) => s.Length <= 240 ? s : s[..240].TrimEnd() + "…";
}
