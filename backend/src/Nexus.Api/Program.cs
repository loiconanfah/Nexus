using Nexus.Graph;
using Nexus.Infrastructure;
using Nexus.Ingestion;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();

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

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.Run();
