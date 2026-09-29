using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using Nexus.Connectors;
using Nexus.Connectors.Rest;
using Nexus.Core.Results;

namespace Nexus.Ingestion.Vendors;

/// <summary>
/// Le moteur qui exécute une recette d'éditeur : un VRAI connecteur live, qui
/// interroge l'API du produit, tourne les pages, et rend des enregistrements
/// bruts au pipeline d'ingestion.
///
/// Un seul moteur pour tous les éditeurs, et non un connecteur par produit : les
/// API d'inventaire se ressemblent (une liste paginée, parfois une sous-liste par
/// élément), et ce qui les distingue vraiment tient dans la recette. Ajouter un
/// éditeur devient donc une déclaration relue et testée, pas du code HTTP
/// recopié une onzième fois.
///
/// Le garde anti-SSRF reste actif : seule la sonde Collector, qui s'exécute chez
/// le client, lève la restriction pour atteindre un Kubernetes ou une CMDB
/// internes. Sans cela, l'API du cloud servirait de relais vers un réseau privé.
/// </summary>
public sealed class VendorApiConnector : IConnector
{
    private readonly HttpClient _http;
    private readonly VendorRecipe _recipe;
    private readonly IReadOnlyDictionary<string, string> _settings;
    private readonly bool _allowInternal;
    private readonly VendorAuthenticator _auth;
    private readonly Dictionary<string, IReadOnlyList<RawRecord>> _cache = new(StringComparer.Ordinal);
    private readonly List<string> _warnings = [];

    public VendorApiConnector(
        HttpClient http,
        VendorRecipe recipe,
        IReadOnlyDictionary<string, string> settings,
        bool allowInternalTargets = false)
    {
        _http = http;
        _recipe = recipe;
        _settings = settings;
        _allowInternal = allowInternalTargets;
        _auth = new VendorAuthenticator(http, recipe.Auth, settings);
        Metadata = new ConnectorMetadata($"vendor:{recipe.Id}", recipe.Name, "1.0", IsReadOnly: true);
    }

    public ConnectorMetadata Metadata { get; }

    /// <summary>La recette exécutée : le profil de mapping en vient.</summary>
    public VendorRecipe Recipe => _recipe;

    /// <summary>
    /// Ce que l'import n'a pas pu lire. Vide veut dire que tout a été lu, et c'est
    /// la seule façon pour l'utilisateur de distinguer une carte complète d'une
    /// carte amputée par une permission manquante.
    /// </summary>
    public IReadOnlyList<string> Warnings => _warnings;

    /// <summary>Un refus de connexion, formulé pour l'utilisateur.</summary>
    private static Result Fail(string code, string message) => Result.Failure(Error.Validation(code, message));

    public async Task<Result> ValidateConnectionAsync(CancellationToken ct = default)
    {
        var missing = VendorTemplate.Missing(_recipe.Fields, _settings);
        if (missing.Count > 0)
            return Fail("vendor.settings_missing", $"Réglages manquants : {string.Join(", ", missing)}.");

        // Le premier jeu de données autonome sert de test : s'il répond, les
        // identifiants sont bons et le compte a le droit de lire.
        var probe = _recipe.Datasets.FirstOrDefault(d => d.ParentDataset is null);
        if (probe is null) return Fail("vendor.no_dataset", "Recette sans jeu de données.");

        try
        {
            using var page = await FetchAsync(probe, Url(probe), null, ct);
            return VendorJson.TryPath(page.Root, probe.RecordsPath, out var records)
                   && records.ValueKind is JsonValueKind.Array or JsonValueKind.Object
                ? Result.Success()
                : Fail("vendor.unexpected_shape",
                    $"Réponse inattendue de {_recipe.Name} : « {probe.RecordsPath} » introuvable.");
        }
        catch (VendorAuthException ex)
        {
            return Fail("vendor.auth_failed", ex.Message);
        }
        catch (SsrfBlockedException ex)
        {
            return Fail("vendor.blocked", ex.Message);
        }
        catch (VendorHttpException ex)
        {
            return Fail("vendor.rejected", ex.Message);
        }
        catch (Exception ex) when (ex is HttpRequestException or JsonException or TaskCanceledException)
        {
            return Fail("vendor.unreachable", $"{_recipe.Name} injoignable : {ex.Message}");
        }
    }

