using System.Globalization;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Nexus.Ingestion.Vendors;

/// <summary>Remplace les {reglage} d'un gabarit par les valeurs fournies par le client.</summary>
public static class VendorTemplate
{
    public static string Render(string template, IReadOnlyDictionary<string, string> settings)
    {
        if (string.IsNullOrEmpty(template) || !template.Contains('{')) return template;
        var sb = new StringBuilder(template.Length + 32);
        var i = 0;
        while (i < template.Length)
        {
            var open = template.IndexOf('{', i);
            if (open < 0) { sb.Append(template, i, template.Length - i); break; }
            var close = template.IndexOf('}', open);
            if (close < 0) { sb.Append(template, i, template.Length - i); break; }

            sb.Append(template, i, open - i);
            var key = template[(open + 1)..close];
            // Un marqueur inconnu ici est laissé INTACT : {parent}, {pageSize} et
            // {pageToken} sont posés plus tard par le moteur, et les effacer
            // fabriquerait une URL silencieusement fausse.
            sb.Append(settings.TryGetValue(key, out var value) ? value : template[open..(close + 1)]);
            i = close + 1;
        }
        return sb.ToString();
    }

    /// <summary>Les réglages requis qui manquent, pour refuser tôt et nommément.</summary>
    public static IReadOnlyList<string> Missing(IReadOnlyList<VendorField> fields, IReadOnlyDictionary<string, string> settings)
        => fields.Where(f => f.Required && (!settings.TryGetValue(f.Key, out var v) || string.IsNullOrWhiteSpace(v)))
            .Select(f => f.Key).ToList();
}

/// <summary>
/// Pose l'authentification sur chaque requête sortante.
///
/// Les quatre familles couvrent ce que les éditeurs pratiquent réellement : un
/// en-tête statique, du Basic, un jeton d'application OAuth2, et la signature
/// AWS. Le jeton est mis en cache pour la durée de vie du connecteur, sans quoi
/// un inventaire de plusieurs pages redemanderait un jeton à chaque appel.
/// </summary>
public sealed class VendorAuthenticator(HttpClient http, VendorAuth auth, IReadOnlyDictionary<string, string> settings)
{
    private string? _token;
    private DateTimeOffset _tokenExpiry = DateTimeOffset.MinValue;

    private string Render(string? template) => template is null ? "" : VendorTemplate.Render(template, settings);

    public async Task ApplyAsync(HttpRequestMessage request, string? body, CancellationToken ct)
    {
        switch (auth.Kind)
        {
            case VendorAuthKind.Headers:
                foreach (var (name, template) in auth.Headers ?? new Dictionary<string, string>())
                {
                    var value = Render(template);
                    if (!string.IsNullOrWhiteSpace(value)) request.Headers.TryAddWithoutValidation(name, value);
                }
                break;

            case VendorAuthKind.Basic:
                var pair = $"{Render(auth.UserTemplate)}:{Render(auth.PasswordTemplate)}";
                request.Headers.Authorization = new AuthenticationHeaderValue(
                    "Basic", Convert.ToBase64String(Encoding.UTF8.GetBytes(pair)));
                break;

            case VendorAuthKind.OAuth2ClientCredentials:
            case VendorAuthKind.GoogleServiceAccount:
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", await TokenAsync(ct));
                break;

            case VendorAuthKind.AwsSigV4:
                SignAws(request, body ?? "");
                break;
        }
    }

    // ── Jetons ──

    private async Task<string> TokenAsync(CancellationToken ct)
    {
        // Une marge d'une minute : un jeton qui expire pendant la pagination
        // ferait échouer un import déjà à moitié écrit.
        if (_token is not null && DateTimeOffset.UtcNow < _tokenExpiry.AddMinutes(-1)) return _token;

        var form = auth.Kind == VendorAuthKind.GoogleServiceAccount
            ? new Dictionary<string, string>
            {
                ["grant_type"] = "urn:ietf:params:oauth:grant-type:jwt-bearer",
                ["assertion"] = GoogleAssertion(),
            }
            : new Dictionary<string, string>
            {
                ["grant_type"] = "client_credentials",
                ["client_id"] = settings.GetValueOrDefault("clientId", ""),
                ["client_secret"] = settings.GetValueOrDefault("clientSecret", ""),
                ["scope"] = Render(auth.Scope),
            };

        using var request = new HttpRequestMessage(HttpMethod.Post, Render(auth.TokenUrl))
        {
            Content = new FormUrlEncodedContent(form),
        };
        using var response = await http.SendAsync(request, ct);
        var payload = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
            throw new VendorAuthException($"Jeton refusé par le fournisseur d'identité ({(int)response.StatusCode}). {Short(payload)}");

        using var document = JsonDocument.Parse(payload);
        var token = document.RootElement.TryGetProperty("access_token", out var t) ? t.GetString() : null;
        if (string.IsNullOrWhiteSpace(token))
            throw new VendorAuthException("Réponse du fournisseur d'identité sans access_token.");

        var seconds = document.RootElement.TryGetProperty("expires_in", out var e) && e.TryGetInt32(out var s) ? s : 3300;
        _token = token;
        _tokenExpiry = DateTimeOffset.UtcNow.AddSeconds(seconds);
        return token!;
    }

