using Microsoft.Extensions.Options;
using Nexus.AI;
using Nexus.Api.Auth;
using Nexus.Api.Tenancy;

namespace Nexus.Api.AI;

/// <summary>
/// Resout le tenant courant depuis le claim JWT "tenant" (repli en-tete
/// X-Tenant-Id en demo si AllowHeaderTenant). Singleton-safe : ne depend que de
/// IHttpContextAccessor. Permet a AiRuntimeConfig (singleton) de connaitre le
/// tenant de la requete sans capturer de service scoped.
/// </summary>
public sealed class HttpCurrentTenant(IHttpContextAccessor accessor, IOptions<AuthConfig> options) : ICurrentTenant
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
