using Microsoft.Extensions.DependencyInjection;
using Nexus.Ingestion.Normalization;

namespace Nexus.Ingestion;

/// <summary>Enregistrement des services du module Ingestion.</summary>
public static class DependencyInjection
{
    public static IServiceCollection AddNexusIngestion(this IServiceCollection services)
    {
        services.AddSingleton<NormalizationEngine>();
        services.AddScoped<ImportPipeline>();
        return services;
    }
}
