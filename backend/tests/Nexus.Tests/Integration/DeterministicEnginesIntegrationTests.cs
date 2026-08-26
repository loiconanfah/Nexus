using Microsoft.Extensions.Options;
using Nexus.Domain.Graph;
using Nexus.Domain.Ontology;
using Nexus.Domain.ValueObjects;
using Nexus.Graph;
using Nexus.Risk;
using Nexus.Risk.Propagation;
using Nexus.Risk.Scoring;
using Nexus.Risk.Spof;

namespace Nexus.Tests.Integration;

/// <summary>
/// Tests d'intégration des moteurs déterministes (Dependency/Propagation/SPOF)
/// sur une topologie seedée dans Neo4j : un serveur SQL01 est un SPOF dont
/// dépend tout le reste.
/// </summary>
[Trait("Category", "Integration")]
public class DeterministicEnginesIntegrationTests
{
    [SkippableFact]
    public async Task Propagation_and_spof_on_seeded_topology()
    {
        await using var conn = new Neo4jConnection(Options.Create(IntegrationEnv.Neo4j));
        Skip.IfNot(await conn.VerifyConnectivityAsync(), "Neo4j non joignable.");

        var tenant = Guid.NewGuid();
        var repo = new Neo4jGraphRepository(conn);
        var queries = new Neo4jDependencyQueries(conn);

        try
        {
            await new GraphSchemaInitializer(conn).InitializeAsync();

            // Topologie :
            //   SQL01(Server,92) ← ERP(App,88) ← Billing(BusinessProcess,95)
            //   SQL01 ← CRM(App,70)
            //   SQL01 ← WEB01(Server,40)
            var sql01 = await Node(repo, tenant, EntityType.Server, "SQL01", 92);
            var erp = await Node(repo, tenant, EntityType.Application, "ERP", 88);
            var crm = await Node(repo, tenant, EntityType.Application, "CRM", 70);
            var web01 = await Node(repo, tenant, EntityType.Server, "WEB01", 40);
            var billing = await Node(repo, tenant, EntityType.BusinessProcess, "Billing", 95);

            await Dep(repo, tenant, erp, sql01);
            await Dep(repo, tenant, crm, sql01);
            await Dep(repo, tenant, web01, sql01);
            await Dep(repo, tenant, billing, erp);

            // --- Dépendants directs de SQL01 = 3 ---
            var directs = await queries.GetDirectDependentsAsync(tenant, sql01);
            Assert.Equal(3, directs.Count);

            // --- Propagation d'une panne de SQL01 ---
            var engine = new PropagationEngine(queries);
            var result = await engine.SimulateFailureAsync(tenant, sql01, ScenarioType.ServerFailure);

            Assert.Equal(4, result.AffectedTotal);                 // ERP, CRM, WEB01, Billing
            Assert.Equal(2, result.MaxDepth);                      // Billing est à 2 sauts
            Assert.Equal(2, result.AffectedByType["Application"]); // ERP + CRM
            Assert.Equal(1, result.AffectedByType["Server"]);      // WEB01
            Assert.Equal(1, result.AffectedByType["BusinessProcess"]); // Billing
            Assert.Equal(88 + 70 + 40 + 95, result.EstimatedOperationalImpact);

            // --- SPOF : SQL01 en tête ---
            var spofs = await new SpofAnalyzer(queries).AnalyzeAsync(tenant);
            Assert.Contains(spofs, s => s.Entity.Name == "SQL01");
            Assert.Equal("SQL01", spofs[0].Entity.Name);           // score le plus élevé
            Assert.True(spofs[0].Score > 50);
            Assert.Contains(spofs, s => s.Entity.Name == "ERP");   // ERP est aussi un SPOF (Billing en dépend)

            // --- Risk Analyzer : évaluation explicable de SQL01 ---
            var analyzer = new RiskAnalyzer(repo, queries, new RiskEngine(), new CriticalityEngine());
            var risk = await analyzer.AssessEntityAsync(tenant, sql01);

            Assert.NotNull(risk);
            Assert.False(risk!.HasRedundancy);
            Assert.Equal(3, risk.DirectDependents);
            Assert.Equal(4, risk.BlastRadius);
            Assert.Equal(92, risk.EffectiveCriticality);
            Assert.True(risk.Assessment.Score >= 50);                 // au moins ELEVATED
            Assert.Equal("Criticality", risk.Assessment.Breakdown[0].Factor);   // facteur dominant
        }
        finally
        {
            await conn.WriteAsync("MATCH (n:Entity { tenantId: $t }) DETACH DELETE n", new { t = tenant.ToString() });
        }
    }

    private static async Task<Guid> Node(Neo4jGraphRepository repo, Guid tenant, EntityType type, string name, int crit)
    {
        var entity = GraphEntity.Create(tenant, type, name, Criticality.Create(crit).Value).Value;
        await repo.UpsertEntityAsync(entity);
        return entity.Id;
    }

    private static Task Dep(Neo4jGraphRepository repo, Guid tenant, Guid source, Guid target)
    {
        var rel = GraphRelation.Create(tenant, source, target, RelationType.DependsOn,
            Confidence.Certain, ConfidenceStatus.Verified).Value;
        return repo.UpsertRelationAsync(rel);
    }
}
