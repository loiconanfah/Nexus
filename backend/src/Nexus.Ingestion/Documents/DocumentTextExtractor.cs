using System.IO.Compression;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using UglyToad.PdfPig;
using UglyToad.PdfPig.DocumentLayoutAnalysis.TextExtractor;

namespace Nexus.Ingestion.Documents;

/// <summary>Texte lu dans un fichier, prêt pour l'analyse.</summary>
public sealed record ExtractedDocument(
    string Text,
    string Format,
    int Tables,
    int Pages,
    IReadOnlyList<string> Warnings);

/// <summary>
/// Lit le texte d'un document : Word (.docx), PDF, et formats texte (.txt, .md,
/// .csv, .json, .html…).
///
/// Les TABLEAUX sont le point délicat : copiés tels quels, ils deviennent une
/// suite de cellules isolées (« AGE-006 », « Garoua », « Élevée ») et l'IA ne
/// sait plus ce qui va avec quoi. Chaque ligne est donc réécrite en phrase
/// autonome, préfixée par les en-têtes de colonnes :
///     « ID : AGE-006 ; Site : Agence Garoua (Nord) ; Criticité : Élevée ».
/// Les titres sont repérés (« # », « ## ») pour que le découpage garde le
/// contexte de chaque section.
/// </summary>
public static class DocumentTextExtractor
{
    public const long MaxFileBytes = 15 * 1024 * 1024;
    public const int MaxTextChars = 400_000;
    private const long MaxXmlBytes = 60L * 1024 * 1024;   // garde-fou contre les archives piégées

    private static readonly XNamespace W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    private static readonly string[] TextExtensions =
        [".txt", ".md", ".markdown", ".log", ".csv", ".tsv", ".json", ".yaml", ".yml", ".xml", ".conf", ".ini", ".html", ".htm"];

