using Pgvector;

namespace Nexus.Infrastructure.Persistence.Entities;

/// <summary>Document source pour le RAG (article 21).</summary>
public class Document
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Title { get; set; } = null!;
    public string? DocType { get; set; }               // contract | procedure | incident | policy ...
    public string BlobUri { get; set; } = null!;
    public string? ContentHash { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<DocumentChunk> Chunks { get; set; } = [];
}

/// <summary>Chunk vectorisé d'un document (pgvector, embeddings 3072 dim).</summary>
public class DocumentChunk
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DocumentId { get; set; }
    public Guid TenantId { get; set; }
    public int ChunkIndex { get; set; }
    public string Content { get; set; } = null!;
    public string Metadata { get; set; } = "{}";       // JSONB

    /// <summary>Embedding text-embedding-3-large (nullable jusqu'à vectorisation).</summary>
    public Vector? Embedding { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Document Document { get; set; } = null!;
}
