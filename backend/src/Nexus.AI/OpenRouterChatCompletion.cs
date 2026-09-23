using System.Net.Http.Json;
using System.Text.Json;

namespace Nexus.AI;

/// <summary>
/// Complétion via OpenRouter : une seule clé donne accès aux modèles de tous les
/// fournisseurs. Trois choix portent ici, et chacun a sa raison :
///
/// 1. LE REPLI AUTOMATIQUE. On n'envoie pas un modèle mais une LISTE, par ordre
///    de préférence. Si le premier est en panne, saturé ou refuse la requête,
///    OpenRouter passe au suivant de lui-même. C'est la continuité de service
///    demandée, sans chaîne de reprise à écrire ni à maintenir de notre côté.
/// 2. LA RÉFLEXION EXCLUE. Les modèles récents réfléchissent par défaut et ces
///    jetons sont facturés. Une extraction documentaire recopie des faits : la
///    réflexion y coûte plus que la réponse, pour rien.
/// 3. LA COLLECTE REFUSÉE. Les documents qui passent ici décrivent les
///    dépendances d'une organisation cliente. Les fournisseurs qui s'autorisent
///    à entraîner sur ce qui transite sont donc écartés de la sélection.
/// </summary>
public sealed class OpenRouterChatCompletion(HttpClient http, string apiKey, string model) : IChatCompletion
{
    private const string Endpoint = "https://openrouter.ai/api/v1/chat/completions";

    /// <summary>Modèles de repli ajoutés derrière le choix de l'utilisateur.</summary>
    /// <remarks>
    /// Trois FOURNISSEURS différents, pas trois modèles du même : une panne chez
    /// l'un ne doit pas emporter toute la chaîne. Le premier est le moins cher ;
    /// les deux suivants sont des alias flottants, qui suivent les versions sans
    /// qu'on ait à rouvrir ce fichier.
    /// </remarks>
    public static readonly string[] Fallbacks =
    [
        "openai/gpt-4o-mini",
        "~google/gemini-flash-latest",
        "~anthropic/claude-haiku-latest",
    ];

    public bool IsConfigured => !string.IsNullOrWhiteSpace(apiKey);

    /// <summary>
    /// Chaîne de modèles : ce que l'utilisateur a choisi (un nom, ou plusieurs
    /// séparés par des virgules), puis les replis qui n'y figurent pas déjà.
    /// Quatre au plus : au-delà, une panne générale fait payer quatre essais.
    /// </summary>
    public static IReadOnlyList<string> Chain(string? model)
    {
        var chain = new List<string>();
        foreach (var m in (model ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            if (!chain.Contains(m, StringComparer.OrdinalIgnoreCase)) chain.Add(m);
        foreach (var f in Fallbacks)
        {
            if (chain.Count >= 4) break;
            if (!chain.Contains(f, StringComparer.OrdinalIgnoreCase)) chain.Add(f);
        }
        return chain;
    }

    public async Task<string?> CompleteAsync(string system, string user, CancellationToken ct = default, CompletionOptions? options = null)
    {
        var chain = Chain(model);
        var (text, rejected) = await SendAsync(chain, system, user, options, full: true, ct);
        // Un modèle qui refuse un réglage (mode JSON non pris en charge, par
        // exemple) ne doit pas priver l'utilisateur de sa réponse : on rejoue une
        // fois au plus simple. Une clé refusée ou un quota atteint ne se rejouent pas.
        if (text is null && rejected) (text, _) = await SendAsync(chain, system, user, options, full: false, ct);
        return text;
    }

    private async Task<(string? Text, bool Rejected)> SendAsync(
        IReadOnlyList<string> chain, string system, string user, CompletionOptions? options, bool full, CancellationToken ct)
    {
        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Post, Endpoint);
            req.Headers.Add("Authorization", $"Bearer {apiKey}");
            // Attribution de l'appel côté OpenRouter (tableau de bord, quotas).
            req.Headers.Add("HTTP-Referer", "https://lenexux.com");
            req.Headers.Add("X-Title", "Lenexux");

            var messages = new object[]
            {
                new { role = "system", content = system },
                new { role = "user", content = user },
            };
            req.Content = full
                ? JsonContent.Create(new
                {
                    model = chain[0],
                    models = chain,
                    messages,
                    temperature = options?.Json == true ? 0.1 : 0.2,
                    max_tokens = options?.MaxTokens ?? 2048,
                    reasoning = new { exclude = true },
                    provider = new { data_collection = "deny" },
                    response_format = options?.Json == true ? new { type = "json_object" } : null,
                })
                : JsonContent.Create(new
                {
                    model = chain[0],
                    models = chain,
                    messages,
                    max_tokens = options?.MaxTokens ?? 2048,
                });

            using var res = await http.SendAsync(req, ct);
            if (!res.IsSuccessStatusCode)
            {
                var body = await res.Content.ReadAsStringAsync(ct);
                Console.Error.WriteLine($"[OPENROUTER] {(int)res.StatusCode} {res.StatusCode} : {Trim(body)}");
                return (null, res.StatusCode is System.Net.HttpStatusCode.BadRequest or System.Net.HttpStatusCode.NotFound);
            }

            var json = await res.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            // Une erreur peut arriver dans un corps en 200 (modèle indisponible).
            if (root.TryGetProperty("error", out var err))
            {
                Console.Error.WriteLine($"[OPENROUTER] erreur dans la réponse : {Trim(err.ToString())}");
                return (null, false);
            }
            if (root.TryGetProperty("choices", out var choices) && choices.GetArrayLength() > 0
                && choices[0].TryGetProperty("message", out var msg)
                && msg.TryGetProperty("content", out var content))
            {
                var text = content.GetString();
                return (string.IsNullOrWhiteSpace(text) ? null : text, false);
            }
            Console.Error.WriteLine($"[OPENROUTER] 200 sans contenu : {Trim(json)}");
            return (null, false);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            Console.Error.WriteLine($"[OPENROUTER] exception : {ex.GetType().Name} {ex.Message}");
            return (null, false);
        }
    }

    private static string Trim(string s) => s.Length > 300 ? s[..300] : s;
}
