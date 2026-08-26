namespace Nexus.Api.Tenancy;

/// <summary>Fournit le tenant de la requête courante.</summary>
public interface ITenantProvider
{
    /// <summary>Identifiant du tenant, ou null si absent/invalide.</summary>
    Guid? TenantId { get; }
}

/// <summary>
/// Résolution du tenant par l'en-tête <c>X-Tenant-Id</c>.
///
/// ⚠️ STUB DE DÉVELOPPEMENT (article 41 / ADR-0005) : en production, le tenant
/// DOIT provenir du jeton (claim), jamais d'un en-tête fourni par le client.
/// Remplacé lors du durcissement sécurité (Phase 6).
/// </summary>
public sealed class HeaderTenantProvider(IHttpContextAccessor accessor) : ITenantProvider
{
    public const string HeaderName = "X-Tenant-Id";

    public Guid? TenantId
    {
        get
        {
            var value = accessor.HttpContext?.Request.Headers[HeaderName].ToString();
            return Guid.TryParse(value, out var id) ? id : null;
        }
    }
}
