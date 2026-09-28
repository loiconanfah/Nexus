using Nexus.Ingestion.Vendors;

namespace Nexus.Api.Integrations;

/// <summary>
/// Le rafraîchissement automatique des branchements.
///
/// C'est la pièce qui distingue une carte VIVANTE d'un dessin daté. Le moteur de
/// confiance décote une dépendance avec le temps : sans relecture régulière, une
/// cartographie finit par dire d'elle-même qu'elle n'est plus fiable, et elle a
/// raison. Personne ne va relancer un import à la main chaque semaine.
///
/// L'échéance vit en base, jamais en mémoire : un redémarrage du cloud ne perd
/// aucun rafraîchissement, il le retarde au plus d'un tour de boucle. Un
/// branchement en échec reste planifié, parce qu'une panne chez l'éditeur est
/// presque toujours temporaire, et son dernier résultat est conservé pour que
/// l'écran le signale.
/// </summary>
public sealed class IntegrationScheduler(
    IServiceScopeFactory scopes,
    ILogger<IntegrationScheduler> log) : BackgroundService
{
    private static readonly TimeSpan Tick = TimeSpan.FromMinutes(5);
    private const int PerTick = 5;

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        // Un délai au démarrage : le cloud a mieux à faire que de lancer des
        // imports pendant qu'il répond à ses premières requêtes.
        try { await Task.Delay(TimeSpan.FromMinutes(1), ct); }
        catch (OperationCanceledException) { return; }

        while (!ct.IsCancellationRequested)
        {
            try { await RunDueAsync(ct); }
            catch (OperationCanceledException) { return; }
            catch (Exception ex) { log.LogError(ex, "Planificateur de branchements : tour interrompu."); }

            try { await Task.Delay(Tick, ct); }
            catch (OperationCanceledException) { return; }
        }
    }

    private async Task RunDueAsync(CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var store = scope.ServiceProvider.GetRequiredService<IntegrationStore>();
        var due = await store.DueAsync(PerTick, ct);
        if (due.Count == 0) return;

        foreach (var (id, tenant, vendorId, interval) in due)
        {
            ct.ThrowIfCancellationRequested();

            // Un scope par import : le pipeline et les dépôts sont à durée de vie
            // de requête, et un import ne doit pas hériter de l'état du précédent.
            await using var runScope = scopes.CreateAsyncScope();
            var runStore = runScope.ServiceProvider.GetRequiredService<IntegrationStore>();
            var runner = runScope.ServiceProvider.GetRequiredService<IntegrationRunner>();

            var recipe = VendorCatalog.Find(vendorId);
            if (recipe is null)
            {
                await runStore.RecordRunAsync(id, false, $"Connecteur « {vendorId} » inconnu.", 0, ct);
                continue;
            }

            var settings = await runStore.ResolveSettingsAsync(tenant, id, ct);
            if (settings is null || VendorTemplate.Missing(recipe.Fields, settings).Count > 0)
            {
                // Déplanifié : réessayer sans identifiants lisibles ne ferait que
                // remplir les journaux d'échecs identiques.
                await runStore.RecordRunAsync(id, false, "Accès illisible : le branchement doit être reconfiguré.", 0, ct);
                continue;
            }

            try
            {
                var run = await runner.ExecuteAsync(tenant, recipe, settings, ct);
                await runStore.RecordRunAsync(id, run.IsSuccess,
                    run.IsSuccess ? run.Value.Summary : run.Error.Message, interval, ct);

                if (run.IsSuccess)
                    log.LogInformation("Branchement {Vendor} rafraîchi pour {Tenant} : {Summary}",
                        recipe.Name, tenant, run.Value.Summary);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                await runStore.RecordRunAsync(id, false, ex.Message, interval, ct);
                log.LogWarning(ex, "Branchement {Vendor} en échec pour {Tenant}.", recipe.Name, tenant);
            }
        }
    }
}
