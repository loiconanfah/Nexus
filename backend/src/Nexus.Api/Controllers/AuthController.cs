using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using System.Text.RegularExpressions;
using Nexus.Api.Auth;
using Nexus.Api.Organization;

namespace Nexus.Api.Controllers;

/// <summary>Authentification : connexion (jeton JWT), SSO Entra ID, profil courant.</summary>
[ApiController]
[Route("api/v1/auth")]
public sealed class AuthController(
    PgUserStore users,
    TokenService tokens,
    EmailVerificationService verification,
    OrganizationStore organizations,
    ILogger<AuthController> log,
    IOptions<AuthConfig> authOptions,
    IOptions<EntraConfig> entraOptions,
    EntraTokenValidator entraValidator) : ControllerBase
{
    private readonly AuthConfig _auth = authOptions.Value;
    private readonly EntraConfig _entra = entraOptions.Value;

    public sealed record LoginRequest(string Email, string Password);
    public sealed record RegisterRequest(
        string Email, string Password, string? ConfirmPassword,
        string? FirstName, string? LastName, string? JobTitle, string? Phone,
        string? Organization, string? Sector, string? Country, string? SizeBand,
        bool AcceptTerms, bool MarketingOptIn, string? Lang);
    public sealed record VerifyRequest(string Email, string Code);
    public sealed record ResendRequest(string Email, string? Lang);

    // Mêmes listes que l'onboarding (OrganizationController) : le profil saisi
    // ici pré-remplit l'assistant de démarrage au lieu d'être redemandé.
    private static readonly string[] Sectors =
    [
        "microfinance", "banking", "insurance", "telecom", "health", "public", "energy",
        "manufacturing", "logistics", "retail", "it-services", "education", "other",
    ];
    private static readonly string[] SizeBands = ["1-49", "50-199", "200-999", "1000-1999", "2000+"];
    private static readonly Regex EmailPattern = new(@"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$", RegexOptions.Compiled);
    public const int MinPasswordLength = 10;
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

        // Contrôlé APRÈS le mot de passe : un tiers ne peut pas savoir si une
        // adresse est inscrite en attente de vérification.
        var state = await users.VerificationStateAsync(user.Email, ct);
        if (state is { Verified: false } && verification.Required)
        {
            var wait = await verification.CooldownAsync(user.Email, ct);
            if (wait == 0) await verification.SendCodeAsync(user.Email, state.Value.FirstName, state.Value.Lang, ct);
            return StatusCode(403, new { error = "email_not_verified", email = user.Email, resendAfter = wait == 0 ? 60 : wait });
        }

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
        if (req is null) return BadRequest(new { error = "credentials_required" });

        var error = Validate(req);
        if (error is not null) return BadRequest(new { error });

        var email = req.Email.Trim();
        var lang = req.Lang == "en" ? "en" : "fr";
        var existing = await users.VerificationStateAsync(email, ct);
        if (existing is { Verified: true }) return Conflict(new { error = "email_taken" });

        // Chaque inscription crée un espace de travail (tenant) neuf et vide.
        var tenant = Guid.NewGuid();
        var user = new NexusUser(email, PasswordHasher.Hash(req.Password), tenant, "admin");
        var profile = new SignupProfile(
            req.FirstName!.Trim(), req.LastName!.Trim(), Clean(req.JobTitle, 120), Clean(req.Phone, 40), lang, req.MarketingOptIn);
        var mustVerify = verification.Required;
        if (!await users.AddPendingAsync(user, profile, ct, verified: !mustVerify)) return Conflict(new { error = "email_taken" });

        // Profil d'organisation pré-rempli : l'assistant de démarrage reprend ces
        // réponses. Il reste « non terminé » tant que les chiffres ne sont pas saisis.
        var country = req.Country!.Trim().ToUpperInvariant();
        await organizations.SaveAsync(tenant, new OrganizationProfile(
            req.Organization!.Trim(), req.Sector!, country, Currencies.ForCountry(country), req.SizeBand!,
            0, 0, "business", null, DateTime.UtcNow), ct);

        // Sans service d'envoi, le compte est actif tout de suite : session ouverte.
        if (!mustVerify)
        {
            var (tok, exp) = tokens.Issue(user);
            return Ok(new { token = tok, expiresAt = exp, email = user.Email, role = user.Role, tenantId = user.TenantId });
        }

        try
        {
            await verification.SendCodeAsync(email, profile.FirstName, lang, ct);
        }
        catch (Exception e)
        {
            log.LogError(e, "Envoi du code de vérification impossible");
            return StatusCode(502, new { error = "email_send_failed", email });
        }
        return Accepted(new { status = "verification_required", email, resendAfter = (int)EmailVerificationService.ResendCooldown.TotalSeconds });
    }

    /// <summary>Confirme l'adresse avec le code reçu, puis ouvre la session.</summary>
    [AllowAnonymous]
    [HttpPost("verify")]
    public async Task<IActionResult> Verify([FromBody] VerifyRequest req, CancellationToken ct)
    {
        if (req is null || string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Code))
            return BadRequest(new { error = "code_required" });

        var state = await users.VerificationStateAsync(req.Email, ct);
        if (state is null) return BadRequest(new { error = "code_invalid" });
        if (state.Value.Verified) return Conflict(new { error = "already_verified" });

        var outcome = await verification.VerifyAsync(req.Email, req.Code, ct);
        if (outcome != VerifyOutcome.Verified)
        {
            var code = outcome switch
            {
                VerifyOutcome.Expired or VerifyOutcome.NoPendingCode => "code_expired",
                VerifyOutcome.TooManyAttempts => "code_locked",
                _ => "code_invalid",
            };
            return BadRequest(new { error = code });
        }

        await users.MarkVerifiedAsync(req.Email, ct);
        var user = await users.FindAsync(req.Email, ct);
        if (user is null) return BadRequest(new { error = "code_invalid" });
        var (token, expires) = tokens.Issue(user);
        return Ok(new { token, expiresAt = expires, email = user.Email, role = user.Role, tenantId = user.TenantId });
    }

    /// <summary>
    /// Renvoie un code. La réponse est la même que l'adresse existe ou non, pour
    /// ne pas révéler qui est inscrit.
    /// </summary>
    [AllowAnonymous]
    [HttpPost("resend")]
    public async Task<IActionResult> Resend([FromBody] ResendRequest req, CancellationToken ct)
    {
        if (req is null || string.IsNullOrWhiteSpace(req.Email)) return BadRequest(new { error = "email_required" });
        var wait = await verification.CooldownAsync(req.Email, ct);
        if (wait > 0) return Ok(new { resendAfter = wait });

        var state = await users.VerificationStateAsync(req.Email, ct);
        if (state is { Verified: false })
        {
            try { await verification.SendCodeAsync(req.Email, state.Value.FirstName, req.Lang ?? state.Value.Lang, ct); }
            catch (Exception e) { log.LogError(e, "Renvoi du code impossible"); return StatusCode(502, new { error = "email_send_failed" }); }
        }
        return Ok(new { resendAfter = (int)EmailVerificationService.ResendCooldown.TotalSeconds });
    }

    /// <summary>Contrôle complet de la demande d'inscription. Retourne un code d'erreur, ou null.</summary>
    public static string? Validate(RegisterRequest r)
    {
        if (string.IsNullOrWhiteSpace(r.Email) || string.IsNullOrWhiteSpace(r.Password)) return "credentials_required";
        if (string.IsNullOrWhiteSpace(r.FirstName) || r.FirstName.Trim().Length > 80) return "first_name_required";
        if (string.IsNullOrWhiteSpace(r.LastName) || r.LastName.Trim().Length > 80) return "last_name_required";
        var email = r.Email.Trim();
        if (email.Length > 254 || !EmailPattern.IsMatch(email)) return "invalid_email";
        if (string.IsNullOrWhiteSpace(r.Organization) || r.Organization.Trim().Length > 120) return "organization_required";
        if (string.IsNullOrWhiteSpace(r.Sector) || !Sectors.Contains(r.Sector)) return "sector_required";
        if (string.IsNullOrWhiteSpace(r.Country) || r.Country.Trim().Length != 2) return "country_required";
        if (string.IsNullOrWhiteSpace(r.SizeBand) || !SizeBands.Contains(r.SizeBand)) return "size_required";
        if (r.Password.Length < MinPasswordLength || r.Password.Length > 128) return "weak_password";
        if (!r.Password.Any(char.IsLetter) || !r.Password.Any(c => !char.IsLetter(c))) return "weak_password";
        var local = email.Split('@')[0];
        if (local.Length >= 4 && r.Password.Contains(local, StringComparison.OrdinalIgnoreCase)) return "password_contains_email";
        if (r.ConfirmPassword is not null && r.ConfirmPassword != r.Password) return "password_mismatch";
        if (!r.AcceptTerms) return "terms_required";
        return null;
    }

    private static string? Clean(string? v, int max)
    {
        var t = v?.Trim();
        return string.IsNullOrEmpty(t) ? null : t.Length > max ? t[..max] : t;
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
        emailVerification = verification.Required,
        minPasswordLength = MinPasswordLength,
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
        var role = admins.Contains(email, StringComparer.OrdinalIgnoreCase) ? "admin" : "member";

        // Provisionnement : l'utilisateur SSO est ENREGISTRÉ localement. Sans cela
        // il resterait invisible de la gestion des comptes, et le contrôle de
        // révocation (qui exige que la base fasse foi) le déconnecterait.
        // Le hachage est vide : impossible de se connecter par mot de passe
        // (PasswordHasher.Verify rejette un format sans « sel.hash »).
        var existing = await users.FindAsync(email, ct);
        if (existing is null)
        {
            await users.AddAsync(new NexusUser(email, "", tenant, role), ct);
        }
        else
        {
            // Compte déjà connu : la base fait foi (un administrateur a pu changer
            // son rôle ou son espace de travail depuis Admin → Comptes & rôles).
            tenant = existing.TenantId;
            role = existing.Role;
        }

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
