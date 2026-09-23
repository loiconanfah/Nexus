using Microsoft.AspNetCore.Mvc;
using Nexus.Api.Business;
using Nexus.Api.Impact;
using Nexus.Api.Organization;
using Nexus.Api.Tenancy;
using Nexus.Api.Workspace;
using Nexus.Domain.Graph;
using Nexus.Domain.ValueObjects;
using Nexus.Graph;
using Nexus.Ingestion.Normalization;
using Nexus.Risk;

namespace Nexus.Api.Controllers;

/// <summary>
/// Espace de travail : sauvegarder, remettre à zéro, restaurer.
///
/// Repartir d'une feuille blanche après un import raté ou une phase d'essai est
/// un besoin courant. Effacer sans filet ne l'est pas : la sauvegarde précède
/// toujours la remise à zéro, et ce qu'elle contient peut être remis en place.
/// </summary>
[Route("api/v1/workspace")]
public sealed class WorkspaceController(
    ITenantProvider tenantProvider,
    IGraphRepository repository,
    OrganizationStore organization,
    BusinessStore business,
    ImpactConfigStore impact,
    WorkspaceStore workspace) : NexusController(tenantProvider)
{
    private const int SnapshotVersion = 1;

    public sealed record SnapshotEntity(
        Guid Id, string EntityType, string Name, int Criticality,
        IReadOnlyList<string> Aliases, string? Description, string? SourceSystem,
        double? CostPerHour, bool Archived);

    public sealed record SnapshotRelation(
        Guid Id, Guid Source, Guid Target, string Type, double Confidence,
        string Status, string? SourceSystem, string? Evidence);

    public sealed record Snapshot(
        int Version,
        DateTime ExportedAt,
        Guid TenantId,
        OrganizationProfile? Profile,
        string? Logo,
        ImpactTuning? ImpactTuning,
        StoredBusiness? BusinessModel,
        IReadOnlyList<SnapshotEntity> Entities,
        IReadOnlyList<SnapshotRelation> Relations);

    /// <summary>
    /// Sauvegarde complète de l'espace, en un seul fichier JSON : profil, réglages
    /// d'impact, modèle d'entreprise, actifs (y compris ceux mis de côté) et
    /// dépendances. C'est ce fichier que restaure <c>POST /workspace/restore</c>.
    /// </summary>
    [HttpGet("export")]
    public async Task<IActionResult> Export(CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;

        var snapshot = await BuildSnapshotAsync(tenant, ct);
        var name = $"lenexux-sauvegarde-{DateTime.UtcNow:yyyy-MM-dd-HHmm}.json";
        Response.Headers.ContentDisposition = $"attachment; filename=\"{name}\"";
        return Ok(snapshot);
    }

    /// <summary>Ce que contient l'espace, pour l'annoncer avant d'effacer.</summary>
    [HttpGet("summary")]
    public async Task<IActionResult> Summary(CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;

        var entities = await repository.GetEntitiesAsync(tenant, 20000, ct);
        var archived = await repository.GetArchivedEntitiesAsync(tenant, 20000, ct);
        var relations = await repository.GetRelationsAsync(tenant, 50000, ct);
        var profile = await organization.GetAsync(tenant, ct);
        var model = await business.GetAsync(tenant, ct);

        return Ok(new
        {
            entities = entities.Count,
            archivedEntities = archived.Count,
            relations = relations.Count,
            hasProfile = profile is not null,
            hasBusinessModel = model is not null,
        });
    }

    public sealed record ResetRequest(string? Confirm, bool KeepProfile = true);

    /// <summary>
    /// Remet l'espace à zéro : le graphe est vidé, ainsi que le modèle
    /// d'entreprise, les scénarios et l'historique. Les comptes, les sondes et la
    /// configuration IA restent en place — sans quoi l'utilisateur perdrait
    /// l'accès à son propre espace. Le profil de l'organisation est conservé par
    /// défaut, car il décrit la maison, pas les données.
    ///
    /// La confirmation explicite est exigée dans le corps de la requête : cette
    /// opération est irréversible sans la sauvegarde.
    /// </summary>
    [HttpPost("reset")]
    public async Task<IActionResult> Reset([FromBody] ResetRequest? req, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (!RequireAdmin(out var forbidden)) return forbidden;
        if (!string.Equals(req?.Confirm?.Trim(), "REINITIALISER", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "confirmation_required" });

        var (entities, relations) = await repository.PurgeTenantAsync(tenant, ct);
        var rows = await workspace.PurgeAsync(tenant, req!.KeepProfile, ct);

        return Ok(new
        {
            entitiesRemoved = entities,
            relationsRemoved = relations,
            recordsRemoved = rows,
            profileKept = req.KeepProfile,
        });
    }

    public sealed record RestoreRequest(Snapshot? Snapshot, bool Replace = false);

    /// <summary>
    /// Restaure une sauvegarde. Par défaut, l'espace doit être vide : restaurer
    /// par-dessus des données existantes s'annonce (<c>replace</c>), et remet
    /// alors l'espace à zéro avant de recharger le fichier.
    /// </summary>
    [HttpPost("restore")]
    public async Task<IActionResult> Restore([FromBody] RestoreRequest? req, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (!RequireAdmin(out var forbidden)) return forbidden;

        var snap = req?.Snapshot;
        if (snap is null) return BadRequest(new { error = "snapshot_required" });
        if (snap.Version > SnapshotVersion) return BadRequest(new { error = "snapshot_too_recent" });

        var existing = await repository.GetEntitiesAsync(tenant, 1, ct);
        if (existing.Count > 0 && !(req!.Replace))
            return Conflict(new { error = "workspace_not_empty" });
        if (existing.Count > 0) await repository.PurgeTenantAsync(tenant, ct);

        // 1. Les actifs d'abord : une dépendance a besoin de ses deux extrémités.
        var known = new HashSet<Guid>();
        var entitiesRestored = 0;
        foreach (var e in snap.Entities ?? [])
        {
            var criticality = Criticality.Create(e.Criticality);
            var built = GraphEntity.Create(
                tenant,
                OntologyResolver.ResolveEntityType(e.EntityType),
                e.Name,
                criticality: criticality.IsSuccess ? criticality.Value : null,
                aliases: e.Aliases,
                description: e.Description,
                sourceSystem: e.SourceSystem,
                id: e.Id,
                costPerHour: e.CostPerHour);
            if (built.IsFailure) continue;

            await repository.UpsertEntityAsync(built.Value, ct);
            if (e.Archived) await repository.DecommissionEntityAsync(tenant, e.Id, ct);
            known.Add(e.Id);
            entitiesRestored++;
        }

        // 2. Les dépendances, avec leur confiance et leur provenance d'origine.
        var relationsRestored = 0;
        foreach (var r in snap.Relations ?? [])
        {
            if (!known.Contains(r.Source) || !known.Contains(r.Target)) continue;
            var type = OntologyResolver.TryResolveRelationType(r.Type);
            if (type is null) continue;
            var confidence = Confidence.Create(r.Confidence);
            if (confidence.IsFailure) continue;
            if (!Enum.TryParse<ConfidenceStatus>(r.Status, ignoreCase: true, out var status))
                status = ConfidenceStatus.Imported;

            var built = GraphRelation.Create(
                tenant, r.Source, r.Target, type, confidence.Value, status,
                sourceSystem: r.SourceSystem, evidence: r.Evidence, id: r.Id);
            if (built.IsFailure) continue;

            await repository.UpsertRelationAsync(built.Value, ct);
            relationsRestored++;
        }

        // 3. Le contexte : profil, réglages d'impact, modèle d'entreprise.
        if (snap.Profile is not null) await organization.SaveAsync(tenant, snap.Profile, ct);
        if (snap.Logo is not null) await organization.SetLogoAsync(tenant, snap.Logo, ct);
        if (snap.ImpactTuning is not null) await impact.SaveAsync(tenant, snap.ImpactTuning, ct);
        if (snap.BusinessModel is not null)
            await business.SaveAsync(tenant, snap.BusinessModel.CompanyName, snap.BusinessModel.Industry,
                snap.BusinessModel.Drivers, "Restauration d'une sauvegarde", ct);

        return Ok(new { entitiesRestored, relationsRestored });
    }

    private async Task<Snapshot> BuildSnapshotAsync(Guid tenant, CancellationToken ct)
    {
        var active = await repository.GetEntitiesAsync(tenant, 20000, ct);
        var archived = await repository.GetArchivedEntitiesAsync(tenant, 20000, ct);
        var relations = await repository.GetRelationsAsync(tenant, 50000, ct);

        var entities = active
            .Select(e => ToSnapshot(e, archived: false))
            .Concat(archived.Select(e => ToSnapshot(e, archived: true)))
            .ToList();

        return new Snapshot(
            SnapshotVersion,
            DateTime.UtcNow,
            tenant,
            await organization.GetAsync(tenant, ct),
            await organization.GetLogoAsync(tenant, ct),
            await impact.GetAsync(tenant, ct),
            await business.GetAsync(tenant, ct),
            entities,
            [.. relations.Select(r => new SnapshotRelation(
                r.Id, r.Source, r.Target, r.Type, r.Confidence, r.Status, r.SourceSystem, r.Evidence))]);
    }

    private static SnapshotEntity ToSnapshot(GraphEntityRecord e, bool archived)
        => new(e.Id, e.EntityType, e.Name, e.Criticality, e.Aliases, e.Description, e.SourceSystem, e.CostPerHour, archived);
}
