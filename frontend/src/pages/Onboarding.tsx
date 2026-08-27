import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Database, FileUp, GitBranch, Loader2, Upload } from 'lucide-react'
import { api } from '../lib/api'
import type { ImportResult } from '../lib/types'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'

type Kind = 'nodes' | 'edges'

const PRESETS: Record<Kind, { title: string; icon: typeof Database; columns: string; sample: string; build: (ds: string) => object }> = {
  nodes: {
    title: 'Systems & Assets',
    icon: Database,
    columns: 'name, type, criticality',
    sample: 'name,type,criticality\nPaymentAPI,Application,88\nRedisCache,Server,70',
    build: (ds) => ({
      sourceSystem: 'CSV Upload',
      entities: [{ dataset: ds, entityType: 'Asset', nameColumn: 'name', criticalityColumn: 'criticality', entityTypeColumn: 'type' }],
      relations: [],
    }),
  },
  edges: {
    title: 'Dependencies',
    icon: GitBranch,
    columns: 'source, source_type, target, target_type, confidence',
    sample: 'source,source_type,target,target_type,confidence\nPaymentAPI,Application,RedisCache,Server,0.95',
    build: (ds) => ({
      sourceSystem: 'CSV Upload',
      entities: [
        { dataset: ds, entityType: 'Asset', nameColumn: 'source', entityTypeColumn: 'source_type' },
        { dataset: ds, entityType: 'Asset', nameColumn: 'target', entityTypeColumn: 'target_type' },
      ],
      relations: [{
        dataset: ds, relationType: 'DependsOn', sourceEntityType: 'Asset', sourceNameColumn: 'source',
        targetEntityType: 'Asset', targetNameColumn: 'target', sourceTypeColumn: 'source_type',
        targetTypeColumn: 'target_type', confidenceColumn: 'confidence', defaultConfidence: 0.9,
      }],
    }),
  },
}

export function Onboarding() {
  const qc = useQueryClient()
  const [kind, setKind] = useState<Kind>('nodes')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function onFile(file: File) {
    setBusy(true); setErr(null); setResult(null); setFileName(file.name)
    try {
      const ds = file.name.replace(/\.[^.]+$/, '')
      const profile = JSON.stringify(PRESETS[kind].build(ds))
      const res = await api.importCsv(file, file.name, profile)
      setResult(res)
      // Rafraichit tous les ecrans data-driven.
      qc.invalidateQueries()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-2" style={{ fontFamily: geist, fontSize: 24, color: 'var(--nx-text)' }}>
          <Upload size={22} style={{ color: CYAN }} /> Data Onboarding
        </h2>
        <p className="mt-1" style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>Ingest your estate into the graph — time to first graph is minutes, not months.</p>
      </div>

      {/* Choix du type de donnee */}
      <div className="grid gap-3 md:grid-cols-2">
        {(Object.keys(PRESETS) as Kind[]).map((k) => {
          const p = PRESETS[k]; const active = kind === k
          return (
            <button key={k} onClick={() => { setKind(k); setResult(null); setErr(null) }} className="flex flex-col gap-2 rounded-sm border p-4 text-left" style={{ background: active ? 'rgba(0,229,255,0.06)' : 'var(--nx-surface-container)', borderColor: active ? CYAN : 'var(--nx-border)' }}>
              <div className="flex items-center gap-2" style={{ color: active ? CYAN_T : 'var(--nx-text)' }}><p.icon size={18} /> <span style={{ fontFamily: geist, fontSize: 16 }}>{p.title}</span></div>
              <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>columns: {p.columns}</div>
              <pre className="mt-1 overflow-x-auto rounded-sm p-2" style={{ background: 'var(--nx-panel)', border: '1px solid var(--nx-border)', fontFamily: mono, fontSize: 10.5, color: 'var(--nx-text-muted)' }}>{p.sample}</pre>
            </button>
          )
        })}
      </div>

      {/* Zone de depot */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f) }}
        onClick={() => inputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-sm border-2 border-dashed py-10"
        style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}
      >
        {busy ? <Loader2 size={28} className="animate-spin" style={{ color: CYAN }} /> : <FileUp size={28} style={{ color: CYAN }} />}
        <span style={{ fontSize: 14, color: 'var(--nx-text)' }}>{busy ? 'Ingesting…' : 'Drop a CSV here or click to browse'}</span>
        <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>Profile: {PRESETS[kind].title} · dataset = filename</span>
        <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
      </div>

      {err && <div className="rounded-sm p-3" style={{ background: 'rgba(255,180,171,0.1)', border: '1px solid #ffb4ab40', color: '#ffb4ab', fontFamily: mono, fontSize: 12 }}>{err}</div>}

      {result && (
        <div className="rounded-sm border" style={{ borderColor: '#4ade8055' }}>
          <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: 'var(--nx-border)', background: 'rgba(74,222,128,0.06)' }}>
            <CheckCircle2 size={16} style={{ color: '#4ade80' }} />
            <span style={{ fontFamily: mono, fontSize: 12, color: '#4ade80', textTransform: 'uppercase' }}>Ingested {fileName}</span>
          </div>
          <div className="grid grid-cols-2 gap-px sm:grid-cols-4" style={{ background: 'var(--nx-border)' }}>
            <Metric label="RECORDS READ" value={result.recordsRead} />
            <Metric label="ENTITIES CREATED" value={result.entitiesCreated} color={CYAN_T} />
            <Metric label="ENTITIES MATCHED" value={result.entitiesMatched} />
            <Metric label="RELATIONS CREATED" value={result.relationsCreated} color={CYAN_T} />
            <Metric label="RELATIONS UNRESOLVED" value={result.relationsUnresolved} color={result.relationsUnresolved > 0 ? '#facc15' : undefined} />
            <Metric label="SKIPPED" value={result.skipped} />
            <MetricText label="DURATION" value={result.duration} />
            <MetricText label="TIME TO FIRST GRAPH" value={result.timeToFirstGraph ?? '—'} />
          </div>
          <div className="px-4 py-3" style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>Graph refreshed across all centers. Explore it in the Graph and Digital Twin views.</div>
        </div>
      )}
    </div>
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
