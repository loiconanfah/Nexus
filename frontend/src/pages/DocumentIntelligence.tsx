import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle, ArrowRight, CheckCircle2, FileText, FileUp, GitMerge, Info, Loader2, ScanText, ShieldAlert, Sparkles, Square, Upload, UserRound, Waypoints,
} from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import { entityTypeLabel, relationTypeLabel } from '../lib/labels'
import type { CandidateEntity, CandidateRelation, ChunkExtraction, DocumentAnalysis, DocumentFinding, DocumentRisk, ParsedDocument } from '../lib/types'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'
const ACCEPT = '.docx,.pdf,.txt,.md,.markdown,.log,.csv,.tsv,.json,.yaml,.yml,.html,.htm,.xml,.conf,.ini,text/*'
const MAX_BYTES = 15 * 1024 * 1024

type T = (fr: string, en: string) => string
type Phase = 'idle' | 'reading' | 'extracting' | 'linking' | 'consolidating' | 'done'
type Progress = { phase: Phase; step: number; total: number; label: string }

const SEV: Record<string, { color: string; fr: string; en: string }> = {
  high: { color: 'var(--nx-danger)', fr: 'Élevé', en: 'High' },
  medium: { color: 'var(--nx-warning)', fr: 'Moyen', en: 'Medium' },
  low: { color: 'var(--nx-text-muted)', fr: 'Faible', en: 'Low' },
}

function parseError(code: string, t: T): string {
  switch (code) {
    case 'legacy_doc': return t('Ancien format Word (.doc) : ouvrez-le dans Word et enregistrez-le au format .docx.', 'Legacy Word format (.doc): open it in Word and save it as .docx.')
    case 'unsupported_format': return t('Format non pris en charge. Formats acceptés : Word (.docx), PDF, texte (.txt, .md, .csv, .json, .html…).', 'Unsupported format. Accepted: Word (.docx), PDF, text (.txt, .md, .csv, .json, .html…).')
    case 'file_too_large': return t('Fichier trop volumineux (15 Mo au maximum).', 'File too large (15 MB maximum).')
    case 'unreadable_file': return t('Le fichier n’a pas pu être lu : il est peut-être protégé par un mot de passe ou endommagé.', 'The file could not be read: it may be password-protected or damaged.')
    default: return t('Lecture du fichier impossible. Réessayez.', 'Could not read the file. Please retry.')
  }
}

const relKey = (r: { source: string; target: string; relationType: string }) => `${r.source}|${r.relationType}|${r.target}`

