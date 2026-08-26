using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Nexus.AI;
using Nexus.Api.Tenancy;
using Nexus.Graph;
using Nexus.Infrastructure;
using Nexus.Ingestion;
using Nexus.Risk;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// --- Observabilité : logs structurés (Serilog, article 44) ---
builder.Services.AddSerilog(cfg => cfg
    .Enrich.FromLogContext()
    .WriteTo.Console());

// --- Observabilité : traces & métriques (OpenTelemetry, article 44) ---
builder.Services.AddOpenTelemetry()
    .ConfigureResource(r => r.AddService("Nexus.Api"))
    .WithTracing(t => t
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation())
    .WithMetrics(m => m
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation());

builder.Services.AddControllers().AddJsonOptions(o =>
    o.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter()));
builder.Services.AddOpenApi();

// --- Sécurité : rate limiting par IP (article 45) ---
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            ctx.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = 240, Window = TimeSpan.FromMinutes(1) }));
});

// --- Résolution du tenant (stub dev par en-tête ; claim du token en Phase 6+) ---
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ITenantProvider, HeaderTenantProvider>();

// --- Modules NEXUS ---
var postgres = builder.Configuration.GetConnectionString("Postgres")
    ?? throw new InvalidOperationException("La chaîne de connexion 'Postgres' est requise.");
builder.Services.AddNexusInfrastructure(postgres);
builder.Services.AddNexusGraph(options =>
    builder.Configuration.GetSection(Neo4jOptions.SectionName).Bind(options));
builder.Services.AddNexusIngestion();
builder.Services.AddNexusRisk();
builder.Services.AddNexusAI(options =>
    builder.Configuration.GetSection(AiOptions.SectionName).Bind(options));

var app = builder.Build();

// En-têtes de sécurité (OWASP, article 45).
app.Use(async (ctx, next) =>
{
    var h = ctx.Response.Headers;
    h["X-Content-Type-Options"] = "nosniff";
    h["X-Frame-Options"] = "DENY";
    h["Referrer-Policy"] = "no-referrer";
    h["X-XSS-Protection"] = "0";
    await next();
});

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseSerilogRequestLogging();
app.UseRateLimiter();
app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.Run();
