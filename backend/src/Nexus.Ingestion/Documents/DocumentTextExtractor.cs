using System.IO.Compression;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using ClosedXML.Excel;
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
/// Lit le texte d'un document : Word (.docx), Excel (.xlsx), PDF, CSV, et formats
/// texte (.txt, .md, .json, .html…).
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
        [".txt", ".md", ".markdown", ".log", ".json", ".yaml", ".yml", ".xml", ".conf", ".ini", ".html", ".htm"];
    private const int MaxSheetRows = 5000;

    public static bool IsSupported(string fileName)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        return ext is ".docx" or ".pdf" or ".xlsx" or ".xlsm" or ".csv" or ".tsv" || TextExtensions.Contains(ext);
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
            ".xlsx" or ".xlsm" => FromXlsx(buffer),
            ".csv" or ".tsv" => FromCsv(ReadText(buffer), ext == ".tsv" ? '\t' : null),
            ".html" or ".htm" => FromHtml(ReadText(buffer)),
            _ when TextExtensions.Contains(ext) => new ExtractedDocument(ReadText(buffer), "text", 0, 0, []),
            ".doc" => throw new NotSupportedException("Ancien format Word (.doc) : enregistrez le fichier au format .docx."),
            ".xls" => throw new NotSupportedException("Ancien format Excel (.xls) : enregistrez le classeur au format .xlsx."),
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

    // ───────────────────────────── Excel (.xlsx) ─────────────────────────────

    /// <summary>
    /// Chaque feuille visible devient une section titrée, et chacune de ses lignes
    /// une phrase « En-tête : valeur ; … ». La première ligne non vide sert
    /// d'en-têtes. Les valeurs sont lues telles qu'affichées (dates, nombres
    /// formatés, résultats de formules).
    /// </summary>
    private static ExtractedDocument FromXlsx(Stream stream)
    {
        XLWorkbook wb;
        try { wb = new XLWorkbook(stream); }
        catch (Exception e) when (e is not OutOfMemoryException)
        {
            throw new InvalidDataException("Classeur Excel illisible (protégé par mot de passe ou endommagé ?).", e);
        }

        using (wb)
        {
            var sb = new StringBuilder();
            var warnings = new List<string>();
            var tables = 0;
            var hidden = 0;
            foreach (var ws in wb.Worksheets)
            {
                if (ws.Visibility != XLWorksheetVisibility.Visible) { hidden++; continue; }
                var range = ws.RangeUsed();
                if (range is null) continue;

                var rows = new List<IReadOnlyList<string>>();
                var total = 0;
                foreach (var row in range.Rows())
                {
                    var cells = row.Cells().Select(c => Clean(SafeText(c))).ToList();
                    if (cells.All(c => c.Length == 0)) continue;
                    total++;
                    if (rows.Count <= MaxSheetRows) rows.Add(cells);
                }
                if (rows.Count == 0) continue;
                if (total > MaxSheetRows + 1)
                    warnings.Add($"Feuille « {ws.Name} » : seules les {MaxSheetRows:N0} premières lignes sur {total - 1:N0} sont lues.");

                tables++;
                sb.Append("\n## Feuille : ").AppendLine(ws.Name);
                sb.AppendLine($"[Tableau {tables} : {ws.Name}]");
                foreach (var line in TableToLines(rows)) sb.AppendLine(line);
                sb.AppendLine();
            }
            if (hidden > 0) warnings.Add($"{hidden} feuille(s) masquée(s) ignorée(s).");
            return new ExtractedDocument(sb.ToString(), "xlsx", tables, 0, warnings);
        }
    }

    private static string SafeText(IXLCell c)
    {
        try { return c.GetFormattedString(); }
        catch { try { return c.Value.ToString(); } catch { return ""; } }
    }

    private static string Clean(string s) => Regex.Replace(s ?? "", @"\s+", " ").Trim();

    // ───────────────────────────── CSV ─────────────────────────────

    /// <summary>Un CSV est un tableau : ses lignes deviennent des phrases, comme pour Excel.</summary>
    private static ExtractedDocument FromCsv(string text, char? delimiter)
    {
        var lines = text.Replace("\r\n", "\n").Split('\n').Where(l => l.Trim().Length > 0).ToList();
        if (lines.Count == 0) return new ExtractedDocument("", "csv", 0, 0, []);
        var sep = delimiter ?? DetectDelimiter(lines[0]);
        var rows = lines.Take(MaxSheetRows + 1).Select(l => (IReadOnlyList<string>)SplitCsv(l, sep)).ToList();
        var warnings = new List<string>();
        if (lines.Count > MaxSheetRows + 1) warnings.Add($"Seules les {MaxSheetRows:N0} premières lignes sur {lines.Count - 1:N0} sont lues.");
        var sb = new StringBuilder("[Tableau 1]\n");
        foreach (var line in TableToLines(rows)) sb.AppendLine(line);
        return new ExtractedDocument(sb.ToString(), "csv", 1, 0, warnings);
    }

    private static char DetectDelimiter(string header)
    {
        var candidates = new[] { ';', ',', '\t', '|' };
        return candidates.OrderByDescending(c => header.Count(ch => ch == c)).First();
    }

    /// <summary>Découpe une ligne CSV en respectant les guillemets (« "Douala, Akwa" » reste une cellule).</summary>
    private static List<string> SplitCsv(string line, char sep)
    {
        var cells = new List<string>();
        var cur = new StringBuilder();
        var quoted = false;
        for (var i = 0; i < line.Length; i++)
        {
            var ch = line[i];
            if (ch == '"')
            {
                if (quoted && i + 1 < line.Length && line[i + 1] == '"') { cur.Append('"'); i++; }
                else quoted = !quoted;
            }
            else if (ch == sep && !quoted) { cells.Add(Clean(cur.ToString())); cur.Clear(); }
            else cur.Append(ch);
        }
        cells.Add(Clean(cur.ToString()));
        return cells;
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
