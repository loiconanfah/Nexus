using System.Net.Http;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Nexus.AI;
using Nexus.Api.Auth;
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

// Réponses d'erreur normalisées (RFC 9457) sans fuite de détails en production.
builder.Services.AddProblemDetails();

// Limite de taille des imports de fichiers (anti-abus).
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(o =>
    o.MultipartBodyLengthLimit = 25 * 1024 * 1024);   // 25 Mo

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
builder.Services.AddScoped<ITenantProvider, ClaimTenantProvider>();
// Config IA par tenant : resolution du tenant (singleton-safe) + persistance Postgres.
builder.Services.AddSingleton<Nexus.AI.ICurrentTenant, Nexus.Api.AI.HttpCurrentTenant>();
builder.Services.AddSingleton<Nexus.AI.IAiConfigStore, Nexus.Api.AI.PgAiConfigStore>();
builder.Services.AddScoped<Nexus.AI.ILlmUsageStore, Nexus.Api.AI.PgLlmUsageStore>();
builder.Services.AddScoped<Nexus.Api.History.HistoryService>();
builder.Services.AddScoped<Nexus.Api.Business.DecisionInterpreter>();
builder.Services.AddScoped<Nexus.Api.Business.DecisionAnalyzer>();
builder.Services.AddScoped<Nexus.Api.Business.ScenarioStore>();
builder.Services.AddScoped<Nexus.Api.Business.BusinessStore>();
builder.Services.AddScoped<Nexus.Api.Impact.ImpactIntelligenceService>();
// Client du connecteur REST : redirections désactivées (garde anti-SSRF avec SsrfGuard).
builder.Services.AddHttpClient("rest-connector")
    .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
    {
        AllowAutoRedirect = false,
        ConnectTimeout = TimeSpan.FromSeconds(10),
    });

// --- Authentification / autorisation (durcissement, article 41) ---
var authCfg = new AuthConfig();
builder.Configuration.GetSection(AuthConfig.SectionName).Bind(authCfg);
// Secrets par variables d'environnement (valeurs de dev sinon, avec avertissement).
authCfg.JwtKey = Environment.GetEnvironmentVariable("NEXUS_JWT_KEY") ?? authCfg.JwtKey;
authCfg.AdminEmail = Environment.GetEnvironmentVariable("NEXUS_ADMIN_EMAIL") ?? authCfg.AdminEmail;
authCfg.AdminPassword = Environment.GetEnvironmentVariable("NEXUS_ADMIN_PASSWORD") ?? authCfg.AdminPassword;
authCfg.AdminTenantId = Environment.GetEnvironmentVariable("NEXUS_ADMIN_TENANT") ?? authCfg.AdminTenantId;
if (Environment.GetEnvironmentVariable("NEXUS_ALLOW_HEADER_TENANT") is "true" or "1") authCfg.AllowHeaderTenant = true;
// Ceinture de sécurité : le tenant par en-tête (contournement d'isolation) est
// INTERDIT en production, même s'il a été activé par erreur via la variable.
if (builder.Environment.IsProduction() && authCfg.AllowHeaderTenant)
{
    authCfg.AllowHeaderTenant = false;
    Log.Warning("NEXUS_ALLOW_HEADER_TENANT ignoré en Production (isolation multi-tenant forcée).");
}
if (Environment.GetEnvironmentVariable("NEXUS_ALLOW_REGISTRATION") is "false" or "0") authCfg.AllowSelfRegistration = false;

var usingDevJwt = string.IsNullOrWhiteSpace(authCfg.JwtKey);
if (usingDevJwt) authCfg.JwtKey = "dev-only-insecure-key-change-in-production-please-32b+";
var usingDevPwd = string.IsNullOrWhiteSpace(authCfg.AdminPassword);
if (usingDevPwd) authCfg.AdminPassword = "nexus-demo-2026";

