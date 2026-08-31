using Microsoft.Extensions.Options;
using Nexus.Api.Auth;

namespace Nexus.Api.Tenancy;

/// <summary>
/// Résolution du tenant depuis le CLAIM du jeton JWT (article 41 : le tenant ne
/// provient jamais d'un en-tête client en production). Un repli par en-tête
/// <c>X-Tenant-Id</c> n'est utilisé que si <c>Nexus:Auth:AllowHeaderTenant</c>
/// est activé (démo/dev local).
/// </summary>
public sealed class ClaimTenantProvider(IHttpContextAccessor accessor, IOptions<AuthConfig> options) : ITenantProvider
{
    public Guid? TenantId
    {
        get
        {
            var claim = accessor.HttpContext?.User?.FindFirst("tenant")?.Value;
            if (Guid.TryParse(claim, out var id)) return id;

            if (options.Value.AllowHeaderTenant)
            {
                var header = accessor.HttpContext?.Request.Headers[HeaderTenantProvider.HeaderName].ToString();
                if (Guid.TryParse(header, out var hid)) return hid;
            }
            return null;
        }
    }
}
