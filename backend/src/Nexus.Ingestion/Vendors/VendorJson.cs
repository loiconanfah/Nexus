using System.Text.Json;

namespace Nexus.Ingestion.Vendors;

/// <summary>
/// Lecture du JSON des éditeurs : navigation par chemin pointé, aplatissement en
/// colonnes, et colonnes dérivées.
///
/// Isolé du moteur HTTP pour une raison précise : c'est ici que se joue la
/// justesse d'un connecteur, et cette partie se teste sur des réponses
/// enregistrées, sans réseau ni compte chez l'éditeur.
/// </summary>
public static class VendorJson
{
    /// <summary>Descend un chemin pointé (« value.data.rows »). Renvoie faux si un segment manque.</summary>
    public static bool TryPath(JsonElement root, string? path, out JsonElement found)
    {
        found = root;
        if (string.IsNullOrWhiteSpace(path)) return true;

        // Une propriété peut CONTENIR un point (« @odata.nextLink » chez
        // Microsoft) : le nom littéral est donc essayé avant de découper.
        if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty(path, out var literal))
        {
            found = literal;
            return true;
        }

        foreach (var segment in path.Split('.', StringSplitOptions.RemoveEmptyEntries))
        {
            if (found.ValueKind != JsonValueKind.Object || !found.TryGetProperty(segment, out var next))
            {
                found = default;
                return false;
            }
            found = next;
        }
        return true;
    }

    /// <summary>Valeur scalaire au bout d'un chemin (lien de page suivante, jeton de curseur).</summary>
    public static string? Scalar(JsonElement root, string? path)
        => TryPath(root, path, out var el) && el.ValueKind is JsonValueKind.String or JsonValueKind.Number
            ? el.ToString()
            : null;

    /// <summary>
    /// Aplatit un objet JSON en colonnes. Les objets imbriqués donnent des clés
    /// pointées (« profile.department »), un tableau de scalaires est joint par
    /// des points-virgules, un tableau d'objets est ignoré ici : il relève de
    /// l'éclatement, qui produit une ligne par élément.
    /// </summary>
    public static void Flatten(string? prefix, JsonElement element, Dictionary<string, string?> into, int depth = 0)
    {
        if (element.ValueKind != JsonValueKind.Object) return;

        foreach (var property in element.EnumerateObject())
        {
            var key = prefix is null ? property.Name : $"{prefix}.{property.Name}";
            switch (property.Value.ValueKind)
            {
                case JsonValueKind.String:
                    into[key] = property.Value.GetString();
                    break;
                case JsonValueKind.Number:
                case JsonValueKind.True:
                case JsonValueKind.False:
                    into[key] = property.Value.ToString();
                    break;
                case JsonValueKind.Object when depth < 3:
                    Flatten(key, property.Value, into, depth + 1);
                    break;
                case JsonValueKind.Array:
                    var scalars = property.Value.EnumerateArray()
                        .Where(x => x.ValueKind is JsonValueKind.String or JsonValueKind.Number)
                        .Select(x => x.ToString());
                    var joined = string.Join(";", scalars);
                    if (joined.Length > 0) into[key] = joined;
                    break;
            }
        }
    }

    /// <summary>
    /// Colonnes calculées. Les identifiants des grands nuages portent
    /// l'information utile DANS la chaîne (le service, la région, le groupe de
    /// ressources) : sans extracteur, un inventaire AWS ou Azure ne produit que
    /// des noms opaques, inutilisables pour une carte de dépendances.
    /// </summary>
    public static string? Derive(string expression, Func<string, string?> column)
    {
        var split = expression.Split(':', 2);
        if (split.Length != 2) return null;
        var extractor = split[0].Trim();
        var argument = split[1].Trim();

        // Extracteurs qui lisent PLUSIEURS colonnes, ou aucune.
        switch (extractor)
        {
            // Un nom de fournisseur est une constante : c'est ce qui permet de voir
            // que tout un inventaire pend au même nuage.
            case "const":
                return argument.Length > 0 ? argument : null;
            // Un nom de personne arrive souvent en deux colonnes (Okta).
            case "concat":
                var parts = argument.Split('|', StringSplitOptions.RemoveEmptyEntries)
                    .Select(c => column(c.Trim()))
                    .Where(v => !string.IsNullOrWhiteSpace(v));
                var joined = string.Join(" ", parts).Trim();
                return joined.Length > 0 ? joined : null;
            // La première colonne renseignée : les API varient d'un objet à l'autre.
            case "coalesce":
                foreach (var candidate in argument.Split('|', StringSplitOptions.RemoveEmptyEntries))
                    if (column(candidate.Trim()) is { } found && !string.IsNullOrWhiteSpace(found)) return found;
                return null;
        }

        var value = column(argument);
        if (string.IsNullOrWhiteSpace(value)) return null;

        return extractor switch
        {
            // arn:aws:ec2:ca-central-1:123456789012:instance/i-0abc
            "arn.service" => Part(value, 2),
            "arn.region" => Part(value, 3),
            "arn.account" => Part(value, 4),
            "arn.name" => LastSegment(value),
            // /subscriptions/<id>/resourceGroups/<rg>/providers/...
            "azure.sub" => After(value, "/subscriptions/"),
            "azure.rg" => After(value, "/resourceGroups/"),
            "path.last" => LastSegment(value),
            _ => null,
        };
    }

    private static string? Part(string arn, int index)
    {
        var parts = arn.Split(':');
        return parts.Length > index && parts[index].Length > 0 ? parts[index] : null;
    }

    private static string? LastSegment(string value)
    {
        var cut = value.LastIndexOfAny(['/', ':']);
        var tail = cut >= 0 && cut < value.Length - 1 ? value[(cut + 1)..] : value;
        return tail.Length > 0 ? tail : null;
    }

    private static string? After(string value, string marker)
    {
        var at = value.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        if (at < 0) return null;
        var rest = value[(at + marker.Length)..];
        var end = rest.IndexOf('/');
        var segment = end < 0 ? rest : rest[..end];
        return segment.Length > 0 ? segment : null;
    }
}
