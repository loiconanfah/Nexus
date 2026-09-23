namespace Nexus.AI;

/// <summary>Consommation LLM d'un tenant sur une période (mois AAAA-MM).</summary>
public sealed record LlmUsage(int Calls, long Chars);

/// <summary>
/// Persistance de la consommation LLM par tenant et par mois. Implémentée dans la
/// couche API (Postgres). Optionnelle : sans elle, aucun quota n'est appliqué.
/// </summary>
public interface ILlmUsageStore
{
    Task<LlmUsage> GetAsync(Guid tenant, string period, CancellationToken ct = default);
    Task IncrementAsync(Guid tenant, string period, int calls, long chars, CancellationToken ct = default);
}

/// <summary>Plafonds mensuels d'usage LLM (0 = illimité).</summary>
public sealed class LlmQuotaOptions
{
    /// <summary>Par espace de travail, sur la clé de l'opérateur.</summary>
    public int MonthlyCallCap { get; init; }
    public long MonthlyCharCap { get; init; }

    /// <summary>
    /// TOUS espaces confondus, sur la clé de l'opérateur. Le plafond par espace
    /// ne protège de rien si l'inscription est libre : il suffit d'ouvrir dix
    /// comptes. Celui-ci est le seul qui borne la facture. À zéro par défaut,
    /// pour ne rien couper à l'insu de l'opérateur.
    /// </summary>
    public int SharedMonthlyCallCap { get; init; }
    public long SharedMonthlyCharCap { get; init; }

    public static LlmQuotaOptions FromEnvironment()
    {
        static long ParseLong(string name, long def)
            => long.TryParse(Environment.GetEnvironmentVariable(name), out var v) && v >= 0 ? v : def;
        return new LlmQuotaOptions
        {
            MonthlyCallCap = (int)ParseLong("NEXUS_LLM_MONTHLY_CALL_CAP", 2000),
            MonthlyCharCap = ParseLong("NEXUS_LLM_MONTHLY_CHAR_CAP", 20_000_000),
            SharedMonthlyCallCap = (int)ParseLong("NEXUS_LLM_SHARED_CALL_CAP", 0),
            SharedMonthlyCharCap = ParseLong("NEXUS_LLM_SHARED_CHAR_CAP", 0),
        };
    }
}

/// <summary>
/// Décorateur de <see cref="IChatCompletion"/> qui applique un PLAFOND d'usage LLM
/// par tenant et par mois. Au-delà du plafond, renvoie null : l'application bascule
/// alors sur ses réponses déterministes (dégradation gracieuse, jamais d'erreur).
/// Le coût est approximé par le nombre d'appels et de caractères (proxy de tokens).
///
/// Le plafond ne s'applique qu'à la CLÉ DE L'OPÉRATEUR, celle que Lenexux fournit
/// aux espaces qui n'en ont pas : c'est son budget qu'il protège. Un espace qui a
/// posé sa propre clé paie ses propres appels, et rien ne justifie de les lui
/// compter ni de les lui couper. Sa consommation reste mesurée, pour qu'il la voie.
/// </summary>
public sealed class QuotaChatCompletion(
    IChatCompletion inner, ICurrentTenant tenant, ILlmUsageStore usage, LlmQuotaOptions options,
    Func<bool>? usesSharedKey = null) : IChatCompletion
{
    public bool IsConfigured => inner.IsConfigured;

    public async Task<string?> CompleteAsync(string system, string user, CancellationToken ct = default, CompletionOptions? completion = null)
    {
        var tid = tenant.TenantId;
        if (tid is null) return await inner.CompleteAsync(system, user, ct, completion); // hors requête tenant : pas de quota
        // Clé propre à l'espace : on mesure, on ne plafonne pas.
        var shared = usesSharedKey is null || usesSharedKey();

        var period = DateTime.UtcNow.ToString("yyyy-MM");
        var used = await usage.GetAsync(tid.Value, period, ct);

        // Consommation de la clé de l'opérateur, tous espaces confondus, tenue
        // sous le tenant vide. Sans elle, dix inscriptions libres contournent
        // dix fois le plafond par espace.
        if (shared && (options.SharedMonthlyCallCap > 0 || options.SharedMonthlyCharCap > 0))
        {
            var pooled = await usage.GetAsync(Guid.Empty, period, ct);
            if ((options.SharedMonthlyCallCap > 0 && pooled.Calls >= options.SharedMonthlyCallCap)
                || (options.SharedMonthlyCharCap > 0 && pooled.Chars >= options.SharedMonthlyCharCap))
                return null;
        }

        var overCalls = shared && options.MonthlyCallCap > 0 && used.Calls >= options.MonthlyCallCap;
        var overChars = shared && options.MonthlyCharCap > 0 && used.Chars >= options.MonthlyCharCap;
        if (overCalls || overChars) return null; // quota atteint → repli déterministe

        var reply = await inner.CompleteAsync(system, user, ct, completion);
        if (reply is not null)
        {
            var chars = system.Length + user.Length + reply.Length;
            await usage.IncrementAsync(tid.Value, period, 1, chars, ct);
            if (shared) await usage.IncrementAsync(Guid.Empty, period, 1, chars, ct);
        }
        return reply;
    }
}
