using Microsoft.Extensions.DependencyInjection;
using Nexus.Domain.Graph;
using Nexus.Domain.Ontology;
using Nexus.Domain.ValueObjects;
using Nexus.Graph;

// =====================================================================
// Nexus.Seed — génère un jeu de démonstration réaliste (articles 52-53).
// Usage : dotnet run --project src/Nexus.Seed
// Révèle volontairement : un SPOF, une dépendance cachée, un fournisseur
// critique unique, une personne détentrice d'une connaissance unique, un
// système legacy, et une relation non documentée (AI_SUGGESTED).
// =====================================================================

static string Env(string key, string fallback) =>
    Environment.GetEnvironmentVariable(key) is { Length: > 0 } v ? v : fallback;

var services = new ServiceCollection();
services.AddNexusGraph(o =>
{
    o.Uri = Env("Nexus__Neo4j__Uri", "bolt://localhost:7687");
    o.User = Env("Nexus__Neo4j__User", "neo4j");
    o.Password = Env("Nexus__Neo4j__Password", "nexus_dev_pwd");
    o.Database = Env("Nexus__Neo4j__Database", "neo4j");
});

await using var provider = services.BuildServiceProvider();
var connection = provider.GetRequiredService<INeo4jConnection>();

if (!await connection.VerifyConnectivityAsync())
{
    Console.Error.WriteLine("❌ Neo4j injoignable. Démarrez les conteneurs : docker compose up -d");
    return 1;
}

var repo = provider.GetRequiredService<IGraphRepository>();
await provider.GetRequiredService<GraphSchemaInitializer>().InitializeAsync();

var tenant = Guid.NewGuid();
const string src = "Seed démo";
Console.WriteLine($"Génération du jeu de démo pour le tenant {tenant}…");

var ids = new Dictionary<string, Guid>();

async Task Node(string name, EntityType type, int crit, params string[] aliases)
{
    var e = GraphEntity.Create(tenant, type, name, Criticality.Create(crit).Value, aliases: aliases, sourceSystem: src).Value;
    await repo.UpsertEntityAsync(e);
    ids[name] = e.Id;
}

async Task Dep(string from, string to, RelationType rel, double conf, ConfidenceStatus status)
{
    var r = GraphRelation.Create(tenant, ids[from], ids[to], rel, Confidence.Create(conf).Value, status,
        sourceSystem: src, id: DeterministicId(from, to, rel)).Value;
    await repo.UpsertRelationAsync(r);
}

Guid DeterministicId(string from, string to, RelationType rel) =>
    Nexus.Core.DeterministicGuid.From(tenant.ToString(), ids[from].ToString(), ids[to].ToString(), rel.Name);

// ---- Infrastructure ----
await Node("SQL01", EntityType.Server, 92, "database-server-001");   // SPOF
await Node("AD01", EntityType.Server, 85);                            // SPOF (auth)
await Node("WEB01", EntityType.Server, 40);
await Node("AS400-LEGACY", EntityType.Server, 78, "mainframe-old");   // système legacy
await Node("CustomerDB", EntityType.Database, 90);

// ---- Applications & processus ----
await Node("ERP", EntityType.Application, 88, "erp-prod");
await Node("CRM", EntityType.Application, 70);
await Node("Billing", EntityType.BusinessProcess, 95);
await Node("Payroll", EntityType.BusinessProcess, 80);

// ---- Fournisseurs & personnes ----
await Node("CloudProviderX", EntityType.Supplier, 90);   // fournisseur critique
await Node("MaintCorp", EntityType.Supplier, 65);        // fournisseur unique du legacy
await Node("Alice", EntityType.Person, 60);              // connaissance unique du legacy
await Node("Bob", EntityType.Person, 58);                // détenteur unique de la connaissance ERP
await Node("Carol", EntityType.Person, 52);              // détentrice unique de CustomerDB
await Node("David", EntityType.Person, 48);              // backup de SQL01

// ---- Dépendances ----
await Dep("ERP", "SQL01", RelationType.DependsOn, 0.98, ConfidenceStatus.Verified);
await Dep("CRM", "SQL01", RelationType.DependsOn, 0.95, ConfidenceStatus.Imported);
await Dep("WEB01", "SQL01", RelationType.DependsOn, 0.90, ConfidenceStatus.Imported);
await Dep("CustomerDB", "SQL01", RelationType.RunsOn, 0.99, ConfidenceStatus.Verified);
await Dep("ERP", "AD01", RelationType.Authenticates, 0.97, ConfidenceStatus.Verified);
await Dep("CRM", "AD01", RelationType.Authenticates, 0.97, ConfidenceStatus.Verified);
await Dep("Billing", "ERP", RelationType.DependsOn, 0.96, ConfidenceStatus.Verified);
await Dep("Payroll", "ERP", RelationType.DependsOn, 0.94, ConfidenceStatus.Imported);

// Dépendance cachée : l'ERP dépend d'un mainframe legacy peu visible.
await Dep("ERP", "AS400-LEGACY", RelationType.DependsOn, 0.85, ConfidenceStatus.Inferred);
// Fournisseur unique du système legacy.
await Dep("AS400-LEGACY", "MaintCorp", RelationType.SuppliedBy, 0.9, ConfidenceStatus.Imported);
// Fournisseur critique : plusieurs applications en dépendent.
await Dep("ERP", "CloudProviderX", RelationType.Uses, 0.9, ConfidenceStatus.Imported);
await Dep("CRM", "CloudProviderX", RelationType.Uses, 0.9, ConfidenceStatus.Imported);
// Dépendances humaines : connaissance critique détenue par peu de personnes (article 28).
await Dep("Alice", "AS400-LEGACY", RelationType.Knows, 0.8, ConfidenceStatus.Verified);
await Dep("Bob", "ERP", RelationType.Knows, 0.85, ConfidenceStatus.Verified);      // seul à connaître l'ERP
await Dep("Bob", "SQL01", RelationType.Knows, 0.8, ConfidenceStatus.Imported);
await Dep("David", "SQL01", RelationType.Knows, 0.75, ConfidenceStatus.Imported);  // backup de SQL01
await Dep("Carol", "CustomerDB", RelationType.Knows, 0.8, ConfidenceStatus.Verified); // seule à connaître CustomerDB
// Relation NON DOCUMENTÉE, suggérée par l'IA, non confirmée.
await Dep("Billing", "CloudProviderX", RelationType.DependsOn, 0.4, ConfidenceStatus.AiSuggested);

Console.WriteLine($"✅ {ids.Count} entités et le graphe de dépendances créés.");
Console.WriteLine();
Console.WriteLine("Pour explorer ce jeu dans l'UI, utilisez l'en-tête de tenant :");
Console.WriteLine($"    X-Tenant-Id: {tenant}");
Console.WriteLine("(ou collez-le dans localStorage['nexus.tenantId'] côté frontend).");
return 0;