export function DocumentIntelligence() {
  const { t, lang } = useLang()
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const cancelRef = useRef<AbortController | null>(null)

  const [text, setText] = useState('')
  const [file, setFile] = useState<ParsedDocument | null>(null)
  const [fileErr, setFileErr] = useState<string | null>(null)
  const [progress, setProgress] = useState<Progress>({ phase: 'idle', step: 0, total: 0, label: '' })
  const [runErr, setRunErr] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null)
  const [selEntities, setSelEntities] = useState<Set<string>>(new Set())
  const [selRelations, setSelRelations] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<'all' | 'new' | 'existing'>('all')
  const [ingesting, setIngesting] = useState(false)
  const [ingestRes, setIngestRes] = useState<{ entitiesCreated: number; entitiesLinked?: number; relationsCreated: number; relationsExisting?: number; unresolved: number } | null>(null)

  const busy = progress.phase !== 'idle' && progress.phase !== 'done'

  async function onFile(f: File) {
    setFileErr(null); setAnalysis(null); setIngestRes(null)
    if (f.size > MAX_BYTES) { setFileErr(parseError('file_too_large', t)); return }
    setProgress({ phase: 'reading', step: 0, total: 1, label: t('Lecture du fichier…', 'Reading the file…') })
    try {
      const doc = await api.parseDocument(f)
      setFile(doc)
      setText(doc.text)
      if (!doc.text) setFileErr(doc.warnings[0] ?? t('Aucun texte lisible dans ce fichier.', 'No readable text in this file.'))
    } catch (e) {
      setFile(null)
      setFileErr(parseError(e instanceof Error ? e.message : '', t))
    } finally {
      setProgress({ phase: 'idle', step: 0, total: 0, label: '' })
    }
  }

  async function analyze() {
    if (!text.trim() || busy) return
    const ctrl = new AbortController()
    cancelRef.current = ctrl
    setRunErr(null); setAnalysis(null); setIngestRes(null)
    setProgress({ phase: 'extracting', step: 1, total: 1, label: '' })
    try {
      const plan = await api.planDocument(text)
      if (!plan.aiAvailable) { setRunErr(t('Aucun modèle IA n’est disponible pour cet espace (voir Admin, Intégrations IA).', 'No AI model is available for this workspace (see Admin, AI integrations).')); return }
      const n = plan.sections.length
      const warnings: string[] = []
      if (plan.truncated) warnings.push(t(`Document très long : les ${n} premières sections sur ${plan.total} sont analysées.`, `Very long document: the first ${n} sections out of ${plan.total} are analyzed.`))

      // 1. Éléments et risques, section par section.
      const parts: ChunkExtraction[] = []
      const known: string[] = []
      for (const s of plan.sections) {
        if (ctrl.signal.aborted) return
        setProgress({ phase: 'extracting', step: s.index + 1, total: n, label: s.section })
        const r = await api.extractSection({ index: s.index, total: n, section: s.section, text: s.text, knownNames: known, lang }, ctrl.signal)
        if (!r.ok || !r.extraction) { warnings.push(t(`Section ${s.index + 1} non analysée : ${r.message ?? ''}`, `Section ${s.index + 1} not analyzed: ${r.message ?? ''}`)); continue }
        parts.push(r.extraction)
        known.push(...r.extraction.entities.map((e) => e.name))
      }
      if (parts.length === 0) { setRunErr(warnings.at(-1) ?? t('Aucune section n’a pu être analysée.', 'No section could be analyzed.')); return }

      // 2. Liens, section par section, avec tous les éléments du document.
      const seen = new Set<string>()
      const entities = parts.flatMap((p) => p.entities).filter((e) => { const k = e.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true })
        .map((e) => ({ name: e.name, type: e.type }))
      const linkParts: ChunkExtraction[] = []
      for (const s of plan.sections) {
        if (ctrl.signal.aborted) return
        setProgress({ phase: 'linking', step: s.index + 1, total: n, label: s.section })
        const r = await api.linkSection({ index: s.index, section: s.section, text: s.text, entities, lang }, ctrl.signal)
        if (r.ok && r.relations.length) linkParts.push({ entities: [], relations: r.relations, risks: [] })
      }

      // 3. Consolidation et recoupement avec le graphe.
      setProgress({ phase: 'consolidating', step: n, total: n, label: '' })
      const res = await api.consolidateDocument({ parts: [...parts, ...linkParts], sections: n, analyzed: parts.length, warnings, lang }, ctrl.signal)
      setAnalysis(res)
      setSelEntities(new Set(res.entities.filter((e) => e.status === 'new').map((e) => e.name)))
      setSelRelations(new Set(res.relations.filter((r) => r.status === 'new').map(relKey)))
      setFilter('all')
    } catch (e) {
      if (!ctrl.signal.aborted) setRunErr(t('L’analyse a été interrompue par une erreur. Réessayez.', 'The analysis stopped on an error. Please retry.') + (e instanceof Error ? ` (${e.message.slice(0, 120)})` : ''))
    } finally {
      setProgress((p) => ({ ...p, phase: 'done' }))
      cancelRef.current = null
    }
  }

  function cancel() {
    cancelRef.current?.abort()
    setProgress({ phase: 'idle', step: 0, total: 0, label: '' })
    setRunErr(t('Analyse annulée.', 'Analysis cancelled.'))
  }

  async function ingest() {
    if (!analysis) return
    setIngesting(true)
    try {
      const relations = analysis.relations.filter((r) => selRelations.has(relKey(r)))
      // Les extrémités des liens retenus sont toujours envoyées : nouvelles, elles
      // sont créées ; reconnues, elles se rattachent à l'élément existant.
      const needed = new Set([...selEntities, ...relations.flatMap((r) => [r.source, r.target])])
      const entities = analysis.entities.filter((e) => needed.has(e.name)).map((e) => ({
        name: e.name, type: e.type, criticality: e.criticality, aliases: e.aliases, description: e.description ?? null, matchId: e.matchId ?? null,
      }))
      const r = await api.ingestDocument({ entities, relations })
      setIngestRes(r)
      qc.invalidateQueries()
    } catch (e) {
      setRunErr(t('L’ajout au graphe a échoué.', 'Adding to the graph failed.') + (e instanceof Error ? ` (${e.message.slice(0, 120)})` : ''))
    } finally { setIngesting(false) }
  }

  const SAMPLES = lang === 'fr' ? [
    'Le traitement de facturation nocturne dépend de l’ERP, qui s’authentifie auprès de AD01 et stocke ses données sur SQL01. Si SQL01 tombe, les factures ne peuvent pas être générées.',
    'Notre CRM est hébergé chez CloudProviderX. Seul Bob sait redémarrer l’intégration ERP.',
  ] : [
    'The nightly billing run depends on the ERP, which authenticates against AD01 and stores data on SQL01. If SQL01 is down, invoices cannot be generated.',
    'Our CRM is hosted on CloudProviderX. Only Bob knows how to restart the ERP integration.',
  ]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-2" style={{ fontFamily: geist, fontSize: 24, color: 'var(--nx-text)' }}>
          <ScanText size={22} style={{ color: CYAN }} /> {t('Intelligence documentaire', 'Document Intelligence')}
        </h2>
        <p className="mt-1" style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>
          {t('Importez un document Word, PDF ou texte (runbook, note d’incident, profil d’organisation, document d’architecture), ou collez-le. Lenexux en relève les éléments, les liens et les risques, section par section, puis les recoupe avec votre graphe en direct.',
            'Upload a Word, PDF or text document (runbook, incident note, organisation profile, architecture document), or paste it. Lenexux extracts its elements, links and risks section by section, then cross-references them with your live graph.')}
        </p>
      </div>

      {/* ───────── Document source ───────── */}
      <div className="flex flex-col gap-3 rounded-sm border p-4" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2" style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text)' }}><FileText size={14} /> {t('Document source', 'Source document')}</span>
          <button onClick={() => inputRef.current?.click()} disabled={busy} className="flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 disabled:opacity-50" style={{ fontFamily: mono, fontSize: 11, borderColor: 'color-mix(in srgb, var(--nx-cyan) 35%, transparent)', color: CYAN_T }}>
            <Upload size={13} /> {t('Importer un fichier (Word, PDF, texte)', 'Upload a file (Word, PDF, text)')}
          </button>
          <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = '' }} />
        </div>

        <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void onFile(f) }}>
          <textarea value={text} onChange={(e) => { setText(e.target.value); setFile(null); setAnalysis(null) }} rows={9} disabled={busy}
            placeholder={t('Déposez un fichier ici, ou collez du texte.', 'Drop a file here, or paste text.')}
            className="w-full resize-y rounded-sm p-3 outline-none" style={{ background: 'var(--nx-panel)', border: '1px dashed var(--nx-border)', color: 'var(--nx-text)', fontSize: 13, lineHeight: 1.5 }} />
        </div>

        {file && file.text && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1" style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-success)' }}>
            <span className="flex items-center gap-1.5"><FileUp size={12} /> {file.fileName}</span>
            <span style={{ color: 'var(--nx-text-muted)' }}>
              {({ docx: 'Word', pdf: 'PDF', html: 'HTML', text: t('Texte', 'Text') } as Record<string, string>)[file.format]}
              {' · '}{file.characters.toLocaleString(lang)} {t('caractères', 'characters')}
              {file.tables > 0 && <> · {file.tables} {t('tableau(x) mis en phrases', 'table(s) turned into sentences')}</>}
              {file.pages > 0 && <> · {file.pages} {t('page(s)', 'page(s)')}</>}
              {' · '}{file.sections} {t('section(s) à analyser', 'section(s) to analyze')}
            </span>
          </div>
        )}
        {file?.text && file.warnings.map((w) => (
          <div key={w} className="flex items-start gap-1.5" style={{ fontSize: 12, color: 'var(--nx-warning)' }}><Info size={13} className="mt-0.5 shrink-0" /> {w}</div>
        ))}
        {fileErr && <div className="flex items-start gap-1.5" style={{ fontSize: 12.5, color: 'var(--nx-danger)' }}><AlertTriangle size={13} className="mt-0.5 shrink-0" /> {fileErr}</div>}

        <div className="flex flex-wrap items-center gap-2">
          {SAMPLES.map((s, i) => (
            <button key={i} onClick={() => { setText(s); setFile(null); setAnalysis(null) }} disabled={busy} className="rounded-sm border px-2 py-1" style={{ fontFamily: mono, fontSize: 10, borderColor: 'var(--nx-border)', color: 'var(--nx-text-muted)' }}>{t('Exemple', 'Sample')} {i + 1}</button>
          ))}
          <div className="ml-auto flex gap-2">
            {busy && progress.phase !== 'reading' && (
              <button onClick={cancel} className="flex items-center gap-1.5 rounded-sm border px-3 py-2" style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text-muted)', fontSize: 13 }}><Square size={13} /> {t('Annuler', 'Cancel')}</button>
            )}
            <button onClick={() => void analyze()} disabled={!text.trim() || busy} className="flex items-center gap-2 rounded-sm px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontSize: 13, fontWeight: 600 }}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {t('Analyser le document', 'Analyze the document')}
            </button>
          </div>
        </div>

        {busy && <ProgressBar p={progress} t={t} />}
        {runErr && <div className="flex items-start gap-1.5 rounded-sm p-2.5" style={{ fontSize: 12.5, color: 'var(--nx-danger)', background: 'color-mix(in srgb, var(--nx-danger) 7%, transparent)' }}><AlertTriangle size={14} className="mt-0.5 shrink-0" /> {runErr}</div>}
      </div>

      {analysis && (
        <Results a={analysis} t={t} lang={lang}
          selEntities={selEntities} setSelEntities={setSelEntities} selRelations={selRelations} setSelRelations={setSelRelations}
          filter={filter} setFilter={setFilter} ingesting={ingesting} ingestRes={ingestRes} onIngest={() => void ingest()} />
      )}
    </div>
  )
}

