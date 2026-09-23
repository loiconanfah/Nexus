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
        return e.Provider is "anthropic" or "openai" or "gemini" or "openrouter";
    }

    // Entree PROPRE au tenant courant (sans repli) : cache -> Postgres.
    private Entry Own()
    {
        var key = TenantKey();
        if (_cache.TryGetValue(key, out var cached)) return cached;
        if (key == Global || _store is null) return new Entry();

        AiStored? loaded = null;
        try { loaded = _store.Load(key); } catch { /* best-effort */ }
        var e = loaded is null
            ? new Entry()
            : new Entry { Provider = loaded.Provider, ApiKey = loaded.ApiKey, Endpoint = loaded.Endpoint, Model = loaded.Model };
        _cache[key] = e;
        return e;
    }

    // Resout l'entree du tenant courant : sa propre cle, sinon la cle globale de
    // l'operateur (variable d'environnement). Tout espace sans cle, y compris un
    // compte tout juste cree, beneficie ainsi de l'IA.
    private Entry Resolve()
    {
        var own = Own();
        if (Configured(own)) return own;
        if (_cache.TryGetValue(Global, out var g) && Configured(g)) return g;
        return own;
    }

    /// <summary>
    /// Origine de la cle utilisee : « own » (cle propre a l'espace), « shared »
    /// (cle globale de l'operateur, en repli) ou « none ».
    /// </summary>
    public string Source()
    {
        if (TenantKey() != Global && Configured(Own())) return "own";
        if (_cache.TryGetValue(Global, out var g) && Configured(g)) return TenantKey() == Global ? "own" : "shared";
        return "none";
    }

    public bool IsConfigured => Configured(Resolve());

    public (string Provider, string? ApiKey, string? Endpoint, string Model) Snapshot()
    {
        var e = Resolve();
        return (e.Provider, e.ApiKey, e.Endpoint, Model(e));
    }

    /// <summary>
    /// Le modele d'une entree, jamais vide. Une ligne enregistree SANS modele
    /// existait (cle posee alors que le champ etait vide, ou ecriture anterieure
    /// a ce garde-fou) : l'appel partait alors sur une URL sans modele et
    /// echouait a chaque fois, en affichant « modele  » dans le diagnostic.
    /// </summary>
    private static string Model(Entry e)
        => string.IsNullOrWhiteSpace(e.Model) ? DefaultModel(e.Provider) : e.Model;

    /// <summary>Statut sans secret : la cle n'est jamais exposee.</summary>
    public (string Provider, bool Configured, string Model, string? EndpointHost) Status()
    {
        var e = Resolve();
        string? host = null;
        if (!string.IsNullOrWhiteSpace(e.Endpoint) && Uri.TryCreate(e.Endpoint, UriKind.Absolute, out var u)) host = u.Host;
        return (e.Provider, Configured(e), Model(e), host);
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

    /// <summary>
    /// Met a jour uniquement le modele (sans re-saisir la cle). Refuse pour un
    /// espace qui utilise la cle partagee : l'enregistrer reviendrait a COPIER la
    /// cle de l'operateur dans la ligne du tenant (fuite, et plus de rotation
    /// possible depuis l'environnement).
    /// </summary>
    public bool SetModel(string model)
    {
        var key = TenantKey();
        var e = key == Global ? Resolve() : Own();
        if (!Configured(e) || string.IsNullOrWhiteSpace(model)) return false;
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
        // Une CHAÎNE, pas un modèle : si le premier flanche, OpenRouter passe au
        // suivant de lui-même. Des modèles rapides et bon marché, l'extraction
        // documentaire recopiant des faits plutôt qu'elle ne raisonne.
        "openrouter" => string.Join(", ", OpenRouterChatCompletion.Fallbacks),
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
        // OpenRouter d'abord : une seule clé d'opérateur, tous les fournisseurs
        // derrière, et le repli automatique d'un modèle à l'autre.
        var openrouter = Environment.GetEnvironmentVariable("OPENROUTER_API_KEY");
        if (!string.IsNullOrWhiteSpace(openrouter))
            return Mk("openrouter", openrouter, null, Environment.GetEnvironmentVariable("OPENROUTER_MODEL"));

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
