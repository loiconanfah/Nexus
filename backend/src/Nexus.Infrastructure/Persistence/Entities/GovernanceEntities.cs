namespace Nexus.Infrastructure.Persistence.Entities;

/// <summary>Journal d'audit immuable (article 43).</summary>
public class AuditLog
{
    public long Id { get; set; }                       // BIGSERIAL
    public Guid? TenantId { get; set; }
    public Guid? UserId { get; set; }
    public string Action { get; set; } = null!;        // login | data_import | risk_modified | ai_query ...
    public string? EntityType { get; set; }
    public string? EntityId { get; set; }
    public string Detail { get; set; } = "{}";         // JSONB
    public System.Net.IPAddress? IpAddress { get; set; }  // mappé sur inet par Npgsql
    public DateTimeOffset OccurredAt { get; set; } = DateTimeOffset.UtcNow;
}

/// <summary>
/// Profil de risque configurable par tenant (articles 14-15). Les pondérations
/// et seuils ne sont JAMAIS hardcodés : ils vivent ici (JSONB).
/// </summary>
public class RiskProfile
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Name { get; set; } = null!;
    public bool IsDefault { get; set; }

    /// <summary>{ criticality: 0.25, exposure: 0.15, ... } (JSONB)</summary>
    public string Weights { get; set; } = "{}";

    /// <summary>{ low:20, moderate:40, elevated:60, high:80 } (JSONB)</summary>
    public string Thresholds { get; set; } = "{\"low\":20,\"moderate\":40,\"elevated\":60,\"high\":80}";

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
