using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Nexus.Api.Auth;

namespace Nexus.Api.Controllers;

/// <summary>Authentification : connexion (jeton JWT), SSO Entra ID, profil courant.</summary>
[ApiController]
[Route("api/v1/auth")]
public sealed class AuthController(
    PgUserStore users,
    TokenService tokens,
    IOptions<AuthConfig> authOptions,
    IOptions<EntraConfig> entraOptions,
    EntraTokenValidator entraValidator) : ControllerBase
{
    private readonly AuthConfig _auth = authOptions.Value;
    private readonly EntraConfig _entra = entraOptions.Value;

    public sealed record LoginRequest(string Email, string Password);
    public sealed record RegisterRequest(string Email, string Password);
    public sealed record EntraLoginRequest(string Token);

    /// <summary>Connexion par identifiants → jeton JWT (tenant dans le claim).</summary>
    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req, CancellationToken ct)
    {
        if (req is null || string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { error = "credentials_required" });

        var user = await users.FindAsync(req.Email, ct);
        if (user is null || !PasswordHasher.Verify(req.Password, user.PasswordHash))
            return Unauthorized(new { error = "invalid_credentials" });

        var (token, expires) = tokens.Issue(user);
        return Ok(new { token, expiresAt = expires, email = user.Email, role = user.Role, tenantId = user.TenantId });
    }

    /// <summary>
    /// Inscription libre : crée un compte + un espace de travail (tenant) vierge
    /// dont l'utilisateur est administrateur. Désactivable via AllowSelfRegistration.
    /// </summary>
    [AllowAnonymous]
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest req, CancellationToken ct)
    {
        if (!_auth.AllowSelfRegistration) return StatusCode(403, new { error = "registration_disabled" });
        if (req is null || string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { error = "credentials_required" });

        var email = req.Email.Trim();
        if (!email.Contains('@') || !email.Contains('.'))
            return BadRequest(new { error = "invalid_email" });
        if (req.Password.Length < 8)
            return BadRequest(new { error = "weak_password" });
        if (await users.ExistsAsync(email, ct))
            return Conflict(new { error = "email_taken" });

        // Chaque inscription crée un espace de travail (tenant) neuf et vide.
        var tenant = Guid.NewGuid();
        var user = new NexusUser(email, PasswordHasher.Hash(req.Password), tenant, "admin");
        if (!await users.AddAsync(user, ct))
            return Conflict(new { error = "email_taken" });

        var (token, expires) = tokens.Issue(user);
        return Ok(new { token, expiresAt = expires, email = user.Email, role = user.Role, tenantId = user.TenantId });
    }

    /// <summary>
    /// Configuration publique d'authentification pour le frontend (indique si le
    /// SSO Entra est actif et fournit les identifiants PUBLICS pour MSAL).
    /// </summary>
    [AllowAnonymous]
    [HttpGet("config")]
    public IActionResult Config() => Ok(new
    {
        registrationEnabled = _auth.AllowSelfRegistration,
        entraEnabled = _entra.Enabled,
        entraClientId = _entra.Enabled ? _entra.ClientId : null,
        entraTenantId = _entra.Enabled ? _entra.TenantId : null,
        entraAuthority = _entra.Enabled ? _entra.Authority : null,
    });

    /// <summary>
    /// Connexion via SSO Entra ID : reçoit le jeton d'identité Microsoft (obtenu
    /// côté navigateur par MSAL), le valide, provisionne l'utilisateur, et émet un
    /// jeton NEXUS. Le tenant NEXUS = DefaultTenantId configuré, sinon le tid Microsoft.
    /// </summary>
    [AllowAnonymous]
    [HttpPost("entra")]
    public async Task<IActionResult> Entra([FromBody] EntraLoginRequest req, CancellationToken ct)
    {
        if (!_entra.Enabled) return NotFound(new { error = "entra_disabled" });
        if (req is null || string.IsNullOrWhiteSpace(req.Token))
            return BadRequest(new { error = "token_required" });

        var principal = await entraValidator.ValidateAsync(req.Token, ct);
        if (principal is null) return Unauthorized(new { error = "invalid_entra_token" });

        var email = principal.FindFirst("preferred_username")?.Value
                    ?? principal.FindFirst("email")?.Value
                    ?? principal.FindFirst("upn")?.Value
                    ?? "";
        if (string.IsNullOrWhiteSpace(email)) return Unauthorized(new { error = "no_email_claim" });

        var msTid = principal.FindFirst("tid")?.Value ?? "";
        var tenant = Guid.TryParse(_entra.DefaultTenantId, out var mapped) ? mapped
                     : Guid.TryParse(msTid, out var fromTid) ? fromTid
                     : Guid.Empty;

        var admins = _entra.AdminEmails.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var role = admins.Contains(email, StringComparer.OrdinalIgnoreCase) ? "admin" : "user";

        var user = new NexusUser(email, "", tenant, role);
        var (token, expires) = tokens.Issue(user);
        return Ok(new { token, expiresAt = expires, email, role, tenantId = tenant });
    }

    /// <summary>Profil de l'utilisateur authentifié (depuis le jeton).</summary>
    [Authorize]
    [HttpGet("me")]
    public IActionResult Me() => Ok(new
    {
        email = User.FindFirst("email")?.Value,
        role = User.FindFirst("role")?.Value,
        tenantId = User.FindFirst("tenant")?.Value,
    });
}
