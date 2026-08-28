import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, ArrowDown, ArrowUp, Boxes, Camera, History as HistoryIcon, Loader2, Minus, Network } from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import type { Snapshot } from '../lib/types'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'

export function History() {
  const { t, lang } = useLang()
  const qc = useQueryClient()
  const { data, isLoading, error } = useQuery({ queryKey: ['history'], queryFn: () => api.history(90) })
  const capture = useMutation({ mutationFn: api.captureSnapshot, onSuccess: () => qc.invalidateQueries({ queryKey: ['history'] }) })

  const snaps = data?.snapshots ?? []
  const latest = snaps[snaps.length - 1]
  const prev = snaps[snaps.length - 2]

  const fmt = (iso: string) => new Date(iso).toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', { dateStyle: 'short', timeStyle: 'short' })

  if (isLoading) return <div style={{ fontFamily: mono, color: 'var(--nx-text-muted)' }}>{t('CHARGEMENT DE L’HISTORIQUE…', 'LOADING HISTORY…')}</div>
  if (error) return <div style={{ color: '#ffb4ab' }}>{(error as Error).message}</div>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h2 className="flex items-center gap-2" style={{ fontFamily: geist, fontSize: 24, color: 'var(--nx-text)' }}>
            <HistoryIcon size={22} style={{ color: CYAN }} /> {t('Historique du jumeau numérique', 'Digital Twin History')}
          </h2>
          <p className="mt-1" style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>{t('Suivez l’évolution de la résilience dans le temps — chaque instantané est réel et horodaté.', 'Track resilience evolution over time — each snapshot is real and timestamped.')}</p>
        </div>
        <button onClick={() => capture.mutate()} disabled={capture.isPending} className="flex items-center gap-2 rounded-sm px-3 py-2" style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontSize: 13, fontWeight: 600 }}>
          {capture.isPending ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />} {t('Capturer un instantané', 'Capture snapshot')}
        </button>
      </div>

      {/* Deltas vs instantané précédent */}
      {latest && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Delta icon={Activity} label={t('SANTÉ', 'HEALTH')} value={latest.healthScore} prev={prev?.healthScore} goodUp />
          <Delta icon={Boxes} label={t('ENTITÉS', 'ENTITIES')} value={latest.entityCount} prev={prev?.entityCount} />
          <Delta icon={Network} label={t('RELATIONS', 'RELATIONS')} value={latest.relationCount} prev={prev?.relationCount} />
          <Delta icon={Activity} label={t('SPOF', 'SPOF')} value={latest.spofCount} prev={prev?.spofCount} goodUp={false} />
        </div>
      )}

      {snaps.length < 2 ? (
        <div className="rounded-sm border p-8 text-center" style={{ borderColor: 'var(--nx-border)', fontFamily: mono, fontSize: 13, color: 'var(--nx-text-muted)' }}>
          {t('Un seul point pour l’instant. Capturez des instantanés au fil du temps (ou après un import) pour voir la courbe d’évolution.', 'Only one point so far. Capture snapshots over time (or after an import) to see the evolution curve.')}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Chart title={t('Score de santé', 'Health score')} snaps={snaps} pick={(s) => s.healthScore} color="#4ade80" max={100} fmt={fmt} />
          <Chart title={t('Entités & SPOF', 'Entities & SPOF')} snaps={snaps} pick={(s) => s.entityCount} color={CYAN} secondPick={(s) => s.spofCount} secondColor="#ffb4ab" fmt={fmt} />
        </div>
      )}

      {/* Table + changements */}
      <div className="overflow-x-auto rounded-sm border" style={{ borderColor: 'var(--nx-border)' }}>
        <div className="border-b px-4 py-3" style={{ borderColor: 'var(--nx-border)' }}>
          <h3 style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text)' }}>{t('Instantanés', 'Snapshots')} · {snaps.length}</h3>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--nx-border)' }}>
              {[t('Horodatage', 'Timestamp'), t('Santé', 'Health'), t('Entités', 'Entities'), t('Relations', 'Relations'), 'SPOF', t('Changement', 'Change')].map((h, i) => (
                <th key={h} className={`px-4 py-2 ${i >= 1 && i <= 4 ? 'text-right' : ''}`} style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...snaps].reverse().map((s, i, arr) => {
              const before = arr[i + 1]
              return (
                <tr key={s.id} className="border-b" style={{ borderColor: 'var(--nx-border)' }}>
                  <td className="px-4 py-2.5" style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text)' }}>{fmt(s.capturedAt)}</td>
                  <td className="px-4 py-2.5 text-right" style={{ fontFamily: mono, fontSize: 12, color: s.healthScore >= 75 ? '#4ade80' : s.healthScore >= 50 ? '#facc15' : '#ffb4ab' }}>{s.healthScore}</td>
                  <td className="px-4 py-2.5 text-right" style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text)' }}>{s.entityCount}</td>
                  <td className="px-4 py-2.5 text-right" style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text-muted)' }}>{s.relationCount}</td>
                  <td className="px-4 py-2.5 text-right" style={{ fontFamily: mono, fontSize: 12, color: s.spofCount > 0 ? '#ffb4ab' : 'var(--nx-text-muted)' }}>{s.spofCount}</td>
                  <td className="px-4 py-2.5" style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>{before ? changeSummary(s, before, t) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function changeSummary(now: Snapshot, before: Snapshot, t: (fr: string, en: string) => string): string {
  const parts: string[] = []
  const de = now.entityCount - before.entityCount
  const dh = now.healthScore - before.healthScore
  const ds = now.spofCount - before.spofCount
  if (de) parts.push(`${de > 0 ? '+' : ''}${de} ${t('entités', 'entities')}`)
  if (dh) parts.push(`${dh > 0 ? '+' : ''}${dh} ${t('santé', 'health')}`)
  if (ds) parts.push(`${ds > 0 ? '+' : ''}${ds} SPOF`)
  return parts.length ? parts.join(' · ') : t('stable', 'stable')
}

function Delta({ icon: Icon, label, value, prev, goodUp }: { icon: typeof Activity; label: string; value: number; prev?: number; goodUp?: boolean }) {
  const d = prev == null ? 0 : value - prev
  const color = d === 0 ? 'var(--nx-text-muted)' : goodUp === undefined ? CYAN_T : (d > 0) === goodUp ? '#4ade80' : '#ffb4ab'
  const Arrow = d > 0 ? ArrowUp : d < 0 ? ArrowDown : Minus
  return (
    <div className="rounded-sm border p-3" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
      <div className="flex items-center gap-1" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}><Icon size={11} /> {label}</div>
      <div className="flex items-baseline gap-2">
        <span style={{ fontFamily: geist, fontSize: 24, fontWeight: 500, color: 'var(--nx-text)' }}>{value}</span>
        {prev != null && <span className="flex items-center gap-0.5" style={{ fontFamily: mono, fontSize: 11, color }}><Arrow size={11} /> {d === 0 ? '0' : Math.abs(d)}</span>}
      </div>
    </div>
  )
}

function Chart({ title, snaps, pick, color, secondPick, secondColor, max, fmt }: {
  title: string; snaps: Snapshot[]; pick: (s: Snapshot) => number; color: string
  secondPick?: (s: Snapshot) => number; secondColor?: string; max?: number; fmt: (s: string) => string
}) {
  const { line, dots, line2, dots2, hi } = useMemo(() => {
    const W = 100, H = 42
    const vals = snaps.map(pick)
    const vals2 = secondPick ? snaps.map(secondPick) : []
    const allMax = max ?? Math.max(1, ...vals, ...vals2)
    const n = snaps.length
    const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * W)
    const y = (v: number) => H - (v / allMax) * (H - 4) - 2
    const toLine = (arr: number[]) => arr.map((v, i) => `${x(i)},${y(v)}`).join(' ')
    const toDots = (arr: number[]) => arr.map((v, i) => ({ x: x(i), y: y(v), v }))
    return { line: toLine(vals), dots: toDots(vals), line2: secondPick ? toLine(vals2) : '', dots2: secondPick ? toDots(vals2) : [], hi: allMax }
  }, [snaps, pick, secondPick, max])

  return (
    <div className="rounded-sm border p-4" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
      <div className="mb-2 flex items-center justify-between">
        <h3 style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text)' }}>{title}</h3>
        <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>max {hi}</span>
      </div>
      <svg viewBox="0 0 100 44" preserveAspectRatio="none" className="h-40 w-full">
        {[0.25, 0.5, 0.75].map((g) => <line key={g} x1={0} y1={44 * g} x2={100} y2={44 * g} stroke="var(--nx-border)" strokeWidth={0.2} />)}
        {line2 && <polyline points={line2} fill="none" stroke={secondColor} strokeWidth={0.8} strokeDasharray="2 1" opacity={0.8} />}
        <polyline points={line} fill="none" stroke={color} strokeWidth={1} />
        {dots2.map((d, i) => <circle key={`b${i}`} cx={d.x} cy={d.y} r={0.8} fill={secondColor} />)}
        {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={1} fill={color} />)}
      </svg>
      <div className="mt-1 flex justify-between" style={{ fontFamily: mono, fontSize: 9, color: 'var(--nx-text-muted)' }}>
        <span>{snaps[0] && fmt(snaps[0].capturedAt)}</span>
        <span>{snaps.length > 1 && fmt(snaps[snaps.length - 1].capturedAt)}</span>
      </div>
    </div>
  )
}