function ProgressBar({ p, t }: { p: Progress; t: T }) {
  // Trois temps : éléments (0 à 45 %), liens (45 à 90 %), recoupement (90 à 100 %).
  const pct = p.phase === 'reading' ? 10
    : p.phase === 'extracting' ? ((p.step - 1) / Math.max(1, p.total)) * 45
      : p.phase === 'linking' ? 45 + ((p.step - 1) / Math.max(1, p.total)) * 45
        : p.phase === 'consolidating' ? 92 : 100
  const label = p.phase === 'reading' ? p.label
    : p.phase === 'extracting' ? t(`Relevé des éléments et des risques : section ${p.step} sur ${p.total}`, `Finding elements and risks: section ${p.step} of ${p.total}`)
      : p.phase === 'linking' ? t(`Recherche des liens entre éléments : section ${p.step} sur ${p.total}`, `Finding links between elements: section ${p.step} of ${p.total}`)
        : t('Fusion des doublons et recoupement avec votre graphe…', 'Merging duplicates and cross-referencing your graph…')
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3" style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>
        <span className="truncate">{label}{p.label && p.phase !== 'reading' ? ` · ${p.label}` : ''}</span>
        <span style={{ fontFamily: mono }}>{Math.round(pct)} %</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--nx-surface-high)' }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(4, pct)}%`, background: CYAN }} />
      </div>
    </div>
  )
}

