using Nexus.Graph;
using Nexus.Risk;

namespace Nexus.Tests.Risk;

/// <summary>
/// Le rattachement des personnes aux systèmes, tel que les documents
/// d'entreprise l'écrivent vraiment. Ces cas viennent du référentiel FIADEC, où
/// l'écran de dépendance humaine restait vide : le document n'écrit jamais
/// « Samuel connaît le core banking », il écrit « l'unité informatique a pour
/// responsable Samuel » et « le core banking appartient à l'unité informatique ».
/// </summary>
public class HumanKnowledgeMapTests
{
    private static GraphEntityRecord E(string name, string type, string? description = null, int crit = 50)
        => new(Guid.NewGuid(), Guid.Empty, type, name, crit, [], description, null);

    private static GraphEdgeRecord R(GraphEntityRecord s, GraphEntityRecord t, string type)
        => new(Guid.NewGuid(), s.Id, t.Id, type, 0.9, "Imported");

    [Fact]
    public void Le_lien_direct_dans_le_sens_habituel_est_lu()
    {
        var person = E("Samuel Etoa", "Person");
        var app = E("Core banking FiadBank", "Application");
        var holds = HumanKnowledgeMap.Build([person, app], [R(person, app, "KNOWS")]);

        var h = Assert.Single(holds);
        Assert.Equal(person.Id, h.PersonId);
        Assert.Equal(app.Id, h.SystemId);
        Assert.True(h.Direct);
    }

    [Fact]
    public void Le_lien_ecrit_A_L_ENVERS_par_le_document_est_lu_aussi()
    {
        // « Cette application a pour responsable cette personne » : la personne
        // est la CIBLE. C'est ainsi que les référentiels l'écrivent, et c'était
        // précisément ce que l'écran ignorait.
        var person = E("Boris Kamdem", "Person");
        var app = E("Mobile banking et USSD", "Application");
        var holds = HumanKnowledgeMap.Build([person, app], [R(app, person, "MANAGED_BY")]);

        var h = Assert.Single(holds);
        Assert.Equal(person.Id, h.PersonId);
        Assert.Equal(app.Id, h.SystemId);
        Assert.True(h.Direct);
    }

    [Fact]
    public void Le_rattachement_par_l_unite_est_etabli_et_marque_indirect()
    {
        // Le cas FIADEC : l'application appartient à une unité, l'unité a un
        // responsable. Aucun lien direct n'existe, et la dépendance est réelle.
        var person = E("Samuel Etoa", "Person", "Poste : Responsable informatique ; Unite : UNI-IT");
        var unit = E("Systemes et securite", "BusinessUnit");
        var app = E("Core banking FiadBank", "Application", crit: 90);

        var holds = HumanKnowledgeMap.Build([person, unit, app],
            [R(app, unit, "OWNED_BY"), R(unit, person, "MANAGED_BY")]);

        var h = Assert.Single(holds);
        Assert.Equal(person.Id, h.PersonId);
        Assert.Equal(app.Id, h.SystemId);
        Assert.False(h.Direct);
        Assert.Contains("Systemes et securite", h.Via);
    }

    [Fact]
    public void Un_lien_direct_l_emporte_sur_le_meme_rattachement_deduit()
    {
        var person = E("Samuel Etoa", "Person");
        var unit = E("Systemes et securite", "BusinessUnit");
        var app = E("Core banking FiadBank", "Application");

        var holds = HumanKnowledgeMap.Build([person, unit, app],
            [R(person, app, "MAINTAINS"), R(app, unit, "OWNED_BY"), R(unit, person, "MANAGED_BY")]);

        var h = Assert.Single(holds);
        Assert.True(h.Direct);
    }

    [Fact]
    public void On_ne_connait_pas_une_unite_ni_un_risque()
    {
        var person = E("Amina Ngono", "Person");
        var unit = E("Gouvernance et arbitrage", "BusinessUnit");
        var risk = E("Panne CORE", "Risk");
        var other = E("Patrice Mbarga", "Person");

        var holds = HumanKnowledgeMap.Build([person, unit, risk, other],
            [R(unit, person, "MANAGED_BY"), R(risk, person, "MANAGED_BY"), R(other, person, "MANAGED_BY")]);

        Assert.Empty(holds);
    }

    [Fact]
    public void Le_metier_est_lu_dans_la_ligne_du_document()
    {
        Assert.Equal("Responsable informatique",
            HumanKnowledgeMap.Job("Poste : Responsable informatique ; Unite : UNI-IT ; Suppleant : PER-007"));
        Assert.Equal("Cheffe agence Douala",
            HumanKnowledgeMap.Job("Unite : UNI-OPS ; Poste : Cheffe agence Douala"));
        Assert.Equal("Credit analyst", HumanKnowledgeMap.Job("Title : Credit analyst ; Unit : UNIT-CRE"));
        Assert.Null(HumanKnowledgeMap.Job("Unite : UNI-IT ; Suppleant : PER-007"));
        Assert.Null(HumanKnowledgeMap.Job(null));
    }

    [Fact]
    public void Deux_personnes_sur_le_meme_systeme_ne_sont_pas_une_personne_cle()
    {
        var a = E("Samuel Etoa", "Person");
        var b = E("Boris Kamdem", "Person");
        var app = E("Core banking FiadBank", "Application");

        var holds = HumanKnowledgeMap.Build([a, b, app], [R(a, app, "MAINTAINS"), R(b, app, "MAINTAINS")]);

        Assert.Equal(2, holds.Count);
        Assert.Equal(2, holds.Select(h => h.PersonId).Distinct().Count());
        Assert.Single(holds.Select(h => h.SystemId).Distinct());
    }
}
