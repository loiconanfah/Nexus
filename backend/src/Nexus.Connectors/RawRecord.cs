namespace Nexus.Connectors;

/// <summary>
/// Enregistrement brut extrait d'une source, avant normalisation. Les valeurs
/// sont conservées telles quelles (chaînes) ; la normalisation vers l'ontologie
/// NEXUS est faite par le pipeline d'ingestion, pas par le connecteur
/// (voir ADR-0009).
/// </summary>
public sealed class RawRecord
{
    private readonly Dictionary<string, string?> _values;

    public RawRecord(string datasetName, string sourceKey, IReadOnlyDictionary<string, string?> values)
    {
        DatasetName = datasetName;
        SourceKey = sourceKey;
        _values = new Dictionary<string, string?>(values, StringComparer.OrdinalIgnoreCase);
    }

    /// <summary>Jeu de données d'origine (fichier / feuille / table).</summary>
    public string DatasetName { get; }

    /// <summary>Identifiant de l'enregistrement dans la source (ex : numéro de ligne). Alimente le lineage (article 12).</summary>
    public string SourceKey { get; }

    public IReadOnlyDictionary<string, string?> Values => _values;

    /// <summary>Lit une colonne (insensible à la casse), ou null si absente/vide.</summary>
    public string? Get(string column)
    {
        if (column is null || !_values.TryGetValue(column, out var value))
        {
            return null;
        }

        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
}
