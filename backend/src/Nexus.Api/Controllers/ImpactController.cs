using Microsoft.AspNetCore.Mvc;
using Nexus.Api.Impact;
using Nexus.Api.Tenancy;

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
    ImpactIntelligenceService impact) : NexusController(tenantProvider)
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
}
