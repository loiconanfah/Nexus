using Microsoft.AspNetCore.Mvc;
using Nexus.Api.History;
using Nexus.Api.Impact;
using Nexus.Api.Remediations;
using Nexus.Api.Tenancy;
using Nexus.Core.Results;
using Nexus.Domain.Graph;
using Nexus.Domain.Ontology;
using Nexus.Domain.ValueObjects;
using Nexus.Graph;
using Nexus.Ingestion.Normalization;
using Nexus.Risk;
using Nexus.Risk.Reporting;
using Nexus.Risk.Spof;

namespace Nexus.Api.Controllers;

/// <summary>
/// « J'ai corrigé » : déclarer une correction, et VOIR ce qu'elle change.
///
/// Le produit détectait, recommandait, puis s'arrêtait. L'utilisateur qui posait
/// un secours ou nommait un responsable n'avait aucun moyen de le dire à l'outil
/// depuis l'endroit où le défaut lui était signalé, ni de constater l'effet. Le
/// travail le plus utile restait donc invisible, et la preuve qu'un régulateur
/// réclame n'existait pas.
///
/// Une correction est mesurée AVANT et APRÈS par les moteurs qui alimentent déjà
/// les écrans : le score de risque de l'élément, l'indice de résilience et le
/// coût horaire de l'arrêt. L'écart n'est donc pas une promesse, c'est la même
/// mesure prise deux fois.
///
/// Le garde-fou qui compte : une correction n'améliore un score que si elle
/// modifie VRAIMENT la cartographie, un secours nommé, une procédure qui existe,
/// un responsable désigné, un second fournisseur. Déclarée sans contrepartie
/// vérifiable, elle est conservée comme note et ne touche à rien, sans quoi il
/// suffirait de cliquer pour paraître résilient.
/// </summary>
[Route("api/v1/remediations")]
public sealed class RemediationsController(
    ITenantProvider tenantProvider,
    IGraphRepository graph,
    RiskAnalyzer riskAnalyzer,
    SpofAnalyzer spofAnalyzer,
    ImpactConfigStore impactConfig,
    ResilienceStore resilience,
    RemediationStore store) : NexusController(tenantProvider)
{
    private const string Source = "Remediation";

    /// <summary>
    /// Les corrections reconnues, et le lien qu'elles écrivent. Chacune répond à
    /// un défaut que le produit sait détecter.
    /// </summary>
    private static readonly Dictionary<string, (string Relation, bool FromTarget, string NeedsType)> Kinds = new(StringComparer.Ordinal)
    {
        // Un secours existe : l'élément est désormais secouru par l'autre.
        ["backup"] = ("BACKED_UP_BY", true, ""),
        // Un second fournisseur est qualifié.
        ["supplier"] = ("SUPPLIED_BY", true, "Supplier"),
        // Une procédure écrite existe.
        ["procedure"] = ("DOCUMENTED_BY", true, "Document"),
        // Un responsable est nommé.
        ["owner"] = ("MANAGED_BY", true, ""),
        // Une seconde personne sait faire fonctionner l'élément.
        ["second_person"] = ("KNOWS", false, "Person"),
    };

    public sealed record ApplyRequest(
        string? Kind, Guid TargetId, Guid? WithId, string? WithName, string? Note);

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int limit, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        var list = await store.ListAsync(tenant, limit == 0 ? 50 : limit, ct);
        return Ok(list);
    }

    [HttpPost]
    public async Task<IActionResult> Apply([FromBody] ApplyRequest? req, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (req is null || req.TargetId == Guid.Empty) return BadRequest(new { error = "target_required" });

        var kind = req.Kind?.Trim() ?? "note";
        if (kind != "note" && !Kinds.ContainsKey(kind))
            return BadRequest(new { error = "unknown_kind", expected = Kinds.Keys.Append("note") });

        var target = await graph.GetEntityAsync(tenant, req.TargetId, ct);
        if (target is null) return NotFound(new { error = "entity_not_found" });

        var before = await MeasureAsync(tenant, target.Id, ct);

        // La contrepartie : l'élément qui porte la correction. Fourni par son
        // identifiant, ou créé à partir de son nom (une procédure, une personne
        // n'existent souvent pas encore dans la carte).
        var changed = false;
        string? counterpartName = null;
        if (kind != "note")
        {
            var (relation, fromTarget, needsType) = Kinds[kind];
            var counterpart = await ResolveCounterpartAsync(tenant, req, needsType, ct);
            if (counterpart is null)
                return BadRequest(new { error = "counterpart_required", detail = "Nommez l'élément qui porte la correction." });

            counterpartName = counterpart.Name;
            var relType = OntologyResolver.TryResolveRelationType(relation);
            if (relType is null) return BadRequest(new { error = "relation_unknown" });

            var (from, to) = fromTarget ? (target.Id, counterpart.Id) : (counterpart.Id, target.Id);
            var confidence = Confidence.Create(0.99);
            var built = GraphRelation.Create(
                tenant, from, to, relType,
                confidence.IsSuccess ? confidence.Value : Confidence.Create(1.0).Value,
                ConfidenceStatus.Verified,
                sourceSystem: Source,
                evidence: $"Correction déclarée par {Who()}{(string.IsNullOrWhiteSpace(req.Note) ? "" : $" — {req.Note!.Trim()}")}");
            if (built.IsFailure) return BadRequest(new { error = built.Error.Message });

            await graph.UpsertRelationAsync(built.Value, ct);
            changed = true;
        }

        var after = await MeasureAsync(tenant, target.Id, ct);
        var record = new Remediation(
            Guid.NewGuid(), kind, target.Id, target.Name,
            string.IsNullOrWhiteSpace(req.Note) ? null : req.Note!.Trim(), Who(), DateTime.UtcNow,
            before.Score, after.Score, before.Index, after.Index, before.Cost, after.Cost, changed);
        await store.AddAsync(tenant, record, ct);

        return Ok(new
        {
            remediation = record,
            counterpart = counterpartName,
            // L'écart, calculé pour l'écran : un score qui baisse est un progrès,
            // un indice qui monte aussi. Les deux signes vont en sens inverse.
            delta = new
            {
                score = after.Score - before.Score,
                index = after.Index - before.Index,
                hourlyCost = after.Cost - before.Cost,
                spofRemoved = before.IsSpof && !after.IsSpof,
            },
        });
    }

    private sealed record Measure(int Score, int Index, long Cost, bool IsSpof);

    /// <summary>
    /// La mesure, prise par les moteurs qui alimentent déjà les écrans. Aucun
    /// calcul propre ici : l'écart doit être comparable à ce que l'utilisateur
    /// lit ailleurs, sinon il ne le croira pas.
    /// </summary>
    private async Task<Measure> MeasureAsync(Guid tenant, Guid id, CancellationToken ct)
    {
        var entities = await graph.GetEntitiesAsync(tenant, ct: ct);
        var relations = await graph.GetRelationsAsync(tenant, ct: ct);
        var spofs = entities.Count == 0 ? [] : await spofAnalyzer.AnalyzeAsync(tenant, limit: 40, ct: ct);
        var index = ResilienceIndex.Compute(entities, relations, spofs);

        var risk = await riskAnalyzer.AssessEntityAsync(tenant, id, ct: ct);
        var tuning = await impactConfig.GetEffectiveAsync(tenant, ct);
        var entity = entities.FirstOrDefault(e => e.Id == id);
        var cost = entity is null ? 0L
            : (long)Math.Round((double)BusinessImpactModel.CostPerHour(entity.Criticality, entity.CostPerHour, tuning));

        return new Measure(
            (int)Math.Round(risk?.Assessment.Score ?? 0),
            index.Total,
            cost,
            spofs.Any(s => s.Entity.Id == id && s.Score >= 60));
    }

    /// <summary>
    /// L'élément qui porte la correction : celui qu'on désigne, ou celui qu'on
    /// crée en le nommant. Un secours ou une procédure ne figurent souvent pas
    /// encore dans la carte, et obliger à les créer ailleurs d'abord ferait
    /// abandonner la déclaration.
    /// </summary>
    private async Task<GraphEntityRecord?> ResolveCounterpartAsync(Guid tenant, ApplyRequest req, string needsType, CancellationToken ct)
    {
        if (req.WithId is { } id && id != Guid.Empty)
            return await graph.GetEntityAsync(tenant, id, ct);

        var name = req.WithName?.Trim();
        if (string.IsNullOrWhiteSpace(name)) return null;

        var type = string.IsNullOrEmpty(needsType) ? EntityType.Asset : OntologyResolver.ResolveEntityType(needsType);
        var crit = Criticality.Create(40);
        var created = GraphEntity.Create(
            tenant, type, name,
            criticality: crit.IsSuccess ? crit.Value : null,
            description: $"Créé en déclarant une correction ({Who()})",
            sourceSystem: Source);
        if (created.IsFailure) return null;

        await graph.UpsertEntityAsync(created.Value, ct);
        return await graph.GetEntityAsync(tenant, created.Value.Id, ct);
    }

    private string Who() => CurrentEmail ?? User?.Identity?.Name ?? "utilisateur";
}
