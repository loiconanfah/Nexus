using Nexus.Core.Results;

namespace Nexus.Domain.Ontology;

/// <summary>
/// Catégorie fonctionnelle d'un type d'entité de l'ontologie NEXUS.
/// </summary>
public enum EntityCategory
{
    Organization,
    Technical,
    Software,
    Process,
    Security,
    Governance,
    Derived
}

/// <summary>
/// Type d'entité de l'ontologie NEXUS (vocabulaire propriétaire contrôlé).
/// Modélisé en smart enumeration : ensemble canonique connu + validation à
/// l'écriture (article 8, gouvernance de l'ontologie). Extensible sans casser
/// l'existant en ajoutant de nouvelles instances au registre.
/// </summary>
public sealed class EntityType : IEquatable<EntityType>
{
    private static readonly Dictionary<string, EntityType> Registry = new(StringComparer.OrdinalIgnoreCase);

    private EntityType(string name, EntityCategory category, bool isAsset = false)
    {
        Name = name;
        Category = category;
        IsAsset = isAsset;
        Registry[name] = this;
    }

    public string Name { get; }
    public EntityCategory Category { get; }

    /// <summary>Vrai si le type est un actif technique (supertype <c>Asset</c>).</summary>
    public bool IsAsset { get; }

    // --- Organisation & humains ---
    public static readonly EntityType Organization = new(nameof(Organization), EntityCategory.Organization);
    public static readonly EntityType BusinessUnit = new(nameof(BusinessUnit), EntityCategory.Organization);
    public static readonly EntityType Location = new(nameof(Location), EntityCategory.Organization);
    public static readonly EntityType Person = new(nameof(Person), EntityCategory.Organization);
    public static readonly EntityType Role = new(nameof(Role), EntityCategory.Organization);
    public static readonly EntityType Team = new(nameof(Team), EntityCategory.Organization);

    // --- Fournisseurs & contrats ---
    public static readonly EntityType Supplier = new(nameof(Supplier), EntityCategory.Organization);
    public static readonly EntityType Contract = new(nameof(Contract), EntityCategory.Governance);

    // --- Technique & infrastructure (actifs) ---
    public static readonly EntityType Asset = new(nameof(Asset), EntityCategory.Technical, isAsset: true);
    public static readonly EntityType Infrastructure = new(nameof(Infrastructure), EntityCategory.Technical, isAsset: true);
    public static readonly EntityType Server = new(nameof(Server), EntityCategory.Technical, isAsset: true);
    public static readonly EntityType Device = new(nameof(Device), EntityCategory.Technical, isAsset: true);
    public static readonly EntityType Network = new(nameof(Network), EntityCategory.Technical, isAsset: true);
    public static readonly EntityType CloudResource = new(nameof(CloudResource), EntityCategory.Technical, isAsset: true);

    // --- Logiciel & données (actifs) ---
    public static readonly EntityType Application = new(nameof(Application), EntityCategory.Software, isAsset: true);
    public static readonly EntityType Service = new(nameof(Service), EntityCategory.Software, isAsset: true);
    public static readonly EntityType System = new(nameof(System), EntityCategory.Software, isAsset: true);
    public static readonly EntityType Database = new(nameof(Database), EntityCategory.Software, isAsset: true);
    public static readonly EntityType DataStore = new(nameof(DataStore), EntityCategory.Software, isAsset: true);

    // --- Processus & métier ---
    public static readonly EntityType Process = new(nameof(Process), EntityCategory.Process);
    public static readonly EntityType BusinessProcess = new(nameof(BusinessProcess), EntityCategory.Process);
    public static readonly EntityType BusinessService = new(nameof(BusinessService), EntityCategory.Process);

    // --- Identité & sécurité ---
    public static readonly EntityType Identity = new(nameof(Identity), EntityCategory.Security);
    public static readonly EntityType Credential = new(nameof(Credential), EntityCategory.Security);
    public static readonly EntityType Control = new(nameof(Control), EntityCategory.Security);
    public static readonly EntityType Policy = new(nameof(Policy), EntityCategory.Security);
    public static readonly EntityType Vulnerability = new(nameof(Vulnerability), EntityCategory.Security);

    // --- Connaissance & gouvernance ---
    public static readonly EntityType Document = new(nameof(Document), EntityCategory.Governance);
    public static readonly EntityType Incident = new(nameof(Incident), EntityCategory.Governance);
    public static readonly EntityType Change = new(nameof(Change), EntityCategory.Governance);
    public static readonly EntityType Risk = new(nameof(Risk), EntityCategory.Governance);
    public static readonly EntityType Event = new(nameof(Event), EntityCategory.Governance);

    // --- Entités dérivées (calculées par NEXUS) ---
    public static readonly EntityType Dependency = new(nameof(Dependency), EntityCategory.Derived);
    public static readonly EntityType Scenario = new(nameof(Scenario), EntityCategory.Derived);
    public static readonly EntityType Simulation = new(nameof(Simulation), EntityCategory.Derived);

    /// <summary>Tous les types d'entités connus.</summary>
    public static IReadOnlyCollection<EntityType> All => Registry.Values;

    /// <summary>Indique si un nom correspond à un type connu du registre.</summary>
    public static bool IsKnown(string name) => name is not null && Registry.ContainsKey(name);

    /// <summary>
    /// Résout un nom vers un type connu, ou renvoie une erreur de validation
    /// (jamais de type « sauvage » : article 8).
    /// </summary>
    public static Result<EntityType> FromName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return Error.Validation("ontology.entity_type.empty", "Le type d'entité est requis.");
        }

        return Registry.TryGetValue(name, out var type)
            ? type
            : Error.Validation("ontology.entity_type.unknown", $"Type d'entité inconnu : '{name}'.");
    }

    public bool Equals(EntityType? other) => other is not null &&
        string.Equals(Name, other.Name, StringComparison.OrdinalIgnoreCase);

    public override bool Equals(object? obj) => obj is EntityType other && Equals(other);
    public override int GetHashCode() => StringComparer.OrdinalIgnoreCase.GetHashCode(Name);
    public override string ToString() => Name;
}
