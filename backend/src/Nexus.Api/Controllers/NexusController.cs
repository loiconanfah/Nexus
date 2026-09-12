using Microsoft.AspNetCore.Mvc;
using Nexus.Api.Tenancy;
using Nexus.Core.Results;

namespace Nexus.Api.Controllers;

/// <summary>
/// Base des contrôleurs NEXUS : garde de tenant obligatoire (isolation
/// multi-tenant, ADR-0005) et projection des <see cref="Error"/> métier vers les
/// codes HTTP, sans coupler le domaine à ASP.NET Core.
/// </summary>
[ApiController]
public abstract class NexusController(ITenantProvider tenantProvider) : ControllerBase
{
    /// <summary>Récupère le tenant courant, ou produit une réponse 400 si absent.</summary>
    protected bool TryGetTenant(out Guid tenantId, out IActionResult error)
    {
        var current = tenantProvider.TenantId;
        if (current is { } id)
        {
            tenantId = id;
            error = null!;
            return true;
        }

        tenantId = Guid.Empty;
        error = Problem(
            title: "Tenant requis",
            detail: $"En-tête '{HeaderTenantProvider.HeaderName}' manquant ou invalide.",
            statusCode: StatusCodes.Status400BadRequest);
        return false;
    }

    /// <summary>Courriel de l'utilisateur courant (claim du jeton).</summary>
    protected string? CurrentEmail => User?.FindFirst("email")?.Value;

    /// <summary>Rôle de l'utilisateur courant : « admin » ou « member ».</summary>
    protected string CurrentRole => User?.FindFirst("role")?.Value ?? "member";

    protected bool IsAdmin => string.Equals(CurrentRole, "admin", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Garde des opérations d'administration (gestion des comptes, sondes,
    /// configuration IA, réglages d'impact). Les membres consultent, les
    /// administrateurs configurent.
    /// </summary>
    protected bool RequireAdmin(out IActionResult error)
    {
        if (IsAdmin) { error = null!; return true; }
        error = Problem(
            title: "admin_required",
            detail: "Cette opération est réservée aux administrateurs de l'espace de travail.",
            statusCode: StatusCodes.Status403Forbidden);
        return false;
    }

    protected IActionResult ToProblem(Error error) => Problem(
        title: error.Code,
        detail: error.Message,
        statusCode: error.Type switch
        {
            ErrorType.Validation => StatusCodes.Status400BadRequest,
            ErrorType.NotFound => StatusCodes.Status404NotFound,
            ErrorType.Conflict => StatusCodes.Status409Conflict,
            ErrorType.Unauthorized => StatusCodes.Status401Unauthorized,
            ErrorType.Forbidden => StatusCodes.Status403Forbidden,
            _ => StatusCodes.Status500InternalServerError
        });
}
