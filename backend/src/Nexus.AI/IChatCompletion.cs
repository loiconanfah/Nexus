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
public interface IChatCompletion
{
    bool IsConfigured { get; }

    /// <summary>Reformule/complète à partir d'un prompt système + utilisateur, ou null si indisponible.</summary>
    Task<string?> CompleteAsync(string system, string user, CancellationToken ct = default);
}

/// <summary>Implémentation inactive (aucune clé configurée) : l'orchestrateur utilise sa réponse déterministe.</summary>
public sealed class NullChatCompletion : IChatCompletion
{
    public bool IsConfigured => false;
    public Task<string?> CompleteAsync(string system, string user, CancellationToken ct = default) => Task.FromResult<string?>(null);
}