    /// <summary>
    /// JWT signé pour un compte de service Google. La délégation à l'échelle du
    /// domaine exige le champ « sub » : c'est l'administrateur au nom duquel
    /// l'annuaire est lu, faute de quoi Google refuse la lecture des utilisateurs.
    /// </summary>
    private string GoogleAssertion()
    {
        var email = settings.GetValueOrDefault("serviceAccountEmail", "");
        var subject = settings.GetValueOrDefault("adminEmail", "");
        var privateKey = settings.GetValueOrDefault("privateKey", "");
        if (string.IsNullOrWhiteSpace(privateKey)) throw new VendorAuthException("Clé privée du compte de service absente.");

        var now = DateTimeOffset.UtcNow;
        var header = Base64Url("""{"alg":"RS256","typ":"JWT"}""");
        var claims = Base64Url(JsonSerializer.Serialize(new Dictionary<string, object>
        {
            ["iss"] = email,
            ["sub"] = subject,
            ["scope"] = Render(auth.Scope),
            ["aud"] = Render(auth.TokenUrl),
            ["iat"] = now.ToUnixTimeSeconds(),
            ["exp"] = now.AddMinutes(30).ToUnixTimeSeconds(),
        }));

        using var rsa = RSA.Create();
        try { rsa.ImportFromPem(privateKey.Replace("\\n", "\n")); }
        catch (Exception ex) { throw new VendorAuthException($"Clé privée illisible : {ex.Message}"); }

        var signature = rsa.SignData(
            Encoding.UTF8.GetBytes($"{header}.{claims}"), HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        return $"{header}.{claims}.{Base64Url(signature)}";
    }

    private static string Base64Url(string value) => Base64Url(Encoding.UTF8.GetBytes(value));

    private static string Base64Url(byte[] bytes)
        => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    // ── Signature AWS SigV4 ──

    /// <summary>
    /// Signature Version 4. AWS n'accepte aucune autre forme d'authentification
    /// sur ses API d'inventaire, il n'existe donc pas de raccourci : sans elle,
    /// pas de connecteur AWS du tout.
    /// </summary>
    private void SignAws(HttpRequestMessage request, string body)
    {
        var accessKey = settings.GetValueOrDefault("accessKeyId", "");
        var secretKey = settings.GetValueOrDefault("secretAccessKey", "");
        var region = Render(auth.AwsRegion);
        var service = auth.AwsService ?? "";
        if (string.IsNullOrWhiteSpace(accessKey) || string.IsNullOrWhiteSpace(secretKey))
            throw new VendorAuthException("Identifiants AWS absents.");

        var now = DateTimeOffset.UtcNow;
        var amzDate = now.ToString("yyyyMMdd'T'HHmmss'Z'", CultureInfo.InvariantCulture);
        var dateStamp = now.ToString("yyyyMMdd", CultureInfo.InvariantCulture);
        var uri = request.RequestUri!;

        request.Headers.TryAddWithoutValidation("x-amz-date", amzDate);

        // En-têtes signés : l'hôte, la date, et ceux que le point d'accès impose
        // (type de contenu, cible). Triés par nom, comme l'exige la norme.
        var signed = new SortedDictionary<string, string>(StringComparer.Ordinal)
        {
            ["host"] = uri.Host,
            ["x-amz-date"] = amzDate,
        };
        if (request.Content?.Headers.ContentType is { } contentType) signed["content-type"] = contentType.ToString();
        if (request.Headers.TryGetValues("x-amz-target", out var target)) signed["x-amz-target"] = string.Join(",", target);

        var canonicalHeaders = string.Concat(signed.Select(h => $"{h.Key}:{h.Value.Trim()}\n"));
        var signedHeaders = string.Join(";", signed.Keys);
        var payloadHash = Hex(SHA256.HashData(Encoding.UTF8.GetBytes(body)));

        var canonicalRequest = string.Join("\n",
            request.Method.Method,
            uri.AbsolutePath.Length == 0 ? "/" : uri.AbsolutePath,
            CanonicalQuery(uri),
            canonicalHeaders,
            signedHeaders,
            payloadHash);

        var scope = $"{dateStamp}/{region}/{service}/aws4_request";
        var stringToSign = string.Join("\n",
            "AWS4-HMAC-SHA256", amzDate, scope, Hex(SHA256.HashData(Encoding.UTF8.GetBytes(canonicalRequest))));

        var signingKey = Hmac(Hmac(Hmac(Hmac(
            Encoding.UTF8.GetBytes($"AWS4{secretKey}"), dateStamp), region), service), "aws4_request");
        var signature = Hex(Hmac(signingKey, stringToSign));

        request.Headers.TryAddWithoutValidation("Authorization",
            $"AWS4-HMAC-SHA256 Credential={accessKey}/{scope}, SignedHeaders={signedHeaders}, Signature={signature}");
    }

    private static string CanonicalQuery(Uri uri)
    {
        var query = uri.Query.TrimStart('?');
        if (query.Length == 0) return "";
        var pairs = query.Split('&', StringSplitOptions.RemoveEmptyEntries)
            .Select(p => p.Split('=', 2))
            .Select(p => (Key: p[0], Value: p.Length > 1 ? p[1] : ""))
            .OrderBy(p => p.Key, StringComparer.Ordinal);
        return string.Join("&", pairs.Select(p => $"{p.Key}={p.Value}"));
    }

    private static byte[] Hmac(byte[] key, string data) => HMACSHA256.HashData(key, Encoding.UTF8.GetBytes(data));

    private static string Hex(byte[] bytes) => Convert.ToHexStringLower(bytes);

    private static string Short(string value) => value.Length <= 200 ? value : value[..200];
}

/// <summary>Échec d'authentification chez l'éditeur : message destiné à l'utilisateur.</summary>
public sealed class VendorAuthException(string message) : Exception(message);
