using Microsoft.AspNetCore.Mvc;
using Nexus.AI;

namespace Nexus.Api.Controllers;

/// <summary>
/// Configuration du fournisseur IA (clé de modèle), pilotée depuis Admin.
/// CONFORMITÉ : la clé est stockée UNIQUEMENT côté serveur (en mémoire) et n'est
/// JAMAIS renvoyée au client ni journalisée. Global (non lié au tenant).
/// </summary>
[ApiController]
[Route("api/v1/ai/config")]
public sealed class AiConfigController(
    AiRuntimeConfig config, DynamicChatCompletion chat,
    ICurrentTenant tenant, ILlmUsageStore usage, LlmQuotaOptions quota) : ControllerBase
{
    /// <summary>Garde admin locale (ce contrôleur n'hérite pas de NexusController).</summary>
    private bool RequireAdmin(out IActionResult error)
    {
        if (string.Equals(User?.FindFirst("role")?.Value, "admin", StringComparison.OrdinalIgnoreCase))
        { error = null!; return true; }
        error = Problem(title: "admin_required",
            detail: "Cette opération est réservée aux administrateurs de l'espace de travail.",
            statusCode: StatusCodes.Status403Forbidden);
        return false;
    }

    public sealed record SetKeyRequest(string Provider, string ApiKey, string? Endpoint, string? Model);
    public sealed record SetModelRequest(string Model);

    /// <summary>Consommation LLM du tenant sur le mois courant + plafonds (0 = illimité).</summary>
    [HttpGet("/api/v1/ai/usage")]
    public async Task<IActionResult> Usage(CancellationToken ct)
    {
        var period = DateTime.UtcNow.ToString("yyyy-MM");
        var tid = tenant.TenantId;
        var u = tid is null ? new LlmUsage(0, 0) : await usage.GetAsync(tid.Value, period, ct);
        var capReached = (quota.MonthlyCallCap > 0 && u.Calls >= quota.MonthlyCallCap)
                      || (quota.MonthlyCharCap > 0 && u.Chars >= quota.MonthlyCharCap);
        return Ok(new
        {
            period,
            calls = u.Calls,
            chars = u.Chars,
            callCap = quota.MonthlyCallCap,
            charCap = quota.MonthlyCharCap,
            capReached,
        });
    }

    /// <summary>Statut sans secret : la clé n'est jamais exposée.</summary>
    [HttpGet]
    public IActionResult Get()
    {
        var (provider, configured, model, host) = config.Status();
        return Ok(new
        {
            providers = new[] { "openrouter", "anthropic", "gemini", "openai", "azure-openai" },
            provider,
            configured,
            model,
            endpointHost = host,
            // « shared » : l'espace n'a pas de cle propre et utilise celle de Lenexux.
            source = config.Source(),
        });
    }

    [HttpPut]
    public async Task<IActionResult> Set([FromBody] SetKeyRequest req, CancellationToken ct)
    {
        if (!RequireAdmin(out var forbidden)) return forbidden;
        if (req is null || string.IsNullOrWhiteSpace(req.Provider) || string.IsNullOrWhiteSpace(req.ApiKey))
            return BadRequest(new { error = "provider_and_key_required" });
        if (req.Provider is not ("openrouter" or "anthropic" or "azure-openai" or "openai" or "gemini"))
            return BadRequest(new { error = "unknown_provider" });
        if (req.Provider == "azure-openai" && string.IsNullOrWhiteSpace(req.Endpoint))
            return BadRequest(new { error = "endpoint_required_for_azure" });

        config.Set(req.Provider, req.ApiKey, req.Endpoint, req.Model);
        // Garantit un modèle qui répond VRAIMENT. Si aucun modèle n'est fourni, ou si
        // celui saisi échoue à l'appel réel (ex. gemini-2.5-pro : indisponible/quota sur
        // le palier gratuit → repli silencieux sur les règles), on bascule automatiquement
        // sur un modèle de texte fiable (flash). Un modèle payant qui fonctionne est conservé.
        if (req.Provider != "azure-openai")
        {
            var needPick = string.IsNullOrWhiteSpace(req.Model);
            if (!needPick)
            {
                var (works, _) = await chat.TestAsync(ct);
                needPick = !works;
            }
            if (needPick)
            {
                var picked = await chat.PickWorkingModelAsync(ct);
                if (!string.IsNullOrWhiteSpace(picked)) config.SetModel(picked!);
            }
        }
        var (provider, configured, model, host) = config.Status();
        return Ok(new { provider, configured, model, endpointHost = host });
    }

    [HttpPatch("model")]
    public IActionResult SetModel([FromBody] SetModelRequest req)
    {
        if (!RequireAdmin(out var forbidden)) return forbidden;
        if (config.Source() == "shared") return Conflict(new { error = "shared_key" });
        if (req is null || string.IsNullOrWhiteSpace(req.Model)) return BadRequest(new { error = "model_required" });
        if (!config.SetModel(req.Model)) return BadRequest(new { error = "no_key_configured" });
        var (provider, configured, model, host) = config.Status();
        return Ok(new { provider, configured, model, endpointHost = host });
    }

    [HttpDelete]
    public IActionResult Clear()
    {
        if (!RequireAdmin(out var forbidden)) return forbidden;
        config.Clear();
        // Apres effacement, la cle partagee peut encore s'appliquer : on renvoie l'etat reel.
        var (_, configured, _, _) = config.Status();
        return Ok(new { configured, source = config.Source() });
    }

    [HttpPost("test")]
    public async Task<IActionResult> Test(CancellationToken ct)
    {
        var (ok, message) = await chat.TestAsync(ct);
        return Ok(new { ok, message });
    }

    /// <summary>Choisit et applique automatiquement un modèle de texte fiable pour la clé configurée.</summary>
    [HttpPost("autopick")]
    public async Task<IActionResult> AutoPick(CancellationToken ct)
    {
        if (!RequireAdmin(out var forbidden)) return forbidden;
        if (config.Source() == "shared") return Conflict(new { error = "shared_key" });
        var picked = await chat.PickWorkingModelAsync(ct);
        if (string.IsNullOrWhiteSpace(picked)) return Ok(new { ok = false, message = "Aucun modèle utilisable trouvé." });
        config.SetModel(picked!);
        return Ok(new { ok = true, model = picked });
    }

    /// <summary>Liste les modèles disponibles pour la clé configurée (valide aussi la clé).</summary>
    [HttpPost("models")]
    public async Task<IActionResult> Models(CancellationToken ct)
    {
        var (ok, message, models) = await chat.ListModelsAsync(ct);
        return Ok(new { ok, message, models });
    }
}
