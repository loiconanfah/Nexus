using System.Net.Http.Json;
using System.Text.Json;

namespace Nexus.AI;

/// <summary>
/// Complétion via l'API Google Gemini (Generative Language API). Utilisée
/// lorsque le fournisseur runtime est "gemini". Palier gratuit disponible.
/// Les erreurs dégradent proprement vers null. La clé n'est jamais journalisée.
/// </summary>
public sealed class GeminiChatCompletion(HttpClient http, string apiKey, string model) : IChatCompletion
{
    public bool IsConfigured => !string.IsNullOrWhiteSpace(apiKey);

    public async Task<string?> CompleteAsync(string system, string user, CancellationToken ct = default, CompletionOptions? options = null)
    {
        var m = model.StartsWith("models/", StringComparison.OrdinalIgnoreCase) ? model["models/".Length..] : model;
        var config = GenerationConfig(m, options);
        var (reply, configRejected) = await SendAsync(m, system, user, config, ct);
        // Un réglage refusé (famille de modèles plus récente, champ inconnu) ne doit
        // pas priver l'utilisateur de sa réponse : on rejoue SANS réglages, et
        // seulement dans ce cas — un quota atteint ne se rejoue pas.
        if (reply is null && configRejected && config is not null)
            (reply, _) = await SendAsync(m, system, user, null, ct);
        return reply;
    }

    private async Task<(string? Text, bool ConfigRejected)> SendAsync(string m, string system, string user, object? generationConfig, CancellationToken ct)
    {
        try
        {
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent";
            using var req = new HttpRequestMessage(HttpMethod.Post, url);
            req.Headers.Add("x-goog-api-key", apiKey);
            req.Content = generationConfig is null
                ? JsonContent.Create(new
                {
                    system_instruction = new { parts = new[] { new { text = system } } },
                    contents = new[] { new { role = "user", parts = new[] { new { text = user } } } },
                })
                : JsonContent.Create(new
                {
                    system_instruction = new { parts = new[] { new { text = system } } },
                    contents = new[] { new { role = "user", parts = new[] { new { text = user } } } },
                    generationConfig,
                });

            using var res = await http.SendAsync(req, ct);
            if (!res.IsSuccessStatusCode)
            {
                var body = await res.Content.ReadAsStringAsync(ct);
                Console.Error.WriteLine($"[GEMINI] {(int)res.StatusCode} {res.StatusCode} sur {m} : {Trim(body)}");
                return (null, res.StatusCode == System.Net.HttpStatusCode.BadRequest);
            }

            var json = await res.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.TryGetProperty("candidates", out var cands) && cands.GetArrayLength() > 0
                && cands[0].TryGetProperty("content", out var content)
                && content.TryGetProperty("parts", out var parts) && parts.GetArrayLength() > 0
                && parts[0].TryGetProperty("text", out var txt))
            {
                return (txt.GetString(), false);
            }
            // 200 mais pas de texte (blocage sécurité, modèle « thinking », format inattendu).
            var reason = cands.GetArrayLength() > 0 && cands[0].TryGetProperty("finishReason", out var fr) ? fr.GetString() : "aucun candidat";
            Console.Error.WriteLine($"[GEMINI] 200 sans texte sur {m} (finishReason={reason}) : {Trim(json)}");
            // MAX_TOKENS : la réponse a été coupée. Le plafond vient de nos réglages,
            // donc un nouvel essai sans réglages a une vraie chance d'aboutir.
            return (null, reason == "MAX_TOKENS");
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            Console.Error.WriteLine($"[GEMINI] exception : {ex.GetType().Name} {ex.Message}");
            return (null, false);
        }
    }

    /// <summary>
    /// Réglages de génération. Deux d'entre eux changent tout sur le coût et la durée :
    ///
    /// 1. La RÉFLEXION. Les modèles 2.5 réfléchissent par défaut, et ces jetons de
    ///    réflexion sont facturés : sur une extraction documentaire, où le modèle
    ///    recopie des faits du texte plutôt qu'il ne raisonne, ils coûtent souvent
    ///    plus que la réponse elle-même, pour rien. On la coupe sur les modèles
    ///    rapides (budget 0) et on la réduit au minimum sur « pro », qui l'exige.
    /// 2. Le MODE JSON. Sans lui, le modèle entoure volontiers son JSON de phrases
    ///    ou de balises Markdown : des jetons de plus, et une réponse parfois
    ///    inexploitable, donc un appel rejoué. Avec lui, la réponse est du JSON.
    /// </summary>
    private static object? GenerationConfig(string m, CompletionOptions? options)
    {
        var name = m.ToLowerInvariant();
        var thinking = name.Contains("2.5") || name.Contains("2-5");
        var pro = name.Contains("pro");
        var maxTokens = options?.MaxTokens ?? 2048;

        if (options?.Json == true && thinking)
            return new
            {
                temperature = 0.1,
                maxOutputTokens = maxTokens,
                responseMimeType = "application/json",
                thinkingConfig = new { thinkingBudget = pro ? 128 : 0 },
            };
        if (options?.Json == true)
            return new { temperature = 0.1, maxOutputTokens = maxTokens, responseMimeType = "application/json" };
        if (thinking)
            return new { maxOutputTokens = maxTokens, thinkingConfig = new { thinkingBudget = pro ? 128 : 0 } };
        return new { maxOutputTokens = maxTokens };
    }

    private static string Trim(string s) => s.Length > 300 ? s[..300] : s;
}
