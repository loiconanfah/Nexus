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

/// <summary>Plafonds mensuels d'usage LLM par tenant (0 = illimité).</summary>
public sealed class LlmQuotaOptions
{
    public int MonthlyCallCap { get; init; }
    public long MonthlyCharCap { get; init; }

    public static LlmQuotaOptions FromEnvironment()
    {
        static long ParseLong(string name, long def)
            => long.TryParse(Environment.GetEnvironmentVariable(name), out var v) && v >= 0 ? v : def;
        return new LlmQuotaOptions
        {
            MonthlyCallCap = (int)ParseLong("NEXUS_LLM_MONTHLY_CALL_CAP", 2000),
            MonthlyCharCap = ParseLong("NEXUS_LLM_MONTHLY_CHAR_CAP", 20_000_000),
        };
    }
}

/// <summary>
/// Décorateur de <see cref="IChatCompletion"/> qui applique un PLAFOND d'usage LLM
/// par tenant et par mois. Au-delà du plafond, renvoie null : l'application bascule
/// alors sur ses réponses déterministes (dégradation gracieuse, jamais d'erreur).
/// Le coût est approximé par le nombre d'appels et de caractères (proxy de tokens).
/// </summary>
public sealed class QuotaChatCompletion(
    IChatCompletion inner, ICurrentTenant tenant, ILlmUsageStore usage, LlmQuotaOptions options) : IChatCompletion
{
    public bool IsConfigured => inner.IsConfigured;

    public async Task<string?> CompleteAsync(string system, string user, CancellationToken ct = default)
    {
        var tid = tenant.TenantId;
        if (tid is null) return await inner.CompleteAsync(system, user, ct); // hors requête tenant : pas de quota

        var period = DateTime.UtcNow.ToString("yyyy-MM");
        var used = await usage.GetAsync(tid.Value, period, ct);

        var overCalls = options.MonthlyCallCap > 0 && used.Calls >= options.MonthlyCallCap;
        var overChars = options.MonthlyCharCap > 0 && used.Chars >= options.MonthlyCharCap;
        if (overCalls || overChars) return null; // quota atteint → repli déterministe

        var reply = await inner.CompleteAsync(system, user, ct);
        if (reply is not null)
        {
            var chars = system.Length + user.Length + reply.Length;
            await usage.IncrementAsync(tid.Value, period, 1, chars, ct);
        }
        return reply;
    }
}
