using Nexus.Core.Results;

namespace Nexus.Domain.Ontology;

/// <summary>
/// Type de relation de l'ontologie NEXUS (vocabulaire propriétaire contrôlé,
/// orienté source → target). Smart enumeration avec registre et validation.
/// <see cref="DependsOn"/> est la relation pivot du Dependency Engine.
/// </summary>
public sealed class RelationType : IEquatable<RelationType>
{
    private static readonly Dictionary<string, RelationType> Registry = new(StringComparer.OrdinalIgnoreCase);

    private RelationType(string name, bool isDependency = false, bool propagates = false)
    {
        Name = name;
        IsDependencyRelation = isDependency;
        Propagates = propagates;
        Registry[name] = this;
    }

    public string Name { get; }

    /// <summary>Vrai si la relation exprime une dépendance opérationnelle traversée par le Dependency Engine.</summary>
    public bool IsDependencyRelation { get; }

    /// <summary>Vrai si la relation propage un impact lors d'une simulation (Propagation Engine).</summary>
    public bool Propagates { get; }

    // Relation pivot
    public static readonly RelationType DependsOn = new("DEPENDS_ON", isDependency: true, propagates: true);

    // Hébergement / exécution
    public static readonly RelationType RunsOn = new("RUNS_ON", isDependency: true, propagates: true);
    public static readonly RelationType Hosts = new("HOSTS", propagates: true);

    // Connectivité
    public static readonly RelationType ConnectsTo = new("CONNECTS_TO");
    public static readonly RelationType CommunicatesWith = new("COMMUNICATES_WITH");
    public static readonly RelationType ConnectedTo = new("CONNECTED_TO");

    // Usage / support
    public static readonly RelationType Uses = new("USES", isDependency: true, propagates: true);
    public static readonly RelationType Supports = new("SUPPORTS", propagates: true);
    public static readonly RelationType Requires = new("REQUIRES", isDependency: true, propagates: true);

    // Données
    public static readonly RelationType Stores = new("STORES");
    public static readonly RelationType Processes = new("PROCESSES");

    // Propriété / gestion
    public static readonly RelationType OwnedBy = new("OWNED_BY");
    public static readonly RelationType ManagedBy = new("MANAGED_BY");
    public static readonly RelationType OperatedBy = new("OPERATED_BY");

    // Fournisseurs / contrats
    public static readonly RelationType SuppliedBy = new("SUPPLIED_BY", isDependency: true, propagates: true);
    public static readonly RelationType ContractedBy = new("CONTRACTED_BY");

    // Localisation / composition
    public static readonly RelationType LocatedIn = new("LOCATED_IN", propagates: true);
    public static readonly RelationType PartOf = new("PART_OF", propagates: true);

    // Causalité / propagation
    public static readonly RelationType Affects = new("AFFECTS", propagates: true);
    public static readonly RelationType Impacts = new("IMPACTS", propagates: true);
    public static readonly RelationType Triggers = new("TRIGGERS", propagates: true);
    public static readonly RelationType Blocks = new("BLOCKS", propagates: true);

    // Sécurité
    public static readonly RelationType Protects = new("PROTECTS");
    public static readonly RelationType Authenticates = new("AUTHENTICATES", isDependency: true, propagates: true);

    // Résilience / cycle de vie
    public static readonly RelationType ReplacedBy = new("REPLACED_BY");
    public static readonly RelationType BackedUpBy = new("BACKED_UP_BY");
    public static readonly RelationType RecoversWith = new("RECOVERS_WITH");

    // Dépendances humaines (article 28)
    public static readonly RelationType HasAccessTo = new("HAS_ACCESS_TO");
    public static readonly RelationType Knows = new("KNOWS", isDependency: true);
    public static readonly RelationType Maintains = new("MAINTAINS", isDependency: true);
    public static readonly RelationType ResponsibleFor = new("RESPONSIBLE_FOR");

    // Gouvernance / générique
    public static readonly RelationType DocumentedBy = new("DOCUMENTED_BY");
    public static readonly RelationType RelatedTo = new("RELATED_TO");

    /// <summary>Tous les types de relations connus.</summary>
    public static IReadOnlyCollection<RelationType> All => Registry.Values;

    public static bool IsKnown(string name) => name is not null && Registry.ContainsKey(name);

    /// <summary>Résout un nom vers un type connu, ou renvoie une erreur de validation.</summary>
    public static Result<RelationType> FromName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return Error.Validation("ontology.relation_type.empty", "Le type de relation est requis.");
        }

        return Registry.TryGetValue(name, out var type)
            ? type
            : Error.Validation("ontology.relation_type.unknown", $"Type de relation inconnu : '{name}'.");
    }

    public bool Equals(RelationType? other) => other is not null &&
        string.Equals(Name, other.Name, StringComparison.OrdinalIgnoreCase);

    public override bool Equals(object? obj) => obj is RelationType other && Equals(other);
    public override int GetHashCode() => StringComparer.OrdinalIgnoreCase.GetHashCode(Name);
    public override string ToString() => Name;
}
