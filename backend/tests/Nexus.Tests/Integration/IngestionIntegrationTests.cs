using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Nexus.Connectors.Files;
using Nexus.Domain.Ontology;
using Nexus.Graph;
using Nexus.Infrastructure.Persistence;
using Nexus.Ingestion;
using Nexus.Ingestion.Mapping;
using Nexus.Ingestion.Normalization;

namespace Nexus.Tests.Integration;

/// <summary>
/// Test d'intégration du moteur d'ingestion de bout en bout : import Excel
/// (2 feuilles) → graphe Neo4j + data lineage PostgreSQL, avec résolution
/// d'entités, dédoublonnage et idempotence.
/// </summary>
[Trait("Category", "Integration")]
public class IngestionIntegrationTests
{
    private static NexusDbContext CreatePg() =>
        new(new DbContextOptionsBuilder<NexusDbContext>()
            .UseNpgsql(IntegrationEnv.PostgresConnectionString, o => o.UseVector())
            .UseSnakeCaseNamingConvention()
            .Options);

    [SkippableFact]
    public async Task Import_excel_builds_graph_with_resolution_dedup_and_lineage()
    {
        await using var conn = new Neo4jConnection(Options.Create(IntegrationEnv.Neo4j));
        Skip.IfNot(await conn.VerifyConnectivityAsync(), "Neo4j non joignable.");
        await using var db = CreatePg();
        Skip.IfNot(await db.Database.CanConnectAsync(), "PostgreSQL non joignable.");

        var tenant = Guid.NewGuid();
        var repo = new Neo4jGraphRepository(conn);
        var resolver = new Neo4jEntityResolver(conn);
        var pipeline = new ImportPipeline(new NormalizationEngine(), resolver, repo, new EfLineageWriter(db));
        var xlsx = CreateWorkbook();

        try
        {
            await new GraphSchemaInitializer(conn).InitializeAsync();

            var connector = new ExcelConnector(new ExcelConnectorConfig(xlsx));
            var profile = new MappingProfile(
                SourceSystem: "Demo Excel",
                Entities:
                [
                    new EntityMapping(
                        Dataset: "assets", EntityType: "Asset", NameColumn: "name",
                        AliasColumns: ["alias"], CriticalityColumn: "criticality",
                        EntityTypeColumn: "type")
                ],
                Relations:
                [
                    new RelationMapping(
                        Dataset: "deps", RelationType: "DEPENDS_ON",
                        SourceEntityType: "Server", SourceNameColumn: "source",
                        TargetEntityType: "Server", TargetNameColumn: "target",
                        SourceTypeColumn: "source_type", TargetTypeColumn: "target_type")
                ]);

            // --- Premier import ---
            var result = await pipeline.ExecuteAsync(tenant, connector, profile);
            Assert.True(result.IsSuccess);
            var r = result.Value;

            Assert.Equal(3, r.EntitiesCreated);        // SQL01, ERP, WEB01
            Assert.Equal(2, r.RelationsCreated);       // ERP->SQL01, WEB01->SQL01 (3e ligne dédupliquée via alias)
            Assert.Equal(0, r.RelationsUnresolved);
            Assert.NotNull(r.TimeToFirstGraph);

            // Résolution : ERP dépend de SQL01 exactement une fois (alias résolu).
            var erpId = await resolver.FindExistingAsync(tenant, EntityType.Application, "ERP", [], default);
            Assert.NotNull(erpId);
            var deps = await repo.GetDirectDependenciesAsync(tenant, erpId!.Value);
            Assert.Single(deps);
            Assert.Equal("SQL01", deps[0].Target.Name);

            // Lineage écrit dans PostgreSQL (3 nœuds + 2 arêtes).
            var lineageCount = await db.DataLineage.CountAsync(l => l.TenantId == tenant);
            Assert.Equal(5, lineageCount);

            // --- Ré-import : idempotent (aucune entité créée, graphe inchangé) ---
            var result2 = await pipeline.ExecuteAsync(tenant, connector, profile);
            Assert.Equal(0, result2.Value.EntitiesCreated);
            Assert.Equal(3, result2.Value.EntitiesMatched);

            var depsAfter = await repo.GetDirectDependenciesAsync(tenant, erpId!.Value);
            Assert.Single(depsAfter);   // toujours une seule arête ERP->SQL01
        }
        finally
        {
            await conn.WriteAsync("MATCH (n:Entity { tenantId: $t }) DETACH DELETE n", new { t = tenant.ToString() });
            db.DataLineage.RemoveRange(db.DataLineage.Where(l => l.TenantId == tenant));
            await db.SaveChangesAsync();
            if (File.Exists(xlsx)) File.Delete(xlsx);
        }
    }

    private static string CreateWorkbook()
    {
        var path = Path.Combine(Path.GetTempPath(), $"nexus_it_{Guid.NewGuid():N}.xlsx");
        using var wb = new XLWorkbook();

        var assets = wb.AddWorksheet("assets");
        WriteRow(assets, 1, "name", "type", "criticality", "alias");
        WriteRow(assets, 2, "SQL01", "Server", "92", "database-server-001");
        WriteRow(assets, 3, "ERP", "Application", "88", "erp-prod");
        WriteRow(assets, 4, "WEB01", "Server", "40", "");

        var deps = wb.AddWorksheet("deps");
        WriteRow(deps, 1, "source", "source_type", "target", "target_type");
        WriteRow(deps, 2, "ERP", "Application", "SQL01", "Server");
        WriteRow(deps, 3, "WEB01", "Server", "SQL01", "Server");
        // 3e dépendance : ERP -> SQL01 via l'ALIAS du serveur (doit se résoudre vers la même arête).
        WriteRow(deps, 4, "ERP", "Application", "database-server-001", "Server");

        wb.SaveAs(path);
        return path;
    }

    private static void WriteRow(IXLWorksheet ws, int row, params string[] values)
    {
        for (var i = 0; i < values.Length; i++)
        {
            ws.Cell(row, i + 1).Value = values[i];
        }
    }
}
