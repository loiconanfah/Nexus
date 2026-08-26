using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Nexus.AI;

/// <summary>Enregistrement du moteur IA (orchestrateur + modèle de chat).</summary>
public static class DependencyInjection
{
    public static IServiceCollection AddNexusAI(this IServiceCollection services, Action<AiOptions> configure)
    {
        services.Configure(configure);

        // Azure OpenAI si configuré, sinon implémentation inactive : l'AI Analyst
        // reste pleinement fonctionnel avec ses réponses déterministes.
        services.AddSingleton<IChatCompletion>(sp =>
        {
            var options = sp.GetRequiredService<IOptions<AiOptions>>();
            return options.Value.IsConfigured
                ? new AzureOpenAIChatCompletion(options)
                : new NullChatCompletion();
        });

        services.AddScoped<AiOrchestrator>();
        return services;
    }
}
