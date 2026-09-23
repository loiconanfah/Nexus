using Nexus.Api.Auth;
using Nexus.Api.Collectors;
using Nexus.Domain.ValueObjects;
using Nexus.Graph;

namespace Nexus.Api.Organization;

/// <summary>
/// Une étape de mise en place. Le libellé est rendu par l'interface (bilingue) ;
/// l'API ne fournit que l'état MESURÉ : une étape n'est jamais cochée à la main,
/// elle l'est parce que la donnée existe.
/// </summary>
public sealed record SetupStep(
    string Key, bool Required, bool Done, int Current, int Target, string Route);

public sealed record SetupProgressReport(
    int Percent, bool RequiredDone, int DoneCount, int Total, IReadOnlyList<SetupStep> Steps, string? Next);

/// <summary>
/// Calcule l'avancement de la mise en place à partir de l'état réel de l'espace.
///
/// Les seuils sont délibérément modestes : ils marquent le minimum pour que les
/// analyses aient un sens (une cascade sur 2 systèmes n'apprend rien), pas une
/// cartographie exhaustive.
/// </summary>
public sealed class SetupProgressService(
    OrganizationStore organization,
    IGraphRepository graph,
    PgUserStore users)
{
    private static readonly HashSet<string> Activities = new(StringComparer.OrdinalIgnoreCase)
        { "BusinessProcess", "BusinessService", "Process" };

    private static readonly HashSet<string> People = new(StringComparer.OrdinalIgnoreCase)
        { "Person", "Role", "Team" };

    private static readonly HashSet<string> Assets = new(StringComparer.OrdinalIgnoreCase)
    {
        "Asset", "Infrastructure", "Server", "Device", "Network", "CloudResource",
        "Application", "Service", "System", "Database", "DataStore",
        "AiModel", "AiAgent", "AiService", "ModelEndpoint", "Dataset",
    };

    public async Task<SetupProgressReport> ComputeAsync(Guid tenant, CancellationToken ct)
    {
        var profile = await organization.GetAsync(tenant, ct);
        var milestones = await organization.MilestonesAsync(tenant, ct);
        var entities = await graph.GetEntitiesAsync(tenant, ct: ct);
        var relations = await graph.GetRelationsAsync(tenant, ct: ct);
        var members = await users.ListByTenantAsync(tenant, ct);

        // Les actions du plan sont des nœuds Control : elles ne décrivent pas l'entreprise.
        var modelled = entities.Where(e => e.EntityType != "Control").ToList();
        var activities = modelled.Where(e => Activities.Contains(e.EntityType)).ToList();
        var assets = modelled.Count(e => Assets.Contains(e.EntityType));
        var suppliers = modelled.Count(e => e.EntityType == "Supplier");
        var people = modelled.Count(e => People.Contains(e.EntityType));
        var costed = activities.Count(e => e.CostPerHour is > 0);
        var verified = relations.Count(IsHumanValidated);

        // Valider 1 relation sur 4 (au moins 3, au plus 10) : assez pour que la base
        // probante d'un chiffrage d'impact tienne, sans exiger un audit complet.
        var verifyTarget = Math.Clamp((int)Math.Ceiling(relations.Count * 0.25), 3, 10);

        var steps = new List<SetupStep>
        {
            new("profile", true, profile?.Completed == true, profile?.Completed == true ? 1 : 0, 1, "/demarrage"),
            new("activities", true, activities.Count >= 1, activities.Count, 1, "/onboarding"),
            new("systems", true, assets >= 3, assets, 3, "/onboarding"),
            new("dependencies", true, relations.Count >= 5, relations.Count, 5, "/graph"),
            new("suppliers", false, suppliers >= 1, suppliers, 1, "/suppliers"),
            new("people", false, people >= 1, people, 1, "/human"),
            new("costs", false, costed >= 1, costed, Math.Max(1, Math.Min(activities.Count, 3)), "/impact"),
            new("validate", false, verified >= verifyTarget, verified, verifyTarget, "/audit"),
            new("simulation", false, milestones.ContainsKey("simulation"), milestones.ContainsKey("simulation") ? 1 : 0, 1, "/simulations"),
            new("team", false, members.Count >= 2, members.Count, 2, "/admin"),
            new("report", false, milestones.ContainsKey("report"), milestones.ContainsKey("report") ? 1 : 0, 1, "/reports"),
        };

        // Les étapes obligatoires pèsent double : ce sont elles qui rendent l'outil utile.
        double weight(SetupStep s) => s.Required ? 2 : 1;
        double partial(SetupStep s) => s.Done ? 1 : s.Target <= 0 ? 0 : Math.Min(1, (double)s.Current / s.Target);
        var percent = (int)Math.Round(100 * steps.Sum(s => weight(s) * partial(s)) / steps.Sum(weight));

        var next = steps.FirstOrDefault(s => s.Required && !s.Done) ?? steps.FirstOrDefault(s => !s.Done);
        return new SetupProgressReport(
            percent, steps.Where(s => s.Required).All(s => s.Done),
            steps.Count(s => s.Done), steps.Count, steps, next?.Key);
    }

    private static bool IsHumanValidated(GraphEdgeRecord r)
        => r.Evidences is { Count: > 0 } ev
            ? ev.Any(e => e.Source == EvidenceSource.HumanValidation)
            : string.Equals(r.Status, nameof(ConfidenceStatus.Verified), StringComparison.OrdinalIgnoreCase);
}