/* ───────────────────────────── Résultats ───────────────────────────── */

function Results(props: {
  a: DocumentAnalysis; t: T; lang: string
  selEntities: Set<string>; setSelEntities: (s: Set<string>) => void
  selRelations: Set<string>; setSelRelations: (s: Set<string>) => void
  filter: 'all' | 'new' | 'existing'; setFilter: (f: 'all' | 'new' | 'existing') => void
  ingesting: boolean; ingestRes: { entitiesCreated: number; entitiesLinked?: number; relationsCreated: number; relationsExisting?: number; unresolved: number } | null
  onIngest: () => void
}) {
  const { a, t, lang, selEntities, setSelEntities, selRelations, setSelRelations, filter, setFilter } = props
  const s = a.stats
  const entities = a.entities.filter((e) => filter === 'all' || e.status === filter)
  const relations = a.relations.filter((r) => filter === 'all' || r.status === filter)
  const toggle = (set: Set<string>, k: string, setter: (s: Set<string>) => void) => { const n = new Set(set); if (n.has(k)) n.delete(k); else n.add(k); setter(n) }
  const pickedRelations = useMemo(() => a.relations.filter((r) => selRelations.has(relKey(r))), [a.relations, selRelations])
  const newEndpoints = useMemo(() => {
    const byName = new Map(a.entities.map((e) => [e.name, e]))
    return new Set(pickedRelations.flatMap((r) => [r.source, r.target]).filter((n) => byName.get(n)?.status === 'new' && !selEntities.has(n)))
  }, [a.entities, pickedRelations, selEntities])
  const toAdd = [...selEntities].filter((n) => a.entities.find((e) => e.name === n)?.status === 'new').length + newEndpoints.size

  return (
    <div className="flex flex-col gap-4">
      {/* Chiffres clés */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label={t('Éléments', 'Elements')} value={s.entities} sub={t(`${s.newEntities} nouveau(x) · ${s.existingEntities} déjà dans le graphe`, `${s.newEntities} new · ${s.existingEntities} already in graph`)} />
        <Tile label={t('Liens', 'Links')} value={s.relations} sub={t(`${s.newRelations} nouveau(x) · ${s.existingRelations} déjà connu(s)`, `${s.newRelations} new · ${s.existingRelations} already known`)} />
        <Tile label={t('Risques cités', 'Risks cited')} value={s.risks} sub={t(`${a.findings.length} constat(s) calculé(s)`, `${a.findings.length} computed finding(s)`)} />
        <Tile label={t('Sections analysées', 'Sections analyzed')} value={`${s.sectionsAnalyzed}/${s.sections}`} sub={s.sectionsAnalyzed === s.sections ? t('document lu en entier', 'whole document read') : t('analyse partielle', 'partial analysis')} warn={s.sectionsAnalyzed < s.sections} />
      </div>

      {a.warnings.length > 0 && (
        <div className="flex flex-col gap-1 rounded-sm border p-3" style={{ borderColor: 'color-mix(in srgb, var(--nx-warning) 40%, transparent)', background: 'color-mix(in srgb, var(--nx-warning) 6%, transparent)' }}>
          {a.warnings.map((w) => <div key={w} className="flex items-start gap-1.5" style={{ fontSize: 12.5, color: 'var(--nx-text)' }}><Info size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--nx-warning)' }} /> {w}</div>)}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel icon={<Waypoints size={14} />} title={t('Constats calculés sur le graphe', 'Findings computed on the graph')}
          hint={t('Calculés par Lenexux sur votre graphe complété du document : points de concentration, dépendance à une personne, criticités divergentes.', 'Computed by Lenexux on your graph plus the document: concentration points, single-person dependency, diverging criticality.')}>
          {a.findings.length === 0
            ? <Empty>{t('Aucun point de concentration ni dépendance à une seule personne détecté dans ce que le document relie.', 'No concentration point or single-person dependency found in what the document links.')}</Empty>
            : a.findings.map((f, i) => <FindingCard key={i} f={f} t={t} />)}
        </Panel>
        <Panel icon={<ShieldAlert size={14} />} title={t('Risques cités par le document', 'Risks cited by the document')}
          hint={t('Relevés par l’IA dans le texte, chacun avec sa citation.', 'Found by the AI in the text, each with its quote.')}>
          {a.risks.length === 0 ? <Empty>{t('Le document ne décrit pas de risque explicite.', 'The document describes no explicit risk.')}</Empty> : a.risks.map((r, i) => <RiskCard key={i} r={r} t={t} />)}
        </Panel>
      </div>

      {/* Proposition pour le graphe */}
      <div className="flex flex-col gap-3 rounded-sm border p-4" style={{ background: 'var(--nx-surface-container)', borderColor: 'color-mix(in srgb, var(--nx-cyan) 30%, transparent)' }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2" style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: CYAN_T }}><GitMerge size={14} /> {t('Proposition pour votre graphe', 'Proposal for your graph')}</span>
          <div className="flex rounded-sm border" style={{ borderColor: 'var(--nx-border)' }}>
            {([['all', t('Tout', 'All')], ['new', t('Nouveaux', 'New')], ['existing', t('Déjà présents', 'Already present')]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} className="px-2.5 py-1" style={{ fontSize: 12, background: filter === k ? 'var(--nx-surface-high)' : 'transparent', color: filter === k ? 'var(--nx-text)' : 'var(--nx-text-muted)' }}>{l}</button>
            ))}
          </div>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--nx-text-muted)' }}>
          {t('Cochez ce qui doit entrer dans le graphe. Un élément déjà présent n’est jamais recréé : les liens s’y rattachent. Les liens ajoutés restent « Suggéré par IA » jusqu’à leur validation dans ', 'Tick what should enter the graph. An element already present is never recreated: links attach to it. Added links stay ‘AI Suggested’ until validated in ')}
          <Link to="/audit" style={{ color: CYAN_T }}>{t('Confiance & audit', 'Confidence & Audit')}</Link>.
        </p>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <ListHead label={t('Éléments', 'Elements')} count={entities.length}
              onAll={() => setSelEntities(new Set([...selEntities, ...entities.filter((e) => e.status === 'new').map((e) => e.name)]))}
              onNone={() => { const n = new Set(selEntities); entities.forEach((e) => n.delete(e.name)); setSelEntities(n) }} t={t} />
            <div className="flex max-h-[460px] flex-col gap-1 overflow-y-auto pr-1">
              {entities.map((e) => <EntityRow key={e.name} e={e} t={t} checked={selEntities.has(e.name)} implied={newEndpoints.has(e.name)} onToggle={() => toggle(selEntities, e.name, setSelEntities)} />)}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <ListHead label={t('Liens', 'Links')} count={relations.length}
              onAll={() => setSelRelations(new Set([...selRelations, ...relations.filter((r) => r.status === 'new').map(relKey)]))}
              onNone={() => { const n = new Set(selRelations); relations.forEach((r) => n.delete(relKey(r))); setSelRelations(n) }} t={t} />
            <div className="flex max-h-[460px] flex-col gap-1 overflow-y-auto pr-1">
              {relations.length === 0 && <Empty>{t('Aucun lien dans ce filtre.', 'No link in this filter.')}</Empty>}
              {relations.map((r) => <RelationRow key={relKey(r)} r={r} t={t} checked={selRelations.has(relKey(r))} onToggle={() => toggle(selRelations, relKey(r), setSelRelations)} />)}
            </div>
          </div>
        </div>

        {props.ingestRes ? (
          <div className="flex items-start gap-2 rounded-sm p-3" style={{ background: 'color-mix(in srgb, var(--nx-success) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--nx-success) 30%, transparent)' }}>
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--nx-success)' }} />
            <span style={{ fontSize: 13, color: 'var(--nx-text)' }}>
              {t(`${props.ingestRes.entitiesCreated} élément(s) créé(s), ${props.ingestRes.entitiesLinked ?? 0} rattaché(s) à l’existant, ${props.ingestRes.relationsCreated} lien(s) ajouté(s) en « Suggéré par IA »`,
                `${props.ingestRes.entitiesCreated} element(s) created, ${props.ingestRes.entitiesLinked ?? 0} matched to existing, ${props.ingestRes.relationsCreated} link(s) added as ‘AI Suggested’`)}
              {(props.ingestRes.relationsExisting ?? 0) > 0 && t(`, ${props.ingestRes.relationsExisting} déjà présent(s) et non dupliqué(s)`, `, ${props.ingestRes.relationsExisting} already present and not duplicated`)}
              {props.ingestRes.unresolved > 0 && t(`, ${props.ingestRes.unresolved} non résolu(s)`, `, ${props.ingestRes.unresolved} unresolved`)}.{' '}
              <Link to="/audit" style={{ color: CYAN_T }}>{t('Les valider', 'Validate them')} <ArrowRight size={12} className="inline" /></Link>
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={props.onIngest} disabled={props.ingesting || (toAdd === 0 && pickedRelations.length === 0)}
              className="flex items-center gap-2 rounded-sm px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50" style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontSize: 13, fontWeight: 600 }}>
              {props.ingesting ? <Loader2 size={15} className="animate-spin" /> : <GitMerge size={15} />}
              {t(`Ajouter ${toAdd} élément(s) et ${pickedRelations.length} lien(s) au graphe`, `Add ${toAdd} element(s) and ${pickedRelations.length} link(s) to the graph`)}
            </button>
            {newEndpoints.size > 0 && <span style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>{t(`dont ${newEndpoints.size} ajouté(s) d’office, car un lien coché y mène`, `including ${newEndpoints.size} added because a ticked link leads to them`)}</span>}
            <span className="ml-auto" style={{ fontSize: 11.5, color: 'var(--nx-text-muted)', fontFamily: mono }}>{lang === 'fr' ? 'Rien n’est écrit sans votre confirmation.' : 'Nothing is written without your confirmation.'}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function Tile({ label, value, sub, warn }: { label: string; value: number | string; sub: string; warn?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-sm border p-3" style={{ background: 'var(--nx-surface-container)', borderColor: warn ? 'color-mix(in srgb, var(--nx-warning) 45%, transparent)' : 'var(--nx-border)' }}>
      <span style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{label}</span>
      <span style={{ fontFamily: geist, fontSize: 26, fontWeight: 600, color: 'var(--nx-text)', lineHeight: 1.1 }}>{value}</span>
      <span style={{ fontSize: 11.5, color: warn ? 'var(--nx-warning)' : 'var(--nx-text-muted)' }}>{sub}</span>
    </div>
  )
}

function Panel({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-sm border p-4" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
      <span className="flex items-center gap-2" style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text)' }}>{icon} {title}</span>
      <span style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>{hint}</span>
      <div className="flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1">{children}</div>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-sm p-3 text-center" style={{ fontSize: 12.5, color: 'var(--nx-text-muted)', background: 'var(--nx-panel)' }}>{children}</div>
}

function SevChip({ s, t }: { s: string; t: T }) {
  const v = SEV[s] ?? SEV.medium
  return <span className="shrink-0 rounded px-1.5 py-0.5" style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: v.color, background: `color-mix(in srgb, ${v.color} 12%, transparent)` }}>{t(v.fr, v.en)}</span>
}

function FindingCard({ f, t }: { f: DocumentFinding; t: T }) {
  const Icon = f.kind === 'key-person' ? UserRound : f.kind === 'concentration' ? Waypoints : Info
  return (
    <div className="flex flex-col gap-1 rounded-sm p-3" style={{ background: 'var(--nx-panel)', border: '1px solid var(--nx-border)', borderLeft: `3px solid ${(SEV[f.severity] ?? SEV.medium).color}` }}>
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-start gap-1.5" style={{ fontSize: 13, fontWeight: 600, color: 'var(--nx-text)' }}><Icon size={14} className="mt-0.5 shrink-0" /> {f.title}</span>
        <SevChip s={f.severity} t={t} />
      </div>
      <span style={{ fontSize: 12.5, color: 'var(--nx-text-muted)', lineHeight: 1.5 }}>{f.detail}</span>
    </div>
  )
}

function RiskCard({ r, t }: { r: DocumentRisk; t: T }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-sm p-3" style={{ background: 'var(--nx-panel)', border: '1px solid var(--nx-border)' }}>
      <div className="flex items-start justify-between gap-2">
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--nx-text)' }}>{r.title}</span>
        <SevChip s={r.severity} t={t} />
      </div>
      {r.detail && r.detail !== r.title && <span style={{ fontSize: 12.5, color: 'var(--nx-text-muted)', lineHeight: 1.5 }}>{r.detail}</span>}
      {r.evidence && <span className="border-l-2 pl-2" style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--nx-text-muted)', borderColor: 'var(--nx-border)' }}>« {r.evidence} »</span>}
      {r.entities.length > 0 && (
        <div className="flex flex-wrap gap-1">{r.entities.map((e) => <span key={e} className="rounded px-1.5 py-0.5" style={{ fontFamily: mono, fontSize: 10.5, color: CYAN_T, background: 'color-mix(in srgb, var(--nx-cyan) 8%, transparent)' }}>{e}</span>)}</div>
      )}
    </div>
  )
}

