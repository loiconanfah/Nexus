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