    public async Task<IReadOnlyList<DatasetDescriptor>> DiscoverAsync(CancellationToken ct = default)
    {
        var descriptors = new List<DatasetDescriptor>();
        foreach (var dataset in _recipe.Datasets)
        {
            var columns = new List<string>();
            long? rows = null;
            if (dataset.ParentDataset is null)
            {
                try
                {
                    using var page = await FetchAsync(dataset, Url(dataset), null, ct);
                    var records = Records(page.Root, dataset).ToList();
                    rows = records.Count;
                    if (records.Count > 0) columns.AddRange(records[0].Values.Keys);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    // Un jeu de données illisible ne doit pas masquer les autres :
                    // l'écran a besoin de la liste complète pour expliquer ce qui manque.
                }
            }
            descriptors.Add(new DatasetDescriptor(dataset.Name, columns, rows));
        }
        return descriptors;
    }

    public async IAsyncEnumerable<RawRecord> ExtractAsync(
        string datasetName, [EnumeratorCancellation] CancellationToken ct = default)
    {
        var dataset = _recipe.Datasets.FirstOrDefault(d => d.Name == datasetName);
        if (dataset is null) yield break;

        foreach (var record in await ReadAsync(dataset, ct)) yield return record;
    }

    /// <summary>
    /// Lit un jeu de données UNE seule fois par import, et garde le résultat.
    ///
    /// Le pipeline parcourt un jeu de données autant de fois qu'il porte de
    /// mappings (entités, puis relations) : sans ce cache, un inventaire de
    /// plusieurs pages serait redemandé cinq ou six fois à l'éditeur, qui finirait
    /// par limiter le débit. La mémoire est bornée par MaxPages × PageSize.
    ///
    /// Un jeu de données refusé n'interrompt pas l'import : il est consigné comme
    /// avertissement. Une permission manquante sur UNE table ne doit pas faire
    /// perdre tout le reste, mais l'utilisateur doit le savoir, sans quoi une
    /// carte incomplète passerait pour une carte complète.
    /// </summary>
    private async Task<IReadOnlyList<RawRecord>> ReadAsync(VendorDataset dataset, CancellationToken ct)
    {
        if (_cache.TryGetValue(dataset.Name, out var cached)) return cached;

        List<RawRecord> records = [];
        try
        {
            records = dataset.ParentDataset is null
                ? await CollectAsync(dataset, Url(dataset), null, ct)
                : await CollectChildrenAsync(dataset, ct);
        }
        catch (Exception ex) when (ex is VendorHttpException or VendorAuthException or SsrfBlockedException)
        {
            _warnings.Add($"{dataset.Name} : {ex.Message}");
        }
        catch (Exception ex) when (ex is HttpRequestException or JsonException)
        {
            _warnings.Add($"{dataset.Name} : {ex.Message}");
        }

        _cache[dataset.Name] = records;
        return records;
    }

    private async Task<List<RawRecord>> CollectAsync(
        VendorDataset dataset, string url, IReadOnlyDictionary<string, string?>? carried, CancellationToken ct)
    {
        var list = new List<RawRecord>();
        await foreach (var record in PagesAsync(dataset, url, carried, ct)) list.Add(record);
        return list;
    }

