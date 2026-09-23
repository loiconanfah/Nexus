using Nexus.Graph;
using Nexus.Risk.Reporting;
using Nexus.Risk.Spof;

namespace Nexus.Tests.Risk;

/// <summary>
/// L'indice doit BOUGER quand l'utilisateur travaille : c'est sa raison d'être.
/// Le score de santé existant ne regardait que la gravité des points uniques,
/// si bien que valider des dépendances ou relier des actifs isolés ne changeait
/// rien à l'écran.
/// </summary>
public class ResilienceIndexTests
{
    private static GraphEntityRecord Entity(string name, int crit = 50)
        => new(Guid.NewGuid(), Guid.Empty, "Application", name, crit, [], null, null);

    private static GraphEdgeRecord Edge(Guid s, Guid t, string status, double confidence)
        => new(Guid.NewGuid(), s, t, "DEPENDS_ON", confidence, status);

    [Fact]
    public void Un_graphe_vide_ne_pretend_rien()
    {
        var score = ResilienceIndex.Compute([], [], []);
        Assert.Equal(0, score.Total);
        Assert.Empty(score.Parts);
        Assert.Contains("importez", score.Summary, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Valider_des_dependances_fait_monter_l_indice()
    {
        var a = Entity("Core banking");
        var b = Entity("Base transactions");
        var avant = ResilienceIndex.Compute([a, b], [Edge(a.Id, b.Id, "Imported", 0.7)], []);
        var apres = ResilienceIndex.Compute([a, b], [Edge(a.Id, b.Id, "Verified", 0.99)], []);

        Assert.True(apres.Total > avant.Total,
            $"l'indice doit monter après validation ({avant.Total} puis {apres.Total})");
        Assert.Equal(100, apres.Parts.Single(p => p.Key == "verification").Score);
    }

    [Fact]
    public void Relier_un_actif_isole_fait_monter_la_couverture()
    {
        var a = Entity("Core banking");
        var b = Entity("Base transactions");
        var orphelin = Entity("Serveur de test");

        var avec = ResilienceIndex.Compute([a, b, orphelin], [Edge(a.Id, b.Id, "Imported", 0.7)], []);
        var sans = ResilienceIndex.Compute([a, b], [Edge(a.Id, b.Id, "Imported", 0.7)], []);

        Assert.Equal(67, avec.Parts.Single(p => p.Key == "coverage").Score);
        Assert.Equal(100, sans.Parts.Single(p => p.Key == "coverage").Score);
    }

    [Fact]
    public void Un_point_unique_critique_pese_plus_qu_un_point_unique_modere()
    {
        var a = Entity("Core banking");
        var b = Entity("Base transactions");
        var edges = new[] { Edge(a.Id, b.Id, "Verified", 0.9) };

        var critique = ResilienceIndex.Compute([a, b], edges, [new SpofResult(b, 3, 5, 95)]);
        var eleve = ResilienceIndex.Compute([a, b], edges, [new SpofResult(b, 3, 5, 65)]);

        Assert.True(critique.Total < eleve.Total);
        Assert.Equal(88, critique.Parts.Single(p => p.Key == "spof").Score);
        Assert.Equal(95, eleve.Parts.Single(p => p.Key == "spof").Score);
    }

    [Fact]
    public void La_fraicheur_suit_la_confiance_qui_decote()
    {
        var a = Entity("Core banking");
        var b = Entity("Base transactions");
        var fraiche = ResilienceIndex.Compute([a, b], [Edge(a.Id, b.Id, "Verified", 0.98)], []);
        var ancienne = ResilienceIndex.Compute([a, b], [Edge(a.Id, b.Id, "Verified", 0.40)], []);

        Assert.Equal(98, fraiche.Parts.Single(p => p.Key == "freshness").Score);
        Assert.Equal(40, ancienne.Parts.Single(p => p.Key == "freshness").Score);
        Assert.True(fraiche.Total > ancienne.Total);
    }

    [Fact]
    public void La_phrase_nomme_le_maillon_le_plus_faible_et_ou_agir()
    {
        var a = Entity("Core banking");
        var b = Entity("Base transactions");
        // Tout est bon sauf la vérification : c'est elle qui doit être nommée.
        var score = ResilienceIndex.Compute([a, b], [Edge(a.Id, b.Id, "Imported", 0.95)], []);

        Assert.Contains("vérification", score.Summary, StringComparison.OrdinalIgnoreCase);
        Assert.Equal("/audit", score.Parts.Single(p => p.Key == "verification").Route);
    }

    [Fact]
    public void Chaque_part_porte_son_poids_et_le_total_en_decoule()
    {
        var a = Entity("A");
        var b = Entity("B");
        var score = ResilienceIndex.Compute([a, b], [Edge(a.Id, b.Id, "Verified", 1.0)], []);

        Assert.Equal(100, score.Parts.Sum(p => p.Weight));
        var expected = (int)Math.Round(score.Parts.Sum(p => (double)p.Score * p.Weight) / 100);
        Assert.Equal(expected, score.Total);
    }
}
