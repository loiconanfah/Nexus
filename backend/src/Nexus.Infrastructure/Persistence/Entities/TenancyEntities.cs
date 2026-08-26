namespace Nexus.Infrastructure.Persistence.Entities;

/// <summary>Tenant : unité d'isolation multi-tenant (ADR-0005).</summary>
public class Tenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = null!;
    public string Slug { get; set; } = null!;

    /// <summary>saas | private_cloud | on_prem</summary>
    public string DeploymentMode { get; set; } = "saas";

    /// <summary>active | suspended | archived</summary>
    public string Status { get; set; } = "active";

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<Organization> Organizations { get; set; } = [];
}

/// <summary>Organisation observée par NEXUS.</summary>
public class Organization
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Name { get; set; } = null!;
    public string? Industry { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Tenant Tenant { get; set; } = null!;
    public ICollection<BusinessUnit> BusinessUnits { get; set; } = [];
}

/// <summary>Unité d'affaires (hiérarchique).</summary>
public class BusinessUnit
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrganizationId { get; set; }
    public string Name { get; set; } = null!;
    public Guid? ParentId { get; set; }

    public Organization Organization { get; set; } = null!;
}
