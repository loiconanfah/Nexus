namespace Nexus.AI;

/// <summary>Intentions reconnues par l'orchestrateur (article 20).</summary>
public enum AiIntent
{
    TopRisks,           // « quels sont nos plus grands risques ? »
    ExplainCriticality, // « pourquoi X est-il critique ? »
    SimulateFailure,    // « que se passe-t-il si X tombe ? »
    SinglePointsOfFailure,
    UndocumentedDependencies,
    Overview,           // question générale / synthèse
}

/// <summary>
/// Élément de preuve rattaché à une réponse (article 39). Chaque affirmation de
/// l'IA doit pouvoir être tracée jusqu'à une donnée déterministe.
/// </summary>
public sealed record AiEvidence(string Label, string Detail, double? Confidence = null);

/// <summary>Source citée (nœud du graphe, facteur de risque, document…).</summary>
public sealed record AiSource(string Type, string Reference);

/// <summary>
/// Réponse de l'AI Analyst. Toujours accompagnée de ses preuves, de sa confiance
/// et de ses sources (guardrails, article 22) ; distingue faits et hypothèses.
/// </summary>
public sealed record AiAnswer(
    string Question,
    AiIntent Intent,
    string Answer,
    double Confidence,
    IReadOnlyList<AiEvidence> Evidence,
    IReadOnlyList<AiSource> Sources,
    IReadOnlyList<string> AffectedAssets,
    string? RecommendedAction,
    bool LlmNaturalized);
