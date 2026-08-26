using Nexus.Core.Guards;
using Nexus.Core.Primitives;
using Nexus.Core.Results;
using Nexus.Domain.Ontology;
using Nexus.Domain.ValueObjects;

namespace Nexus.Domain.Graph;

/// <summary>
/// Nœud du knowledge graph : une entité de l'ontologie NEXUS (article 7).
/// Identité stable par <see cref="Entity{TId}.Id"/> (UUID généré par NEXUS,
/// jamais par la source, pour garantir la stabilité inter-bases — DOMAIN_MODEL §1).
/// </summary>
public sealed class GraphEntity : Entity<Guid>
{
    private readonly List<string> _aliases;
    private readonly Dictionary<string, string> _attributes;

    private GraphEntity(
        Guid id,
        Guid tenantId,
        EntityType type,
        string name,
        Criticality criticality,
        IEnumerable<string> aliases,
        IReadOnlyDictionary<string, string> attributes,
        string? description,
        string? sourceSystem,
        DateTimeOffset createdAt) : base(id)
    {
        TenantId = tenantId;
        Type = type;
        Name = name;
        Criticality = criticality;
        _aliases = aliases.Where(a => !string.IsNullOrWhiteSpace(a)).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        _attributes = new Dictionary<string, string>(attributes);
        Description = description;
        SourceSystem = sourceSystem;
        CreatedAt = createdAt;
        UpdatedAt = createdAt;
        ValidFrom = createdAt;
    }

    public Guid TenantId { get; }
    public EntityType Type { get; }
    public string Name { get; private set; }
    public string? Description { get; private set; }
    public Criticality Criticality { get; private set; }
    public string? SourceSystem { get; }

    public IReadOnlyList<string> Aliases => _aliases;
    public IReadOnlyDictionary<string, string> Attributes => _attributes;

    public DateTimeOffset CreatedAt { get; }
    public DateTimeOffset UpdatedAt { get; private set; }

    // Graphe temporel (article 25) : ValidUntil = null signifie « actif ».
    public DateTimeOffset ValidFrom { get; private set; }
    public DateTimeOffset? ValidUntil { get; private set; }

    public bool IsActive => ValidUntil is null;

    /// <summary>Fabrique validée d'une entité de graphe.</summary>
    public static Result<GraphEntity> Create(
        Guid tenantId,
        EntityType type,
        string name,
        Criticality? criticality = null,
        IEnumerable<string>? aliases = null,
        IReadOnlyDictionary<string, string>? attributes = null,
        string? description = null,
        string? sourceSystem = null,
        Guid? id = null,
        DateTimeOffset? createdAt = null)
    {
        if (tenantId == Guid.Empty)
        {
            return Error.Validation("graph_entity.tenant_required", "Le tenant est requis.");
        }

        if (type is null)
        {
            return Error.Validation("graph_entity.type_required", "Le type d'entité est requis.");
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            return Error.Validation("graph_entity.name_required", "Le nom de l'entité est requis.");
        }

        return new GraphEntity(
            id ?? Guid.NewGuid(),
            tenantId,
            type,
            name.Trim(),
            criticality ?? Criticality.Unknown,
            aliases ?? [],
            attributes ?? new Dictionary<string, string>(),
            description,
            sourceSystem,
            createdAt ?? DateTimeOffset.UtcNow);
    }

    public void Rename(string name)
    {
        Name = Guard.AgainstNullOrWhiteSpace(name).Trim();
        Touch();
    }

    public void SetCriticality(Criticality criticality)
    {
        Criticality = Guard.AgainstNull(criticality);
        Touch();
    }

    public void AddAlias(string alias)
    {
        if (!string.IsNullOrWhiteSpace(alias) &&
            !_aliases.Contains(alias, StringComparer.OrdinalIgnoreCase))
        {
            _aliases.Add(alias);
            Touch();
        }
    }

    public void SetAttribute(string key, string value)
    {
        _attributes[Guard.AgainstNullOrWhiteSpace(key)] = value;
        Touch();
    }

    /// <summary>Clôt la validité temporelle de l'entité (historisation — article 25).</summary>
    public void Retire(DateTimeOffset at)
    {
        ValidUntil = at;
        Touch();
    }

    private void Touch() => UpdatedAt = DateTimeOffset.UtcNow;
}