    /// <summary>
    /// Jeu de données enfant : une requête par enregistrement parent. Les colonnes
    /// du parent sont recopiées, sans quoi la relation serait orpheline (« ce
    /// membre appartient à QUEL groupe ? »). Un parent qui refuse la lecture est
    /// ignoré : un seul groupe protégé ne doit pas annuler tous les autres.
    /// </summary>
    private async Task<List<RawRecord>> CollectChildrenAsync(VendorDataset dataset, CancellationToken ct)
    {
        var parent = _recipe.Datasets.FirstOrDefault(d => d.Name == dataset.ParentDataset);
        if (parent is null || dataset.ParentKey is null) return [];

        var list = new List<RawRecord>();
        var parents = await ReadAsync(parent, ct);
        var refused = 0;

        foreach (var parentRecord in parents.Take(dataset.MaxParents))
        {
            var key = parentRecord.Get(dataset.ParentKey);
            if (string.IsNullOrWhiteSpace(key)) continue;

            var carried = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
            foreach (var column in dataset.ParentColumns ?? [])
                if (parentRecord.Get(column) is { } value) carried[$"parent.{column}"] = value;

            var url = Url(dataset).Replace("{parent}", Uri.EscapeDataString(key), StringComparison.Ordinal);
            try
            {
                list.AddRange(await CollectAsync(dataset, url, carried, ct));
            }
            catch (Exception ex) when (ex is VendorHttpException or HttpRequestException or JsonException)
            {
                refused++;
            }
        }

        if (refused > 0) _warnings.Add($"{dataset.Name} : {refused} élément(s) non lisibles, ignorés.");
        return list;
    }

    public async Task<ConnectorHealth> HealthCheckAsync(CancellationToken ct = default)
    {
        var validation = await ValidateConnectionAsync(ct);
        return validation.IsSuccess ? ConnectorHealth.Healthy() : ConnectorHealth.Unhealthy(validation.Error.Message);
    }

    // ── Pagination ──

    private async IAsyncEnumerable<RawRecord> PagesAsync(
        VendorDataset dataset,
        string firstUrl,
        IReadOnlyDictionary<string, string?>? carried,
        [EnumeratorCancellation] CancellationToken ct)
    {
        var url = firstUrl;
        string? pageToken = null;
        for (var page = 0; page < Math.Max(1, dataset.MaxPages); page++)
        {
            ct.ThrowIfCancellationRequested();
            var pagedUrl = Paged(dataset, url, page);
            using var response = await FetchAsync(dataset, pagedUrl, pageToken, ct);

            var count = 0;
            foreach (var record in Records(response.Root, dataset, carried))
            {
                count++;
                yield return record;
            }

            // Une page vide termine la lecture, quel que soit ce que dit l'éditeur.
            if (count == 0) break;

            switch (dataset.Page)
            {
                case PageMode.None:
                    yield break;
                case PageMode.NextLink:
                    var next = VendorJson.Scalar(response.Root, dataset.NextPath);
                    if (string.IsNullOrWhiteSpace(next)) yield break;
                    // Certains éditeurs (Atlassian) renvoient un lien RELATIF :
                    // il faut le recoller à l'hôte, sinon la deuxième page échoue.
                    url = Uri.TryCreate(next, UriKind.Absolute, out _)
                        ? next!
                        : new Uri(new Uri(pagedUrl), next!).ToString();
                    break;
                case PageMode.BodyToken:
                    pageToken = VendorJson.Scalar(response.Root, dataset.NextPath);
                    if (string.IsNullOrWhiteSpace(pageToken)) yield break;
                    break;
                case PageMode.NextKey:
                    // Le jeton revient dans le corps et repart en paramètre d'URL,
                    // greffé sur l'URL d'origine dont les autres paramètres comptent.
                    var key = VendorJson.Scalar(response.Root, dataset.NextPath);
                    if (string.IsNullOrWhiteSpace(key)) yield break;
                    var name = dataset.PageParam ?? "pageToken";
                    url = $"{firstUrl}{(firstUrl.Contains('?') ? '&' : '?')}{name}={Uri.EscapeDataString(key!)}";
                    break;
                case PageMode.LinkHeaderCursor:
                    var cursor = NextFromLinkHeader(response.LinkHeader);
                    if (cursor is null) yield break;
                    url = cursor;
                    break;
                case PageMode.OffsetLimit:
                case PageMode.PageNumber:
                    // L'URL de la page suivante est calculée à l'entrée de boucle ;
                    // une page incomplète signale la fin sans appel supplémentaire.
                    if (count < dataset.PageSize) yield break;
                    break;
            }
        }
    }

