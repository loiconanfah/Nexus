using Microsoft.AspNetCore.Mvc;
using Nexus.Api.Impact;
using Nexus.Api.Tenancy;
using Nexus.Risk;

namespace Nexus.Api.Controllers;

/// <summary>
/// Intelligence d'impact transversale : une question métier en langage naturel
/// (« que se passe-t-il si nous perdons le fournisseur X ? ») → cascade sur le
/// graphe → impact financier → éléments critiques → dépendances dangereuses →
/// mitigations. C'est la couche qui relie les silos que les ERP/ITSM ne voient
/// chacun que partiellement.
/// </summary>
[Route("api/v1/impact")]
public sealed class ImpactController(
    ITenantProvider tenantProvider,
    ImpactIntelligenceService impact,
    ImpactConfigStore impactConfig) : NexusController(tenantProvider)
{
    public sealed record AnalyzeRequest(string Question, string? Lang);

    /// <summary>Analyse d'impact transversale d'un problème/décision exprimé en langage naturel.</summary>
    [HttpPost("analyze")]
    public async Task<IActionResult> Analyze([FromBody] AnalyzeRequest req, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (req is null || string.IsNullOrWhiteSpace(req.Question))
            return BadRequest(new { error = "question_required" });

        var lang = req.Lang == "en" ? "en" : "fr";
        var result = await impact.AnalyzeAsync(tenant, req.Question.Trim(), lang, ct);
        return Ok(result);
    }

    // ── Réglages du modèle d'impact (paliers de coût, RTO, probabilité) ──

    /// <summary>Réglages EFFECTIFS du tenant + s'ils sont personnalisés ou par défaut.</summary>
    [HttpGet("config")]
    public async Task<IActionResult> GetConfig(CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        var stored = await impactConfig.GetAsync(tenant, ct);
        return Ok(new { tuning = stored ?? ImpactTuning.Default, customized = stored is not null, defaults = ImpactTuning.Default });
    }

    /// <summary>Enregistre des réglages personnalisés pour le tenant.</summary>
    [HttpPut("config")]
    public async Task<IActionResult> SaveConfig([FromBody] ImpactTuning tuning, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (!RequireAdmin(out var forbidden)) return forbidden;
        if (tuning is null) return BadRequest(new { error = "tuning_required" });
        // Bornes de sûreté : coûts ≥ 0, probabilités dans [0,1], multiplicateur > 0.
        var safe = tuning with
        {
            RtoMultiplier = Math.Clamp(tuning.RtoMultiplier, 0.1, 10.0),
            ProbabilityDecay = Math.Clamp(tuning.ProbabilityDecay, 0.1, 1.0),
            ProbabilityFloor = Math.Clamp(tuning.ProbabilityFloor, 0.0, 1.0),
            CostVeryHigh = Math.Max(0, tuning.CostVeryHigh), CostHigh = Math.Max(0, tuning.CostHigh),
            CostElevated = Math.Max(0, tuning.CostElevated), CostSignificant = Math.Max(0, tuning.CostSignificant),
            CostModerate = Math.Max(0, tuning.CostModerate), CostLow = Math.Max(0, tuning.CostLow),
            CostMinimal = Math.Max(0, tuning.CostMinimal),
        };
        await impactConfig.SaveAsync(tenant, safe, ct);
        return Ok(new { tuning = safe, customized = true, defaults = ImpactTuning.Default });
    }

    /// <summary>Réinitialise les réglages du tenant aux valeurs par défaut du produit.</summary>
    [HttpPost("config/reset")]
    public async Task<IActionResult> ResetConfig(CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (!RequireAdmin(out var forbidden)) return forbidden;
        await impactConfig.ResetAsync(tenant, ct);
        return Ok(new { tuning = ImpactTuning.Default, customized = false, defaults = ImpactTuning.Default });
    }
}
