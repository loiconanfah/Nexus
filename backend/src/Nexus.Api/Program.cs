using Nexus.Api.Tenancy;
using Nexus.Graph;
using Nexus.Infrastructure;
using Nexus.Ingestion;
using Nexus.Risk;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers().AddJsonOptions(o =>
    // Enums sérialisés/désérialisés en chaînes (ex : scenario = "ServerFailure").
    o.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter()));
builder.Services.AddOpenApi();

// Résolution du tenant (stub dev par en-tête ; remplacé par le claim du token en Phase 6).
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ITenantProvider, HeaderTenantProvider>();

// --- Modules NEXUS ---
// PostgreSQL (plan de contrôle + pgvector).
var postgres = builder.Configuration.GetConnectionString("Postgres")
    ?? throw new InvalidOperationException("La chaîne de connexion 'Postgres' est requise.");
builder.Services.AddNexusInfrastructure(postgres);

// Neo4j (knowledge graph).
builder.Services.AddNexusGraph(options =>
    builder.Configuration.GetSection(Neo4jOptions.SectionName).Bind(options));

// Moteur d'ingestion (connecteurs, normalisation, pipeline).
builder.Services.AddNexusIngestion();

// Moteurs déterministes (risque, criticité, propagation, SPOF).
builder.Services.AddNexusRisk();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.Run();
