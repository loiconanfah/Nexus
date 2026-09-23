namespace Nexus.AI;

/// <summary>Configuration du moteur IA (Azure OpenAI).</summary>
public sealed class AiOptions
{
    public const string SectionName = "Nexus:AI";

    public string? Endpoint { get; set; }
    public string? ApiKey { get; set; }
    public string ChatDeployment { get; set; } = "gpt-4o";
    public string EmbeddingDeployment { get; set; } = "text-embedding-3-large";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(Endpoint) && !string.IsNullOrWhiteSpace(ApiKey);
}

/// <summary>
/// Port de complétion de chat. L'IA ne raisonne jamais seule : elle reçoit un
/// contexte structuré issu du déterministe et se contente de le REFORMULER
/// (article 19). Si aucun modèle n'est configuré, l'orchestrateur reste
/// pleinement fonctionnel avec sa réponse déterministe.
/// </summary>
/// <summary>
/// Ce qu'on attend d'un appel. <c>Json</c> demande une réponse en JSON strict :
/// le modèle cesse alors d'entourer sa réponse de texte ou de balises Markdown,
/// ce qui économise des jetons et évite les réponses inexploitables.
/// <c>MaxTokens</c> borne la réponse ; une extraction documentaire en demande
/// plus qu'une phrase de synthèse.
/// </summary>
public sealed record CompletionOptions(bool Json = false, int? MaxTokens = null)
{
    /// <summary>Extraction documentaire : JSON strict, réponse large.</summary>
    public static readonly CompletionOptions Extraction = new(Json: true, MaxTokens: 8192);

    /// <summary>Réponse structurée courte : classification, narration encadrée.</summary>
    public static readonly CompletionOptions Structured = new(Json: true, MaxTokens: 2048);

    /// <summary>Réponse en prose, bornée : reformulation d'un contexte déjà calculé.</summary>
    public static readonly CompletionOptions Prose = new(Json: false, MaxTokens: 1024);
}

public interface IChatCompletion
{
    bool IsConfigured { get; }

    /// <summary>Reformule/complète à partir d'un prompt système + utilisateur, ou null si indisponible.</summary>
    Task<string?> CompleteAsync(string system, string user, CancellationToken ct = default, CompletionOptions? options = null);
}

/// <summary>Implémentation inactive (aucune clé configurée) : l'orchestrateur utilise sa réponse déterministe.</summary>
public sealed class NullChatCompletion : IChatCompletion
{
    public bool IsConfigured => false;
    public Task<string?> CompleteAsync(string system, string user, CancellationToken ct = default, CompletionOptions? options = null) => Task.FromResult<string?>(null);
}