/// <summary>Un rappel ou une opération en cours, calculé à la volée.</summary>
public sealed record Notice(
    string Id, string Kind, string Severity, string Code, IReadOnlyDictionary<string, object?> Data,
    string? Route, DateTime? At);

/// <summary>
/// Centre de notifications. Rien n'est stocké : chaque avis découle de l'état
/// courant, disparaît de lui-même quand la situation est réglée, et porte un
/// identifiant STABLE pour que l'interface mémorise ce qui a été lu.
/// </summary>
public sealed class NotificationService(
    SetupProgressService progress,
    CollectorStore collectors,
    IGraphRepository graph,
    Nexus.Api.History.ResilienceStore resilience)
{
    /// <summary>
    /// Au-delà de ce délai, une dépendance dont plus rien n'a été observé n'est
    /// plus un fait mais un souvenir. C'est le seul signal que le produit
    /// fabrique TOUT SEUL, sans que personne n'ait rien fait : la raison de
    /// revenir, et elle est honnête puisqu'elle reflète une vraie dégradation.
    /// </summary>
    private const int StaleDays = 90;

    public async Task<IReadOnlyList<Notice>> ListAsync(Guid tenant, bool isAdmin, CancellationToken ct)
    {
        var list = new List<Notice>();
        var now = DateTime.UtcNow;

        // 1. Mise en place : la prochaine étape à franchir (une seule, pour ne pas noyer).
        var setup = await progress.ComputeAsync(tenant, ct);
        var next = setup.Steps.FirstOrDefault(s => s.Key == setup.Next);
        if (next is not null)
        {
            list.Add(new Notice($"setup.{next.Key}", "task", next.Required ? "warning" : "info", $"setup.{next.Key}",
                new Dictionary<string, object?> { ["current"] = next.Current, ["target"] = next.Target, ["percent"] = setup.Percent },
                next.Route, null));
        }

        // 2. Opérations en cours et échecs récents des sondes.
        var jobs = await collectors.ListJobsAsync(tenant, 50, ct);
        var running = jobs.Where(j => j.Status == "running").ToList();
        if (running.Count > 0)
            list.Add(new Notice("ops.running", "operation", "info", "ops.running",
                new Dictionary<string, object?> { ["count"] = running.Count }, "/admin", running.Max(j => j.CreatedAt)));

        var queued = jobs.Count(j => j.Status == "pending" && j.ScheduledFor <= now);
        if (queued > 0)
            list.Add(new Notice("ops.queued", "operation", "info", "ops.queued",
                new Dictionary<string, object?> { ["count"] = queued }, "/admin", null));

        foreach (var failed in jobs.Where(j => j.Status == "failed" && j.CompletedAt > now.AddDays(-7)).Take(3))
            list.Add(new Notice($"ops.failed.{failed.Id}", "alert", "danger", "ops.failed",
                new Dictionary<string, object?> { ["error"] = failed.Error }, "/admin", failed.CompletedAt));

        foreach (var done in jobs.Where(j => j.Status == "done" && j.CompletedAt > now.AddDays(-2)).Take(3))
            list.Add(new Notice($"ops.done.{done.Id}", "operation", "success", "ops.done",
                new Dictionary<string, object?> { ["entities"] = done.EntitiesCreated, ["relations"] = done.RelationsCreated },
                "/graph", done.CompletedAt));

        // 3. Sondes muettes : une cartographie qui ne se rafraîchit plus vieillit.
        foreach (var c in (await collectors.ListAsync(tenant, ct)).Where(c => c.LastSeenAt is { } seen && seen < now.AddHours(-2)))
            list.Add(new Notice($"collector.offline.{c.Id}", "alert", "warning", "collector.offline",
                new Dictionary<string, object?> { ["name"] = c.Name, ["since"] = c.LastSeenAt }, "/admin", c.LastSeenAt));

        // 4. Qualité des données : suggestions IA en attente et dépendances fragiles.
        var relations = await graph.GetRelationsAsync(tenant, ct: ct);
        var suggested = relations.Count(r => string.Equals(r.Status, nameof(ConfidenceStatus.AiSuggested), StringComparison.OrdinalIgnoreCase));
        if (suggested > 0)
            list.Add(new Notice("data.suggested", "task", "info", "data.suggested",
                new Dictionary<string, object?> { ["count"] = suggested }, "/audit", null));

        var weak = relations.Count(r => r.Confidence < 0.5);
        if (weak > 0)
            list.Add(new Notice("data.weak", "task", "warning", "data.weak",
                new Dictionary<string, object?> { ["count"] = weak }, "/audit", null));

        // 4 bis. Ce qui a VIEILLI. Une preuve ancienne reste une preuve, mais sa
        // fraîcheur décote : une carte que personne ne rafraîchit finit par décrire
        // une organisation qui n'existe plus.
        var stale = relations.Count(r => r.Evidences is { Count: > 0 } ev
            && ev.Max(e => e.CollectedAt) < now.AddDays(-StaleDays));
        if (stale > 0)
            list.Add(new Notice("data.stale", "task", "warning", "data.stale",
                new Dictionary<string, object?> { ["count"] = stale, ["days"] = StaleDays }, "/audit", null));

        // 4 ter. Actifs isolés : ils n'entrent dans AUCUNE propagation, donc dans
        // aucun chiffrage d'impact. Les relier est le geste le plus rentable.
        var entities = await graph.GetEntitiesAsync(tenant, ct: ct);
        if (entities.Count > 0)
        {
            var linked = new HashSet<Guid>();
            foreach (var r in relations) { linked.Add(r.Source); linked.Add(r.Target); }
            var isolated = entities.Count(e => !linked.Contains(e.Id));
            if (isolated > 0)
                list.Add(new Notice("data.isolated", "task", "info", "data.isolated",
                    new Dictionary<string, object?> { ["count"] = isolated }, "/inference", null));
        }

        // 4 quater. L'indice de résilience a-t-il bougé cette semaine ? Une baisse
        // se signale d'elle-même, une hausse aussi : c'est ce qui donne envie de
        // recommencer.
        var series = await resilience.HistoryAsync(tenant, 8, ct);
        if (series.Count >= 2)
        {
            var first = series[0];
            var last = series[^1];
            var delta = last.Total - first.Total;
            if (delta != 0)
                list.Add(new Notice("index.moved", "operation", delta < 0 ? "warning" : "success", "index.moved",
                    new Dictionary<string, object?> { ["delta"] = delta, ["total"] = last.Total }, "/dashboard", null));
        }

        // 5. Plan d'action : ce qui reste ouvert.
        var actions = (await graph.GetEntitiesAsync(tenant, ct: ct))
            .Where(e => e.EntityType == "Control" && (e.SourceSystem ?? "").StartsWith("Action Plan", StringComparison.Ordinal))
            .Select(e => e.Description ?? "")
            .ToList();
        var open = actions.Count(d => !d.Contains("\"status\":\"Done\"", StringComparison.OrdinalIgnoreCase));
        if (open > 0)
            list.Add(new Notice("actions.open", "task", "info", "actions.open",
                new Dictionary<string, object?> { ["count"] = open }, "/actions", null));

        // Les avis réservés à l'administration (sondes) n'ont pas de sens pour un membre.
        if (!isAdmin) list.RemoveAll(n => n.Route == "/admin");

        return list
            .OrderBy(n => n.Severity switch { "danger" => 0, "warning" => 1, "info" => 2, _ => 3 })
            .ThenByDescending(n => n.At ?? DateTime.MinValue)
            .ToList();
    }
}
