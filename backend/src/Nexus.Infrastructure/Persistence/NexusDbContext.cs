using Microsoft.EntityFrameworkCore;
using Nexus.Infrastructure.Persistence.Entities;

namespace Nexus.Infrastructure.Persistence;

/// <summary>
/// DbContext du plan de contrôle NEXUS (PostgreSQL). Porte l'état applicatif :
/// tenants, RBAC, connecteurs, jobs, lineage, documents+embeddings, audit,
/// profils de risque. Le graphe opérationnel vit dans Neo4j (voir Nexus.Graph).
/// Le nommage snake_case est appliqué globalement (EFCore.NamingConventions).
/// </summary>
public sealed class NexusDbContext(DbContextOptions<NexusDbContext> options) : DbContext(options)
{
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<BusinessUnit> BusinessUnits => Set<BusinessUnit>();
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<Connector> Connectors => Set<Connector>();
    public DbSet<IngestionJob> IngestionJobs => Set<IngestionJob>();
    public DbSet<DataLineage> DataLineage => Set<DataLineage>();
    public DbSet<Document> Documents => Set<Document>();
    public DbSet<DocumentChunk> DocumentChunks => Set<DocumentChunk>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<RiskProfile> RiskProfiles => Set<RiskProfile>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        b.HasPostgresExtension("vector");
        b.HasPostgresExtension("pg_trgm");

        // ---- Tenancy ----
        b.Entity<Tenant>(e =>
        {
            e.ToTable("tenant");
            e.HasIndex(x => x.Slug).IsUnique();
            e.HasMany(x => x.Organizations).WithOne(x => x.Tenant)
                .HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Organization>(e =>
        {
            e.ToTable("organization");
            e.HasIndex(x => x.TenantId);
            e.HasMany(x => x.BusinessUnits).WithOne(x => x.Organization)
                .HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<BusinessUnit>(e =>
        {
            e.ToTable("business_unit");
            e.HasIndex(x => x.OrganizationId);
            e.HasOne<BusinessUnit>().WithMany()
                .HasForeignKey(x => x.ParentId).OnDelete(DeleteBehavior.SetNull);
        });

        // ---- Identity & RBAC ----
        b.Entity<AppUser>(e =>
        {
            e.ToTable("app_user");
            e.HasIndex(x => new { x.TenantId, x.Email }).IsUnique();
            e.HasMany(x => x.Roles).WithMany(x => x.Users)
                .UsingEntity(j => j.ToTable("user_role"));
        });

        b.Entity<Role>(e =>
        {
            e.ToTable("role");
            e.HasIndex(x => new { x.TenantId, x.Key }).IsUnique();
            e.HasMany(x => x.Permissions).WithMany(x => x.Roles)
                .UsingEntity(j => j.ToTable("role_permission"));
        });

        b.Entity<Permission>(e =>
        {
            e.ToTable("permission");
            e.HasKey(x => x.Key);
        });

        // ---- Ingestion ----
        b.Entity<Connector>(e =>
        {
            e.ToTable("connector");
            e.HasIndex(x => x.TenantId);
            e.Property(x => x.Config).HasColumnType("jsonb");
        });

        b.Entity<IngestionJob>(e =>
        {
            e.ToTable("ingestion_job");
            e.HasIndex(x => new { x.TenantId, x.Status });
        });

        b.Entity<DataLineage>(e =>
        {
            e.ToTable("data_lineage");
            e.HasIndex(x => x.GraphNodeId);
            e.HasIndex(x => x.GraphEdgeId);
        });

        // ---- Documents & RAG ----
        b.Entity<Document>(e =>
        {
            e.ToTable("document");
            e.HasIndex(x => x.TenantId);
            e.HasMany(x => x.Chunks).WithOne(x => x.Document)
                .HasForeignKey(x => x.DocumentId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<DocumentChunk>(e =>
        {
            e.ToTable("document_chunk");
            e.HasIndex(x => x.TenantId);
            e.Property(x => x.Metadata).HasColumnType("jsonb");
            e.Property(x => x.Embedding).HasColumnType("vector(3072)");
        });

        // ---- Governance ----
        b.Entity<AuditLog>(e =>
        {
            e.ToTable("audit_log");
            e.HasIndex(x => new { x.TenantId, x.OccurredAt });
            e.HasIndex(x => x.Action);
            e.Property(x => x.Detail).HasColumnType("jsonb");
        });

        b.Entity<RiskProfile>(e =>
        {
            e.ToTable("risk_profile");
            e.HasIndex(x => x.TenantId);
            e.Property(x => x.Weights).HasColumnType("jsonb");
            e.Property(x => x.Thresholds).HasColumnType("jsonb");
        });
    }
}
