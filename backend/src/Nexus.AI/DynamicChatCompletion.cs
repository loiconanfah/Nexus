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
        var reply = await Resolve().CompleteAsync(
            "Tu es un test de connexion. Réponds uniquement par le mot OK.",
            "Réponds OK.", ct);
        return reply is not null
            ? (true, $"Connexion réussie · réponse du modèle : « {reply.Trim()} »")
            : (false, "Échec : clé invalide, modèle introuvable ou service injoignable.");
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
