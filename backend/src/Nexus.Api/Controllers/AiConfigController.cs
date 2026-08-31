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
public sealed class AiConfigController(AiRuntimeConfig config, DynamicChatCompletion chat) : ControllerBase
{
    public sealed record SetKeyRequest(string Provider, string ApiKey, string? Endpoint, string? Model);
    public sealed record SetModelRequest(string Model);

    /// <summary>Statut sans secret : la clé n'est jamais exposée.</summary>
    [HttpGet]
    public IActionResult Get()
    {
        var (provider, configured, model, host) = config.Status();
        return Ok(new
        {
            providers = new[] { "anthropic", "gemini", "openai", "azure-openai" },
            provider,
            configured,
            model,
            endpointHost = host,
        });
    }

    [HttpPut]
    public async Task<IActionResult> Set([FromBody] SetKeyRequest req, CancellationToken ct)
    {
        if (req is null || string.IsNullOrWhiteSpace(req.Provider) || string.IsNullOrWhiteSpace(req.ApiKey))
            return BadRequest(new { error = "provider_and_key_required" });
        if (req.Provider is not ("anthropic" or "azure-openai" or "openai" or "gemini"))
            return BadRequest(new { error = "unknown_provider" });
        if (req.Provider == "azure-openai" && string.IsNullOrWhiteSpace(req.Endpoint))
            return BadRequest(new { error = "endpoint_required_for_azure" });

        config.Set(req.Provider, req.ApiKey, req.Endpoint, req.Model);
        // Si aucun modèle n'est fourni (ou pour Anthropic/OpenAI/Gemini), on choisit
        // automatiquement un modèle de texte fiable — évite les défauts obsolètes (ex. 404).
        if (string.IsNullOrWhiteSpace(req.Model) && req.Provider != "azure-openai")
        {
            var picked = await chat.PickWorkingModelAsync(ct);
            if (!string.IsNullOrWhiteSpace(picked)) config.SetModel(picked!);
        }
        var (provider, configured, model, host) = config.Status();
        return Ok(new { provider, configured, model, endpointHost = host });
    }

    [HttpPatch("model")]
    public IActionResult SetModel([FromBody] SetModelRequest req)
    {
        if (req is null || string.IsNullOrWhiteSpace(req.Model)) return BadRequest(new { error = "model_required" });
        if (!config.SetModel(req.Model)) return BadRequest(new { error = "no_key_configured" });
        var (provider, configured, model, host) = config.Status();
        return Ok(new { provider, configured, model, endpointHost = host });
    }

    [HttpDelete]
    public IActionResult Clear()
    {
        config.Clear();
        return Ok(new { configured = false });
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