function ListHead({ label, count, onAll, onNone, t }: { label: string; count: number; onAll: () => void; onNone: () => void; t: T }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{label} ({count})</span>
      <span className="flex gap-3" style={{ fontSize: 11.5 }}>
        <button onClick={onAll} style={{ color: CYAN_T }}>{t('cocher les nouveaux', 'tick new ones')}</button>
        <button onClick={onNone} style={{ color: 'var(--nx-text-muted)' }}>{t('tout décocher', 'untick all')}</button>
      </span>
    </div>
  )
}

function StatusBadge({ existing, matchName, name, t }: { existing: boolean; matchName?: string | null; name: string; t: T }) {
  return existing
    ? <span className="shrink-0 rounded px-1.5 py-0.5" title={matchName ?? ''} style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-success)', background: 'color-mix(in srgb, var(--nx-success) 10%, transparent)' }}>{matchName && matchName !== name ? `${t('déjà présent', 'present')} : ${matchName}` : t('déjà présent', 'present')}</span>
    : <span className="shrink-0 rounded px-1.5 py-0.5" style={{ fontFamily: mono, fontSize: 10, color: CYAN_T, background: 'color-mix(in srgb, var(--nx-cyan) 10%, transparent)' }}>{t('nouveau', 'new')}</span>
}

