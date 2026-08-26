using Microsoft.Extensions.Options;
using Nexus.Domain.Graph;
using Nexus.Domain.Ontology;
using Nexus.Domain.ValueObjects;
using Nexus.Graph;

namespace Nexus.Tests.Integration;

/// <summary>
/// Tests d'intégration du knowledge graph contre un Neo4j réel (docker-compose).
/// Valide : contraintes, upsert d'entités/relations, lecture des dépendances.
/// </summary>
[Trait("Category", "Integration")]
public class GraphIntegrationTests
{
    [SkippableFact]
    public async Task Upsert_and_read_dependency_round_trip()
    {
        await using var connection = new Neo4jConnection(Options.Create(IntegrationEnv.Neo4j));
        Skip.IfNot(await connection.VerifyConnectivityAsync(), "Neo4j non joignable — test d'intégration ignoré.");

        var tenant = Guid.NewGuid();
        var repo = new Neo4jGraphRepository(connection);

        try
        {
            // Contraintes/index (idempotent).
            await new GraphSchemaInitializer(connection).InitializeAsync();

            // Deux entités : une application ERP dépend d'un serveur SQL01 (SPOF).
            var sql01 = GraphEntity.Create(tenant, EntityType.Server, "SQL01",
                Criticality.Create(92).Value, sourceSystem: "Azure CMDB").Value;
            var erp = GraphEntity.Create(tenant, EntityType.Application, "ERP",
                Criticality.Create(88).Value, aliases: ["erp-prod"], sourceSystem: "Azure CMDB").Value;

            await repo.UpsertEntityAsync(sql01);
            await repo.UpsertEntityAsync(erp);

            // Relation de dépendance vérifiée, confiance 0.98.
            var dep = GraphRelation.Create(tenant, erp.Id, sql01.Id, RelationType.DependsOn,
                Confidence.Create(0.98).Value, ConfidenceStatus.Verified, sourceSystem: "Azure CMDB").Value;
            await repo.UpsertRelationAsync(dep);

            // Lecture de l'entité.
            var read = await repo.GetEntityAsync(tenant, erp.Id);
            Assert.NotNull(read);
            Assert.Equal("ERP", read!.Name);
            Assert.Equal("Application", read.EntityType);
            Assert.Contains("erp-prod", read.Aliases);

            // Lecture de la dépendance directe.
            var deps = await repo.GetDirectDependenciesAsync(tenant, erp.Id);
            Assert.Single(deps);
            Assert.Equal("SQL01", deps[0].Target.Name);
            Assert.Equal("DEPENDS_ON", deps[0].RelationType);
            Assert.Equal(0.98, deps[0].Confidence, precision: 3);
            Assert.Equal("Verified", deps[0].Status);

            // Idempotence : ré-upsert ne duplique pas.
            await repo.UpsertEntityAsync(erp);
            var depsAgain = await repo.GetDirectDependenciesAsync(tenant, erp.Id);
            Assert.Single(depsAgain);
        }
        finally
        {
            // Nettoyage : supprime le sous-graphe du tenant de test.
            await connection.WriteAsync(
                "MATCH (n:Entity { tenantId: $t }) DETACH DELETE n",
                new { t = tenant.ToString() });
        }
    }
}
