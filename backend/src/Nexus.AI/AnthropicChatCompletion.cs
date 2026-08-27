using System.Net.Http.Json;
using System.Text.Json;

namespace Nexus.AI;

/// <summary>
/// Complétion via l'API Messages d'Anthropic (Claude). Utilisée lorsque le
/// fournisseur runtime est "anthropic". Les erreurs dégradent proprement vers
/// null (l'AI Analyst garde sa réponse déterministe). La clé n'est jamais
/// journalisée.
/// </summary>
public sealed class AnthropicChatCompletion(HttpClient http, string apiKey, string model) : IChatCompletion
{
    private const string Endpoint = "https://api.anthropic.com/v1/messages";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(apiKey);

    public async Task<string?> CompleteAsync(string system, string user, CancellationToken ct = default)
    {
        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Post, Endpoint);
            req.Headers.Add("x-api-key", apiKey);
            req.Headers.Add("anthropic-version", "2023-06-01");
            req.Content = JsonContent.Create(new
            {
                model,
                max_tokens = 1024,
                system,
                messages = new[] { new { role = "user", content = user } },
            });

            using var res = await http.SendAsync(req, ct);
            if (!res.IsSuccessStatusCode) return null;

            using var stream = await res.Content.ReadAsStreamAsync(ct);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
            if (doc.RootElement.TryGetProperty("content", out var content) && content.GetArrayLength() > 0)
            {
                var first = content[0];
                if (first.TryGetProperty("text", out var txt)) return txt.GetString();
            }
            return null;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            return null;   // dégradation propre
        }
    }
}
