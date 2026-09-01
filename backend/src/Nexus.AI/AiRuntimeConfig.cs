using System.Collections.Concurrent;

namespace Nexus.AI;

/// <summary>
/// Configuration IA mutable a l'execution, PAR TENANT. Chaque espace de travail
/// (tenant) a sa propre cle : chaque utilisateur saisit la sienne dans Admin, et
/// elle est persistee en Postgres (survit aux redemarrages). La cle n'est jamais
/// renvoyee au navigateur ni journalisee. Un repli GLOBAL (Guid.Empty) amorce
/// depuis les variables d'environnement s'applique aux tenants sans cle propre.
/// </summary>
public sealed class AiRuntimeConfig
{
    private sealed class Entry
    {
        public string Provider = "";
        public string? ApiKey;
        public string? Endpoint;
        public string Model = "";
    }

    private static readonly Guid Global = Guid.Empty;
    private readonly ConcurrentDictionary<Guid, Entry> _cache = new();
    private readonly ICurrentTenant? _tenant;
    private readonly IAiConfigStore? _store;

    public AiRuntimeConfig(ICurrentTenant? tenant = null, IAiConfigStore? store = null)
    {
        _tenant = tenant;
        _store = store;
    }

    private Guid TenantKey() => _tenant?.TenantId ?? Global;

    private static bool Configured(Entry e)
    {
        if (string.IsNullOrWhiteSpace(e.ApiKey)) return false;
        if (e.Provider == "azure-openai") return !string.IsNullOrWhiteSpace(e.Endpoint);
        return e.Provider is "anthropic" or "openai" or "gemini";
    }

    // Resout l'entree du tenant courant : cache -> Postgres -> repli global (env).
    private Entry Resolve()
    {
        var key = TenantKey();
        if (_cache.TryGetValue(key, out var cached) && Configured(cached)) return cached;

        if (key != Global && _store is not null && !_cache.ContainsKey(key))
        {
            AiStored? loaded = null;
            try { loaded = _store.Load(key); } catch { /* best-effort */ }
            var e = loaded is null
                ? new Entry()
                : new Entry { Provider = loaded.Provider, ApiKey = loaded.ApiKey, Endpoint = loaded.Endpoint, Model = loaded.Model };
            _cache[key] = e;
            if (Configured(e)) return e;
        }

        // Repli sur la cle globale de l'operateur (variable d'environnement).
        if (_cache.TryGetValue(Global, out var g) && Configured(g)) return g;
        return _cache.TryGetValue(key, out var self) ? self : new Entry();
    }

    public bool IsConfigured => Configured(Resolve());

    public (string Provider, string? ApiKey, string? Endpoint, string Model) Snapshot()
    {
        var e = Resolve();
        return (e.Provider, e.ApiKey, e.Endpoint, e.Model);
    }

    /// <summary>Statut sans secret : la cle n'est jamais exposee.</summary>
    public (string Provider, bool Configured, string Model, string? EndpointHost) Status()
    {
        var e = Resolve();
        string? host = null;
        if (!string.IsNullOrWhiteSpace(e.Endpoint) && Uri.TryCreate(e.Endpoint, UriKind.Absolute, out var u)) host = u.Host;
        return (e.Provider, Configured(e), e.Model, host);
    }

    public void Set(string provider, string apiKey, string? endpoint, string? model)
    {
        var p = provider.Trim();
        var e = new Entry
        {
            Provider = p,
            ApiKey = string.IsNullOrWhiteSpace(apiKey) ? null : apiKey.Trim(),
            Endpoint = string.IsNullOrWhiteSpace(endpoint) ? null : endpoint.Trim(),
            Model = string.IsNullOrWhiteSpace(model) ? DefaultModel(p) : model!.Trim(),
        };
        var key = TenantKey();
        _cache[key] = e;
        if (key != Global) Save(key, e);
    }

    /// <summary>Met a jour uniquement le modele (sans re-saisir la cle).</summary>
    public bool SetModel(string model)
    {
        var e = Resolve();
        if (string.IsNullOrWhiteSpace(e.ApiKey) || string.IsNullOrWhiteSpace(model)) return false;
        var key = TenantKey();
        var ne = new Entry { Provider = e.Provider, ApiKey = e.ApiKey, Endpoint = e.Endpoint, Model = model.Trim() };
        _cache[key] = ne;
        if (key != Global) Save(key, ne);
        return true;
    }

    public void Clear()
    {
        var key = TenantKey();
        _cache[key] = new Entry();
        if (key != Global) { try { _store?.Delete(key); } catch { /* best-effort */ } }
    }

    private void Save(Guid key, Entry e)
    {
        try { _store?.Save(key, new AiStored(e.Provider, e.ApiKey, e.Endpoint, e.Model)); }
        catch { /* best-effort : la config reste au moins en memoire pour la session */ }
    }

    public static string DefaultModel(string provider) => provider switch
    {
        "anthropic" => "claude-3-5-sonnet-latest",
        "openai" => "gpt-4o",
        "azure-openai" => "gpt-4o",
        "gemini" => "gemini-1.5-flash",
        _ => "",
    };

    /// <summary>
    /// Amorcage GLOBAL depuis l'environnement au demarrage (cle de l'operateur,
    /// repli pour les tenants sans cle propre). Aucun secret en dur.
    /// </summary>
    public void SeedFromEnvironment(AiOptions azure)
    {
        var e = SeedEntry(azure);
        if (e is not null) _cache[Global] = e;
    }

    private static Entry? SeedEntry(AiOptions azure)
    {
        var anthropic = Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY");
        if (!string.IsNullOrWhiteSpace(anthropic))
            return Mk("anthropic", anthropic, null, Environment.GetEnvironmentVariable("ANTHROPIC_MODEL"));

        var openai = Environment.GetEnvironmentVariable("OPENAI_API_KEY");
        if (!string.IsNullOrWhiteSpace(openai))
            return Mk("openai", openai, null, Environment.GetEnvironmentVariable("OPENAI_MODEL"));

        var gemini = Environment.GetEnvironmentVariable("GEMINI_API_KEY") ?? Environment.GetEnvironmentVariable("GOOGLE_API_KEY");
        if (!string.IsNullOrWhiteSpace(gemini))
            return Mk("gemini", gemini, null, Environment.GetEnvironmentVariable("GEMINI_MODEL"));

        if (azure.IsConfigured)
            return Mk("azure-openai", azure.ApiKey!, azure.Endpoint, azure.ChatDeployment);

        return null;
    }

    private static Entry Mk(string provider, string key, string? endpoint, string? model) => new()
    {
        Provider = provider,
        ApiKey = key.Trim(),
        Endpoint = string.IsNullOrWhiteSpace(endpoint) ? null : endpoint!.Trim(),
        Model = string.IsNullOrWhiteSpace(model) ? DefaultModel(provider) : model!.Trim(),
    };
}
