import { useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, Database, FileUp, GitBranch, Loader2, Sheet, Sparkles, Upload, Wand2 } from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import { CONNECTORS } from '../lib/connectors'
import { RestLiveImport } from '../components/RestLiveImport'
import type { FilePreview, ImportResult } from '../lib/types'

const EXCEL = /\.(xlsx|xlsm)$/i

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'

type Mode = 'nodes' | 'edges' | 'auto'
const RELATION_TYPES = ['DEPENDS_ON', 'RUNS_ON', 'USES', 'SUPPLIED_BY', 'AUTHENTICATES', 'KNOWS', 'MAINTAINS', 'HOSTS', 'CONNECTS_TO', 'STORES', 'PROTECTS']

const PRESETS: Record<'nodes' | 'edges', { columns: string; sample: string; build: (ds: string) => object }> = {
  nodes: {
    columns: 'name, type, criticality, costPerHour (optionnel)',
    sample: 'name,type,criticality,costPerHour\nPaymentAPI,Application,88,25000\nRedisCache,Server,70,8000',
    build: (ds) => ({ sourceSystem: 'CSV Upload', entities: [{ dataset: ds, entityType: 'Asset', nameColumn: 'name', criticalityColumn: 'criticality', entityTypeColumn: 'type', costPerHourColumn: 'costPerHour' }], relations: [] }),
  },
  edges: {
    columns: 'source, source_type, target, target_type, confidence',
    sample: 'source,source_type,target,target_type,confidence\nPaymentAPI,Application,RedisCache,Server,0.95',
    build: (ds) => ({
      sourceSystem: 'CSV Upload',
      entities: [
        { dataset: ds, entityType: 'Asset', nameColumn: 'source', entityTypeColumn: 'source_type' },
        { dataset: ds, entityType: 'Asset', nameColumn: 'target', entityTypeColumn: 'target_type' },
      ],
      relations: [{ dataset: ds, relationType: 'DEPENDS_ON', sourceEntityType: 'Asset', sourceNameColumn: 'source', targetEntityType: 'Asset', targetNameColumn: 'target', sourceTypeColumn: 'source_type', targetTypeColumn: 'target_type', confidenceColumn: 'confidence', defaultConfidence: 0.9 }],
    }),
  },
}

// Heuristique de mapping (remplacée par Claude quand une clé est configurée).
function guess(headers: string[], re: RegExp): string {
  return headers.find((h) => re.test(h)) ?? ''
}
type AutoMap = { kind: 'entities' | 'relations'; name: string; type: string; crit: string; cost: string; source: string; sourceType: string; target: string; targetType: string; relation: string; confidence: string; defaultType?: string }
function autoDetect(headers: string[]): AutoMap {
  const source = guess(headers, /source|from|src|parent|depend.*on|upstream/i)
  const target = guess(headers, /target|to\b|dest|child|downstream/i)
  const isRel = !!(source && target)
  return {
    kind: isRel ? 'relations' : 'entities',
    name: guess(headers, /name|nom|asset|system|hostname|\bci\b|label/i) || headers[0] || '',
    type: guess(headers, /type|category|kind|class|categorie/i),
    crit: guess(headers, /crit|prior|import|sever|weight/i),
    cost: guess(headers, /cost.?per.?hour|cost.?hour|hourly.?cost|downtime.?cost|co[uû]t.?heure|co[uû]t.?h|\bcostperhour\b/i),
    source, target,
    sourceType: guess(headers, /source.?type|from.?type|src.?type/i),
    targetType: guess(headers, /target.?type|to.?type|dest.?type/i),
    relation: 'DEPENDS_ON',
    confidence: guess(headers, /conf|score|weight|proba/i),
  }
}
function buildAutoProfile(ds: string, m: AutoMap): object {
  const et = m.defaultType || 'Asset'
  if (m.kind === 'entities') {
    return {
      sourceSystem: 'CSV Upload',
      entities: [{ dataset: ds, entityType: et, nameColumn: m.name, ...(m.type ? { entityTypeColumn: m.type } : {}), ...(m.crit ? { criticalityColumn: m.crit } : {}), ...(m.cost ? { costPerHourColumn: m.cost } : {}) }],
      relations: [],
    }
  }
  return {
    sourceSystem: 'CSV Upload',
    entities: [
      { dataset: ds, entityType: et, nameColumn: m.source, ...(m.sourceType ? { entityTypeColumn: m.sourceType } : {}) },
      { dataset: ds, entityType: et, nameColumn: m.target, ...(m.targetType ? { entityTypeColumn: m.targetType } : {}) },
    ],
    relations: [{
      dataset: ds, relationType: m.relation, sourceEntityType: 'Asset', sourceNameColumn: m.source,
      targetEntityType: 'Asset', targetNameColumn: m.target,
      ...(m.sourceType ? { sourceTypeColumn: m.sourceType } : {}), ...(m.targetType ? { targetTypeColumn: m.targetType } : {}),
      ...(m.confidence ? { confidenceColumn: m.confidence } : {}), defaultConfidence: 0.9,
    }],
  }
}

