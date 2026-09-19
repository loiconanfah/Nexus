using Nexus.AI;
using Nexus.AI.Decisions;
using Nexus.Graph;
using Nexus.Risk;
using Nexus.Risk.Decisions;
using Xunit;

namespace Nexus.Tests.Risk;

public class DecisionAssistantTests
{
    private static readonly Guid T = Guid.NewGuid();
    private static readonly Guid Billing = Guid.NewGuid(), Erp = Guid.NewGuid(), Db = Guid.NewGuid(), Admin = Guid.NewGuid();

    private static GraphView Org() => GraphView.From(
        [
            new(Billing, T, "BusinessProcess", "Facturation", 90, [], null, "t"),
            new(Erp, T, "Application", "ERP", 85, [], null, "t"),
            new(Db, T, "Database", "Base clients", 80, [], null, "t"),
            new(Admin, T, "Role", "Administrateur ERP", 70, [], null, "t"),
        ],
        [
            new(Guid.NewGuid(), Billing, Erp, "DEPENDS_ON", 0.9, "Imported"),
            new(Guid.NewGuid(), Erp, Db, "DEPENDS_ON", 0.9, "Imported"),
            new(Guid.NewGuid(), Admin, Erp, "MAINTAINS", 0.9, "Imported"),
        ]);

    private static readonly DecisionContext Ctx = new("EUR", 20_000_000, 100, "business", null, "FR", ImpactTuning.Default);

    private sealed class FakeChat(string? answer) : IChatCompletion
    {
        public bool IsConfigured => answer is not null;
        public string? LastUser { get; private set; }
        public Task<string?> CompleteAsync(string system, string user, CancellationToken ct = default) { LastUser = user; return Task.FromResult(answer); }
    }

    [Fact]
    public async Task Sans_IA_le_graphe_complete_les_systemes_et_revele_des_angles_morts()
    {
        var d = await new DecisionAssistant(new FakeChat(null)).PrepareAsync("Recruter un analyste pour la Facturation", Org(), Ctx, "retail", "fr", default);
        Assert.False(d.UsedAi);
        Assert.Equal(DecisionKinds.Hire, d.Spec.Kind);
        Assert.Contains(Billing, d.Spec.Serves!);
        // La facturation s'appuie sur l'ERP : il est proposé, avec sa justification.
        Assert.Contains(Erp, d.Spec.Uses!);
        var s = Assert.Single(d.Suggestions, x => x.Field == "uses");
        Assert.Equal("graph", s.Source);
        Assert.Contains("ERP", s.Reason);
        Assert.Contains("uses", d.Spec.Suggested!);
        // Angle mort : la facturation dépend aussi de la base clients (point unique), non traitée.
        var chain = Assert.Single(d.BlindSpots, b => b.Id.StartsWith("graph:chain:"));
        Assert.Equal("Base clients", Assert.Single(chain.Nodes).Name);
        Assert.Equal(Db, Assert.Single(chain.Patch!.AddIds!));
        // Salaire pré-rempli depuis le profil, signalé comme suggestion.
        Assert.Equal(70_000, d.Spec.AnnualSalary);
        Assert.Contains(d.Suggestions, x => x.Field == "annualSalary" && x.Source == "graph");
    }

    [Fact]
    public async Task Remplacer_le_seul_detenteur_propose_un_recouvrement()
    {
        var d = await new DecisionAssistant(new FakeChat(null)).PrepareAsync("Remplacer l'Administrateur ERP", Org(), Ctx, null, "fr", default);
        Assert.Equal(DecisionKinds.Replace, d.Spec.Kind);
        Assert.Equal(Admin, d.Spec.SubjectId);
        Assert.NotNull(d.Spec.OverlapMonths);
        Assert.Contains(d.Suggestions, x => x.Field == "overlapMonths" && x.Source == "graph");
    }

