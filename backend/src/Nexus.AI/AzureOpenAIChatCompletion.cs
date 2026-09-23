using System.ClientModel;
using Azure.AI.OpenAI;
using Microsoft.Extensions.Options;
using OpenAI.Chat;

namespace Nexus.AI;

/// <summary>
/// Complétion via Azure OpenAI. Instanciée uniquement lorsqu'une clé est
/// configurée (sinon <see cref="NullChatCompletion"/> est utilisée). Les erreurs
/// réseau/API dégradent proprement vers null (l'orchestrateur garde sa réponse
/// déterministe — jamais d'échec dur de l'AI Analyst).
/// </summary>
public sealed class AzureOpenAIChatCompletion : IChatCompletion
{
    private readonly ChatClient? _client;

    public AzureOpenAIChatCompletion(IOptions<AiOptions> options)
    {
        var o = options.Value;
        if (o.IsConfigured)
        {
            var azure = new AzureOpenAIClient(new Uri(o.Endpoint!), new ApiKeyCredential(o.ApiKey!));
            _client = azure.GetChatClient(o.ChatDeployment);
        }
    }

    public bool IsConfigured => _client is not null;

    public async Task<string?> CompleteAsync(string system, string user, CancellationToken ct = default, CompletionOptions? options = null)
    {
        if (_client is null)
        {
            return null;
        }

        try
        {
            var chatOptions = new ChatCompletionOptions { Temperature = options?.Json == true ? 0.1f : 0.2f };
            if (options?.MaxTokens is { } max) chatOptions.MaxOutputTokenCount = max;
            if (options?.Json == true) chatOptions.ResponseFormat = ChatResponseFormat.CreateJsonObjectFormat();
            var response = await _client.CompleteChatAsync(
                [new SystemChatMessage(system), new UserChatMessage(user)],
                chatOptions,
                ct);

            return response.Value.Content.Count > 0 ? response.Value.Content[0].Text : null;
        }
        catch (ClientResultException)
        {
            return null;   // dégradation propre : on garde la réponse déterministe
        }
    }
}
