using Nexus.Core.Results;
using Nexus.Ingestion;
using Nexus.Ingestion.Vendors;

namespace Nexus.Api.Integrations;

/// <summary>Bilan d'un rafraîchissement, tel qu'il est montré et consigné.</summary>
public sealed record IntegrationRun(
    ImportResult Result,
    IReadOnlyList<string> Warnings)
{
    /// <summary>Une phrase que l'utilisateur peut lire, et que le journal conserve.</summary>
    public string Summary =>
        $"{Result.EntitiesCreated} créés, {Result.EntitiesMatched} retrouvés, {Result.RelationsCreated} dépendances"
        + (Result.RelationsUnresolved > 0 ? $", {Result.RelationsUnresolved} non résolues" : "")
        + (Warnings.Count > 0 ? $", {Warnings.Count} avertissement(s)" : "");
}

/// <summary>
/// Exécute un branchement : interroge l'éditeur et écrit dans le graphe par le
/// pipeline habituel.
///
/// Partagé par l'écran et par le planificateur, pour une raison de fond : un
/// rafraîchissement automatique doit produire EXACTEMENT ce qu'un import manuel
/// produit, sinon la carte se mettrait à dépendre de qui l'a déclenchée.
/// </summary>
public sealed class IntegrationRunner(ImportPipeline pipeline, IHttpClientFactory httpFactory)
{
    public async Task<Result<IntegrationRun>> ExecuteAsync(
        Guid tenant,
        VendorRecipe recipe,
        IReadOnlyDictionary<string, string> settings,
        CancellationToken ct)
    {
        // Une source interne n'est pas joignable depuis le cloud, et le garde
        // anti-SSRF a raison de le refuser : elle passe par la sonde Collector.
        if (recipe.Internal)
            return Error.Validation("integration.internal_only",
                $"{recipe.Name} vit dans votre réseau : ce branchement passe par la sonde Collector, pas par le cloud.");

        var http = httpFactory.CreateClient("rest-connector");
        http.Timeout = TimeSpan.FromSeconds(60);

        var connector = new VendorApiConnector(http, recipe, settings);
        var result = await pipeline.ExecuteAsync(tenant, connector, recipe.Profile, ct: ct);

        return result.IsFailure
            ? result.Error
            : new IntegrationRun(result.Value, connector.Warnings);
    }
}