export function Onboarding() {
  const { t } = useLang()
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const connector = useMemo(() => CONNECTORS.find((c) => c.id === params.get('connector')), [params])
  const [mode, setMode] = useState<Mode>('nodes')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  // Fichier en attente : mapping (mode auto) ou choix de feuille (Excel) à confirmer.
  const [pending, setPending] = useState<{ file: File; headers: string[]; sample: string } | null>(null)
  const [sheets, setSheets] = useState<FilePreview['datasets'] | null>(null)
  const [sheet, setSheet] = useState<string | null>(null)
  const [map, setMap] = useState<AutoMap | null>(null)
  const [aiUsed, setAiUsed] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const modeTitle = (m: Mode) => m === 'nodes' ? t('Systèmes & actifs', 'Systems & Assets') : m === 'edges' ? t('Dépendances', 'Dependencies') : t('Auto / IA — tout fichier', 'Auto / AI — any file')

  async function runImport(file: File, profileObj: object) {
    setBusy(true); setErr(null); setResult(null); setFileName(file.name)
    try {
      // Excel et CSV suivent le MÊME pipeline ; seul le lecteur de fichier change.
      const res = EXCEL.test(file.name)
        ? await api.importExcel(file, file.name, JSON.stringify(profileObj))
        : await api.importCsv(file, file.name, JSON.stringify(profileObj))
      setResult(res); setPending(null); setMap(null)
      qc.invalidateQueries()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  /** Analyse IA du mapping sur un échantillon (sinon l'heuristique suffit). */
  async function analyzeSample(sample: string, headers: string[]) {
    setAnalyzing(true)
    try {
      const r = await api.analyzeImport(sample)
      if (r.usedAi && r.mapping) {
        const m = r.mapping
        setMap({ kind: m.kind, name: m.name, type: m.type, crit: m.crit, cost: autoDetect(headers).cost, source: m.source, sourceType: m.sourceType, target: m.target, targetType: m.targetType, relation: m.relation || 'DEPENDS_ON', confidence: m.confidence, defaultType: m.defaultEntityType })
        setAiUsed(true)
      }
    } catch { /* on garde l'heuristique */ } finally { setAnalyzing(false) }
  }

  async function onFile(file: File) {
    setErr(null); setResult(null); setSheets(null); setSheet(null)

    // Excel : les colonnes ne se lisent pas dans le navigateur, et le jeu de
    // données porte le nom de la FEUILLE. Le serveur les découvre d'abord.
    if (EXCEL.test(file.name)) {
      setBusy(true)
      try {
        const preview = await api.previewFile(file)
        const first = preview.datasets[0]
        if (!first) { setErr(t('Ce classeur ne contient aucune feuille lisible.', 'This workbook has no readable sheet.')); return }
        setSheets(preview.datasets); setSheet(first.name)
        setPending({ file, headers: first.columns, sample: first.sample })
        setMap(autoDetect(first.columns)); setAiUsed(false)
        void analyzeSample(first.sample, first.columns)
      } catch (e) {
        const code = e instanceof Error ? e.message : ''
        setErr(code === 'legacy_xls'
          ? t('Ancien format Excel (.xls) : enregistrez le classeur au format .xlsx.', 'Legacy Excel format (.xls): save the workbook as .xlsx.')
          : t('Lecture du classeur impossible.', 'Could not read the workbook.'))
      } finally { setBusy(false) }
      return
    }

    if (mode === 'auto') {
      // Lit l'entête réel du fichier ; propose un mapping (IA si clé, sinon heuristique).
      const text = await file.text()
      const lines = text.split(/\r?\n/)
      const headers = (lines[0] ?? '').trim().split(',').map((h) => h.trim()).filter(Boolean)
      const sample = lines.slice(0, 15).join('\n')
      setPending({ file, headers, sample })
      setMap(autoDetect(headers)); setAiUsed(false)   // heuristique immédiate
      void analyzeSample(sample, headers)             // puis l'IA, si une clé existe
      return
    }
    const ds = file.name.replace(/\.[^.]+$/, '')
    runImport(file, PRESETS[mode].build(ds))
  }

  /** Jeu de données : la feuille choisie pour un classeur, le nom du fichier sinon. */
  function datasetName(file: File) {
    return sheet ?? file.name.replace(/\.[^.]+$/, '')
  }

  function confirmAuto() {
    if (!pending || !map) return
    runImport(pending.file, buildAutoProfile(datasetName(pending.file), map))
  }

  /** Changement de feuille : colonnes, mapping et échantillon suivent. */
  function pickSheet(name: string) {
    const d = sheets?.find((x) => x.name === name)
    if (!d || !pending) return
    setSheet(name)
    setPending({ ...pending, headers: d.columns, sample: d.sample })
    setMap(autoDetect(d.columns)); setAiUsed(false)
    void analyzeSample(d.sample, d.columns)
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-2" style={{ fontFamily: geist, fontSize: 24, color: 'var(--nx-text)' }}>
          <Upload size={22} style={{ color: CYAN }} /> {t('Intégration des données', 'Data Onboarding')}
        </h2>
        <p className="mt-1" style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>{t('Injectez votre parc dans le graphe — le premier graphe se mesure en minutes, pas en mois.', 'Ingest your estate into the graph — time to first graph is minutes, not months.')}</p>
      </div>

      {connector && (
        <div className="rounded-sm border px-4 py-3" style={{ background: 'color-mix(in srgb, var(--nx-cyan) 6%, transparent)', borderColor: 'color-mix(in srgb, var(--nx-cyan) 30%, transparent)' }}>
          <span style={{ fontFamily: mono, fontSize: 12, color: CYAN_T }}>{connector.name}</span>
          <p className="mt-0.5" style={{ fontSize: 12.5, color: 'var(--nx-text-muted)' }}>{t(`Exportez depuis ${connector.name} (${connector.bringsFr}) en CSV, puis déposez-le ci-dessous. Utilisez le mode Auto/IA si vos colonnes diffèrent.`, `Export from ${connector.name} (${connector.bringsEn}) as CSV, then drop it below. Use Auto/AI mode if your columns differ.`)}</p>
        </div>
      )}

      {/* Choix du mode */}
      <div className="grid gap-3 md:grid-cols-3">
        <ModeTile icon={Database} active={mode === 'nodes'} title={modeTitle('nodes')} sub="name, type, criticality" onClick={() => { setMode('nodes'); setPending(null); setResult(null) }} />
        <ModeTile icon={GitBranch} active={mode === 'edges'} title={modeTitle('edges')} sub="source, target, confidence" onClick={() => { setMode('edges'); setPending(null); setResult(null) }} />
        <ModeTile icon={Wand2} active={mode === 'auto'} title={modeTitle('auto')} sub={t('colonnes libres — détectées', 'free columns — detected')} onClick={() => { setMode('auto'); setPending(null); setResult(null) }} highlight />
      </div>

      {/* Zone de dépôt */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f) }}
        onClick={() => inputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-sm border-2 border-dashed py-10"
        style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}
      >
        {busy ? <Loader2 size={28} className="animate-spin" style={{ color: CYAN }} /> : mode === 'auto' ? <Wand2 size={28} style={{ color: CYAN }} /> : <FileUp size={28} style={{ color: CYAN }} />}
        <span style={{ fontSize: 14, color: 'var(--nx-text)' }}>{busy ? t('Ingestion…', 'Ingesting…') : t('Déposez un fichier CSV ou Excel ici, ou cliquez pour parcourir', 'Drop a CSV or Excel file here, or click to browse')}</span>
        <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>{t('Mode', 'Mode')}: {modeTitle(mode)}</span>
        <input ref={inputRef} type="file" accept=".csv,.tsv,.xlsx,.xlsm,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = '' }} />
      </div>

      {/* Classeur Excel : choix de la feuille */}
      {sheets && pending && (
        <div className="flex flex-col gap-3 rounded-sm border p-4" style={{ background: 'var(--nx-surface-container)', borderColor: 'color-mix(in srgb, var(--nx-cyan) 30%, transparent)' }}>
          <div className="flex flex-wrap items-center gap-2" style={{ fontFamily: mono, fontSize: 12, color: CYAN_T }}>
            <Sheet size={14} /> {pending.file.name} · {sheets.length} {t('feuille(s)', 'sheet(s)')}
          </div>
          <div className="flex flex-wrap gap-2">
            {sheets.map((d) => (
              <button key={d.name} onClick={() => pickSheet(d.name)} className="rounded-sm border px-3 py-1.5 text-left"
                style={{ borderColor: sheet === d.name ? CYAN : 'var(--nx-border)', background: sheet === d.name ? 'color-mix(in srgb, var(--nx-cyan) 8%, transparent)' : 'var(--nx-panel)' }}>
                <span style={{ fontSize: 12.5, color: 'var(--nx-text)' }}>{d.name}</span>
                <span className="ml-2" style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--nx-text-muted)' }}>{d.columns.length} {t('col.', 'cols')} · {d.rows} {t('lignes', 'rows')}</span>
              </button>
            ))}
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--nx-text-muted)' }}>
            {t('Choisissez la feuille à importer : ses colonnes sont reconnues ci-dessous, quel que soit leur intitulé.',
              'Choose the sheet to import: its columns are recognised below, whatever they are called.')}
          </p>
        </div>
      )}

      {/* Mode preset : aperçu du format attendu */}
      {mode !== 'auto' && (
        <pre className="overflow-x-auto rounded-sm border p-3" style={{ background: 'var(--nx-panel)', borderColor: 'var(--nx-border)', fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>{PRESETS[mode].sample}</pre>
      )}

      {/* Mapping détecté à valider : mode auto, et tout classeur Excel */}
      {(mode === 'auto' || sheets) && pending && map && (
        <div className="rounded-sm border p-4" style={{ background: 'var(--nx-surface-container)', borderColor: 'color-mix(in srgb, var(--nx-cyan) 30%, transparent)' }}>
          <div className="mb-3 flex flex-wrap items-center gap-2" style={{ fontFamily: mono, fontSize: 12, color: CYAN_T }}>
            <Sparkles size={14} /> {t('Mapping détecté', 'Detected mapping')} · {pending.file.name} · {pending.headers.length} {t('colonnes', 'columns')}
            {analyzing
              ? <span className="flex items-center gap-1 rounded px-2 py-0.5" style={{ fontSize: 10, color: 'var(--nx-text-muted)', background: 'var(--nx-surface)' }}><Loader2 size={10} className="animate-spin" /> {t('analyse IA…', 'AI analysis…')}</span>
              : <span className="rounded px-2 py-0.5" style={{ fontSize: 10, color: aiUsed ? 'var(--nx-success)' : 'var(--nx-text-muted)', background: aiUsed ? 'color-mix(in srgb, var(--nx-success) 12%, transparent)' : 'var(--nx-surface)' }}>{aiUsed ? t('classé par IA', 'AI-classified') : t('heuristique', 'heuristic')}</span>}
          </div>
          <div className="mb-3 flex gap-2">
            {(['entities', 'relations'] as const).map((k) => (
              <button key={k} onClick={() => setMap({ ...map, kind: k })} className="rounded-sm border px-3 py-1" style={{ fontFamily: mono, fontSize: 11, borderColor: map.kind === k ? CYAN : 'var(--nx-border)', color: map.kind === k ? CYAN_T : 'var(--nx-text-muted)', background: map.kind === k ? 'color-mix(in srgb, var(--nx-cyan) 8%, transparent)' : 'transparent' }}>
                {k === 'entities' ? t('Entités', 'Entities') : t('Relations', 'Relations')}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {map.kind === 'entities' ? (
              <>
                <MapField label={t('Nom', 'Name')} value={map.name} headers={pending.headers} onChange={(v) => setMap({ ...map, name: v })} required />
                <MapField label={t('Type', 'Type')} value={map.type} headers={pending.headers} onChange={(v) => setMap({ ...map, type: v })} />
                <MapField label={t('Criticité', 'Criticality')} value={map.crit} headers={pending.headers} onChange={(v) => setMap({ ...map, crit: v })} />
                <MapField label={t('Coût d’arrêt / h', 'Downtime cost / h')} value={map.cost} headers={pending.headers} onChange={(v) => setMap({ ...map, cost: v })} />
              </>
            ) : (
              <>
                <MapField label={t('Source', 'Source')} value={map.source} headers={pending.headers} onChange={(v) => setMap({ ...map, source: v })} required />
                <MapField label={t('Cible', 'Target')} value={map.target} headers={pending.headers} onChange={(v) => setMap({ ...map, target: v })} required />
                <RelField label={t('Type de relation', 'Relation type')} value={map.relation} onChange={(v) => setMap({ ...map, relation: v })} />
                <MapField label={t('Type source', 'Source type')} value={map.sourceType} headers={pending.headers} onChange={(v) => setMap({ ...map, sourceType: v })} />
                <MapField label={t('Type cible', 'Target type')} value={map.targetType} headers={pending.headers} onChange={(v) => setMap({ ...map, targetType: v })} />
                <MapField label={t('Confiance', 'Confidence')} value={map.confidence} headers={pending.headers} onChange={(v) => setMap({ ...map, confidence: v })} />
              </>
            )}
          </div>
          <button onClick={confirmAuto} disabled={busy} className="mt-4 flex items-center justify-center gap-2 rounded-sm px-4 py-2" style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontSize: 13, fontWeight: 600 }}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {t('Importer avec ce mapping', 'Import with this mapping')}
          </button>
        </div>
      )}

      {err && <div className="rounded-sm p-3" style={{ background: 'color-mix(in srgb, var(--nx-danger) 10%, transparent)', border: '1px solid #ffb4ab40', color: 'var(--nx-danger)', fontFamily: mono, fontSize: 12 }}>{err}</div>}

      {result && (
        <div className="rounded-sm border" style={{ borderColor: '#4ade8055' }}>
          <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: 'var(--nx-border)', background: 'color-mix(in srgb, var(--nx-success) 6%, transparent)' }}>
            <CheckCircle2 size={16} style={{ color: 'var(--nx-success)' }} />
            <span style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-success)', textTransform: 'uppercase' }}>{t('Ingéré', 'Ingested')} {fileName}</span>
          </div>
          <div className="grid grid-cols-2 gap-px sm:grid-cols-4" style={{ background: 'var(--nx-border)' }}>
            <Metric label={t('LIGNES LUES', 'RECORDS READ')} value={result.recordsRead} />
            <Metric label={t('ENTITÉS CRÉÉES', 'ENTITIES CREATED')} value={result.entitiesCreated} color={CYAN_T} />
            <Metric label={t('ENTITÉS APPARIÉES', 'ENTITIES MATCHED')} value={result.entitiesMatched} />
            <Metric label={t('RELATIONS CRÉÉES', 'RELATIONS CREATED')} value={result.relationsCreated} color={CYAN_T} />
            <Metric label={t('RELATIONS NON RÉSOLUES', 'RELATIONS UNRESOLVED')} value={result.relationsUnresolved} color={result.relationsUnresolved > 0 ? 'var(--nx-warning)' : undefined} />
            <Metric label={t('IGNORÉES', 'SKIPPED')} value={result.skipped} color={result.skipped > 0 ? 'var(--nx-warning)' : undefined} />
            <MetricText label={t('DURÉE', 'DURATION')} value={result.duration} />
            <MetricText label={t('DÉLAI 1ER GRAPHE', 'TIME TO FIRST GRAPH')} value={result.timeToFirstGraph ?? '—'} />
          </div>
          <div className="px-4 py-3" style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>{t('Graphe rafraîchi dans tous les centres. Explorez-le dans les vues Graphe et Jumeau numérique.', 'Graph refreshed across all centers. Explore it in the Graph and Digital Twin views.')}</div>
        </div>
      )}

      <RestLiveImport />
    </div>
  )
}