    [Fact]
    public async Task L_IA_complete_les_champs_propose_des_angles_morts_et_n_invente_aucun_element()
    {
        const string json = """
        {"kind":"hire","newName":"Expert IA","serves":["Facturation"],"uses":["ERP"],
         "tools":[{"name":"Plateforme ML","type":"AiService","external":true,"annualCost":24000}],
         "values":{"annualSalary":72000,"expectedAnnualGain":90000},
         "reasons":{"annualSalary":"Salaire de marché pour ce profil","tools":"Il lui faut un environnement de modèles","expectedAnnualGain":"Moins d'erreurs de facturation"},
         "understanding":"Automatiser la détection d'anomalies de facturation.",
         "blindSpots":[
           {"severity":"warning","title":"Accès aux données clients","detail":"Le modèle aura besoin de l'historique client.","question":"Qui autorise l'accès ?","nodes":["Base clients","Serveur fantôme"],"patch":{"field":"uses","value":["Base clients"]}},
           {"severity":"info","title":"Sans objet","detail":"x","nodes":[],"patch":{"field":"uses","value":["Élément inventé"]}}
         ]}
        """;
        var chat = new FakeChat(json);
        var d = await new DecisionAssistant(chat).PrepareAsync("On veut un expert IA pour fiabiliser la facturation", Org(), Ctx, "retail", "fr", default);

        Assert.True(d.UsedAi);
        Assert.Equal("Automatiser la détection d'anomalies de facturation.", d.Understanding);
        Assert.Equal(72000, d.Spec.AnnualSalary);
        Assert.Single(d.Spec.Tools!);
        Assert.Contains("annualSalary", d.Spec.Suggested!);
        Assert.Contains("tools", d.Spec.Suggested!);
        Assert.Contains(d.Suggestions, x => x.Field == "annualSalary" && x.Source == "ai" && x.Reason.Contains("marché"));

        var spot = Assert.Single(d.BlindSpots, b => b.Title == "Accès aux données clients");
        Assert.Equal("ai", spot.Source);
        Assert.Equal("Base clients", Assert.Single(spot.Nodes).Name);        // « Serveur fantôme » n'existe pas : ignoré
        Assert.Equal(Db, Assert.Single(spot.Patch!.AddIds!));
        Assert.Null(Assert.Single(d.BlindSpots, b => b.Title == "Sans objet").Patch); // correctif vers un élément inventé : écarté

        // Le contexte envoyé à l'IA contient le profil et le catalogue réel.
        Assert.Contains("devise EUR", chat.LastUser);
        Assert.Contains("- ERP [Application", chat.LastUser);
    }

    [Fact]
    public async Task Une_reponse_IA_illisible_retombe_sur_le_graphe()
    {
        var d = await new DecisionAssistant(new FakeChat("désolé, je ne peux pas")).PrepareAsync("Recruter un analyste pour la Facturation", Org(), Ctx, null, "fr", default);
        Assert.False(d.UsedAi);
        Assert.Contains(Erp, d.Spec.Uses!);
    }

    [Fact]
    public void Un_montant_suggere_non_confirme_reste_signale_dans_le_chiffrage()
    {
        var spec = new DecisionSpec(DecisionKinds.Hire, NewName: "Expert", Serves: [Billing], Uses: [Erp], AnnualSalary: 60_000, ExpectedAnnualGain: 100_000,
            Suggested: ["annualSalary", "expectedAnnualGain"]);
        var r = new DecisionEngine(Org(), Ctx, "fr").Analyze(spec);
        Assert.Equal("suggested", Assert.Single(r.Costs, c => c.Key == "salary").Source);
        Assert.Equal("suggested", Assert.Single(r.Benefits, c => c.Key == "gain").Source);

        var confirmed = new DecisionEngine(Org(), Ctx, "fr").Analyze(spec with { Suggested = [] });
        Assert.Equal("input", Assert.Single(confirmed.Costs, c => c.Key == "salary").Source);
    }
}
