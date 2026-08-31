using System.ClientModel;
using Azure.AI.OpenAI;
using OpenAI.Chat;

namespace Nexus.AI;

/// <summary>
/// Complétion de chat dont le fournisseur est choisi À L'EXÉCUTION selon
/// <see cref="AiRuntimeConfig"/> (piloté depuis Admin). Reconstruit le client
/// sous-jacent quand la configuration change. Sans clé configurée, se comporte
/// comme non configuré : l'AI Analyst reste pleinement déterministe.
/// </summary>
public sealed class DynamicChatCompletion(AiRuntimeConfig config, IHttpClientFactory httpFactory) : IChatCompletion
{
    private readonly object _lock = new();
    private IChatCompletion _inner = new NullChatCompletion();
    private string _cacheKey = "";

    public bool IsConfigured => config.IsConfigured;

    private IChatCompletion Resolve()
    {
        var (provider, apiKey, endpoint, model) = config.Snapshot();
        var key = $"{provider}|{endpoint}|{model}|{(string.IsNullOrEmpty(apiKey) ? "" : apiKey.GetHashCode())}";
        lock (_lock)
        {
            if (key == _cacheKey) return _inner;
            _inner = Build(provider, apiKey, endpoint, model);
            _cacheKey = key;
            return _inner;
        }
    }

    private IChatCompletion Build(string provider, string? apiKey, string? endpoint, string model)
    {
        if (string.IsNullOrWhiteSpace(apiKey)) return new NullChatCompletion();
        try
        {
            switch (provider)
            {
                case "anthropic":
                    return new AnthropicChatCompletion(httpFactory.CreateClient("anthropic"), apiKey, model);
                case "gemini":
                    return new GeminiChatCompletion(httpFactory.CreateClient("anthropic"), apiKey, model);
                case "openai":
                    return new OpenAiCompatibleCompletion(new OpenAI.OpenAIClient(new ApiKeyCredential(apiKey)).GetChatClient(model));
                case "azure-openai":
                    if (string.IsNullOrWhiteSpace(endpoint)) return new NullChatCompletion();
                    return new OpenAiCompatibleCompletion(new AzureOpenAIClient(new Uri(endpoint), new ApiKeyCredential(apiKey)).GetChatClient(model));
                default:
                    return new NullChatCompletion();
            }
        }
        catch
        {
            return new NullChatCompletion();
        }
    }

    public Task<string?> CompleteAsync(string system, string user, CancellationToken ct = default)
        => Resolve().CompleteAsync(system, user, ct);

    /// <summary>Teste réellement la connexion au fournisseur configuré.</summary>
    public async Task<(bool Ok, string Message)> TestAsync(CancellationToken ct = default)
    {
        if (!config.IsConfigured) return (false, "Aucun fournisseur configuré.");
        // Valide d'abord la clé indépendamment du modèle (liste des modèles).
        var (ok, message, models) = await ListModelsAsync(ct);
        if (!ok) return (false, message);

        var reply = await Resolve().CompleteAsync(
            "Tu es un test de connexion. Réponds uniquement par le mot OK.",
            "Réponds OK.", ct);
        if (reply is not null) return (true, $"Connexion réussie · réponse du modèle : « {reply.Trim()} »");

        var (_, _, _, model) = config.Snapshot();
        var known = models.Length > 0 && Array.Exists(models, m => string.Equals(m, model, StringComparison.OrdinalIgnoreCase));
        return known
            ? (false, "Clé valide mais l'appel a échoué (quota, région ou service).")
            : (false, $"Clé valide, mais le modèle « {model} » est introuvable. Choisissez-en un dans la liste.");
    }

    /// <summary>Valide la clé et liste les modèles disponibles chez le fournisseur.</summary>
    public async Task<(bool Ok, string Message, string[] Models)> ListModelsAsync(CancellationToken ct = default)
    {
        var (provider, apiKey, endpoint, _) = config.Snapshot();
        if (string.IsNullOrWhiteSpace(apiKey)) return (false, "Aucune clé configurée.", []);

        try
        {
            var http = httpFactory.CreateClient("anthropic");
            if (provider == "anthropic")
            {
                using var req = new HttpRequestMessage(HttpMethod.Get, "https://api.anthropic.com/v1/models?limit=100");
                req.Headers.Add("x-api-key", apiKey);
                req.Headers.Add("anthropic-version", "2023-06-01");
                return await ReadModels(http, req, "data", "id", ct);
            }
            if (provider == "openai")
            {
                using var req = new HttpRequestMessage(HttpMethod.Get, "https://api.openai.com/v1/models");
                req.Headers.Add("Authorization", $"Bearer {apiKey}");
                return await ReadModels(http, req, "data", "id", ct);
            }
            if (provider == "gemini")
            {
                using var req = new HttpRequestMessage(HttpMethod.Get, "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200");
                req.Headers.Add("x-goog-api-key", apiKey);
                return await ReadGeminiModels(http, req, ct);
            }
            // Azure : les « modèles » sont des déploiements, non listables via cette API.
            var (_, _, _, model) = config.Snapshot();
            return (true, "Fournisseur Azure : utilisez le nom de votre déploiement.", string.IsNullOrWhiteSpace(model) ? [] : [model]);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            return (false, "Service injoignable.", []);
        }
    }

