using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Nexus.Connectors.Rest;

// ═══════════════════════════════════════════════════════════════════════════
//  Lenexux Collector — sonde installée DANS le réseau du client.
//
//  Principe : elle n'expose AUCUN port et n'exige AUCUNE ouverture de pare-feu
//  entrante. Elle SORT en HTTPS vers Lenexux Cloud, demande s'il y a du travail,
//  interroge les systèmes internes explicitement autorisés, puis renvoie les
//  enregistrements bruts.
//
//  Elle ne fait que COLLECTER : la résolution d'entités, l'ontologie, les
//  preuves et le calcul d'impact restent dans le cloud. Le moteur peut donc
//  évoluer sans jamais redéployer quoi que ce soit chez le client.
// ═══════════════════════════════════════════════════════════════════════════

var cloud = Env("LENEXUX_CLOUD_URL") ?? "https://lenexux.com";
var key = Env("LENEXUX_COLLECTOR_KEY");
var pollSeconds = int.TryParse(Env("LENEXUX_POLL_SECONDS"), out var p) ? Math.Clamp(p, 5, 300) : 15;
var version = typeof(Program).Assembly.GetName().Version?.ToString() ?? "1.0.0";

if (string.IsNullOrWhiteSpace(key))
{
    Console.Error.WriteLine("LENEXUX_COLLECTOR_KEY manquant. Déclarez une sonde dans Lenexux (Admin → Collectors) et reportez sa clé ici.");
    return 1;
}

var json = new JsonSerializerOptions(JsonSerializerDefaults.Web);
using var http = new HttpClient { BaseAddress = new Uri(cloud.TrimEnd('/') + "/"), Timeout = TimeSpan.FromSeconds(60) };
http.DefaultRequestHeaders.Add("X-Collector-Key", key);

Log($"Lenexux Collector {version} — cloud {cloud}, sondage toutes les {pollSeconds}s.");

using var stopping = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) => { e.Cancel = true; stopping.Cancel(); };

while (!stopping.IsCancellationRequested)
{
    try
    {
        await HeartbeatAsync(stopping.Token);
        while (await RunNextJobAsync(stopping.Token)) { /* vide la file avant de dormir */ }
    }
    catch (OperationCanceledException) { break; }
    catch (Exception ex)
    {
        Log($"cycle en erreur : {ex.Message}");
    }

    try { await Task.Delay(TimeSpan.FromSeconds(pollSeconds), stopping.Token); }
    catch (OperationCanceledException) { break; }
}

Log("arrêt demandé, au revoir.");
return 0;

// ── Signe de vie ────────────────────────────────────────────────────────────
async Task HeartbeatAsync(CancellationToken ct)
{
    using var res = await http.PostAsJsonAsync("api/v1/collectors/agent/heartbeat", new { version }, json, ct);
    if (res.StatusCode == HttpStatusCode.Unauthorized)
        throw new InvalidOperationException("clé de sonde refusée par le cloud.");
    res.EnsureSuccessStatusCode();
}

// ── Une collecte ────────────────────────────────────────────────────────────
// Renvoie true si une tâche a été traitée (il peut y en avoir d'autres en file).
async Task<bool> RunNextJobAsync(CancellationToken ct)
{
    using var res = await http.GetAsync("api/v1/collectors/agent/jobs/next", ct);
    if (res.StatusCode == HttpStatusCode.NoContent) return false;
    res.EnsureSuccessStatusCode();

    var job = await res.Content.ReadFromJsonAsync<JobEnvelope>(json, ct);
    if (job is null || job.Id == Guid.Empty) return false;

    Log($"tâche {job.Id:N} ({job.Kind}) réclamée.");

    try
    {
        var spec = job.Request.Deserialize<RestJobSpec>(json)
                   ?? throw new InvalidOperationException("spécification de tâche illisible.");

        var records = await CollectRestAsync(spec, ct);
        Log($"  {records.Count} enregistrement(s) collecté(s) sur {spec.Url}");

        using var post = await http.PostAsJsonAsync(
            $"api/v1/collectors/agent/jobs/{job.Id}/result", new { records }, json, ct);
        post.EnsureSuccessStatusCode();
        var outcome = await post.Content.ReadAsStringAsync(ct);
        Log($"  remonté au cloud : {outcome}");
    }
    catch (Exception ex)
    {
        Log($"  échec : {ex.Message}");
        try
        {
            using var fail = await http.PostAsJsonAsync(
                $"api/v1/collectors/agent/jobs/{job.Id}/result", new { error = ex.Message }, json, ct);
        }
        catch { /* le cloud reverra la tâche ; ne pas masquer l'erreur d'origine */ }
    }

    return true;
}

// ── Collecte REST, DEPUIS L'INTÉRIEUR du réseau ─────────────────────────────
// AllowInternalTargets = true : c'est ici légitime, et c'est toute la raison
// d'être de la sonde. Le garde anti-SSRF reste actif côté cloud, où il empêche
// l'API d'être utilisée comme relais vers un réseau privé.
async Task<List<CollectedRecord>> CollectRestAsync(RestJobSpec spec, CancellationToken ct)
{
    using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(60) };
    var connector = new RestConnector(client, new RestConnectorConfig(
        spec.Url, spec.AuthHeaderName, spec.AuthHeaderValue, spec.RecordsPath,
        string.IsNullOrWhiteSpace(spec.Dataset) ? "rest" : spec.Dataset!,
        AllowInternalTargets: true));

    var valid = await connector.ValidateConnectionAsync(ct);
    if (valid.IsFailure) throw new InvalidOperationException(valid.Error.Message);

    var dataset = string.IsNullOrWhiteSpace(spec.Dataset) ? "rest" : spec.Dataset!;
    var list = new List<CollectedRecord>();
    await foreach (var r in connector.ExtractAsync(dataset, ct))
        list.Add(new CollectedRecord(r.SourceKey, r.Values.ToDictionary(k => k.Key, v => v.Value)));
    return list;
}

static string? Env(string name)
{
    var v = Environment.GetEnvironmentVariable(name);
    return string.IsNullOrWhiteSpace(v) ? null : v.Trim();
}

static void Log(string message)
    => Console.WriteLine($"[{DateTimeOffset.Now:yyyy-MM-dd HH:mm:ss}] {message}");

// ── Contrats échangés avec le cloud ─────────────────────────────────────────
internal sealed record JobEnvelope(Guid Id, string Kind, JsonElement Request);

internal sealed record RestJobSpec(
    string Url, string? AuthHeaderName, string? AuthHeaderValue,
    string? RecordsPath, string? Dataset);

internal sealed record CollectedRecord(string SourceKey, Dictionary<string, string?> Values);