function ModeTile({ icon: Icon, active, title, sub, onClick, highlight }: { icon: typeof Database; active: boolean; title: string; sub: string; onClick: () => void; highlight?: boolean }) {
  return (
    <button onClick={onClick} className="flex flex-col gap-1 rounded-sm border p-4 text-left" style={{ background: active ? 'color-mix(in srgb, var(--nx-cyan) 6%, transparent)' : 'var(--nx-surface-container)', borderColor: active ? CYAN : highlight ? 'color-mix(in srgb, var(--nx-cyan) 30%, transparent)' : 'var(--nx-border)' }}>
      <div className="flex items-center gap-2" style={{ color: active ? CYAN_T : 'var(--nx-text)' }}><Icon size={18} /> <span style={{ fontFamily: geist, fontSize: 15 }}>{title}</span></div>
      <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{sub}</span>
    </button>
  )
}

function MapField({ label, value, headers, onChange, required }: { label: string; value: string; headers: string[]; onChange: (v: string) => void; required?: boolean }) {
  return (
    <label className="flex flex-col gap-1">
      <span style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: required && !value ? 'var(--nx-danger)' : 'var(--nx-text-muted)' }}>{label}{required ? ' *' : ''}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-sm px-2 py-1.5 outline-none" style={{ background: 'var(--nx-panel)', border: '1px solid var(--nx-border)', color: 'var(--nx-text)', fontSize: 12 }}>
        <option value="">—</option>
        {headers.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
    </label>
  )
}
function RelField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-sm px-2 py-1.5 outline-none" style={{ background: 'var(--nx-panel)', border: '1px solid var(--nx-border)', color: 'var(--nx-text)', fontSize: 12 }}>
        {RELATION_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
    </label>
  )
}

function Metric({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="p-3" style={{ background: 'var(--nx-surface-container)' }}>
      <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{label}</div>
      <div style={{ fontFamily: geist, fontSize: 22, color: color ?? 'var(--nx-text)' }}>{value}</div>
    </div>
  )
}
function MetricText({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3" style={{ background: 'var(--nx-surface-container)' }}>
      <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: 14, color: 'var(--nx-text)' }}>{value}</div>
    </div>
  )
}
