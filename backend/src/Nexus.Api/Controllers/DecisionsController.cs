using Microsoft.AspNetCore.Mvc;
using Nexus.Api.Business;
using Nexus.AI.Decisions;
using Nexus.Api.Impact;
using Nexus.Api.Organization;
using Nexus.Api.Tenancy;
using Nexus.Graph;
using Nexus.Risk.Decisions;

namespace Nexus.Api.Controllers;

/// <summary>
/// Décisions fondées sur le graphe : recruter, remplacer, changer d'outil, de
/// fournisseur, de site, automatiser. Le moteur est déterministe ; l'IA ne sert
/// qu'à préparer la décision : champs suggérés et angles morts, toujours à confirmer.
/// </summary>
[Route("api/v1/decisions")]
public sealed class DecisionsController(
    ITenantProvider tenantProvider,
    IGraphRepository graph,
    OrganizationStore organization,
    ImpactConfigStore impactConfig,
    BusinessStore business,
    DecisionAssistant assistant) : NexusController(tenantProvider)
{
    public sealed record AnalyzeRequest(DecisionSpec Spec, string? Lang);
    public sealed record InterpretRequest(string Text, string? Lang);

    private async Task<(GraphView Graph, DecisionContext Ctx, string? Sector)> LoadAsync(Guid tenant, CancellationToken ct)
    {
        var entities = await graph.GetEntitiesAsync(tenant, ct: ct);
        var edges = await graph.GetRelationsAsync(tenant, ct: ct);
        var profile = await organization.GetAsync(tenant, ct);
        var tuning = await impactConfig.GetEffectiveAsync(tenant, ct);
        var model = await business.GetAsync(tenant, ct);
        var ctx = new DecisionContext(
            profile?.Currency ?? Currencies.Default,
            profile?.AnnualRevenue ?? 0,
            profile?.Headcount ?? 0,
            profile?.OperatingMode ?? "business",
            model?.Drivers.AvgSalary is > 0 ? model.Drivers.AvgSalary : null,
            profile?.Country,
            tuning);
        return (GraphView.From(entities, edges), ctx, profile?.Sector);
    }

    [HttpPost("analyze")]
    public async Task<IActionResult> Analyze([FromBody] AnalyzeRequest req, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (req?.Spec is null || !DecisionKinds.All.Contains(req.Spec.Kind)) return BadRequest(new { error = "kind_invalid" });
        var (g, ctx, _) = await LoadAsync(tenant, ct);
        return Ok(new DecisionEngine(g, ctx, req.Lang == "en" ? "en" : "fr").Analyze(req.Spec));
    }

    [HttpPost("interpret")]
    public async Task<IActionResult> Interpret([FromBody] InterpretRequest req, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (string.IsNullOrWhiteSpace(req?.Text) || req.Text.Length > 1000) return BadRequest(new { error = "text_invalid" });
        var (g, ctx, sector) = await LoadAsync(tenant, ct);
        return Ok(await assistant.PrepareAsync(req.Text.Trim(), g, ctx, sector, req.Lang == "en" ? "en" : "fr", ct));
    }
}