// Refus de démarrer en PRODUCTION avec des secrets de dev : une clé JWT connue
// permettrait de forger des jetons ; un mot de passe admin par défaut est trivial.
if (builder.Environment.IsProduction() && (usingDevJwt || usingDevPwd))
{
    var missing = string.Join(", ",
        new[] { usingDevJwt ? "NEXUS_JWT_KEY" : null, usingDevPwd ? "NEXUS_ADMIN_PASSWORD" : null }
            .Where(x => x is not null));
    throw new InvalidOperationException(
        $"Démarrage refusé en Production : secret(s) obligatoire(s) manquant(s) : {missing}. " +
        "Définissez-les via des variables d'environnement.");
}
builder.Services.Configure<AuthConfig>(o =>
{
    o.JwtKey = authCfg.JwtKey; o.Issuer = authCfg.Issuer; o.Audience = authCfg.Audience;
    o.ExpiryHours = authCfg.ExpiryHours; o.AllowHeaderTenant = authCfg.AllowHeaderTenant;
    o.AllowSelfRegistration = authCfg.AllowSelfRegistration;
    o.AdminEmail = authCfg.AdminEmail; o.AdminPassword = authCfg.AdminPassword; o.AdminTenantId = authCfg.AdminTenantId;
});

// --- SSO Entra ID (OpenID Connect) : DORMANT sauf si TenantId + ClientId fournis. ---
var entraCfg = new EntraConfig();
builder.Configuration.GetSection(EntraConfig.SectionName).Bind(entraCfg);
entraCfg.TenantId = Environment.GetEnvironmentVariable("NEXUS_ENTRA_TENANT_ID") ?? entraCfg.TenantId;
entraCfg.ClientId = Environment.GetEnvironmentVariable("NEXUS_ENTRA_CLIENT_ID") ?? entraCfg.ClientId;
entraCfg.DefaultTenantId = Environment.GetEnvironmentVariable("NEXUS_ENTRA_DEFAULT_TENANT") ?? entraCfg.DefaultTenantId;
entraCfg.AdminEmails = Environment.GetEnvironmentVariable("NEXUS_ENTRA_ADMIN_EMAILS") ?? entraCfg.AdminEmails;
builder.Services.Configure<EntraConfig>(o =>
{
    o.TenantId = entraCfg.TenantId; o.ClientId = entraCfg.ClientId;
    o.DefaultTenantId = entraCfg.DefaultTenantId; o.AdminEmails = entraCfg.AdminEmails;
});
builder.Services.AddSingleton<EntraTokenValidator>();

builder.Services.AddSingleton<TokenService>();
builder.Services.AddScoped<PgUserStore>();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        // Conserve les noms de claims tels quels (email/role/tenant), sans remappage URI.
        o.MapInboundClaims = false;
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true, ValidIssuer = authCfg.Issuer,
            ValidateAudience = true, ValidAudience = authCfg.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(authCfg.JwtKey)),
            ValidateLifetime = true, ClockSkew = TimeSpan.FromMinutes(1),
        };
    });
// Tout est protégé par défaut ; [AllowAnonymous] ouvre login/health.
builder.Services.AddAuthorization(o => o.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());

// CORS restreint (origines par NEXUS_CORS_ORIGINS, séparées par des virgules).
var corsOrigins = (Environment.GetEnvironmentVariable("NEXUS_CORS_ORIGINS") ?? "")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
builder.Services.AddCors(o => o.AddPolicy("nexus", p =>
{
    if (corsOrigins.Length > 0) p.WithOrigins(corsOrigins).AllowAnyHeader().AllowAnyMethod().AllowCredentials();
}));

// --- Modules NEXUS ---
var postgres = builder.Configuration.GetConnectionString("Postgres")
    ?? throw new InvalidOperationException("La chaîne de connexion 'Postgres' est requise.");
// Render (et d'autres hébergeurs) fournissent l'URL au format postgres://user:pass@host/db.
// Npgsql attend le format « Host=...;Port=...;Database=... » : on convertit si nécessaire.
if (postgres.StartsWith("postgres://") || postgres.StartsWith("postgresql://"))
{
    var pgUri = new Uri(postgres);
    var pgUserInfo = pgUri.UserInfo.Split(':', 2);
    var pgUser = Uri.UnescapeDataString(pgUserInfo[0]);
    var pgPass = pgUserInfo.Length > 1 ? Uri.UnescapeDataString(pgUserInfo[1]) : "";
    var pgDb = Uri.UnescapeDataString(pgUri.AbsolutePath.TrimStart('/'));
    var pgPort = pgUri.Port > 0 ? pgUri.Port : 5432;
    postgres = $"Host={pgUri.Host};Port={pgPort};Database={pgDb};Username={pgUser};Password={pgPass};SSL Mode=Prefer;Trust Server Certificate=true";
}
builder.Services.AddNexusInfrastructure(postgres);
builder.Services.AddNexusGraph(options =>
    builder.Configuration.GetSection(Neo4jOptions.SectionName).Bind(options));
