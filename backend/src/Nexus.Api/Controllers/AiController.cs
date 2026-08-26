using Microsoft.AspNetCore.Mvc;
using Nexus.AI;
using Nexus.Api.Tenancy;

namespace Nexus.Api.Controllers;

public sealed record AskRequest(string Question);

/// <summary>AI Analyst : questions en langage naturel, réponses sourcées (articles 19-22, 39).</summary>
[Route("api/v1/ai")]
public sealed class AiController(
    ITenantProvider tenantProvider,
    AiOrchestrator orchestrator) : NexusController(tenantProvider)
{
    [HttpPost("ask")]
    public async Task<IActionResult> Ask([FromBody] AskRequest request, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (string.IsNullOrWhiteSpace(request?.Question))
        {
            return BadRequest("Question requise.");
        }

        return Ok(await orchestrator.AskAsync(tenant, request.Question, ct));
    }
}
