using Microsoft.AspNetCore.Mvc;
using Nexus.AI;
using Nexus.Api.Tenancy;
using Nexus.Domain.Graph;
using Nexus.Domain.ValueObjects;
using Nexus.Graph;
using Nexus.Ingestion.Documents;
using Nexus.Ingestion.Normalization;

namespace Nexus.Api.Controllers;

/// <summary>
/// Intelligence documentaire (article 12 / P5). Un document (Word, PDF, texte)
/// est lu, découpé en sections, analysé section par section par l'IA, puis
/// consolidé et recoupé avec le graphe en direct. L'utilisateur choisit ce qui
/// entre dans le graphe : rien n'est écrit sans confirmation, et les liens
/// restent « Suggéré par IA » jusqu'à validation dans Confiance & audit.
///
/// L'analyse section par section est pilotée par le navigateur : chaque appel
/// reste court (pas d'expiration derrière un proxy, progression visible), et le
/// contexte d'espace de travail de la requête s'applique à chaque appel au modèle
/// (clé IA et quota de l'espace).
/// </summary>
[Route("api/v1/documents")]
public sealed class DocumentExtractionController(
    ITenantProvider tenantProvider,
    IChatCompletion chat,
    IGraphRepository repository) : NexusController(tenantProvider)
{
    private const string Source = "Document Intelligence";

    public sealed record TextRequest(string Text, string? Lang);
    public sealed record SectionRequest(int Index, int Total, string? Section, string Text, List<string>? KnownNames, string? Lang);
    public sealed record NamedEntity(string Name, string Type);
    public sealed record LinkRequest(int Index, string? Section, string Text, List<NamedEntity> Entities, string? Lang);
    public sealed record ConsolidateRequest(List<ChunkExtraction> Parts, int Sections, int? Analyzed, List<string>? Warnings, string? Lang);
    public sealed record IngestEntity(string Name, string Type, int Criticality, List<string>? Aliases, string? Description, string? MatchId);
    public sealed record IngestRelation(string Source, string SourceType, string Target, string TargetType, string RelationType, double Confidence, string? Evidence);
    public sealed record IngestRequest(List<IngestEntity> Entities, List<IngestRelation> Relations);

    private static string Lang(string? l) => l == "en" ? "en" : "fr";
    private string NoAi(string lang) => lang == "en"
        ? "No AI model is available for this workspace (see Admin, AI integrations)."
        : "Aucun modèle IA n'est disponible pour cet espace (voir Admin, Intégrations IA).";

    /// <summary>Lit un fichier (Word, PDF, texte) et renvoie son texte, tableaux mis en phrases.</summary>
    [HttpPost("parse")]
    [RequestSizeLimit(DocumentTextExtractor.MaxFileBytes + 1024 * 1024)]
    public IActionResult Parse(IFormFile? file)
    {
        if (!TryGetTenant(out _, out var error)) return error;
        if (file is null || file.Length == 0) return BadRequest(new { error = "file_required" });
        if (file.Length > DocumentTextExtractor.MaxFileBytes) return BadRequest(new { error = "file_too_large", maxBytes = DocumentTextExtractor.MaxFileBytes });
        if (!DocumentTextExtractor.IsSupported(file.FileName))
            return BadRequest(new { error = Path.GetExtension(file.FileName).Equals(".doc", StringComparison.OrdinalIgnoreCase) ? "legacy_doc" : "unsupported_format" });

        try
        {
            using var stream = file.OpenReadStream();
            var doc = DocumentTextExtractor.Extract(stream, file.FileName);
            if (doc.Text.Length == 0)
                return Ok(new { fileName = file.FileName, doc.Format, text = "", characters = 0, doc.Tables, doc.Pages, sections = 0, doc.Warnings });
            return Ok(new
            {
                fileName = file.FileName,
                doc.Format,
                doc.Text,
                characters = doc.Text.Length,
                doc.Tables,
                doc.Pages,
                sections = DocumentAnalyzer.Plan(doc.Text).Count,
                doc.Warnings,
            });
        }
        catch (Exception e) when (e is InvalidDataException or System.Xml.XmlException or NotSupportedException)
        {
            return BadRequest(new { error = "unreadable_file", message = e.Message });
        }
        catch (Exception)
        {
            // PDF chiffré ou corrompu, notamment.
            return BadRequest(new { error = "unreadable_file", message = "Le fichier n'a pas pu être lu (protégé par mot de passe ou endommagé ?)." });
        }
    }

    /// <summary>Découpe un texte en sections à analyser.</summary>
    [HttpPost("plan")]
    public IActionResult Plan([FromBody] TextRequest req)
    {
        if (!TryGetTenant(out _, out var error)) return error;
        if (string.IsNullOrWhiteSpace(req?.Text)) return BadRequest(new { error = "text_required" });
        var text = req.Text.Length > DocumentTextExtractor.MaxTextChars ? req.Text[..DocumentTextExtractor.MaxTextChars] : req.Text;
        var all = DocumentAnalyzer.Plan(text);
        var kept = all.Take(DocumentAnalyzer.MaxChunks).ToList();
        return Ok(new
        {
            aiAvailable = chat.IsConfigured,
            total = all.Count,
            truncated = all.Count > kept.Count,
            sections = kept.Select(c => new { c.Index, c.Section, c.Text, characters = c.Text.Length }),
        });
    }

    /// <summary>Analyse UNE section. Ne modifie pas le graphe.</summary>
    [HttpPost("extract-section")]
    public async Task<IActionResult> ExtractSection([FromBody] SectionRequest req, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (string.IsNullOrWhiteSpace(req?.Text)) return BadRequest(new { error = "text_required" });
        var lang = Lang(req.Lang);
        if (!chat.IsConfigured) return Ok(new { ok = false, message = NoAi(lang) });

        var chunk = new DocumentChunk(req.Index, req.Section ?? "", req.Text.Length > 12_000 ? req.Text[..12_000] : req.Text);
        var graph = await repository.GetEntitiesAsync(tenant, ct: ct);
        var known = graph.Select(g => g.Name).Concat(req.KnownNames ?? []);
        var answered = false;
        var parsed = await DocumentAnalyzer.ExtractSectionAsync(chunk, Math.Max(1, req.Total), known, lang,
            async (s, u, t) => { var r = await chat.CompleteAsync(s, u, t); answered |= r is not null; return r; }, ct);
        if (parsed is null)
            return Ok(new
            {
                ok = false,
                message = !answered
                    ? (lang == "en" ? "The model did not answer (monthly quota reached or service unavailable)." : "Le modèle n'a pas répondu (quota mensuel atteint ou service indisponible).")
                    : (lang == "en" ? "The model's answer could not be used." : "La réponse du modèle n'était pas exploitable."),
            });
        return Ok(new { ok = true, extraction = parsed });
    }

    /// <summary>
    /// Seconde passe sur une section : les liens entre tous les éléments du
    /// document (relevés par extract-section sur l'ensemble des sections).
    /// </summary>
    [HttpPost("link-section")]
    public async Task<IActionResult> LinkSection([FromBody] LinkRequest req, CancellationToken ct)
    {
        if (!TryGetTenant(out _, out var error)) return error;
        if (string.IsNullOrWhiteSpace(req?.Text) || req.Entities is null) return BadRequest(new { error = "text_required" });
        if (!chat.IsConfigured) return Ok(new { ok = false, message = NoAi(Lang(req.Lang)), relations = Array.Empty<object>() });
        var chunk = new DocumentChunk(req.Index, req.Section ?? "", req.Text.Length > 12_000 ? req.Text[..12_000] : req.Text);
        var entities = req.Entities.Where(e => !string.IsNullOrWhiteSpace(e.Name)).Take(400).Select(e => (e.Name, e.Type)).ToList();
        var relations = await DocumentAnalyzer.ExtractLinksAsync(chunk, entities, (s, u, t) => chat.CompleteAsync(s, u, t), ct);
        return Ok(new { ok = true, relations });
    }

    /// <summary>Fusionne les sections, recoupe avec le graphe et calcule les constats.</summary>
    [HttpPost("consolidate")]
    public async Task<IActionResult> Consolidate([FromBody] ConsolidateRequest req, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (req?.Parts is null) return BadRequest(new { error = "parts_required" });
        var graph = await repository.GetEntitiesAsync(tenant, ct: ct);
        var edges = await repository.GetRelationsAsync(tenant, ct: ct);
        var groups = chat.IsConfigured
            ? await DocumentAnalyzer.ReconcileAsync(req.Parts, (s, u, t) => chat.CompleteAsync(s, u, t), ct)
            : [];
        var result = DocumentAnalyzer.Consolidate(req.Parts, graph, edges, Lang(req.Lang), Math.Max(1, req.Sections), req.Warnings, groups, req.Analyzed);
        return Ok(result);
    }

    /// <summary>
    /// Analyse complète en un seul appel (pour l'API et les textes courts). Pour
    /// un long document, préférer plan puis extract-section, qui montrent la
    /// progression et ne risquent pas d'expirer.
    /// </summary>
    [HttpPost("extract")]
    public async Task<IActionResult> Extract([FromBody] TextRequest req, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (string.IsNullOrWhiteSpace(req?.Text)) return BadRequest(new { error = "text_required" });
        var lang = Lang(req.Lang);
        if (!chat.IsConfigured) return Ok(new { usedAi = false, message = NoAi(lang), entities = Array.Empty<object>(), relations = Array.Empty<object>() });

        var text = req.Text.Length > DocumentTextExtractor.MaxTextChars ? req.Text[..DocumentTextExtractor.MaxTextChars] : req.Text;
        var graph = await repository.GetEntitiesAsync(tenant, ct: ct);
        var edges = await repository.GetRelationsAsync(tenant, ct: ct);
        var result = await DocumentAnalyzer.RunAsync(text, (s, u, c) => chat.CompleteAsync(s, u, c), graph, edges, lang, ct);
        var usedAi = result.Stats.SectionsAnalyzed > 0;
        return Ok(new
        {
            usedAi,
            message = lang == "en"
                ? $"{result.Stats.Entities} element(s), {result.Stats.Relations} link(s), {result.Stats.Risks} risk(s)."
                : $"{result.Stats.Entities} élément(s), {result.Stats.Relations} lien(s), {result.Stats.Risks} risque(s).",
            result.Stats, result.Entities, result.Relations, result.Risks, result.Findings, result.Warnings,
        });
    }

    /// <summary>
    /// Ajoute au graphe les éléments retenus. Un élément reconnu dans le graphe
    /// (MatchId, ou même nom au sens large : casse, accents, alias) n'est pas
    /// recréé : les liens s'y rattachent. Les liens restent « Suggéré par IA ».
    /// </summary>
    [HttpPost("ingest")]
    public async Task<IActionResult> Ingest([FromBody] IngestRequest req, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (req is null) return BadRequest(new { error = "body_required" });

        var existing = await repository.GetEntitiesAsync(tenant, ct: ct);
        var byId = existing.ToDictionary(e => e.Id);
        var byKey = new Dictionary<string, Guid>();
        var exact = new HashSet<string>();   // un nom exact l'emporte toujours sur une clé secondaire
        void Index(string? name, Guid id)
        {
            var k = DocumentAnalyzer.Key(name);
            if (k.Length > 0) { byKey[k] = id; exact.Add(k); }
            foreach (var alt in DocumentAnalyzer.AltKeys(name)) if (!exact.Contains(alt)) byKey.TryAdd(alt, id);
        }
        Guid? Resolve(string? name)
        {
            if (byKey.TryGetValue(DocumentAnalyzer.Key(name), out var id)) return id;
            foreach (var alt in DocumentAnalyzer.AltKeys(name)) if (byKey.TryGetValue(alt, out id)) return id;
            return null;
        }
        foreach (var e in existing) { Index(e.Name, e.Id); foreach (var a in e.Aliases) Index(a, e.Id); }

        // Liens déjà présents (mêmes extrémités, même type) : jamais recréés. Un
        // second import du même document ne doit rien dupliquer.
        var existingEdges = (await repository.GetRelationsAsync(tenant, ct: ct))
            .Select(r => (r.Source, r.Target, r.Type.ToUpperInvariant())).ToHashSet();
        int entitiesCreated = 0, entitiesLinked = 0, relationsCreated = 0, relationsExisting = 0, unresolved = 0;

        foreach (var e in req.Entities ?? [])
        {
            if (string.IsNullOrWhiteSpace(e.Name)) continue;
            if (Guid.TryParse(e.MatchId, out var mid) && byId.ContainsKey(mid))
            {
                Index(e.Name, mid); foreach (var a in e.Aliases ?? []) Index(a, mid);
                entitiesLinked++;
                continue;
            }
            if (Resolve(e.Name) is not null) { entitiesLinked++; continue; }

            var type = OntologyResolver.ResolveEntityType(e.Type);
            var crit = Criticality.Create(Math.Clamp(e.Criticality, 0, 100));
            var aliases = (e.Aliases ?? []).Where(a => !string.IsNullOrWhiteSpace(a)).Select(a => a.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).Take(20).ToList();
            var ge = GraphEntity.Create(tenant, type, e.Name.Trim(), criticality: crit.IsSuccess ? crit.Value : null,
                aliases: aliases, description: string.IsNullOrWhiteSpace(e.Description) ? null : e.Description.Trim(), sourceSystem: Source);
            if (ge.IsFailure) continue;
            await repository.UpsertEntityAsync(ge.Value, ct);
            Index(e.Name, ge.Value.Id); foreach (var a in aliases) Index(a, ge.Value.Id);
            entitiesCreated++;
        }

        foreach (var r in req.Relations ?? [])
        {
            if (Resolve(r.Source) is not Guid sid || Resolve(r.Target) is not Guid tid || sid == tid) { unresolved++; continue; }
            var relType = OntologyResolver.ResolveRelationType(r.RelationType);
            if (!existingEdges.Add((sid, tid, relType.Name.ToUpperInvariant()))) { relationsExisting++; continue; }
            var conf = Confidence.Create(Math.Clamp(r.Confidence, 0.05, 0.95));
            // Extraite d'un document PAR l'IA : reste AiSuggested (hors calculs
            // « fermes », ADR-0006) jusqu'à validation humaine.
            var extract = string.IsNullOrWhiteSpace(r.Evidence) ? null : r.Evidence;
            var rel = GraphRelation.Create(tenant, sid, tid, relType,
                conf.IsSuccess ? conf.Value : Confidence.Create(0.4).Value,
                ConfidenceStatus.AiSuggested, sourceSystem: Source, evidence: extract,
                evidences: [RelationEvidence.From(
                    EvidenceSource.AiInference,
                    extract is null ? "Extraite d'un document par l'IA" : $"Extrait du document : « {extract} »",
                    sourceSystem: Source,
                    weight: conf.IsSuccess ? conf.Value.Value : 0.4)]);
            if (rel.IsFailure) { unresolved++; continue; }
            await repository.UpsertRelationAsync(rel.Value, ct);
            relationsCreated++;
        }

        return Ok(new { entitiesCreated, entitiesLinked, relationsCreated, relationsExisting, unresolved });
    }
}
