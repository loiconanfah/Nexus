using Nexus.AI;
using Xunit;

namespace Nexus.Tests.AI;

/// <summary>
/// Clé IA partagée : tout espace sans clé propre (dont un compte tout juste créé)
/// doit utiliser la clé de l'opérateur, sans jamais la recopier chez lui.
/// </summary>
public class AiRuntimeConfigTests
{
    private sealed class Tenant : ICurrentTenant { public Guid? TenantId { get; set; } }

    private sealed class Store : IAiConfigStore
    {
        public readonly Dictionary<Guid, AiStored> Rows = [];
        public AiStored? Load(Guid tenant) => Rows.TryGetValue(tenant, out var r) ? r : null;
        public void Save(Guid tenant, AiStored config) => Rows[tenant] = config;
        public void Delete(Guid tenant) => Rows.Remove(tenant);
    }

    /// <summary>Configuration avec une clé globale (celle de l'opérateur), posée hors contexte tenant.</summary>
    private static (AiRuntimeConfig Cfg, Tenant Tenant, Store Store) WithSharedKey()
    {
        var tenant = new Tenant();
        var store = new Store();
        var cfg = new AiRuntimeConfig(tenant, store);
        cfg.Set("gemini", "SHARED-KEY", null, "gemini-flash");   // TenantId null : clé globale
        return (cfg, tenant, store);
    }

    [Fact]
    public void New_workspace_without_own_key_uses_the_shared_key()
    {
        var (cfg, tenant, _) = WithSharedKey();
        tenant.TenantId = Guid.NewGuid();

        Assert.True(cfg.IsConfigured);
        Assert.Equal("SHARED-KEY", cfg.Snapshot().ApiKey);
        Assert.Equal("gemini", cfg.Snapshot().Provider);
        Assert.Equal("shared", cfg.Source());
    }

    [Fact]
    public void Own_key_takes_precedence_over_the_shared_key()
    {
        var (cfg, tenant, store) = WithSharedKey();
        var id = Guid.NewGuid();
        store.Rows[id] = new AiStored("anthropic", "OWN-KEY", null, "claude");
        tenant.TenantId = id;

        Assert.Equal("OWN-KEY", cfg.Snapshot().ApiKey);
        Assert.Equal("own", cfg.Source());
    }

    [Fact]
    public void Changing_the_model_never_copies_the_shared_key_into_the_workspace()
    {
        var (cfg, tenant, store) = WithSharedKey();
        var id = Guid.NewGuid();
        tenant.TenantId = id;

        Assert.False(cfg.SetModel("another-model"));
        Assert.False(store.Rows.ContainsKey(id));
        Assert.Equal("gemini-flash", cfg.Snapshot().Model);
    }

    [Fact]
    public void Clearing_an_own_key_falls_back_to_the_shared_key()
    {
        var (cfg, tenant, store) = WithSharedKey();
        var id = Guid.NewGuid();
        store.Rows[id] = new AiStored("openai", "OWN-KEY", null, "gpt");
        tenant.TenantId = id;

        cfg.Clear();

        Assert.Equal("SHARED-KEY", cfg.Snapshot().ApiKey);
        Assert.Equal("shared", cfg.Source());
    }

    [Fact]
    public void Without_any_key_the_workspace_is_not_configured()
    {
        var tenant = new Tenant { TenantId = Guid.NewGuid() };
        var cfg = new AiRuntimeConfig(tenant, new Store());

        Assert.False(cfg.IsConfigured);
        Assert.Equal("none", cfg.Source());
    }
}
