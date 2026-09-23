using Nexus.Graph;
using Nexus.Risk.Spof;

namespace Nexus.Risk.Reporting;

/// <summary>Une part de l'indice : son score, son poids, ce qui l'explique, où agir.</summary>
public sealed record IndexPart(string Key, int Score, int Weight, string Label, string Detail, string Route);

/// <summary>L'indice et ses parts, avec l'écart depuis le dernier relevé.</summary>
public sealed record ResilienceScore(int Total, IReadOnlyList<IndexPart> Parts, string Summary);

/// <summary>
/// Indice de résilience : ce que vaut la cartographie, en un nombre qui BOUGE
/// quand on travaille.
///
/// Le score de santé existant ne regarde que la gravité des cinq points uniques
/// les plus lourds. Conséquence : valider quarante dépendances, importer deux
/// cents actifs ou rafraîchir une carte vieillissante ne change RIEN à l'écran.
/// Le travail le plus utile était le seul à ne pas se voir.
///
/// Quatre parts, chacune calculée sur des faits et décomposable devant un
/// auditeur, chacune reliée à l'écran où l'on agit dessus :
///   1. Couverture       les actifs reliés à quelque chose ; un actif isolé
///                       n'entre dans aucune propagation, donc dans aucun chiffrage.
///   2. Vérification     les dépendances confirmées par un humain.
///   3. Points uniques   ce qui tombe seul et emporte le reste.
///   4. Fraîcheur        la confiance décote avec le temps ; une carte jamais
///                       rafraîchie le dit d'elle-même.
/// </summary>
public static class ResilienceIndex
{
    public static ResilienceScore Compute(
        IReadOnlyList<GraphEntityRecord> entities,
        IReadOnlyList<GraphEdgeRecord> relations,
        IReadOnlyList<SpofResult> spofs,
        string lang = "fr")
    {
        var en = lang == "en";
        if (entities.Count == 0)
            return new ResilienceScore(0, [], en
                ? "Nothing to measure yet: import your systems to get a first index."
                : "Rien à mesurer pour l'instant : importez vos systèmes pour obtenir un premier indice.");

        // 1. Couverture.
        var linked = new HashSet<Guid>();
        foreach (var r in relations) { linked.Add(r.Source); linked.Add(r.Target); }
        var covered = entities.Count(e => linked.Contains(e.Id));
        var coverage = Pct(covered, entities.Count);

        // 2. Vérification.
        var verified = relations.Count(r => string.Equals(r.Status, "Verified", StringComparison.OrdinalIgnoreCase));
        var verification = relations.Count == 0 ? 0 : Pct(verified, relations.Count);

        // 3. Points uniques. Un point unique critique pèse plus lourd qu'un
        //    point unique modéré : la pénalité suit la gravité, pas le nombre.
        var criticalSpofs = spofs.Count(s => s.Score >= 80);
        var highSpofs = spofs.Count(s => s.Score is >= 60 and < 80);
        var spofScore = relations.Count == 0 ? 0 : Math.Clamp(100 - (12 * criticalSpofs + 5 * highSpofs), 0, 100);

        // 4. Fraîcheur : la confiance porte déjà la décote d'ancienneté.
        var freshness = relations.Count == 0 ? 0 : (int)Math.Round(relations.Average(r => r.Confidence) * 100);

        var parts = new List<IndexPart>
        {
            new("coverage", coverage, 25,
                en ? "Coverage" : "Couverture",
                en ? $"{covered} of {entities.Count} assets are connected to something"
                   : $"{covered} actifs sur {entities.Count} sont reliés à quelque chose",
                "/inference"),
            new("verification", verification, 30,
                en ? "Verification" : "Vérification",
                en ? $"{verified} of {relations.Count} dependencies confirmed by a person"
                   : $"{verified} dépendances sur {relations.Count} confirmées par un humain",
                "/audit"),
            new("spof", spofScore, 25,
                en ? "Single points of failure" : "Points uniques de défaillance",
                en ? $"{criticalSpofs} critical, {highSpofs} high, with no alternative"
                   : $"{criticalSpofs} critiques, {highSpofs} élevés, sans solution de secours",
                "/risks"),
            new("freshness", freshness, 20,
                en ? "Freshness" : "Fraîcheur",
                en ? $"Average confidence {freshness}%, it decays as evidence ages"
                   : $"Confiance moyenne {freshness} %, elle décote à mesure que les preuves vieillissent",
                "/audit"),
        };

        var total = (int)Math.Round(parts.Sum(p => (double)p.Score * p.Weight) / parts.Sum(p => p.Weight));
        return new ResilienceScore(total, parts, Summarize(total, parts, en));
    }

    /// <summary>La phrase qui nomme la part la plus faible : c'est là qu'est le prochain geste utile.</summary>
    private static string Summarize(int total, List<IndexPart> parts, bool en)
    {
        var weakest = parts.OrderBy(p => p.Score).First();
        var band = total >= 75 ? (en ? "solid" : "solide")
            : total >= 50 ? (en ? "workable" : "correcte")
            : (en ? "fragile" : "fragile");
        return en
            ? $"Your map is {band}. The weakest link is {weakest.Label.ToLowerInvariant()}: {weakest.Detail}."
            : $"Votre cartographie est {band}. Le maillon le plus faible est « {weakest.Label.ToLowerInvariant()} » : {weakest.Detail}.";
    }

    private static int Pct(int part, int whole) => whole == 0 ? 0 : (int)Math.Round(100.0 * part / whole);
}
