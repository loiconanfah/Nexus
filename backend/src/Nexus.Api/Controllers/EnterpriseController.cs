using Microsoft.AspNetCore.Mvc;
using Nexus.Api.Business;
using Nexus.Api.Tenancy;

namespace Nexus.Api.Controllers;

/// <summary>
/// Modèle d'entreprise (couche « Decision Intelligence », article 31) : socle
/// financier & opérationnel dérivé de leviers déterministes.
/// </summary>
[Route("api/v1/enterprise")]
public sealed class EnterpriseController(
    ITenantProvider tenantProvider,
    DecisionInterpreter interpreter,
    DecisionAnalyzer analyzer,
    ScenarioStore scenarios) : NexusController(tenantProvider)
{
    /// <summary>État courant du modèle d'entreprise (leviers → états dérivés).</summary>
    [HttpGet("model")]
    public IActionResult GetModel()
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        return Ok(EnterpriseModelProvider.ForTenant(tenant));
    }

    public sealed record DecisionRequest(string Text, string? Lang);

    /// <summary>
    /// Interprète une décision en langage naturel → effets structurés (leviers +
    /// éventuel nouveau service) + interprétation IA. Le calcul d'impact reste
    /// déterministe côté client (même moteur que le modèle).
    /// </summary>
    [HttpPost("decision")]
    public async Task<IActionResult> Decide([FromBody] DecisionRequest req, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (req is null || string.IsNullOrWhiteSpace(req.Text)) return BadRequest(new { error = "text_required" });

        var model = EnterpriseModelProvider.ForTenant(tenant);
        if (!model.Configured) return BadRequest(new { error = "model_not_configured" });

        var lang = req.Lang == "en" ? "en" : "fr";
        var effect = await interpreter.InterpretAsync(req.Text.Trim(), model.Drivers, lang, ct);
        var analysis = await analyzer.AnalyzeAsync(req.Text.Trim(), model.Drivers, effect, lang, ct);
        return Ok(new { effect, analysis });
    }

    // ── Sauvegarde de scénarios (diagramme de décision) ──
    public sealed record SaveScenarioRequest(string Name, string Payload);

    [HttpGet("scenarios")]
    public async Task<IActionResult> ListScenarios(CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        var list = await scenarios.ListAsync(tenant, ct);
        return Ok(list.Select(s => new { id = s.Id, name = s.Name, payload = s.Payload, createdAt = s.CreatedAt }));
    }

    [HttpPost("scenarios")]
    public async Task<IActionResult> SaveScenario([FromBody] SaveScenarioRequest req, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (req is null || string.IsNullOrWhiteSpace(req.Name) || string.IsNullOrWhiteSpace(req.Payload))
            return BadRequest(new { error = "name_and_payload_required" });
        var id = await scenarios.SaveAsync(tenant, req.Name.Trim(), req.Payload, ct);
        return Ok(new { id });
    }

    [HttpDelete("scenarios/{id:guid}")]
    public async Task<IActionResult> DeleteScenario(Guid id, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        await scenarios.DeleteAsync(tenant, id, ct);
        return NoContent();
    }
}
