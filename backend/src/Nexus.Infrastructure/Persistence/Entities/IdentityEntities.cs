namespace Nexus.Infrastructure.Persistence.Entities;

/// <summary>Utilisateur NEXUS, lié à Entra ID via <see cref="ExternalId"/>.</summary>
public class AppUser
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string? ExternalId { get; set; }
    public string Email { get; set; } = null!;
    public string? DisplayName { get; set; }
    public string Status { get; set; } = "active";     // active | disabled
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? LastLoginAt { get; set; }

    public ICollection<Role> Roles { get; set; } = [];
}

/// <summary>Rôle RBAC (article 41). TenantId null = rôle système global.</summary>
public class Role
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string Key { get; set; } = null!;           // ex : risk_manager
    public string Name { get; set; } = null!;
    public bool IsSystem { get; set; }

    public ICollection<Permission> Permissions { get; set; } = [];
    public ICollection<AppUser> Users { get; set; } = [];
}

/// <summary>Permission granulaire (article 42), ex : simulations.execute.</summary>
public class Permission
{
    public string Key { get; set; } = null!;           // clé primaire
    public string Description { get; set; } = null!;

    public ICollection<Role> Roles { get; set; } = [];
}
