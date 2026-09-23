using Nexus.AI;

namespace Nexus.Tests.AI;

public class QuotaChatCompletionTests
{
    private static readonly Guid Tenant = Guid.Parse("be110000-cf1c-4000-8000-000000000002");

    private sealed class FakeTenant(Guid? id) : ICurrentTenant { public Guid? TenantId { get; } = id; }

    private sealed class FakeInner(string? reply) : IChatCompletion
    {
        public int Calls;
        public bool IsConfigured => true;
        public Task<string?> CompleteAsync(string system, string user, CancellationToken ct = default, CompletionOptions? options = null)
        { Calls++; return Task.FromResult(reply); }
    }

    private sealed class MemUsage : ILlmUsageStore
    {
        private readonly Dictionary<string, LlmUsage> _u = new();
        public Task<LlmUsage> GetAsync(Guid tenant, string period, CancellationToken ct = default)
            => Task.FromResult(_u.GetValueOrDefault($"{tenant}|{period}", new LlmUsage(0, 0)));
        public Task IncrementAsync(Guid tenant, string period, int calls, long chars, CancellationToken ct = default)
        {
            var k = $"{tenant}|{period}";
            var cur = _u.GetValueOrDefault(k, new LlmUsage(0, 0));
            _u[k] = new LlmUsage(cur.Calls + calls, cur.Chars + chars);
            return Task.CompletedTask;
        }
        public void Seed(string period, int calls, long chars) => _u[$"{Tenant}|{period}"] = new LlmUsage(calls, chars);
    }

    [Fact]
    public async Task Under_cap_calls_inner_and_records_usage()
    {
        var inner = new FakeInner("réponse");
        var usage = new MemUsage();
        var q = new QuotaChatCompletion(inner, new FakeTenant(Tenant), usage, new LlmQuotaOptions { MonthlyCallCap = 10, MonthlyCharCap = 1000 });

        var reply = await q.CompleteAsync("sys", "user");

        Assert.Equal("réponse", reply);
        Assert.Equal(1, inner.Calls);
        var period = DateTime.UtcNow.ToString("yyyy-MM");
        var u = await usage.GetAsync(Tenant, period);
        Assert.Equal(1, u.Calls);
        Assert.True(u.Chars > 0);
    }

    [Fact]
    public async Task At_call_cap_returns_null_and_does_not_call_inner()
    {
        var inner = new FakeInner("réponse");
        var usage = new MemUsage();
        var period = DateTime.UtcNow.ToString("yyyy-MM");
        usage.Seed(period, calls: 10, chars: 0);
        var q = new QuotaChatCompletion(inner, new FakeTenant(Tenant), usage, new LlmQuotaOptions { MonthlyCallCap = 10, MonthlyCharCap = 0 });

        var reply = await q.CompleteAsync("sys", "user");

        Assert.Null(reply);          // repli déterministe
        Assert.Equal(0, inner.Calls); // l'appel coûteux n'a pas eu lieu
    }

    [Fact]
    public async Task At_char_cap_returns_null()
    {
        var inner = new FakeInner("réponse");
        var usage = new MemUsage();
        var period = DateTime.UtcNow.ToString("yyyy-MM");
        usage.Seed(period, calls: 0, chars: 1000);
        var q = new QuotaChatCompletion(inner, new FakeTenant(Tenant), usage, new LlmQuotaOptions { MonthlyCallCap = 0, MonthlyCharCap = 1000 });

        Assert.Null(await q.CompleteAsync("sys", "user"));
    }

    [Fact]
    public async Task Null_reply_does_not_record_usage()
    {
        var inner = new FakeInner(null); // repli du fournisseur
        var usage = new MemUsage();
        var q = new QuotaChatCompletion(inner, new FakeTenant(Tenant), usage, new LlmQuotaOptions { MonthlyCallCap = 10, MonthlyCharCap = 1000 });

        Assert.Null(await q.CompleteAsync("sys", "user"));
        var u = await usage.GetAsync(Tenant, DateTime.UtcNow.ToString("yyyy-MM"));
        Assert.Equal(0, u.Calls);
    }

