using System.Text;

namespace Nexus.Ingestion.Normalization;

/// <summary>
/// Retire les accents des lettres latines (« Système » devient « Systeme »).
///
/// Fait à la main plutôt qu'avec string.Normalize : l'API tourne en mode de
/// globalisation invariante, où la décomposition Unicode n'est pas garantie, et
/// deux noms qui ne diffèrent que par un accent doivent toujours se reconnaître.
/// </summary>
public static class TextFold
{
    private static readonly Dictionary<char, string> Map = Build();

    private static Dictionary<char, string> Build()
    {
        var m = new Dictionary<char, string>();
        void Add(string chars, string to) { foreach (var c in chars) { m[c] = to; m[char.ToUpperInvariant(c)] = to.ToUpperInvariant(); } }
        Add("àáâãäåāăą", "a"); Add("çćĉċč", "c"); Add("ďđ", "d"); Add("èéêëēĕėęě", "e");
        Add("ĝğġģ", "g"); Add("ĥħ", "h"); Add("ìíîïĩīĭįı", "i"); Add("ĵ", "j"); Add("ķ", "k");
        Add("ĺļľŀł", "l"); Add("ñńņňŉ", "n"); Add("òóôõöøōŏő", "o"); Add("ŕŗř", "r");
        Add("śŝşš", "s"); Add("ţťŧ", "t"); Add("ùúûüũūŭůűų", "u"); Add("ŵ", "w"); Add("ýÿŷ", "y"); Add("źżž", "z");
        m['œ'] = "oe"; m['Œ'] = "OE"; m['æ'] = "ae"; m['Æ'] = "AE"; m['ß'] = "ss";
        m['’'] = "'"; m['‘'] = "'";
        return m;
    }

    public static string RemoveDiacritics(string? value)
    {
        if (string.IsNullOrEmpty(value)) return "";
        var sb = new StringBuilder(value.Length);
        foreach (var c in value) sb.Append(Map.TryGetValue(c, out var r) ? r : c.ToString());
        return sb.ToString();
    }
}