    /// <summary>
    /// Choisit automatiquement un modèle de TEXTE fiable dans la liste du fournisseur
    /// (évite les modèles image/tts/preview et les noms obsolètes). Utilisé à l'ajout
    /// d'une clé pour que ça « marche » sans que l'utilisateur devine le bon modèle.
    /// </summary>
    public async Task<string?> PickWorkingModelAsync(CancellationToken ct = default)
    {
        var (provider, apiKey, _, _) = config.Snapshot();
        var (ok, _, models) = await ListModelsAsync(ct);
        if (!ok || models.Length == 0 || string.IsNullOrWhiteSpace(apiKey)) return null;

        bool textOnly(string m) => new[] { "image", "tts", "audio", "embedding", "vision", "research" }
            .All(bad => !m.Contains(bad, StringComparison.OrdinalIgnoreCase));
        double ver(string m)
        {
            var mt = System.Text.RegularExpressions.Regex.Match(m, "(\\d+(?:\\.\\d+)?)");
            return mt.Success && double.TryParse(mt.Groups[1].Value, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var v) ? v : 0;
        }
        // Candidats de texte, plus récents d'abord, en préférant flash-lite puis flash.
        var candidates = models
            .Where(m => textOnly(m) && !m.Contains("preview", StringComparison.OrdinalIgnoreCase) && m.Contains("flash", StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(ver).ThenByDescending(m => m.Contains("flash-lite", StringComparison.OrdinalIgnoreCase))
            .Take(3).ToList();
        if (candidates.Count == 0)
            candidates = models.Where(textOnly).OrderByDescending(ver).Take(3).ToList();
        if (candidates.Count == 0) return models.FirstOrDefault();

        // On teste réellement chaque candidat (gemini/anthropic), timeout court par essai.
        foreach (var m in candidates)
        {
            IChatCompletion? c = provider switch
            {
                "gemini" => new GeminiChatCompletion(httpFactory.CreateClient("anthropic"), apiKey, m),
                "anthropic" => new AnthropicChatCompletion(httpFactory.CreateClient("anthropic"), apiKey, m),
                _ => null,
            };
            if (c is null) return candidates[0]; // OpenAI/Azure : pas de test, on prend le meilleur candidat
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(8));
            try
            {
                var reply = await c.CompleteAsync("Test de connexion. Réponds OK.", "OK", cts.Token);
                if (!string.IsNullOrWhiteSpace(reply)) return m;
            }
            catch (OperationCanceledException) { /* candidat trop lent → suivant */ }
        }
        return candidates[0];
    }

    private static async Task<(bool, string, string[])> ReadModels(HttpClient http, HttpRequestMessage req, string arrayProp, string idProp, CancellationToken ct)
    {
        using var res = await http.SendAsync(req, ct);
        if (res.StatusCode == System.Net.HttpStatusCode.Unauthorized) return (false, "Clé invalide (401).", []);
        if (!res.IsSuccessStatusCode) return (false, $"Échec du fournisseur ({(int)res.StatusCode}).", []);
        using var stream = await res.Content.ReadAsStreamAsync(ct);
        using var doc = await System.Text.Json.JsonDocument.ParseAsync(stream, cancellationToken: ct);
        var list = new List<string>();
        if (doc.RootElement.TryGetProperty(arrayProp, out var arr))
            foreach (var item in arr.EnumerateArray())
                if (item.TryGetProperty(idProp, out var id) && id.GetString() is { } s) list.Add(s);
        list.Sort(StringComparer.OrdinalIgnoreCase);
        return (true, $"Clé valide · {list.Count} modèle(s) disponible(s).", [.. list]);
    }

    // Gemini : modèles sous "models", nom "models/xxx", filtrés à generateContent.
    private static async Task<(bool, string, string[])> ReadGeminiModels(HttpClient http, HttpRequestMessage req, CancellationToken ct)
    {
        using var res = await http.SendAsync(req, ct);
        if (res.StatusCode is System.Net.HttpStatusCode.Unauthorized or System.Net.HttpStatusCode.Forbidden or System.Net.HttpStatusCode.BadRequest)
            return (false, "Clé invalide ou API Generative Language non activée.", []);
        if (!res.IsSuccessStatusCode) return (false, $"Échec du fournisseur ({(int)res.StatusCode}).", []);
        using var stream = await res.Content.ReadAsStreamAsync(ct);
        using var doc = await System.Text.Json.JsonDocument.ParseAsync(stream, cancellationToken: ct);
        var list = new List<string>();
        if (doc.RootElement.TryGetProperty("models", out var arr))
        {
            foreach (var item in arr.EnumerateArray())
            {
                var supports = false;
                if (item.TryGetProperty("supportedGenerationMethods", out var methods))
                    foreach (var mm in methods.EnumerateArray())
                        if (mm.GetString() == "generateContent") { supports = true; break; }
                if (!supports) continue;
                if (item.TryGetProperty("name", out var n) && n.GetString() is { } s)
                    list.Add(s.StartsWith("models/", StringComparison.OrdinalIgnoreCase) ? s["models/".Length..] : s);
            }
        }
        list.Sort(StringComparer.OrdinalIgnoreCase);
        return (true, $"Clé valide · {list.Count} modèle(s) Gemini disponible(s).", [.. list]);
    }
}

/// <summary>Adaptateur pour tout ChatClient compatible OpenAI (OpenAI, Azure OpenAI).</summary>
internal sealed class OpenAiCompatibleCompletion(ChatClient client) : IChatCompletion
{
    public bool IsConfigured => true;

    public async Task<string?> CompleteAsync(string system, string user, CancellationToken ct = default)
    {
        try
        {
            var response = await client.CompleteChatAsync(
                [new SystemChatMessage(system), new UserChatMessage(user)],
                new ChatCompletionOptions { Temperature = 0.2f },
                ct);
            return response.Value.Content.Count > 0 ? response.Value.Content[0].Text : null;
        }
        catch (ClientResultException)
        {
            return null;
        }
    }
}
