using Nexus.AI;

namespace Nexus.Api.AI;

/// <summary>
/// Pourquoi le modèle n'a pas répondu, dit précisément.
///
/// « Le modèle n'a pas répondu » est vrai et inutile : l'utilisateur ne sait ni
/// quelle clé a été employée, ni s'il doit corriger quelque chose. Or le système
/// le sait. Le cas qui trompe le plus est celui d'un espace qui a gardé SA clé,
/// devenue invalide : elle prime sur celle de l'opérateur, si bien qu'ajouter
/// une clé côté serveur ne change rien tant qu'on ne l'a pas effacée.
/// </summary>
public static class AiAvailability
{
    /// <summary>Message d'échec, et l'écran où corriger.</summary>
    public static (string Message, string? Route) Explain(AiRuntimeConfig config, LlmUsage used, LlmQuotaOptions quota, bool shared, string lang)
    {
        var en = lang == "en";
        var source = config.Source();

        if (source == "none")
            return (en
                ? "No AI model is available for this workspace. Add a key in Administration, or ask your operator for one."
                : "Aucun modèle IA n'est disponible pour cet espace. Ajoutez une clé dans Administration, ou demandez-en une à votre opérateur.",
                "/admin");

        var overCalls = shared && quota.MonthlyCallCap > 0 && used.Calls >= quota.MonthlyCallCap;
        var overChars = shared && quota.MonthlyCharCap > 0 && used.Chars >= quota.MonthlyCharCap;
        if (overCalls || overChars)
            return (en
                ? "The monthly cap of the shared key is reached. Add your own key to carry on, or wait for next month."
                : "Le plafond mensuel de la clé partagée est atteint. Ajoutez votre propre clé pour continuer, ou attendez le mois prochain.",
                "/admin");

        var (provider, _, model, _) = config.Snapshot();
        if (source == "own")
            return (en
                ? $"Your own key ({Label(provider, en)}, model {model}) did not answer: it may be invalid, out of quota, or the model may not exist with that provider. Clear it in Administration to fall back on the key provided by Lenexux."
                : $"Votre propre clé ({Label(provider, en)}, modèle {model}) n'a pas répondu : elle peut être invalide, à court de quota, ou le modèle peut ne pas exister chez ce fournisseur. Effacez-la dans Administration pour revenir à la clé fournie par Lenexux.",
                "/admin");

        return (en
            ? $"The model did not answer ({Label(provider, en)}). The provider may be down or saturated; try again in a moment."
            : $"Le modèle n'a pas répondu ({Label(provider, en)}). Le fournisseur peut être en panne ou saturé ; réessayez dans un instant.",
            null);
    }

    private static string Label(string provider, bool en) => provider switch
    {
        "openrouter" => "OpenRouter",
        "anthropic" => "Claude (Anthropic)",
        "gemini" => "Google Gemini",
        "openai" => "OpenAI",
        "azure-openai" => "Azure OpenAI",
        _ => provider,
    };
}
