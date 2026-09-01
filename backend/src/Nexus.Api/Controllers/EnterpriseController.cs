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
    ScenarioStore scenarios,
    BusinessStore business) : NexusController(tenantProvider)
{
    // Modèle personnalisé (saisi via le formulaire) prioritaire ; sinon jeux de démo (CGI/Bell).
    private async Task<EnterpriseModel> ResolveModelAsync(Guid tenant, CancellationToken ct)
    {
        var stored = await business.GetAsync(tenant, ct);
        return stored is not null
            ? EnterpriseModelProvider.BuildCustom(stored.CompanyName, stored.Industry, stored.Drivers)
            : EnterpriseModelProvider.ForTenant(tenant);
    }

    /// <summary>État courant du modèle d'entreprise (leviers → états dérivés).</summary>
    [HttpGet("model")]
    public async Task<IActionResult> GetModel(CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        return Ok(await ResolveModelAsync(tenant, ct));
    }

    public sealed record SaveModelRequest(string CompanyName, string Industry, BusinessDrivers Drivers);

    /// <summary>Crée / met à jour le modèle d'entreprise du tenant depuis le formulaire.</summary>
    [HttpPut("model")]
    public async Task<IActionResult> SaveModel([FromBody] SaveModelRequest req, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (req is null || req.Drivers is null || string.IsNullOrWhiteSpace(req.CompanyName))
            return BadRequest(new { error = "company_and_drivers_required" });
        if (req.Drivers.Units <= 0 || req.Drivers.AvgPrice <= 0)
            return BadRequest(new { error = "revenue_drivers_required" });
        await business.SaveAsync(tenant, req.CompanyName, req.Industry ?? "", req.Drivers, ct);
        return Ok(await ResolveModelAsync(tenant, ct));
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

        var model = await ResolveModelAsync(tenant, ct);
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
