using Nexus.Domain.Ontology;

namespace Nexus.Graph;

/// <summary>Candidat de correspondance floue (résolution d'entités — article 11).</summary>
public sealed record FuzzyMatch(Guid Id, string Name, string EntityType, double Score);

/// <summary>
/// Résolution d'entités (article 11) : rapproche une entité candidate d'une
/// entité existante du graphe. Une même ressource décrite différemment par
/// plusieurs sources (« SQL01 », « database-server-001 ») doit se résoudre vers
/// la même entité NEXUS — sans jamais fusionner automatiquement une entité
/// critique sous un seuil de confiance.
/// </summary>
public interface IEntityResolver
{
    /// <summary>
    /// Correspondance ferme (exact/alias, insensible à la casse) au sein d'un
    /// tenant et d'un type. Renvoie l'id existant, ou null si aucune.
    /// </summary>
    Task<Guid?> FindExistingAsync(
        Guid tenantId, EntityType type, string name, IReadOnlyList<string> aliases, CancellationToken ct = default);

    /// <summary>
    /// Correspondances floues (index full-text) pour suggérer des doublons
    /// potentiels. Ne fusionne rien : sert à proposer, pas à décider.
    /// </summary>
    Task<IReadOnlyList<FuzzyMatch>> FindSimilarAsync(
        Guid tenantId, string name, int limit = 5, CancellationToken ct = default);
}
