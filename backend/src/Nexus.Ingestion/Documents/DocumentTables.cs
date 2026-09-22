using System.Globalization;
using System.Text.RegularExpressions;
using Nexus.Ingestion.Normalization;

namespace Nexus.Ingestion.Documents;

/// <summary>
/// Lecture EXACTE, sans IA, des lignes de tableau structurées que produit
/// DocumentTextExtractor (« En-tête : valeur ; … »).
///
/// Une ligne qui porte un identifiant et un nom est un élément ; une ligne qui
/// porte une source, une cible et (souvent) un type de lien est un lien ; un
/// élément de type « risque » est un risque. Sur un classeur de 148 éléments et
/// 391 liens, le modèle n'en recopiait qu'une partie, variable d'un passage à
/// l'autre : ces faits-là n'ont pas besoin d'être interprétés, seulement lus.
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
    private static readonly string[] RiskTypes = ["risque", "risk", "menace"];

    /// <summary>
    /// Verbes de lien courants dans les tableaux français, avec leur sens : pour
    /// « A POSSEDE B », c'est B qui appartient à A (le lien est inversé).
    /// Un verbe inconnu donne un lien neutre (RELATED_TO), jamais une dépendance.
    /// </summary>
    private static readonly Dictionary<string, (string Type, bool Reverse)> Verbs = new()
    {
        ["dependde"] = ("DEPENDS_ON", false), ["depend"] = ("DEPENDS_ON", false), ["alimentepar"] = ("DEPENDS_ON", false),
        ["necessite"] = ("DEPENDS_ON", false), ["reposesur"] = ("DEPENDS_ON", false),
        ["utilise"] = ("USES", false), ["hebergesur"] = ("RUNS_ON", false), ["tournesur"] = ("RUNS_ON", false),
        ["heberge"] = ("HOSTS", false),
        ["fournipar"] = ("SUPPLIED_BY", false), ["fourniepar"] = ("SUPPLIED_BY", false), ["assurepar"] = ("SUPPLIED_BY", false),
        ["fournit"] = ("SUPPLIED_BY", true),
        ["responsablede"] = ("RESPONSIBLE_FOR", false), ["maintient"] = ("MAINTAINS", false), ["connait"] = ("KNOWS", false),
        ["travaillea"] = ("LOCATED_IN", false), ["situea"] = ("LOCATED_IN", false), ["situedans"] = ("LOCATED_IN", false),
        ["baseea"] = ("LOCATED_IN", false), ["basea"] = ("LOCATED_IN", false),
        ["possede"] = ("OWNED_BY", true), ["dirige"] = ("MANAGED_BY", true), ["gere"] = ("MANAGED_BY", true),
        ["exploite"] = ("OPERATED_BY", true), ["offre"] = ("SERVED_BY", true), ["propose"] = ("SERVED_BY", true),
        ["affecte"] = ("IMPACTS", false), ["impacte"] = ("IMPACTS", false), ["survenua"] = ("IMPACTS", false),
        ["protege"] = ("PROTECTS", false), ["couvre"] = ("PROTECTS", false),
        ["sauvegardesur"] = ("BACKED_UP_BY", false), ["sauvegardeesur"] = ("BACKED_UP_BY", false), ["secourupar"] = ("BACKED_UP_BY", false),
        ["repliquede"] = ("BACKED_UP_BY", true), ["seconde"] = ("BACKED_UP_BY", true),
        ["stockeesur"] = ("STORES", true), ["stockesur"] = ("STORES", true), ["stocke"] = ("STORES", false),
        ["documentepar"] = ("DOCUMENTED_BY", false), ["detaille"] = ("DOCUMENTED_BY", true),
        ["declenche"] = ("TRIGGERS", false), ["causepar"] = ("TRIGGERS", true),
        ["faitpartiede"] = ("PART_OF", false), ["appartienta"] = ("PART_OF", false),
    };

    /// <summary>Faits lus directement dans les lignes de tableau d'un extrait.</summary>
    public static ChunkExtraction Read(string text)
    {
        var entities = new List<RawEntity>();
        var relations = new List<RawRelation>();
        var risks = new List<RawRisk>();
        foreach (var raw in text.Split('\n'))
        {
            var line = raw.Trim();
            if (line.Length == 0 || !line.Contains(" : ")) continue;
            var cells = Cells(line);
            if (cells.Count < 2) continue;

            var source = Get(cells, SourceKeys);
            var target = Get(cells, TargetKeys);
            if (source is not null && target is not null)
            {
                var verb = Get(cells, RelationKeys);
                var (type, reverse) = Relation(verb);
                var (s, t) = reverse ? (target, source) : (source, target);
                relations.Add(new RawRelation(s, "Asset", t, "Asset", type, 0.9, Clip(line)));
                continue;
            }

            var id = Get(cells, IdKeys);
            var name = Get(cells, NameKeys);
            if (id is null || name is null) continue;
            var typeText = Get(cells, TypeKeys) ?? "";
            var crit = Criticality(Get(cells, CritKeys));
            var desc = Get(cells, DescKeys);
            if (RiskTypes.Any(r => Fold(typeText).StartsWith(r, StringComparison.Ordinal)))
            {
                risks.Add(new RawRisk(name, crit >= 75 ? "high" : crit >= 45 ? "medium" : "low", desc ?? name, [], Clip(line)));
                continue;
            }
            entities.Add(new RawEntity(name, OntologyResolver.ResolveEntityType(typeText).Name, crit, [id], desc));
        }
        return new ChunkExtraction(entities, relations, risks);
    }

    /// <summary>
    /// Vrai si l'extrait est presque entièrement fait de lignes de tableau lues
    /// exactement : l'envoyer au modèle n'apporterait rien, coûterait du quota et
    /// introduirait de la variabilité.
    /// </summary>
    public static bool IsMostlyStructured(string text, ChunkExtraction facts)
    {
        var lines = text.Split('\n').Select(l => l.Trim())
            .Count(l => l.Length > 0 && !l.StartsWith('#') && !l.StartsWith('[') && !l.StartsWith("Section :", StringComparison.Ordinal));
        var read = facts.Entities.Count + facts.Relations.Count + facts.Risks.Count;
        return lines > 0 && read >= 0.85 * lines;
    }

    /// <summary>Réunit ce que le modèle a proposé et ce qui a été lu exactement.</summary>
    public static ChunkExtraction Merge(ChunkExtraction? model, ChunkExtraction table)
        => model is null
            ? table
            : new ChunkExtraction(
                [.. table.Entities, .. model.Entities],
                [.. table.Relations, .. model.Relations],
                [.. table.Risks, .. model.Risks]);

    private static Dictionary<string, string> Cells(string line)
    {
        var d = new Dictionary<string, string>();
        foreach (var part in line.Split(" ; "))
        {
            var i = part.IndexOf(" : ", StringComparison.Ordinal);
            if (i <= 0) continue;
            var key = Fold(part[..i]);
            var value = part[(i + 3)..].Trim();
            if (key.Length > 0 && value.Length > 0) d.TryAdd(key, value);
        }
        return d;
    }

    private static string? Get(Dictionary<string, string> cells, string[] keys)
    {
        foreach (var k in keys) if (cells.TryGetValue(k, out var v)) return v;
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
