using System.Runtime.CompilerServices;
using System.Text.Json;
using Nexus.Core.Results;

namespace Nexus.Connectors.Rest;

/// <summary>
/// Configuration d'une source REST/JSON. <paramref name="RecordsPath"/> est un
/// chemin pointé optionnel vers le tableau d'objets (ex. « data.items ») ; si
/// vide, le connecteur prend le tableau racine, sinon le premier tableau trouvé.
/// </summary>
public sealed record RestConnectorConfig(
    string Url,
    string? AuthHeaderName = null,
    string? AuthHeaderValue = null,
    string? RecordsPath = null,
    string DatasetName = "rest");

/// <summary>
/// Connecteur REST/JSON read-only (article 10) : un vrai connecteur LIVE — il
/// interroge une API HTTP et en extrait des enregistrements bruts, sans fichier
/// intermédiaire. La normalisation et le mapping vers l'ontologie restent au
/// pipeline (ADR-0009), si bien que N'IMPORTE QUELLE API JSON devient une source
/// exploitable avec un simple profil de mapping.
/// </summary>
public sealed class RestConnector(HttpClient http, RestConnectorConfig config) : IConnector
{
    public ConnectorMetadata Metadata { get; } = new("rest", config.Url, "1.0", IsReadOnly: true);

    public async Task<Result> ValidateConnectionAsync(CancellationToken ct = default)
    {
        if (!IsHttpUrl(config.Url))
            return Result.Failure(Error.Validation("connector.rest.bad_url", "L'URL doit être http(s)."));
        try
        {
            using var doc = await FetchAsync(ct);
            return TryGetArray(doc.RootElement, out _)
                ? Result.Success()
                : Result.Failure(Error.Validation("connector.rest.no_array", "Aucun tableau JSON trouvé à l'URL/au chemin indiqué."));
        }
        catch (SsrfBlockedException ex)
        {
            return Result.Failure(Error.Validation("connector.rest.blocked", ex.Message));
        }
        catch (Exception ex) when (ex is HttpRequestException or JsonException or TaskCanceledException)
        {
            return Result.Failure(Error.Validation("connector.rest.unreachable", $"Source injoignable : {ex.Message}"));
        }
    }

    public async Task<IReadOnlyList<DatasetDescriptor>> DiscoverAsync(CancellationToken ct = default)
    {
        using var doc = await FetchAsync(ct);
        var columns = new List<string>();
        long count = 0;
        if (TryGetArray(doc.RootElement, out var arr))
        {
            count = arr.GetArrayLength();
            var first = arr.EnumerateArray().FirstOrDefault();
            if (first.ValueKind == JsonValueKind.Object)
            {
                var flat = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
                Flatten(null, first, flat, 0);
                columns.AddRange(flat.Keys);
            }
        }
        return [new DatasetDescriptor(config.DatasetName, columns, count)];
    }

    public async IAsyncEnumerable<RawRecord> ExtractAsync(string datasetName, [EnumeratorCancellation] CancellationToken ct = default)
    {
        using var doc = await FetchAsync(ct);
        if (!TryGetArray(doc.RootElement, out var arr)) yield break;

        var i = 0;
        foreach (var el in arr.EnumerateArray())
        {
            ct.ThrowIfCancellationRequested();
            i++;
            if (el.ValueKind != JsonValueKind.Object) continue;
            var values = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
            Flatten(null, el, values, 0);
            var key = values.TryGetValue("id", out var id) && !string.IsNullOrWhiteSpace(id) ? id! : i.ToString();
            yield return new RawRecord(datasetName, key, values);
        }
    }

    public async Task<ConnectorHealth> HealthCheckAsync(CancellationToken ct = default)
    {
        var validation = await ValidateConnectionAsync(ct);
        return validation.IsSuccess ? ConnectorHealth.Healthy() : ConnectorHealth.Unhealthy(validation.Error.Message);
    }

    // ── Interne ──
    private async Task<JsonDocument> FetchAsync(CancellationToken ct)
    {
        // Garde anti-SSRF : refuse loopback / IP privées / métadonnées cloud.
        await SsrfGuard.ValidateAsync(config.Url, ct);

        using var req = new HttpRequestMessage(HttpMethod.Get, config.Url);
        req.Headers.TryAddWithoutValidation("Accept", "application/json");
        if (!string.IsNullOrWhiteSpace(config.AuthHeaderName) && !string.IsNullOrWhiteSpace(config.AuthHeaderValue))
            req.Headers.TryAddWithoutValidation(config.AuthHeaderName, config.AuthHeaderValue);

        using var resp = await http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);
        // Les redirections sont désactivées côté handler (anti-contournement SSRF) :
        // une 3xx est traitée comme une cible non exploitable.
        if ((int)resp.StatusCode is >= 300 and < 400)
            throw new SsrfBlockedException("Redirections non autorisées pour une source REST.");
        resp.EnsureSuccessStatusCode();
        await using var stream = await resp.Content.ReadAsStreamAsync(ct);
        return await JsonDocument.ParseAsync(stream, cancellationToken: ct);
    }

    private bool TryGetArray(JsonElement root, out JsonElement array)
    {
        // Chemin explicite (« data.items »).
        if (!string.IsNullOrWhiteSpace(config.RecordsPath))
        {
            var cur = root;
            foreach (var seg in config.RecordsPath.Split('.', StringSplitOptions.RemoveEmptyEntries))
            {
                if (cur.ValueKind != JsonValueKind.Object || !cur.TryGetProperty(seg, out var next)) { array = default; return false; }
                cur = next;
            }
            array = cur;
            return cur.ValueKind == JsonValueKind.Array;
        }
        // Tableau racine.
        if (root.ValueKind == JsonValueKind.Array) { array = root; return true; }
        // Sinon, premier tableau parmi les propriétés.
        if (root.ValueKind == JsonValueKind.Object)
            foreach (var p in root.EnumerateObject())
                if (p.Value.ValueKind == JsonValueKind.Array) { array = p.Value; return true; }
        array = default;
        return false;
    }

    // Aplatit un objet JSON en colonnes (profondeur 2), clés pointées pour les scalaires imbriqués.
    private static void Flatten(string? prefix, JsonElement el, Dictionary<string, string?> into, int depth)
    {
        foreach (var p in el.EnumerateObject())
        {
            var key = prefix is null ? p.Name : $"{prefix}.{p.Name}";
            switch (p.Value.ValueKind)
            {
                case JsonValueKind.String:
                    into[key] = p.Value.GetString();
                    break;
                case JsonValueKind.Number:
                case JsonValueKind.True:
                case JsonValueKind.False:
                    into[key] = p.Value.ToString();
                    break;
                case JsonValueKind.Object when depth < 2:
                    Flatten(key, p.Value, into, depth + 1);
                    break;
                case JsonValueKind.Array:
                    // Tableau de scalaires → joint ; sinon ignoré (les relations viennent d'un autre dataset).
                    var scalars = p.Value.EnumerateArray()
                        .Where(x => x.ValueKind is JsonValueKind.String or JsonValueKind.Number)
                        .Select(x => x.ToString());
                    var joined = string.Join(";", scalars);
                    if (joined.Length > 0) into[key] = joined;
                    break;
            }
        }
    }

    private static bool IsHttpUrl(string url)
        => Uri.TryCreate(url, UriKind.Absolute, out var u) && (u.Scheme == Uri.UriSchemeHttp || u.Scheme == Uri.UriSchemeHttps);
}
