import { useMemo, useState } from 'react'
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
  if (error) return <div style={{ color: 'var(--nx-danger)' }}>{(error as Error).message}</div>

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
          <Chart title={t('Score de santé', 'Health score')} snaps={snaps} pick={(s) => s.healthScore} color="var(--nx-success)" max={100} fmt={fmt} />
          <Chart title={t('Entités & SPOF', 'Entities & SPOF')} snaps={snaps} pick={(s) => s.entityCount} color={CYAN} secondPick={(s) => s.spofCount} secondColor="var(--nx-danger)" fmt={fmt} />
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
                  <td className="px-4 py-2.5 text-right" style={{ fontFamily: mono, fontSize: 12, color: s.healthScore >= 75 ? 'var(--nx-success)' : s.healthScore >= 50 ? 'var(--nx-warning)' : 'var(--nx-danger)' }}>{s.healthScore}</td>
                  <td className="px-4 py-2.5 text-right" style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text)' }}>{s.entityCount}</td>
                  <td className="px-4 py-2.5 text-right" style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text-muted)' }}>{s.relationCount}</td>
                  <td className="px-4 py-2.5 text-right" style={{ fontFamily: mono, fontSize: 12, color: s.spofCount > 0 ? 'var(--nx-danger)' : 'var(--nx-text-muted)' }}>{s.spofCount}</td>
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
  const color = d === 0 ? 'var(--nx-text-muted)' : goodUp === undefined ? CYAN_T : (d > 0) === goodUp ? 'var(--nx-success)' : 'var(--nx-danger)'
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

/**
 * La courbe d'une mesure dans le temps.
 *
 * Elle etait tracee en coordonnees etirees (preserveAspectRatio="none") : les
 * points devenaient des ovales et l'epaisseur du trait changeait avec la largeur
 * de la fenetre. Surtout, rien ne distinguait le DERNIER releve, qui est
 * pourtant la seule valeur que l'on cherche en ouvrant l'ecran.
 *
 * Desormais : un aplat degrade sous la courbe pour donner le volume, la derniere
 * valeur marquee et chiffree, et le minimum comme le maximum annotes. Le survol
 * d'un releve donne sa date et sa valeur.
 */
function Chart({ title, snaps, pick, color, secondPick, secondColor, max, fmt }: {
  title: string; snaps: Snapshot[]; pick: (s: Snapshot) => number; color: string
  secondPick?: (s: Snapshot) => number; secondColor?: string; max?: number; fmt: (s: string) => string
}) {
  const { t } = useLang()
  const [hover, setHover] = useState<number | null>(null)

  // Repere en unites reelles : le SVG n'est plus etire, donc un point reste rond
  // et un trait garde son epaisseur quelle que soit la largeur disponible.
  const W = 600, H = 190, PAD_X = 10, PAD_TOP = 16, PAD_BOTTOM = 14

  const model = useMemo(() => {
    const values = snaps.map(pick)
    const second = secondPick ? snaps.map(secondPick) : []
    const hi = max ?? Math.max(1, ...values, ...second)
    const n = snaps.length
    const x = (i: number) => (n <= 1 ? W / 2 : PAD_X + (i / (n - 1)) * (W - PAD_X * 2))
    const y = (v: number) => PAD_TOP + (1 - v / hi) * (H - PAD_TOP - PAD_BOTTOM)
    const path = (arr: number[]) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
    const area = values.length
      ? `${path(values)} L${x(values.length - 1).toFixed(1)},${H - PAD_BOTTOM} L${x(0).toFixed(1)},${H - PAD_BOTTOM} Z`
      : ''
    const peak = values.indexOf(Math.max(...values))
    const trough = values.indexOf(Math.min(...values))
    return { values, second, hi, x, y, line: path(values), line2: second.length ? path(second) : '', area, peak, trough }
  }, [snaps, pick, secondPick, max])

  const { values, hi, x, y, line, line2, area, peak, trough } = model
  const last = values.length - 1
  const shown = hover ?? last
  const gradientId = `sp-${title.replace(/[^a-z0-9]/gi, '')}`

  if (snaps.length === 0) return null

  return (
    <div className="rounded-sm border p-4" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h3 style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text)' }}>{title}</h3>
        <div className="flex items-baseline gap-2">
          <span style={{ fontFamily: geist, fontSize: 22, fontWeight: 500, color }}>{values[shown]}</span>
          <span style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--nx-text-muted)' }}>
            {snaps[shown] && fmt(snaps[shown].capturedAt)}
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full" role="img"
        onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.26} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((g) => (
          <line key={g} x1={PAD_X} x2={W - PAD_X} y1={y(hi * g)} y2={y(hi * g)}
            stroke="var(--nx-border)" strokeWidth={1} strokeDasharray="2 7" />
        ))}

        {area && <path d={area} fill={`url(#${gradientId})`} />}
        {line2 && <path d={line2} fill="none" stroke={secondColor} strokeWidth={1.4} strokeDasharray="4 3" opacity={0.85} />}
        <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* Le sommet et le creux, nommes : ce sont les deux dates dont on parle. */}
        {values.length > 2 && peak !== trough && [peak, trough].map((i) => (
          <circle key={`m${i}`} cx={x(i)} cy={y(values[i])} r={3} fill="var(--nx-panel)" stroke={color} strokeWidth={1.5} />
        ))}

        {/* Le dernier releve, ou celui que l'on survole. */}
        <line x1={x(shown)} x2={x(shown)} y1={PAD_TOP - 6} y2={H - PAD_BOTTOM}
          stroke="var(--nx-outline)" strokeWidth={1} strokeDasharray="3 3" opacity={hover === null ? 0 : 0.7} />
        <circle cx={x(shown)} cy={y(values[shown])} r={5} fill={color} stroke="var(--nx-panel)" strokeWidth={2} />

        {/* Zones de survol, une par releve. */}
        {snaps.map((_, i) => (
          <rect key={i} x={x(i) - (W / Math.max(1, snaps.length)) / 2} y={0}
            width={W / Math.max(1, snaps.length)} height={H} fill="transparent"
            onMouseEnter={() => setHover(i)} style={{ cursor: 'crosshair' }} />
        ))}
      </svg>

      <div className="flex justify-between" style={{ fontFamily: mono, fontSize: 9.5, color: 'var(--nx-text-muted)' }}>
        <span>{snaps[0] && fmt(snaps[0].capturedAt)}</span>
        <span>{t('max', 'max')} {hi}</span>
        <span>{snaps.length > 1 && fmt(snaps[snaps.length - 1].capturedAt)}</span>
      </div>
    </div>
  )
}