    [Fact]
    public async Task Le_plafond_protege_la_cle_de_l_operateur()
    {
        // Espace sans cle propre : c'est Lenexux qui paie, le plafond s'applique.
        var inner = new FakeInner("reponse");
        var usage = new MemUsage();
        usage.Seed(DateTime.UtcNow.ToString("yyyy-MM"), calls: 10, chars: 0);
        var q = new QuotaChatCompletion(inner, new FakeTenant(Tenant), usage,
            new LlmQuotaOptions { MonthlyCallCap = 10, MonthlyCharCap = 0 }, usesSharedKey: () => true);

        Assert.Null(await q.CompleteAsync("sys", "user"));
        Assert.Equal(0, inner.Calls);
    }

    [Fact]
    public async Task Un_espace_avec_sa_propre_cle_n_est_pas_plafonne()
    {
        // Il paie ses propres appels : les compter oui, les couper non.
        var inner = new FakeInner("reponse");
        var usage = new MemUsage();
        usage.Seed(DateTime.UtcNow.ToString("yyyy-MM"), calls: 10_000, chars: 100_000_000);
        var q = new QuotaChatCompletion(inner, new FakeTenant(Tenant), usage,
            new LlmQuotaOptions { MonthlyCallCap = 10, MonthlyCharCap = 1000 }, usesSharedKey: () => false);

        Assert.Equal("reponse", await q.CompleteAsync("sys", "user"));
        Assert.Equal(1, inner.Calls);
        // La consommation reste mesuree, pour qu'il la voie dans Administration.
        var u = await usage.GetAsync(Tenant, DateTime.UtcNow.ToString("yyyy-MM"));
        Assert.Equal(10_001, u.Calls);
    }

    [Fact]
    public async Task Le_plafond_global_borne_la_facture_de_l_operateur()
    {
        // Dix comptes ouverts librement contournent dix fois le plafond par
        // espace : seul le plafond tous espaces confondus borne la depense.
        var usage = new MemUsage();
        var options = new LlmQuotaOptions { MonthlyCallCap = 0, MonthlyCharCap = 0, SharedMonthlyCallCap = 2, SharedMonthlyCharCap = 0 };
        var inner = new FakeInner("reponse");

        // Deux espaces DIFFERENTS, sur la cle de l'operateur.
        var a1 = new QuotaChatCompletion(inner, new FakeTenant(Guid.NewGuid()), usage, options, usesSharedKey: () => true);
        var a2 = new QuotaChatCompletion(inner, new FakeTenant(Guid.NewGuid()), usage, options, usesSharedKey: () => true);
        var a3 = new QuotaChatCompletion(inner, new FakeTenant(Guid.NewGuid()), usage, options, usesSharedKey: () => true);

        Assert.Equal("reponse", await a1.CompleteAsync("sys", "user"));
        Assert.Equal("reponse", await a2.CompleteAsync("sys", "user"));
        Assert.Null(await a3.CompleteAsync("sys", "user"));
        Assert.Equal(2, inner.Calls);
    }

    [Fact]
    public async Task Le_plafond_global_ne_touche_pas_un_espace_qui_paie_sa_cle()
    {
        var usage = new MemUsage();
        var options = new LlmQuotaOptions { SharedMonthlyCallCap = 1 };
        var inner = new FakeInner("reponse");
        var shared = new QuotaChatCompletion(inner, new FakeTenant(Guid.NewGuid()), usage, options, usesSharedKey: () => true);
        var own = new QuotaChatCompletion(inner, new FakeTenant(Guid.NewGuid()), usage, options, usesSharedKey: () => false);

        await shared.CompleteAsync("sys", "user");          // consomme le plafond global
        Assert.Equal("reponse", await own.CompleteAsync("sys", "user"));
        Assert.Equal(2, inner.Calls);
    }

    [Fact]
    public async Task No_tenant_passes_through_without_quota()
    {
        var inner = new FakeInner("réponse");
        var usage = new MemUsage();
        var q = new QuotaChatCompletion(inner, new FakeTenant(null), usage, new LlmQuotaOptions { MonthlyCallCap = 1, MonthlyCharCap = 1 });

        Assert.Equal("réponse", await q.CompleteAsync("sys", "user"));
        Assert.Equal(1, inner.Calls);
    }
}