    /// <summary>Ajoute le paramètre de page, pour les éditeurs qui paginent par décalage ou par numéro.</summary>
    private static string Paged(VendorDataset dataset, string url, int page)
    {
        if (page == 0 || dataset.Page is not (PageMode.OffsetLimit or PageMode.PageNumber)) return url;
        var name = dataset.PageParam ?? (dataset.Page == PageMode.OffsetLimit ? "offset" : "page");
        var value = dataset.Page == PageMode.OffsetLimit ? page * dataset.PageSize : page + 1;
        return $"{url}{(url.Contains('?') ? '&' : '?')}{name}={value}";
    }

    /// <summary>Curseur « rel=next » de l'en-tête Link (convention Okta).</summary>
    internal static string? NextFromLinkHeader(string? header)
    {
        if (string.IsNullOrWhiteSpace(header)) return null;
        foreach (var part in header.Split(','))
        {
            if (!part.Contains("rel=\"next\"", StringComparison.OrdinalIgnoreCase)) continue;
            var start = part.IndexOf('<');
            var end = part.IndexOf('>');
            if (start >= 0 && end > start) return part[(start + 1)..end];
        }
        return null;
    }

    // ── Lecture des enregistrements ──

    /// <summary>
    /// Transforme une réponse en enregistrements. L'éclatement d'un tableau
    /// imbriqué est ici parce que c'est la forme sous laquelle les éditeurs
    /// livrent leurs RELATIONS, et que les relations sont la raison d'être du
    /// produit : les ignorer reviendrait à n'importer qu'un inventaire.
    /// </summary>
    private IEnumerable<RawRecord> Records(
        JsonElement root, VendorDataset dataset, IReadOnlyDictionary<string, string?>? carried = null)
    {
        if (!VendorJson.TryPath(root, dataset.RecordsPath, out var container)) yield break;

        var index = 0;
        foreach (var (element, key) in Elements(container, dataset))
        {
            index++;
            var flat = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
            if (key is not null) flat["key"] = key;
            VendorJson.Flatten(null, element, flat);
            if (carried is not null) foreach (var (k, v) in carried) flat[k] = v;

            if (dataset.ExplodePath is null)
            {
                yield return Build(dataset, flat, index, null);
                continue;
            }

            // Une ligne par élément du tableau imbriqué, colonnes du porteur conservées.
            if (!VendorJson.TryPath(element, dataset.ExplodePath, out var nested) || nested.ValueKind != JsonValueKind.Array)
                continue;

            var sub = 0;
            foreach (var item in nested.EnumerateArray())
            {
                sub++;
                var row = new Dictionary<string, string?>(flat, StringComparer.OrdinalIgnoreCase);
                if (item.ValueKind == JsonValueKind.Object) VendorJson.Flatten("item", item, row);
                else if (item.ValueKind is JsonValueKind.String or JsonValueKind.Number) row["item"] = item.ToString();
                yield return Build(dataset, row, index, sub);
            }
        }
    }

    /// <summary>Les éléments d'une réponse : tableau, ou objet dont chaque propriété est un enregistrement.</summary>
    private static IEnumerable<(JsonElement Element, string? Key)> Elements(JsonElement container, VendorDataset dataset)
    {
        if (dataset.Shape == RecordShape.ObjectMap)
        {
            if (container.ValueKind != JsonValueKind.Object) yield break;
            foreach (var property in container.EnumerateObject())
            {
                // Une propriété dont la valeur est un tableau de chaînes (Datadog :
                // « service » vers ses appels) est portée telle quelle.
                yield return (property.Value, property.Name);
            }
            yield break;
        }

        if (container.ValueKind != JsonValueKind.Array) yield break;
        foreach (var element in container.EnumerateArray())
            if (element.ValueKind == JsonValueKind.Object) yield return (element, null);
    }