    public static bool IsSupported(string fileName)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        return ext is ".docx" or ".pdf" || TextExtensions.Contains(ext);
    }

    public static ExtractedDocument Extract(Stream content, string fileName)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        using var buffer = new MemoryStream();
        content.CopyTo(buffer);
        buffer.Position = 0;

        var doc = ext switch
        {
            ".docx" => FromDocx(buffer),
            ".pdf" => FromPdf(buffer),
            ".html" or ".htm" => FromHtml(ReadText(buffer)),
            _ when TextExtensions.Contains(ext) => new ExtractedDocument(ReadText(buffer), "text", 0, 0, []),
            ".doc" => throw new NotSupportedException("Ancien format Word (.doc) : enregistrez le fichier au format .docx."),
            _ => throw new NotSupportedException($"Format non pris en charge : {ext}"),
        };

        var text = Normalize(doc.Text);
        var warnings = doc.Warnings.ToList();
        if (text.Length > MaxTextChars)
        {
            text = text[..MaxTextChars];
            warnings.Add($"Document très long : seuls les {MaxTextChars:N0} premiers caractères sont analysés.");
        }
        return doc with { Text = text, Warnings = warnings };
    }

    // ───────────────────────────── Word (.docx) ─────────────────────────────

    private static ExtractedDocument FromDocx(Stream stream)
    {
        using var zip = new ZipArchive(stream, ZipArchiveMode.Read);
        var entry = zip.GetEntry("word/document.xml")
            ?? throw new InvalidDataException("Fichier Word illisible : contenu principal introuvable.");
        if (entry.Length > MaxXmlBytes) throw new InvalidDataException("Fichier Word trop volumineux une fois décompressé.");

        XDocument xml;
        using (var s = entry.Open()) xml = XDocument.Load(s);
        var body = xml.Root?.Element(W + "body") ?? throw new InvalidDataException("Fichier Word vide.");

        var sb = new StringBuilder();
        var tables = 0;
        string? lastHeading = null;
        foreach (var node in body.Elements())
        {
            if (node.Name == W + "p")
            {
                var text = ParagraphText(node);
                if (text.Length == 0) continue;
                var level = HeadingLevel(node);
                if (level > 0)
                {
                    lastHeading = text;
                    sb.Append('\n').Append(new string('#', Math.Min(level, 4))).Append(' ').AppendLine(text);
                }
                else sb.AppendLine(text);
            }
            else if (node.Name == W + "tbl")
            {
                tables++;
                AppendTable(sb, node, tables, lastHeading);
            }
        }

        var warnings = new List<string>();
        if (zip.Entries.Any(e => e.FullName.StartsWith("word/media/", StringComparison.OrdinalIgnoreCase)))
            warnings.Add("Le document contient des images : leur contenu (schémas, captures) n'est pas lu.");
        return new ExtractedDocument(sb.ToString(), "docx", tables, 0, warnings);
    }

    private static string ParagraphText(XElement p)
    {
        var sb = new StringBuilder();
        foreach (var el in p.Descendants())
        {
            if (el.Name == W + "t") sb.Append(el.Value);
            else if (el.Name == W + "tab") sb.Append(' ');
            else if (el.Name == W + "br" || el.Name == W + "cr") sb.Append(' ');
        }
        return Regex.Replace(sb.ToString(), @"\s+", " ").Trim();
    }

    /// <summary>Niveau de titre (styles Heading1…, Titre1…, Title), 0 si paragraphe normal.</summary>
    private static int HeadingLevel(XElement p)
    {
        var style = p.Element(W + "pPr")?.Element(W + "pStyle")?.Attribute(W + "val")?.Value ?? "";
        if (style.Equals("Title", StringComparison.OrdinalIgnoreCase) || style.Equals("Titre", StringComparison.OrdinalIgnoreCase)) return 1;
        var m = Regex.Match(style, @"^(?:Heading|Titre|berschrift)\s*(\d)$", RegexOptions.IgnoreCase);
        if (m.Success) return int.Parse(m.Groups[1].Value) + 1;
        var outline = p.Element(W + "pPr")?.Element(W + "outlineLvl")?.Attribute(W + "val")?.Value;
        return int.TryParse(outline, out var lvl) && lvl < 9 ? lvl + 2 : 0;
    }

    private static void AppendTable(StringBuilder sb, XElement tbl, int number, string? heading)
    {
        var rows = tbl.Elements(W + "tr")
            .Select(tr => tr.Elements(W + "tc").Select(tc => string.Join(" ", tc.Elements(W + "p").Select(ParagraphText).Where(t => t.Length > 0))).ToList())
            .Where(r => r.Any(c => c.Length > 0))
            .ToList();
        if (rows.Count == 0) return;
        sb.AppendLine().AppendLine($"[Tableau {number}{(heading is null ? "" : $" : {heading}")}]");
        foreach (var line in TableToLines(rows)) sb.AppendLine(line);
        sb.AppendLine();
    }

    /// <summary>
    /// Une ligne de tableau devient une phrase autonome « En-tête : valeur ; … ».
    /// Sans ligne d'en-tête exploitable (une seule ligne, ou en-têtes vides), les
    /// cellules sont simplement jointes.
    /// </summary>
    public static IEnumerable<string> TableToLines(IReadOnlyList<IReadOnlyList<string>> rows)
    {
        if (rows.Count == 0) yield break;
        var header = rows[0];
        var usable = rows.Count > 1 && header.Count(h => h.Length > 0) >= Math.Max(1, header.Count / 2);
        if (!usable)
        {
            foreach (var r in rows) yield return string.Join(" ; ", r.Where(c => c.Length > 0));
            yield break;
        }
        foreach (var r in rows.Skip(1))
        {
            var parts = new List<string>();
            for (var i = 0; i < r.Count; i++)
            {
                if (r[i].Length == 0) continue;
                var h = i < header.Count && header[i].Length > 0 ? header[i] : $"Colonne {i + 1}";
                parts.Add($"{h} : {r[i]}");
            }
            if (parts.Count > 0) yield return string.Join(" ; ", parts);
        }
    }

    // ───────────────────────────── PDF ─────────────────────────────

    private static ExtractedDocument FromPdf(Stream stream)
    {
        using var pdf = PdfDocument.Open(stream);
        var sb = new StringBuilder();
        var pages = 0;
        var empty = 0;
        foreach (var page in pdf.GetPages())
        {
            pages++;
            var text = ContentOrderTextExtractor.GetText(page);
            if (string.IsNullOrWhiteSpace(text)) { empty++; continue; }
            sb.AppendLine(text).AppendLine();
        }
        var warnings = new List<string>();
        if (pages > 0 && empty == pages)
            warnings.Add("Ce PDF ne contient pas de texte lisible (document numérisé en image) : la reconnaissance de caractères n'est pas prise en charge.");
        else if (empty > 0)
            warnings.Add($"{empty} page(s) sans texte lisible (images numérisées) ont été ignorées.");
        return new ExtractedDocument(sb.ToString(), "pdf", 0, pages, warnings);
    }

    // ───────────────────────────── Texte et HTML ─────────────────────────────

    private static string ReadText(Stream stream)
    {
        using var reader = new StreamReader(stream, new UTF8Encoding(false), detectEncodingFromByteOrderMarks: true);
        return reader.ReadToEnd();
    }

    private static ExtractedDocument FromHtml(string html)
    {
        var s = Regex.Replace(html, @"<(script|style)[\s\S]*?</\1>", " ", RegexOptions.IgnoreCase);
        s = Regex.Replace(s, @"<(br|/p|/div|/li|/tr|/h[1-6])\s*/?>", "\n", RegexOptions.IgnoreCase);
        s = Regex.Replace(s, @"<(td|th)[^>]*>", " ; ", RegexOptions.IgnoreCase);
        s = Regex.Replace(s, "<[^>]+>", " ");
        return new ExtractedDocument(WebUtility.HtmlDecode(s), "html", 0, 0, []);
    }

    private static string Normalize(string text)
    {
        var s = text.Replace("\r\n", "\n").Replace('\r', '\n').Replace(' ', ' ');
        s = Regex.Replace(s, @"[ \t]+\n", "\n");
        s = Regex.Replace(s, @"\n{3,}", "\n\n");
        return s.Trim();
    }
}
