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

    public async Task<string?> CompleteAsync(string system, string user, CancellationToken ct = default)
    {
        try
        {
            var m = model.StartsWith("models/", StringComparison.OrdinalIgnoreCase) ? model["models/".Length..] : model;
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent";
            using var req = new HttpRequestMessage(HttpMethod.Post, url);
            req.Headers.Add("x-goog-api-key", apiKey);
            req.Content = JsonContent.Create(new
            {
                system_instruction = new { parts = new[] { new { text = system } } },
                contents = new[] { new { role = "user", parts = new[] { new { text = user } } } },
            });

            using var res = await http.SendAsync(req, ct);
            if (!res.IsSuccessStatusCode)
            {
                var body = await res.Content.ReadAsStringAsync(ct);
                Console.Error.WriteLine($"[GEMINI] {(int)res.StatusCode} {res.StatusCode} sur {m} : {Trim(body)}");
                return null;
            }

            var json = await res.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.TryGetProperty("candidates", out var cands) && cands.GetArrayLength() > 0
                && cands[0].TryGetProperty("content", out var content)
                && content.TryGetProperty("parts", out var parts) && parts.GetArrayLength() > 0
                && parts[0].TryGetProperty("text", out var txt))
            {
                return txt.GetString();
            }
            // 200 mais pas de texte (blocage sécurité, modèle « thinking », format inattendu).
            var reason = cands.GetArrayLength() > 0 && cands[0].TryGetProperty("finishReason", out var fr) ? fr.GetString() : "aucun candidat";
            Console.Error.WriteLine($"[GEMINI] 200 sans texte sur {m} (finishReason={reason}) : {Trim(json)}");
            return null;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            Console.Error.WriteLine($"[GEMINI] exception : {ex.GetType().Name} {ex.Message}");
            return null;
        }
    }

    private static string Trim(string s) => s.Length > 300 ? s[..300] : s;
}