    private RawRecord Build(VendorDataset dataset, Dictionary<string, string?> values, int index, int? sub)
    {
        foreach (var (name, expression) in dataset.Derive ?? new Dictionary<string, string>())
            if (VendorJson.Derive(expression, c => values.GetValueOrDefault(c)) is { } derived)
                values[name] = derived;

        var identity = values.GetValueOrDefault("id")
                       ?? values.GetValueOrDefault("key")
                       ?? values.GetValueOrDefault("sys_id")
                       ?? index.ToString();
        var sourceKey = sub is null ? $"{dataset.Name}:{identity}" : $"{dataset.Name}:{identity}#{sub}";
        return new RawRecord(dataset.Name, sourceKey, values);
    }

    // ── HTTP ──

    private string Url(VendorDataset dataset)
    {
        var rendered = VendorTemplate.Render(dataset.UrlTemplate, _settings);
        return rendered.Replace("{pageSize}", dataset.PageSize.ToString(), StringComparison.Ordinal);
    }

    private sealed record Page(JsonDocument Document, string? LinkHeader) : IDisposable
    {
        public JsonElement Root => Document.RootElement;
        public void Dispose() => Document.Dispose();
    }

    private async Task<Page> FetchAsync(VendorDataset dataset, string url, string? pageToken, CancellationToken ct)
    {
        if (!_allowInternal) await SsrfGuard.ValidateAsync(url, ct);

        var body = dataset.Body is null
            ? null
            : VendorTemplate.Render(dataset.Body, _settings)
                .Replace("{pageToken}", pageToken ?? "", StringComparison.Ordinal)
                .Replace("{pageSize}", dataset.PageSize.ToString(), StringComparison.Ordinal);

        using var request = new HttpRequestMessage(new HttpMethod(dataset.Method), url);
        request.Headers.TryAddWithoutValidation("Accept", "application/json");
        foreach (var (name, template) in dataset.Headers ?? new Dictionary<string, string>())
            request.Headers.TryAddWithoutValidation(name, VendorTemplate.Render(template, _settings));

        if (body is not null)
        {
            // Le type de contenu peut être imposé par l'éditeur (AWS attend du
            // x-amz-json) : l'en-tête déclaré dans la recette a la priorité.
            var declared = dataset.Headers?.FirstOrDefault(h =>
                string.Equals(h.Key, "Content-Type", StringComparison.OrdinalIgnoreCase)).Value;
            request.Content = new StringContent(body, Encoding.UTF8);
            request.Content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(
                string.IsNullOrWhiteSpace(declared) ? "application/json" : declared.Split(';')[0]);
        }

        await _auth.ApplyAsync(request, body, ct);

        using var response = await _http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
        if ((int)response.StatusCode is >= 300 and < 400)
            throw new SsrfBlockedException("Redirections non autorisées pour une source d'inventaire.");

        if (!response.IsSuccessStatusCode)
        {
            var detail = await response.Content.ReadAsStringAsync(ct);
            throw new VendorHttpException(Explain(_recipe.Name, (int)response.StatusCode, detail));
        }

        var link = response.Headers.TryGetValues("Link", out var values) ? string.Join(",", values) : null;
        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        var document = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
        return new Page(document, link);
    }

    /// <summary>
    /// Un refus d'API doit se lire sans ouvrir la documentation de l'éditeur :
    /// le code seul ne dit pas à l'utilisateur s'il s'est trompé de clé ou s'il
    /// manque une permission, et c'est cette confusion qui fait abandonner un
    /// branchement.
    /// </summary>
    private static string Explain(string vendor, int status, string detail) => status switch
    {
        401 => $"{vendor} refuse les identifiants fournis (401). Vérifiez la clé ou le secret.",
        403 => $"{vendor} accepte les identifiants mais refuse la lecture (403) : il manque une permission au compte.",
        404 => $"{vendor} ne connaît pas ce point d'accès (404). Vérifiez l'URL de votre instance.",
        429 => $"{vendor} limite le débit (429). Relancez l'import dans quelques minutes.",
        >= 500 => $"{vendor} est en erreur de son côté ({status}).",
        _ => $"{vendor} a refusé la requête ({status}). {(detail.Length <= 180 ? detail : detail[..180])}",
    };
}

/// <summary>Refus HTTP d'un éditeur, déjà traduit pour l'utilisateur.</summary>
public sealed class VendorHttpException(string message) : Exception(message);
