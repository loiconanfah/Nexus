using System.Text.Json;
using Nexus.Graph;
using Nexus.Risk;
using Nexus.Risk.Decisions;
using Xunit;

namespace Nexus.Tests.Risk;

/// <summary>
/// Moteur de décision : volontairement testé sur une organisation neutre
/// (facturation, ERP, hébergeur…) — rien n'y est propre à un secteur.
/// </summary>
public class DecisionEngineTests
{
    private static readonly Guid T = Guid.NewGuid();
    private static readonly Guid Billing = Guid.NewGuid(), Sales = Guid.NewGuid();
    private static readonly Guid Erp = Guid.NewGuid(), Db = Guid.NewGuid(), Crm = Guid.NewGuid();
    private static readonly Guid Admin = Guid.NewGuid(), Analyst = Guid.NewGuid(), Host = Guid.NewGuid();

    private static GraphView Org()
    {
        GraphEntityRecord E(Guid id, string type, string name, int crit) => new(id, T, type, name, crit, [], null, "test");
        GraphEdgeRecord R(Guid s, Guid t, string type) => new(Guid.NewGuid(), s, t, type, 0.9, "Imported");
        return GraphView.From(
            [
                E(Billing, "BusinessProcess", "Facturation", 90), E(Sales, "BusinessProcess", "Ventes", 80),
                E(Erp, "Application", "ERP", 85), E(Db, "Database", "Base clients", 80), E(Crm, "Application", "CRM", 70),
                E(Admin, "Role", "Administrateur ERP", 70), E(Analyst, "Role", "Analyste", 40), E(Host, "Supplier", "Hébergeur", 70),
            ],
            [
                R(Billing, Erp, "DEPENDS_ON"), R(Sales, Crm, "DEPENDS_ON"), R(Erp, Db, "DEPENDS_ON"), R(Crm, Db, "DEPENDS_ON"),
                R(Db, Host, "SUPPLIED_BY"), R(Admin, Erp, "MAINTAINS"), R(Admin, Db, "KNOWS"), R(Analyst, Crm, "KNOWS"),
                R(Admin, Erp, "HAS_ACCESS_TO"),
            ]);
    }

    private static readonly DecisionContext Ctx = new("EUR", 20_000_000, 100, "business", 55_000, "FR", ImpactTuning.Default);

    private static DecisionReport Run(DecisionSpec s, string lang = "fr") => new DecisionEngine(Org(), Ctx, lang).Analyze(s);

    [Fact]
    public void Un_depart_du_seul_detenteur_du_savoir_est_signale_comme_bloquant()
    {
        var r = Run(new DecisionSpec(DecisionKinds.Departure, SubjectId: Admin));
        Assert.Contains(r.Findings, f => f.Code == "person.sole-holder" && f.Severity == "danger");
        Assert.Contains(r.Findings, f => f.Code == "person.activities" && f.Nodes.Any(n => n.Name == "Facturation"));
        Assert.True(r.Totals.TransitionRisk > 0);
        Assert.Equal("conditional", r.Verdict);
        Assert.Contains(r.MustKnow, m => m.Contains("Révoquer 1 accès"));
    }

    [Fact]
    public void Le_recouvrement_reduit_le_risque_de_transition()
    {
        var sans = Run(new DecisionSpec(DecisionKinds.Replace, SubjectId: Admin, NewName: "Nouvel administrateur", OverlapMonths: 0));
        var avec = Run(new DecisionSpec(DecisionKinds.Replace, SubjectId: Admin, NewName: "Nouvel administrateur", OverlapMonths: 2));
        Assert.True(avec.Totals.TransitionRisk < sans.Totals.TransitionRisk);
        Assert.Contains(avec.Costs, c => c.Key == "overlap" && c.Source == "profile");
    }

    [Fact]
    public void Un_poste_IA_sans_aucun_systeme_rattache_est_signale()
        => Assert.Contains(Run(new DecisionSpec(DecisionKinds.Hire, NewName: "Data scientist", Serves: [Sales])).Findings, f => f.Code == "hire.ai-no-data");

    [Fact]
    public void Recruter_un_second_detenteur_ameliore_la_resilience()
    {
        var r = Run(new DecisionSpec(DecisionKinds.Hire, NewName: "Second administrateur", Serves: [Billing], Uses: [Erp, Db]));
        Assert.Contains(r.Findings, f => f.Code == "hire.backup");
        Assert.True(r.After.KeyPeople < r.Before.KeyPeople);
        Assert.True(r.After.Score > r.Before.Score);
        Assert.Contains(r.Costs, c => c.Key == "salary" && c.Year1 == 55_000);
    }

