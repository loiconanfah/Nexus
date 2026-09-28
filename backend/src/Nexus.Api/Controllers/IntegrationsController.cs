using Microsoft.AspNetCore.Mvc;
using Nexus.Api.Integrations;
using Nexus.Api.Tenancy;
using Nexus.Ingestion.Vendors;

namespace Nexus.Api.Controllers;

/// <summary>
/// Les branchements vers les systèmes du client : ce que Lenexux sait interroger,
/// ce qui est branché, et le rafraîchissement.
///
/// Un seul principe gouverne cet écran : ne proposer que ce qui est réellement
/// interrogé. Un catalogue de logos qui renvoient tous vers un téléversement de
/// fichier donne l'illusion de l'intégration et détruit la confiance au premier
/// essai, alors qu'un branchement qui relit la source tout seul est ce qui rend la
/// carte vivante.
///
/// Les secrets entrent et ne ressortent jamais : la réponse dit seulement QUE le
/// champ est renseigné.
/// </summary>
[Route("api/v1/integrations")]
public sealed class IntegrationsController(
    ITenantProvider tenantProvider,
    IntegrationStore store,
    IntegrationRunner runner,
    SecretBox secrets) : NexusController(tenantProvider)
{
    public sealed record TestRequest(string? VendorId, Dictionary<string, string>? Settings, Guid? Id);

    public sealed record SaveRequest(
        string? VendorId, string? Label, Dictionary<string, string>? Settings, int IntervalMinutes, Guid? Id);

    /// <summary>Ce que Lenexux sait interroger, et ce qu'il faut saisir pour chacun.</summary>
    [HttpGet("catalog")]
    public IActionResult Catalog() => Ok(new
    {
        // L'écran doit pouvoir dire pourquoi un enregistrement est refusé avant
        // que l'utilisateur ne saisisse un secret pour rien.
        canStore = secrets.IsConfigured,
        connectors = VendorCatalog.All.Select(Describe),
    });

    private static object Describe(VendorRecipe r) => new
    {
        id = r.Id,
        name = r.Name,
        category = r.Category,
        summaryFr = r.SummaryFr,
        summaryEn = r.SummaryEn,
        bringsFr = r.BringsFr,
        bringsEn = r.BringsEn,
        docUrl = r.DocUrl,
        internalOnly = r.Internal,
        auth = r.Auth.Kind.ToString(),
        datasets = r.Datasets.Select(d => d.Name),
        // Ce que le branchement écrira dans la carte : un utilisateur doit le
        // savoir AVANT de brancher, pas après.
        writes = new
        {
            entities = r.Profile.Entities.Select(e => e.EntityType).Distinct(),
            relations = r.Profile.Relations.Select(x => x.RelationType).Distinct(),
        },
        fields = r.Fields.Select(f => new
        {
            key = f.Key, labelFr = f.LabelFr, labelEn = f.LabelEn,
            secret = f.Secret, helpFr = f.HelpFr, helpEn = f.HelpEn,
            placeholder = f.Placeholder, required = f.Required,
        }),
    };

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        var list = await store.ListAsync(tenant, ct);
        return Ok(list.Select(i => new
        {
            i.Id, i.VendorId, i.Label, i.Settings, i.IntervalMinutes,
            i.NextRunAt, i.LastRunAt, i.LastOutcome, i.Healthy, i.CreatedBy, i.CreatedAt,
            vendorName = VendorCatalog.Find(i.VendorId)?.Name ?? i.VendorId,
        }));
    }

    /// <summary>
    /// Essaie les identifiants sans rien écrire. Indispensable : personne ne
    /// programme un rafraîchissement automatique sur un accès qu'il n'a pas vu
    /// fonctionner une fois.
    /// </summary>
    [HttpPost("test")]
    public async Task<IActionResult> Test([FromBody] TestRequest? req, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (!RequireAdmin(out var forbidden)) return forbidden;

        var (recipe, settings, failure) = await ResolveAsync(tenant, req?.Id, req?.VendorId, req?.Settings, ct);
        if (failure is not null) return failure;

        var connector = new VendorApiConnector(
            new HttpClient { Timeout = TimeSpan.FromSeconds(30) }, recipe!, settings!);
        var health = await connector.HealthCheckAsync(ct);

        return Ok(new { ok = health.IsHealthy, detail = health.Detail, vendor = recipe!.Name });
    }

    /// <summary>Interroge la source et écrit dans la carte, maintenant.</summary>
    [HttpPost("run")]
    public async Task<IActionResult> Run([FromBody] TestRequest? req, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (!RequireAdmin(out var forbidden)) return forbidden;

        var (recipe, settings, failure) = await ResolveAsync(tenant, req?.Id, req?.VendorId, req?.Settings, ct);
        if (failure is not null) return failure;

        var run = await runner.ExecuteAsync(tenant, recipe!, settings!, ct);

        if (req?.Id is { } id)
        {
            var saved = await store.GetAsync(tenant, id, ct);
            await store.RecordRunAsync(id, run.IsSuccess,
                run.IsSuccess ? run.Value.Summary : run.Error.Message,
                saved?.IntervalMinutes ?? 0, ct);
        }

        if (run.IsFailure) return ToProblem(run.Error);
        return Ok(new
        {
            result = run.Value.Result,
            warnings = run.Value.Warnings,
            summary = run.Value.Summary,
        });
    }

    /// <summary>Enregistre un branchement, avec sa périodicité de rafraîchissement.</summary>
    [HttpPost]
    public async Task<IActionResult> Save([FromBody] SaveRequest? req, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (!RequireAdmin(out var forbidden)) return forbidden;
        if (req is null) return BadRequest(new { error = "body_required" });

        var recipe = VendorCatalog.Find(req.VendorId);
        if (recipe is null) return BadRequest(new { error = "unknown_connector" });

        var incoming = req.Settings ?? [];
        var secretKeys = recipe.Fields.Where(f => f.Secret).Select(f => f.Key).ToHashSet(StringComparer.Ordinal);
        var secret = incoming.Where(kv => secretKeys.Contains(kv.Key) && !string.IsNullOrWhiteSpace(kv.Value))
            .ToDictionary(kv => kv.Key, kv => kv.Value, StringComparer.Ordinal);
        var plain = incoming.Where(kv => !secretKeys.Contains(kv.Key))
            .ToDictionary(kv => kv.Key, kv => kv.Value, StringComparer.Ordinal);

        if (secret.Count > 0 && !secrets.IsConfigured)
            return BadRequest(new
            {
                error = "secret_storage_unavailable",
                detail = $"Aucune clé de chiffrement n'est configurée sur ce serveur ({SecretBox.EnvironmentVariable}) : "
                       + "un accès à votre système ne sera pas conservé en clair.",
            });

        // Une périodicité trop courte harcèlerait l'éditeur pour rien : un
        // inventaire ne change pas toutes les minutes.
        var interval = req.IntervalMinutes <= 0 ? 0 : Math.Clamp(req.IntervalMinutes, 60, 60 * 24 * 7);
        var label = string.IsNullOrWhiteSpace(req.Label) ? recipe.Name : req.Label!.Trim();

        var saved = await store.SaveAsync(
            tenant, req.Id, recipe.Id, label, plain, secret, interval, CurrentEmail, ct);

        return Ok(new { saved.Id, saved.Label, saved.IntervalMinutes, saved.NextRunAt, vendorName = recipe.Name });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (!RequireAdmin(out var forbidden)) return forbidden;
        return await store.DeleteAsync(tenant, id, ct) ? NoContent() : NotFound(new { error = "not_found" });
    }

    /// <summary>
    /// Résout la recette et les réglages : soit un branchement enregistré, soit
    /// ce que l'écran vient de saisir. Un branchement enregistré dont les secrets
    /// sont illisibles se signale, au lieu d'échouer sur un refus d'API obscur.
    /// </summary>
    private async Task<(VendorRecipe? Recipe, Dictionary<string, string>? Settings, IActionResult? Failure)>
        ResolveAsync(Guid tenant, Guid? id, string? vendorId, Dictionary<string, string>? provided, CancellationToken ct)
    {
        if (id is { } saved)
        {
            var integration = await store.GetAsync(tenant, saved, ct);
            if (integration is null) return (null, null, NotFound(new { error = "not_found" }));

            var recipe = VendorCatalog.Find(integration.VendorId);
            if (recipe is null) return (null, null, BadRequest(new { error = "unknown_connector" }));

            var settings = await store.ResolveSettingsAsync(tenant, saved, ct) ?? [];
            var missing = VendorTemplate.Missing(recipe.Fields, settings);
            if (missing.Count > 0)
                return (null, null, BadRequest(new
                {
                    error = "credentials_unreadable",
                    detail = $"Ce branchement doit être reconfiguré : {string.Join(", ", missing)} manquant(s).",
                }));

            return (recipe, settings, null);
        }

        var direct = VendorCatalog.Find(vendorId);
        if (direct is null) return (null, null, BadRequest(new { error = "unknown_connector" }));
        return (direct, provided ?? [], null);
    }
}