function EntityRow({ e, t, checked, implied, onToggle }: { e: CandidateEntity; t: T; checked: boolean; implied: boolean; onToggle: () => void }) {
  const existing = e.status === 'existing'
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-sm p-2" style={{ background: 'var(--nx-panel)', border: '1px solid var(--nx-border)', opacity: existing ? 0.85 : 1 }}>
      <input type="checkbox" checked={checked || implied} disabled={existing || implied} onChange={onToggle} className="mt-0.5" style={{ accentColor: 'var(--nx-cyan)' }} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-1.5">
          <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--nx-text)' }}>{e.name}</span>
          <StatusBadge existing={existing} matchName={e.matchName} name={e.name} t={t} />
        </span>
        <span style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--nx-text-muted)' }}>
          {entityTypeLabel(e.type, t)} · {t('criticité', 'criticality')} {e.criticality}
          {existing && e.graphCriticality != null && e.graphCriticality !== e.criticality && ` (${t('graphe', 'graph')} ${e.graphCriticality})`}
          {e.aliases.length > 0 && ` · ${e.aliases.slice(0, 3).join(', ')}`}
        </span>
      </span>
    </label>
  )
}

function RelationRow({ r, t, checked, onToggle }: { r: CandidateRelation; t: T; checked: boolean; onToggle: () => void }) {
  const existing = r.status === 'existing'
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-sm p-2" style={{ background: 'var(--nx-panel)', border: '1px solid var(--nx-border)', opacity: existing ? 0.85 : 1 }}>
      <input type="checkbox" checked={checked} disabled={existing} onChange={onToggle} className="mt-0.5" style={{ accentColor: 'var(--nx-cyan)' }} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-1.5" style={{ fontSize: 12 }}>
          <span style={{ color: 'var(--nx-text)' }}>{r.source}</span>
          <span className="rounded px-1 py-px" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)', background: 'var(--nx-surface-high)' }}>{relationTypeLabel(r.relationType, t)}</span>
          <span style={{ color: 'var(--nx-text)' }}>{r.target}</span>
          <span className="ml-auto flex items-center gap-1.5">
            {existing && <StatusBadge existing matchName={null} name="" t={t} />}
            <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-warning)' }}>{Math.round(r.confidence * 100)} %</span>
          </span>
        </span>
        {r.evidence && <span className="truncate" title={r.evidence} style={{ fontSize: 11.5, fontStyle: 'italic', color: 'var(--nx-text-muted)' }}>« {r.evidence} »</span>}
      </span>
    </label>
  )
}