    [Fact]
    public void Un_expert_IA_devient_personne_cle_de_ses_outils_et_l_acces_aux_donnees_est_questionne()
    {
        var r = Run(new DecisionSpec(DecisionKinds.Hire, NewName: "Expert IA", Serves: [Sales], Uses: [Crm],
            Tools: [new ToolSpec("Plateforme IA", "AiService", "Fournisseur IA", External: true, OutsideCountry: true, AnnualCost: 12_000)]));
        // Le CRM n'est pas une base de données : l'accès aux données est à vérifier, pas absent.
        Assert.Contains(r.Findings, f => f.Code == "hire.ai-data" && f.Severity == "info");
        // Seul à maîtriser la plateforme dont dépendent les ventes : une nouvelle personne clé.
        Assert.Contains(r.Diff.AddedEdges, e => e.SourceName == "Expert IA" && e.TargetName == "Plateforme IA" && e.Type == "KNOWS");
        Assert.True(r.After.KeyPeople >= r.Before.KeyPeople);
        Assert.Contains(r.Diff.AddedNodes, n => n.Type == "AiProvider");
        Assert.Contains(r.MustKnow, m => m.Contains("hors") && m.Contains("FR"));
        Assert.Contains(r.Costs, c => c.Key == "integration:Plateforme IA" && c.Source == "graph");
    }

    [Fact]
    public void Remplacer_un_outil_compte_les_liaisons_a_refaire_dans_le_graphe()
    {
        var r = Run(new DecisionSpec(DecisionKinds.ReplaceTool, SubjectId: Erp, NewName: "ERP v2", AnnualCost: 30_000, AnnualCostRemoved: 40_000, CutoverHours: 8));
        var blast = Assert.Single(r.Findings, f => f.Code == "replace.blast");
        Assert.Equal(2, blast.Nodes.Count); // Facturation (dépendant) et Base clients (dépendance)
        Assert.Contains(r.Diff.RemovedNodes, n => n.Name == "ERP");
        Assert.Contains(r.Diff.AddedNodes, n => n.Name == "ERP v2");
        Assert.Contains(r.Benefits, b => b.Key == "removed");
        Assert.NotNull(r.Totals.PaybackMonths);
    }

    [Fact]
    public void Sans_element_choisi_le_verdict_est_insuffisant()
        => Assert.Equal("insufficient", Run(new DecisionSpec(DecisionKinds.ReplaceTool)).Verdict);

    [Fact]
    public void Le_rapport_est_deterministe_et_bilingue()
    {
        var spec = new DecisionSpec(DecisionKinds.ChangeSupplier, SubjectId: Host, NewName: "Autre hébergeur", AnnualCost: 10_000, AnnualCostRemoved: 12_000);
        Assert.Equal(JsonSerializer.Serialize(Run(spec)), JsonSerializer.Serialize(Run(spec)));
        Assert.StartsWith("Change supplier", Run(spec, "en").Headline);
    }

    [Theory]
    [InlineData(DecisionKinds.Upgrade)]
    [InlineData(DecisionKinds.OpenSite)]
    [InlineData(DecisionKinds.CloseSite)]
    [InlineData(DecisionKinds.Automate)]
    [InlineData(DecisionKinds.NewTool)]
    public void Tous_les_types_produisent_un_rapport(string kind)
    {
        var r = Run(new DecisionSpec(kind, SubjectId: kind == DecisionKinds.Automate ? Billing : Erp, NewName: "Nouveau", Serves: [Billing], Uses: [Db], HoursSavedPerMonth: 40));
        Assert.Equal(kind, r.Kind);
        Assert.NotEmpty(r.Plan);
        Assert.InRange(r.Confidence, 0.15, 0.95);
    }

    [Fact]
    public void Avec_un_recouvrement_prevu_le_seul_detenteur_devient_un_point_de_vigilance()
    {
        var r = Run(new DecisionSpec(DecisionKinds.Replace, SubjectId: Admin, OverlapMonths: 2));
        Assert.Equal("warning", Assert.Single(r.Findings, f => f.Code == "person.sole-holder").Severity);
        Assert.DoesNotContain(r.Findings, f => f.Severity == "danger");
    }

    [Fact]
    public void Une_criticite_absente_est_remplacee_par_un_defaut_et_signalee()
    {
        var a = Guid.NewGuid(); var b = Guid.NewGuid(); var p = Guid.NewGuid();
        var g = GraphView.From(
            [new(a, T, "BusinessProcess", "Activité", 0, [], null, "csv"), new(b, T, "Application", "Logiciel", 0, [], null, "csv"), new(p, T, "Role", "Gestionnaire", 0, [], null, "csv")],
            [new(Guid.NewGuid(), a, b, "DEPENDS_ON", 0.9, "Imported"), new(Guid.NewGuid(), b, p, "DEPENDS_ON", 0.9, "Imported")]);
        var r = new DecisionEngine(g, Ctx, "fr").Analyze(new DecisionSpec(DecisionKinds.Departure, SubjectId: p));
        Assert.Contains(r.MissingInputs, m => m.StartsWith("Criticité de"));
        // Au plancher (criticité 0), le risque serait dérisoire ; avec le défaut par type il reflète l'activité touchée.
        Assert.True(r.Totals.TransitionRisk > ImpactTuning.Default.CostMinimal * 10);
    }
}
