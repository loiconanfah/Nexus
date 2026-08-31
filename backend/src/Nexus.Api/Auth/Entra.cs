using System.Security.Claims;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace Nexus.Api.Auth;

/// <summary>
/// Configuration du SSO Entra ID (OpenID Connect). DORMANT par défaut : ne
/// s'active que si TenantId + ClientId sont fournis (par variables d'env). Ces
/// valeurs sont publiques (pas des secrets) — exposées au frontend pour MSAL.
/// </summary>
public sealed class EntraConfig
{
    public const string SectionName = "Nexus:Auth:Entra";

    /// <summary>GUID du répertoire Entra (ou "organizations"/"common").</summary>
    public string TenantId { get; set; } = "";
    /// <summary>Client ID de l'app enregistrée (= audience du jeton).</summary>
    public string ClientId { get; set; } = "";
    /// <summary>Tenant NEXUS cible ; si vide, on utilise le tid Microsoft.</summary>
    public string DefaultTenantId { get; set; } = "";
    /// <summary>E-mails (séparés par virgules) promus rôle "admin".</summary>
    public string AdminEmails { get; set; } = "";

    public bool Enabled => !string.IsNullOrWhiteSpace(TenantId) && !string.IsNullOrWhiteSpace(ClientId);
    public string Authority => $"https://login.microsoftonline.com/{TenantId}";
    public string MetadataAddress => $"https://login.microsoftonline.com/{TenantId}/v2.0/.well-known/openid-configuration";
}

/// <summary>
/// Valide un jeton d'identité émis par Entra ID contre les clés de signature
/// publiques de Microsoft (JWKS récupéré et mis en cache automatiquement).
/// </summary>
public sealed class EntraTokenValidator
{
    private readonly EntraConfig _cfg;
    private readonly ConfigurationManager<OpenIdConnectConfiguration>? _configManager;

    public EntraTokenValidator(IOptions<EntraConfig> options)
    {
        _cfg = options.Value;
        if (_cfg.Enabled)
        {
            _configManager = new ConfigurationManager<OpenIdConnectConfiguration>(
                _cfg.MetadataAddress,
                new OpenIdConnectConfigurationRetriever(),
                new HttpDocumentRetriever { RequireHttps = true });
        }
    }

    /// <summary>Retourne le principal si le jeton Microsoft est valide, sinon null.</summary>
    public async Task<ClaimsPrincipal?> ValidateAsync(string token, CancellationToken ct)
    {
        if (!_cfg.Enabled || _configManager is null) return null;

        var config = await _configManager.GetConfigurationAsync(ct);
        var parameters = new TokenValidationParameters
        {
            // L'émetteur exact provient des métadonnées (concret pour un tenant unique).
            ValidateIssuer = !config.Issuer.Contains("{tenantid}", StringComparison.OrdinalIgnoreCase),
            ValidIssuer = config.Issuer,
            ValidateAudience = true,
            ValidAudiences = new[] { _cfg.ClientId, $"api://{_cfg.ClientId}" },
            ValidateIssuerSigningKey = true,
            IssuerSigningKeys = config.SigningKeys,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(2),
        };

        var handler = new JsonWebTokenHandler { MapInboundClaims = false };
        var result = await handler.ValidateTokenAsync(token, parameters);
        if (!result.IsValid || result.ClaimsIdentity is null) return null;
        return new ClaimsPrincipal(result.ClaimsIdentity);
    }
}
