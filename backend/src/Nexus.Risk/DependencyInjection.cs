using Microsoft.Extensions.DependencyInjection;
using Nexus.Risk.Propagation;
using Nexus.Risk.Scoring;
using Nexus.Risk.Spof;

namespace Nexus.Risk;

/// <summary>Enregistrement des moteurs déterministes (risque, criticité, propagation, SPOF).</summary>
public static class DependencyInjection
{
    public static IServiceCollection AddNexusRisk(this IServiceCollection services)
    {
        services.AddSingleton<RiskEngine>();
        services.AddSingleton<CriticalityEngine>();
        services.AddScoped<PropagationEngine>();
        services.AddScoped<SpofAnalyzer>();
        services.AddScoped<RiskAnalyzer>();
        services.AddScoped<Reporting.ReportService>();
        return services;
    }
}
