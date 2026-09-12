using Microsoft.AspNetCore.Mvc;
using Nexus.Api.Auth;
using Nexus.Api.Tenancy;

namespace Nexus.Api.Controllers;

/// <summary>
/// Comptes de l'espace de travail. Un pilote réel réunit plusieurs personnes
/// (RSSI, DSI, continuité, direction) : elles doivent partager LE MÊME espace,
/// alors qu'une inscription libre en crée un nouveau à chaque fois.
///
/// Deux rôles : <c>admin</c> (configure : comptes, sondes, IA, réglages
/// d'impact) et <c>member</c> (consulte et analyse). Toutes les opérations sont
/// bornées à l'espace de l'appelant — on ne peut jamais toucher un autre tenant.
/// </summary>
[Route("api/v1/users")]
public sealed class UsersController(
    ITenantProvider tenantProvider,
    PgUserStore users) : NexusController(tenantProvider)
{
    private static readonly string[] Roles = ["admin", "member"];

    private static string NormalizeRole(string? role)
        => Roles.Contains((role ?? "").Trim().ToLowerInvariant()) ? role!.Trim().ToLowerInvariant() : "member";

    /// <summary>Membres de l'espace de travail.</summary>
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;

        var me = CurrentEmail;
        var list = (await users.ListByTenantAsync(tenant, ct)).Select(u => new
        {
            email = u.Email,
            role = u.Role,
            createdAt = u.CreatedAt,
            isSelf = string.Equals(u.Email, me, StringComparison.OrdinalIgnoreCase),
        });
        return Ok(new { users = list, canManage = IsAdmin });
    }

    public sealed record InviteRequest(string Email, string Password, string? Role);

    /// <summary>
    /// Ajoute une personne à CET espace de travail. Le mot de passe est
    /// provisoire : il est transmis hors bande à l'intéressé, qui se connecte
    /// ensuite normalement.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Invite([FromBody] InviteRequest req, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (!RequireAdmin(out var forbidden)) return forbidden;

        if (req is null || string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { error = "credentials_required" });

        var email = req.Email.Trim();
        if (!email.Contains('@') || !email.Contains('.'))
            return BadRequest(new { error = "invalid_email" });
        if (req.Password.Length < 8)
            return BadRequest(new { error = "weak_password" });

        // L'e-mail est unique pour toute la plateforme : un compte appartient à un
        // seul espace de travail.
        if (await users.ExistsAsync(email, ct))
            return Conflict(new { error = "email_taken" });

        var role = NormalizeRole(req.Role);
        var added = await users.AddAsync(
            new NexusUser(email, PasswordHasher.Hash(req.Password), tenant, role), ct);
        if (!added) return Conflict(new { error = "email_taken" });

        return Ok(new { email, role });
    }

    public sealed record RoleRequest(string Role);

    /// <summary>Change le rôle d'un membre.</summary>
    [HttpPatch("{email}/role")]
    public async Task<IActionResult> SetRole(string email, [FromBody] RoleRequest req, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (!RequireAdmin(out var forbidden)) return forbidden;

        var target = await users.FindAsync(email, ct);
        if (target is null || target.TenantId != tenant)
            return NotFound(new { error = "user_not_found" });

        var role = NormalizeRole(req?.Role);

        // Ne jamais laisser l'espace sans administrateur.
        if (string.Equals(target.Role, "admin", StringComparison.OrdinalIgnoreCase) && role != "admin"
            && await users.CountAdminsAsync(tenant, ct) <= 1)
            return Conflict(new { error = "last_admin", message = "L'espace doit conserver au moins un administrateur." });

        await users.SetRoleAsync(tenant, email, role, ct);
        return Ok(new { email = target.Email, role });
    }

    public sealed record PasswordRequest(string Password);

    /// <summary>Réinitialise le mot de passe d'un membre (dépannage d'accès).</summary>
    [HttpPatch("{email}/password")]
    public async Task<IActionResult> SetPassword(string email, [FromBody] PasswordRequest req, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (!RequireAdmin(out var forbidden)) return forbidden;

        if (req is null || string.IsNullOrWhiteSpace(req.Password) || req.Password.Length < 8)
            return BadRequest(new { error = "weak_password" });

        var target = await users.FindAsync(email, ct);
        if (target is null || target.TenantId != tenant)
            return NotFound(new { error = "user_not_found" });

        await users.SetPasswordAsync(tenant, email, PasswordHasher.Hash(req.Password), ct);
        return NoContent();
    }

    /// <summary>Retire un membre de l'espace de travail.</summary>
    [HttpDelete("{email}")]
    public async Task<IActionResult> Remove(string email, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (!RequireAdmin(out var forbidden)) return forbidden;

        var target = await users.FindAsync(email, ct);
        if (target is null || target.TenantId != tenant)
            return NotFound(new { error = "user_not_found" });

        if (string.Equals(target.Email, CurrentEmail, StringComparison.OrdinalIgnoreCase))
            return Conflict(new { error = "cannot_remove_self", message = "Vous ne pouvez pas retirer votre propre compte." });

        if (string.Equals(target.Role, "admin", StringComparison.OrdinalIgnoreCase)
            && await users.CountAdminsAsync(tenant, ct) <= 1)
            return Conflict(new { error = "last_admin", message = "L'espace doit conserver au moins un administrateur." });

        await users.RemoveAsync(tenant, email, ct);
        return NoContent();
    }
}
