using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Nexus.AI;

/// <summary>Enregistrement du moteur IA (orchestrateur + modèle de chat).</summary>
public static class DependencyInjection
{
    public static IServiceCollection AddNexusAI(this IServiceCollection services, Action<AiOptions> configure)
    {
        services.Configure(configure);
        services.AddHttpClient("anthropic");

        // Config IA mutable à l'exécution (pilotée depuis Admin), amorcée depuis
        // l'environnement / la section Nexus:AI au démarrage.
        services.AddSingleton(sp =>
        {
            // ICurrentTenant / IAiConfigStore sont fournis par la couche API (Postgres).
            // Optionnels : sans eux, la config reste globale en memoire (tests, outils).
            var cfg = new AiRuntimeConfig(sp.GetService<ICurrentTenant>(), sp.GetService<IAiConfigStore>());
            cfg.SeedFromEnvironment(sp.GetRequiredService<IOptions<AiOptions>>().Value);
            return cfg;
        });

        // Complétion dont le fournisseur est choisi à l'exécution. Sans clé,
        // l'AI Analyst reste pleinement fonctionnel avec ses réponses déterministes.
        services.AddSingleton<DynamicChatCompletion>();
        services.AddSingleton<IChatCompletion>(sp => sp.GetRequiredService<DynamicChatCompletion>());

        services.AddScoped<AiOrchestrator>();
        return services;
    }
}