builder.Services.AddNexusIngestion();
builder.Services.AddNexusRisk();
builder.Services.AddNexusAI(options =>
    builder.Configuration.GetSection(AiOptions.SectionName).Bind(options));

var app = builder.Build();

// Migrations + contraintes de graphe au démarrage (déploiement conteneur).
if (app.Configuration.GetValue<bool>("Nexus:RunMigrationsOnStartup"))
{
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<Nexus.Infrastructure.Persistence.NexusDbContext>().Database.MigrateAsync();
    await scope.ServiceProvider.GetRequiredService<Nexus.Graph.GraphSchemaInitializer>().InitializeAsync();
}

// Avertissements de sécurité si secrets de dev en usage.
if (usingDevJwt) Log.Warning("NEXUS_JWT_KEY non défini — clé JWT de DEV utilisée. À définir en production.");
if (usingDevPwd) Log.Warning("NEXUS_ADMIN_PASSWORD non défini — mot de passe admin de DEV utilisé ({Email}). À définir en production.", authCfg.AdminEmail);
if (authCfg.AllowHeaderTenant) Log.Warning("AllowHeaderTenant activé — tenant par en-tête autorisé (DÉMO uniquement).");
Log.Information(entraCfg.Enabled
    ? "SSO Entra ID ACTIF (clientId {ClientId}, tenant {TenantId})."
    : "SSO Entra ID inactif — connexion par mot de passe uniquement (définir NEXUS_ENTRA_TENANT_ID + NEXUS_ENTRA_CLIENT_ID pour l'activer).",
    entraCfg.ClientId, entraCfg.TenantId);

// Amorçage de l'administrateur de démo (idempotent, tolérant si base indisponible).
try
{
    using var scope = app.Services.CreateScope();
    var store = scope.ServiceProvider.GetRequiredService<PgUserStore>();
    var adminTenant = Guid.TryParse(authCfg.AdminTenantId, out var atid) ? atid : Guid.Empty;
    await store.EnsureSeedAsync(authCfg.AdminEmail, authCfg.AdminPassword, adminTenant, "admin", CancellationToken.None);

    // Comptes de DÉMO dédiés (un par jeu de données), mot de passe démo fixe et
    // indépendant du mot de passe admin. Chaque compte est sur SON tenant : la page
    // d'onboarding laisse le visiteur choisir le jeu, puis se connecte au bon espace.
    const string demoPwd = "lenexus-demo-2026";
    var cgiTenant = Guid.Parse("c6100000-cf1c-4000-8000-000000000001");
    var bellTenant = Guid.Parse("be110000-cf1c-4000-8000-000000000002");
    await store.EnsureSeedAsync("demo-cgi@lenexus.demo", demoPwd, cgiTenant, "admin", CancellationToken.None);
    await store.EnsureSeedAsync("demo-bell@lenexus.demo", demoPwd, bellTenant, "admin", CancellationToken.None);
}
catch (Exception ex)
{
    Log.Warning(ex, "Amorçage de l'admin ignoré (base indisponible ?).");
}

// Gestion globale des exceptions → ProblemDetails (pas de stack trace en prod).
app.UseExceptionHandler();

// HSTS en production (force HTTPS côté navigateur).
if (!app.Environment.IsDevelopment()) app.UseHsts();

// En-têtes de sécurité (OWASP, article 45).
app.Use(async (ctx, next) =>
{
    var h = ctx.Response.Headers;
    h["X-Content-Type-Options"] = "nosniff";
    h["X-Frame-Options"] = "DENY";
    h["Referrer-Policy"] = "no-referrer";
    h["X-XSS-Protection"] = "0";
    // CSP stricte pour l'API (JSON) : aucune ressource active.
    h["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'";
    await next();
});

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseSerilogRequestLogging();
app.UseRateLimiter();
app.UseHttpsRedirection();
app.UseCors("nexus");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
