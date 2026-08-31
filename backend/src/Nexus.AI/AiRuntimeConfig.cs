namespace Nexus.AI;

/// <summary>
/// Configuration IA MUTABLE à l'exécution (fournisseur + clé), pilotée depuis la
/// page Admin. La clé vit UNIQUEMENT en mémoire côté serveur : elle n'est jamais
/// renvoyée au navigateur ni journalisée. Amorcée depuis les variables
/// d'environnement au démarrage (ANTHROPIC_API_KEY, ou section Nexus:AI pour
/// Azure OpenAI). Pour la production : gestionnaire de secrets / variable d'env.
/// </summary>
public sealed class AiRuntimeConfig
{
    private readonly object _lock = new();
    private string _provider = "";     // "anthropic" | "azure-openai" | "openai"
    private string? _apiKey;
    private string? _endpoint;          // requis pour azure-openai
    private string _model = "";

    public bool IsConfigured
    {
        get
        {
            lock (_lock)
            {
                if (string.IsNullOrWhiteSpace(_apiKey)) return false;
                if (_provider == "azure-openai") return !string.IsNullOrWhiteSpace(_endpoint);
                return _provider is "anthropic" or "openai" or "gemini";
            }
        }
    }

    public (string Provider, string? ApiKey, string? Endpoint, string Model) Snapshot()
    {
        lock (_lock) { return (_provider, _apiKey, _endpoint, _model); }
    }

    /// <summary>Statut sans secret : la clé n'est jamais exposée.</summary>
    public (string Provider, bool Configured, string Model, string? EndpointHost) Status()
    {
        lock (_lock)
        {
            string? host = null;
            if (!string.IsNullOrWhiteSpace(_endpoint) && Uri.TryCreate(_endpoint, UriKind.Absolute, out var u)) host = u.Host;
            return (_provider, IsConfigured, _model, host);
        }
    }

    public void Set(string provider, string apiKey, string? endpoint, string? model)
    {
        lock (_lock)
        {
            _provider = provider.Trim();
            _apiKey = string.IsNullOrWhiteSpace(apiKey) ? null : apiKey.Trim();
            _endpoint = string.IsNullOrWhiteSpace(endpoint) ? null : endpoint.Trim();
            _model = string.IsNullOrWhiteSpace(model) ? DefaultModel(_provider) : model.Trim();
        }
        Persist();
    }

    /// <summary>Met à jour uniquement le modèle (sans re-saisir la clé).</summary>
    public bool SetModel(string model)
    {
        bool ok;
        lock (_lock)
        {
            ok = !(string.IsNullOrWhiteSpace(_apiKey) || string.IsNullOrWhiteSpace(model));
            if (ok) _model = model.Trim();
        }
        if (ok) Persist();
        return ok;
    }

    public void Clear()
    {
        lock (_lock) { _provider = ""; _apiKey = null; _endpoint = null; _model = ""; }
        try { if (System.IO.File.Exists(FilePath)) System.IO.File.Delete(FilePath); } catch { /* best-effort */ }
    }

    // Persistance locale (DEV) : la clé survit aux redémarrages. Emplacement STABLE
    // (indépendant du dossier de lancement) : %LOCALAPPDATA%\Nexus (ou ~/.local/share).
    // Fichier local, jamais commité. En production : variable d'env / gestionnaire de secrets.
    private static readonly string FilePath = System.IO.Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "Nexus", "ai-runtime.local.json");
    private sealed record Persisted(string Provider, string? ApiKey, string? Endpoint, string Model);

    private void Persist()
    {
        try
        {
            var (p, k, e, m) = Snapshot();
            if (string.IsNullOrWhiteSpace(k)) return;
            System.IO.Directory.CreateDirectory(System.IO.Path.GetDirectoryName(FilePath)!);
            System.IO.File.WriteAllText(FilePath, System.Text.Json.JsonSerializer.Serialize(new Persisted(p, k, e, m)));
        }
        catch { /* best-effort */ }
    }

    private bool LoadFromFile()
    {
        try
        {
            if (!System.IO.File.Exists(FilePath)) return false;
            var d = System.Text.Json.JsonSerializer.Deserialize<Persisted>(System.IO.File.ReadAllText(FilePath));
            if (d is null || string.IsNullOrWhiteSpace(d.ApiKey)) return false;
            Set(d.Provider, d.ApiKey, d.Endpoint, d.Model);
            return true;
        }
        catch { return false; }
    }

    public static string DefaultModel(string provider) => provider switch
    {
        "anthropic" => "claude-3-5-sonnet-latest",
        "openai" => "gpt-4o",
        "azure-openai" => "gpt-4o",
        "gemini" => "gemini-1.5-flash",
        _ => "",
    };

    /// <summary>Amorçage depuis l'environnement au démarrage (aucun secret en dur).</summary>
    public void SeedFromEnvironment(AiOptions azure)
    {
        var anthropic = Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY");
        if (!string.IsNullOrWhiteSpace(anthropic))
        {
            Set("anthropic", anthropic, null, Environment.GetEnvironmentVariable("ANTHROPIC_MODEL"));
            return;
        }
        var openai = Environment.GetEnvironmentVariable("OPENAI_API_KEY");
        if (!string.IsNullOrWhiteSpace(openai))
        {
            Set("openai", openai, null, Environment.GetEnvironmentVariable("OPENAI_MODEL"));
            return;
        }
        var gemini = Environment.GetEnvironmentVariable("GEMINI_API_KEY") ?? Environment.GetEnvironmentVariable("GOOGLE_API_KEY");
        if (!string.IsNullOrWhiteSpace(gemini))
        {
            Set("gemini", gemini, null, Environment.GetEnvironmentVariable("GEMINI_MODEL"));
            return;
        }
        // Clé saisie via l'UI et persistée localement (dev).
        if (LoadFromFile()) return;
        if (azure.IsConfigured)
        {
            Set("azure-openai", azure.ApiKey!, azure.Endpoint, azure.ChatDeployment);
        }
    }
}
