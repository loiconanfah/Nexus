namespace Nexus.Infrastructure.Persistence.Entities;

/// <summary>Connecteur configuré. Read-only par défaut (ADR-0008).</summary>
public class Connector
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Type { get; set; } = null!;          // csv | excel | json | rest | azure ...
    public string Name { get; set; } = null!;

    /// <summary>Config non-secrète (JSONB). Les secrets vont dans Key Vault.</summary>
    public string Config { get; set; } = "{}";

    public bool IsReadOnly { get; set; } = true;
    public string Status { get; set; } = "configured";
    public DateTimeOffset? LastSyncAt { get; set; }
    public DateTimeOffset? LastSuccessAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

/// <summary>Exécution d'ingestion (full | incremental).</summary>
public class IngestionJob
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? ConnectorId { get; set; }
    public string Mode { get; set; } = "full";
    public string Status { get; set; } = "queued";     // queued | running | succeeded | failed | cancelled
    public int RecordsRead { get; set; }
    public int RecordsMapped { get; set; }
    public string? Error { get; set; }
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? FinishedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

/// <summary>Provenance d'une donnée du graphe (article 12). Répond au « pourquoi ».</summary>
public class DataLineage
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }

    /// <summary>Id du nœud Neo4j concerné (ou null si l'entrée concerne une relation).</summary>
    public string? GraphNodeId { get; set; }

    /// <summary>Id de la relation Neo4j concernée.</summary>
    public string? GraphEdgeId { get; set; }

    public Guid? ConnectorId { get; set; }
    public Guid? JobId { get; set; }
    public string? SourceSystem { get; set; }
    public string? SourceRecord { get; set; }
    public bool Transformed { get; set; }
    public bool Inferred { get; set; }
    public DateTimeOffset CollectedAt { get; set; } = DateTimeOffset.UtcNow;
}
