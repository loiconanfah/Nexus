using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Nexus.Api.Collectors;
using Nexus.Api.Tenancy;
using Nexus.Connectors;
using Nexus.Connectors.Memory;
using Nexus.Ingestion;
using Nexus.Ingestion.Mapping;

namespace Nexus.Api.Controllers;

/// <summary>
/// Lenexux Collector : sonde installée DANS le réseau du client. Elle n'expose
/// aucun port et n'exige aucune ouverture de pare-feu entrante — elle sort en
/// HTTPS, vient chercher ses tâches, interroge les systèmes internes autorisés,
/// puis renvoie les enregistrements bruts. Toute l'intelligence (résolution,
/// ontologie, preuves, impact) reste dans le cloud : la sonde ne fait que
/// COLLECTER, ce qui permet de faire évoluer le moteur sans redéployer chez le
/// client.
/// </summary>
[Route("api/v1/collectors")]
public sealed class CollectorsController(
    ITenantProvider tenantProvider,
    CollectorStore store,
    ImportPipeline pipeline) : NexusController(tenantProvider)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private const string KeyHeader = "X-Collector-Key";

    // ══════════ Administration (utilisateur authentifié) ══════════

    public sealed record CreateCollectorRequest(string Name);

    /// <summary>Déclare un Collector. La clé n'est affichée QU'UNE FOIS.</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCollectorRequest req, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (!RequireAdmin(out var forbidden)) return forbidden;
        if (req is null || string.IsNullOrWhiteSpace(req.Name))
            return BadRequest(new { error = "name_required" });

        var (collector, key) = await store.CreateAsync(tenant, req.Name, ct);
        return Ok(new
        {
            collector.Id,
            collector.Name,
            key, // à reporter dans la configuration de la sonde — non récupérable ensuite
            hint = "Conservez cette clé : elle n'est plus affichée après cette réponse.",
        });
    }

    /// <summary>Sondes déclarées et leur état (une sonde est « en ligne » si vue il y a moins de 2 min).</summary>
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        var now = DateTime.UtcNow;
        var list = (await store.ListAsync(tenant, ct)).Select(c => new
        {
            c.Id, c.Name, c.Version, c.CreatedAt, c.LastSeenAt,
            online = c.LastSeenAt is not null && (now - c.LastSeenAt.Value).TotalSeconds < 120,
        });
        return Ok(list);
    }

    /// <summary>Source REST interne à collecter + profil de mapping vers l'ontologie.</summary>
    public sealed record RestJobRequest(
        string Url, string? AuthHeaderName, string? AuthHeaderValue, string? RecordsPath,
        string? Dataset, MappingProfile Profile,
        /// <summary>Si renseigné, la collecte se répète à cet intervalle (en minutes).</summary>
        int? IntervalMinutes = null);

    /// <summary>Confie une collecte à une sonde (elle la récupérera à son prochain passage).</summary>
    [HttpPost("{id:guid}/jobs")]
    public async Task<IActionResult> Enqueue(Guid id, [FromBody] RestJobRequest req, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (!RequireAdmin(out var forbidden)) return forbidden;
        if (req is null || string.IsNullOrWhiteSpace(req.Url) || req.Profile is null)
            return BadRequest(new { error = "url_and_profile_required" });

        var jobId = await store.EnqueueJobAsync(
            tenant, id, "rest", JsonSerializer.Serialize(req, Json),
            req.IntervalMinutes, scheduledFor: null, ct);
        return Ok(new { jobId, status = "pending", recurring = req.IntervalMinutes is > 0 });
    }

    /// <summary>
    /// Révoque une sonde : sa clé cesse immédiatement d'être acceptée et ses
    /// collectes planifiées sont retirées. À utiliser en cas de compromission ou
    /// de mise hors service.
    /// </summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Revoke(Guid id, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (!RequireAdmin(out var forbidden)) return forbidden;
        var ok = await store.RevokeAsync(tenant, id, ct);
        return ok ? NoContent() : NotFound(new { error = "collector_not_found" });
    }

    /// <summary>Historique des collectes.</summary>
    [HttpGet("jobs")]
    public async Task<IActionResult> Jobs([FromQuery] int limit = 50, CancellationToken ct = default)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        var jobs = (await store.ListJobsAsync(tenant, limit, ct)).Select(j => new
        {
            j.Id, j.CollectorId, j.Kind, j.Status, j.CreatedAt, j.CompletedAt,
            j.Error, j.EntitiesCreated, j.RelationsCreated,
            j.ScheduledFor, j.IntervalMinutes,
            url = TryReadUrl(j.RequestJson),
        });
        return Ok(jobs);
    }

    // ══════════ Protocole de la sonde (clé, pas de JWT) ══════════

    /// <summary>URL de la source, pour l'affichage de l'historique (sans les secrets).</summary>
    private static string? TryReadUrl(string requestJson)
    {
        try { return JsonSerializer.Deserialize<JsonElement>(requestJson).GetProperty("url").GetString(); }
        catch { return null; }
    }

    private async Task<CollectorInfo?> AgentAsync(CancellationToken ct)
        => Request.Headers.TryGetValue(KeyHeader, out var k)
            ? await store.AuthenticateAsync(k.ToString(), ct)
            : null;

    public sealed record HeartbeatRequest(string? Version);

    /// <summary>Signe de vie : la sonde annonce qu'elle est là et sa version.</summary>
    [AllowAnonymous]
    [HttpPost("agent/heartbeat")]
    public async Task<IActionResult> Heartbeat([FromBody] HeartbeatRequest? req, CancellationToken ct)
    {
        var me = await AgentAsync(ct);
        if (me is null) return Unauthorized(new { error = "invalid_collector_key" });

        await store.TouchAsync(me.Id, req?.Version, ct);
        return Ok(new { ok = true, collector = me.Name });
    }

    /// <summary>Réclame la prochaine collecte à effectuer. 204 s'il n'y a rien à faire.</summary>
    [AllowAnonymous]
    [HttpGet("agent/jobs/next")]
    public async Task<IActionResult> NextJob(CancellationToken ct)
    {
        var me = await AgentAsync(ct);
        if (me is null) return Unauthorized(new { error = "invalid_collector_key" });

        await store.TouchAsync(me.Id, null, ct);
        var job = await store.ClaimNextAsync(me.Id, ct);
        if (job is null) return NoContent();

        return Ok(new { job.Id, job.Kind, request = JsonSerializer.Deserialize<JsonElement>(job.RequestJson) });
    }

    /// <summary>Enregistrement brut renvoyé par la sonde.</summary>
    public sealed record CollectedRecord(string SourceKey, Dictionary<string, string?> Values);
    public sealed record JobResultRequest(List<CollectedRecord>? Records, string? Error);

    /// <summary>
    /// Résultat d'une collecte. Les enregistrements traversent le MÊME pipeline
    /// que n'importe quelle source (normalisation, résolution d'entités,
    /// ontologie, preuves) : la sonde n'interprète rien.
    /// </summary>
    [AllowAnonymous]
    [HttpPost("agent/jobs/{jobId:guid}/result")]
    public async Task<IActionResult> SubmitResult(Guid jobId, [FromBody] JobResultRequest req, CancellationToken ct)
    {
        var me = await AgentAsync(ct);
        if (me is null) return Unauthorized(new { error = "invalid_collector_key" });
        await store.TouchAsync(me.Id, null, ct);

        if (!string.IsNullOrWhiteSpace(req?.Error))
        {
            await store.CompleteJobAsync(jobId, "failed", req!.Error, 0, 0, ct);
            return Ok(new { ok = false, status = "failed" });
        }

        var jobs = await store.ListJobsAsync(me.TenantId, 500, ct);
        var job = jobs.FirstOrDefault(j => j.Id == jobId && j.CollectorId == me.Id);
        if (job is null) return NotFound(new { error = "job_not_found" });

        var spec = JsonSerializer.Deserialize<RestJobRequest>(job.RequestJson, Json);
        if (spec?.Profile is null)
        {
            await store.CompleteJobAsync(jobId, "failed", "profil de mapping illisible", 0, 0, ct);
            return BadRequest(new { error = "bad_job_profile" });
        }

        var dataset = string.IsNullOrWhiteSpace(spec.Dataset) ? "rest" : spec.Dataset!;
        var records = (req?.Records ?? [])
            .Select(r => new RawRecord(dataset, r.SourceKey, r.Values))
            .ToList();

        // La provenance porte le nom de la sonde ET « REST » : le moteur de preuves
        // classe alors la collecte comme source interrogée EN DIRECT (plus fiable
        // qu'un fichier déclaratif).
        var profile = spec.Profile with { SourceSystem = $"Collector {me.Name} · REST" };

        try
        {
            var result = await pipeline.ExecuteAsync(me.TenantId, new InMemoryConnector(dataset, records), profile, ct: ct);
            if (result.IsFailure)
            {
                await store.CompleteJobAsync(jobId, "failed", result.Error.Message, 0, 0, ct);
                return ToProblem(result.Error);
            }

            await store.CompleteJobAsync(jobId, "done", null,
                result.Value.EntitiesCreated, result.Value.RelationsCreated, ct);
            return Ok(new { ok = true, status = "done", result.Value.EntitiesCreated, result.Value.RelationsCreated });
        }
        catch (Exception ex)
        {
            await store.CompleteJobAsync(jobId, "failed", ex.Message, 0, 0, ct);
            throw;
        }
    }
}
