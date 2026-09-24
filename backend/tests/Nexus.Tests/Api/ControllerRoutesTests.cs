using System.Reflection;
using Microsoft.AspNetCore.Mvc;

namespace Nexus.Tests.Api;

/// <summary>
/// La surface d'URL de l'API, verrouillée.
///
/// Une route est un contrat avec le navigateur : la renommer casse l'écran sans
/// que rien ne le signale, ni à la compilation ni aux tests. C'est arrivé en
/// réécrivant un contrôleur, où « human-dependencies » est devenu
/// « human-dependency » : le code compilait, les 184 tests passaient, et l'écran
/// répondait 404.
///
/// Ce test échoue dès qu'une route change. Un changement VOULU se déclare en
/// mettant cette liste à jour, et l'on va alors corriger l'appel côté écran ;
/// un changement accidentel s'arrête ici.
/// </summary>
public class ControllerRoutesTests
{
    private static readonly string[] Expected =
    [
        "api/v1/actions",
        "api/v1/ai",
        "api/v1/ai/config",
        "api/v1/attacks",
        "api/v1/audit",
        "api/v1/auth",
        "api/v1/collectors",
        "api/v1/decisions",
        "api/v1/documents",
        "api/v1/enterprise",
        "api/v1/entities",
        "api/v1/graph",
        "api/v1/history",
        "api/v1/human-dependencies",
        "api/v1/impact",
        "api/v1/imports",
        "api/v1/imports/analyze",
        "api/v1/incident",
        "api/v1/incidents",
        "api/v1/inference",
        "api/v1/onboarding",
        "api/v1/organization",
        "api/v1/overview",
        "api/v1/reports",
        "api/v1/resilience",
        "api/v1/risks",
        "api/v1/simulations",
        "api/v1/suppliers",
        "api/v1/users",
        "api/v1/workspace",
        "health",
    ];

    private static IEnumerable<Type> Controllers()
        => typeof(Nexus.Api.Controllers.NexusController).Assembly
            .GetTypes()
            .Where(t => !t.IsAbstract && typeof(ControllerBase).IsAssignableFrom(t));

    [Fact]
    public void Aucune_route_n_a_change_sans_etre_declaree()
    {
        var actual = Controllers()
            .Select(t => t.GetCustomAttribute<RouteAttribute>()?.Template)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x!)
            .Distinct()
            .OrderBy(x => x, StringComparer.Ordinal)
            .ToArray();

        Assert.Equal(Expected.OrderBy(x => x, StringComparer.Ordinal).ToArray(), actual);
    }

    [Fact]
    public void Chaque_controleur_porte_une_route()
    {
        // Un contrôleur sans route se sert sous un chemin dérivé de son NOM :
        // le renommer déplacerait alors l'API à son insu.
        var sans = Controllers()
            .Where(t => t.GetCustomAttribute<RouteAttribute>() is null)
            .Where(t => t.GetCustomAttributes<Microsoft.AspNetCore.Mvc.Routing.HttpMethodAttribute>(true)
                .Concat(t.GetMethods().SelectMany(m => m.GetCustomAttributes<Microsoft.AspNetCore.Mvc.Routing.HttpMethodAttribute>(true)))
                .Any(a => a.Template is null || !a.Template.StartsWith('/')))
            .Select(t => t.Name)
            .ToList();

        Assert.True(sans.Count == 0, $"contrôleur(s) sans route explicite : {string.Join(", ", sans)}");
    }
}
