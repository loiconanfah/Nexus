import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Waypoints, ArrowRight, AlertTriangle, Zap, ShieldAlert, Sparkles, TrendingDown } from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const NEG = '#d15b54'

const EXAMPLES: [string, string][] = [
  ['Que se passe-t-il si nous perdons le fournisseur Ericsson ?', 'What happens if we lose supplier Ericsson?'],
  ['Impact si le Data Center Montréal tombe en panne', 'Impact if Data Center Montréal goes down'],
  ['Que se passe-t-il si le HSS est indisponible ?', 'What happens if the HSS is unavailable?'],
]

export function ImpactIntelligence() {
  const { t, lang } = useLang()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const analyze = useMutation({ mutationFn: (question: string) => api.analyzeImpact(question, lang) })
  const data = analyze.data

  const nf = new Intl.NumberFormat(lang === 'fr' ? 'fr-CA' : 'en-CA')
  const money = (v: number) => {
    const a = Math.abs(v)
    if (a >= 1e6) return `${(v / 1e6).toFixed(a >= 1e8 ? 0 : 2)} M$`
    if (a >= 1e3) return `${(v / 1e3).toFixed(0)} k$`
    return nf.format(Math.round(v))
  }
  const run = (text: string) => { setQ(text); if (text.trim()) analyze.mutate(text.trim()) }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Waypoints size={22} style={{ color: CYAN }} />
          <h2 style={{ fontFamily: geist, fontSize: 22, color: 'var(--nx-text)' }}>
            {t('Impact transversal', 'Cross-system Impact')}
          </h2>
        </div>
        <p style={{ fontSize: 13, color: 'var(--nx-text-muted)', maxWidth: 640 }}>
          {t(
            'Posez une question métier en langage naturel. Lenexus relie la question à votre graphe de dépendances, calcule la cascade, l’impact financier, les éléments critiques et les mitigations — au-delà des frontières des systèmes.',
            'Ask a business question in natural language. Lenexus links it to your dependency graph, computing the cascade, financial impact, critical items and mitigations — across system boundaries.',
          )}
        </p>
      </div>

      {/* Barre de question */}
      <div className="rounded-lg border p-4" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && q.trim()) analyze.mutate(q.trim()) }}
            placeholder={t('Ex. « Que se passe-t-il si nous perdons le fournisseur X ? »', 'E.g. “What happens if we lose supplier X?”')}
            className="w-full rounded-md border bg-transparent px-3 py-2.5 outline-none"
            style={{ borderColor: 'var(--nx-border)', fontSize: 14, color: 'var(--nx-text)' }}
          />
          <button
            onClick={() => q.trim() && analyze.mutate(q.trim())}
            disabled={analyze.isPending || !q.trim()}
            className="flex items-center justify-center gap-1.5 rounded-md px-5 py-2.5 text-sm font-medium"
            style={{ background: CYAN, color: '#04121a', opacity: analyze.isPending || !q.trim() ? 0.6 : 1, whiteSpace: 'nowrap' }}
          >
            {analyze.isPending ? t('Analyse…', 'Analyzing…') : <>{t('Analyser l’impact', 'Analyze impact')} <ArrowRight size={15} /></>}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map(([fr, en]) => (
            <button
              key={fr} onClick={() => run(t(fr, en))}
              className="rounded-full border px-3 py-1"
              style={{ borderColor: 'var(--nx-border)', fontSize: 12, color: 'var(--nx-text-muted)' }}
            >
              {t(fr, en)}
            </button>
          ))}
        </div>
      </div>

      {analyze.isError && <p style={{ color: NEG, fontSize: 13 }}>{(analyze.error as Error).message}</p>}

      {data && !data.target.resolved && (
        <div className="rounded-lg border p-6" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
          <div className="mb-2 flex items-center gap-2" style={{ color: 'var(--nx-outline)' }}>
            <AlertTriangle size={18} /> <span style={{ fontFamily: geist, fontSize: 16, color: 'var(--nx-text)' }}>{t('Cible non résolue', 'Target not resolved')}</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>{data.narrative}</p>
        </div>
      )}

      {data && data.target.resolved && (
        <div className="flex flex-col gap-5">
          {/* En-tête cible + narrative */}
          <div className="rounded-lg border p-5" style={{ borderColor: CYAN, background: 'var(--nx-panel)' }}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded px-2 py-0.5" style={{ background: 'var(--nx-surface-container)', fontFamily: mono, fontSize: 11, color: CYAN }}>{data.target.entityType}</span>
              <h3 style={{ fontFamily: geist, fontSize: 20, color: 'var(--nx-text)' }}>{data.target.name}</h3>
              <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-outline)' }}>· {data.scenario}</span>
              {data.aiUsed && <span className="flex items-center gap-1" style={{ fontSize: 11, color: CYAN }}><Sparkles size={12} /> IA</span>}
            </div>
            <p className="mt-2" style={{ fontSize: 14, color: 'var(--nx-text)', lineHeight: 1.5 }}>{data.narrative}</p>
          </div>

          {/* KPIs impact */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label={t('Éléments affectés', 'Affected elements')} value={String(data.affectedTotal)} sub={`${t('profondeur', 'depth')} ${data.maxDepth}`} icon={<Waypoints size={15} />} />
            <Kpi label={t('Impact / heure', 'Impact / hour')} value={money(data.perHourImpact)} sub={data.currency} icon={<Zap size={15} />} />
            <Kpi label={t('Pire cas', 'Worst case')} value={money(data.worstCaseImpact)} sub={`${t('rétab.', 'recovery')} ${data.maxRecoveryHours}h`} icon={<TrendingDown size={15} />} accent />
            <Kpi label={t('Attendu (pondéré)', 'Expected (weighted)')} value={money(data.expectedImpact)} sub={data.currency} icon={<TrendingDown size={15} />} />
          </div>

          {/* Répartition par type */}
          {Object.keys(data.affectedByType).length > 0 && (
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
              <div className="mb-2" style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: CYAN }}>{t('Cascade par type', 'Cascade by type')}</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(data.affectedByType).sort((a, b) => b[1] - a[1]).map(([type, n]) => (
                  <span key={type} className="rounded-md border px-2.5 py-1" style={{ borderColor: 'var(--nx-border)', fontSize: 12, color: 'var(--nx-text)' }}>
                    {type} <b style={{ color: CYAN }}>{n}</b>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Éléments critiques */}
            <Panel title={t('Éléments critiques affectés', 'Critical affected elements')} icon={<AlertTriangle size={13} />}>
              <div className="flex flex-col">
                {data.criticalItems.map((c) => (
                  <div key={c.id} className="flex items-center justify-between border-b py-2" style={{ borderColor: 'var(--nx-border)' }}>
                    <div className="flex items-center gap-2 truncate">
                      <span className="rounded px-1.5 py-0.5" style={{ background: critColor(c.criticality), fontFamily: mono, fontSize: 10, color: '#04121a' }}>{c.criticality}</span>
                      <span className="truncate" style={{ fontSize: 13, color: 'var(--nx-text)' }}>{c.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--nx-outline)' }}>{c.type}</span>
                    </div>
                    <span style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text-muted)' }}>{money(c.nodeImpact)}</span>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Dépendances dangereuses (SPOF) */}
            <Panel title={t('Dépendances dangereuses (SPOF)', 'Dangerous dependencies (SPOF)')} icon={<ShieldAlert size={13} />}>
              {data.dangerousDependencies.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>{t('Aucun point unique de défaillance dans la cascade.', 'No single point of failure in the cascade.')}</p>
              ) : (
                <div className="flex flex-col">
                  {data.dangerousDependencies.map((d) => (
                    <div key={d.id} className="flex items-center justify-between border-b py-2" style={{ borderColor: 'var(--nx-border)' }}>
                      <div className="flex items-center gap-2 truncate">
                        <ShieldAlert size={14} style={{ color: NEG }} />
                        <span className="truncate" style={{ fontSize: 13, color: 'var(--nx-text)' }}>{d.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--nx-outline)' }}>{d.type}</span>
                      </div>
                      <span style={{ fontFamily: mono, fontSize: 12, color: NEG }}>{d.directDependents} {t('dépendants', 'dependents')}</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          {/* Mitigations */}
          <Panel title={t('Mitigations recommandées', 'Recommended mitigations')} icon={<Sparkles size={13} />}>
            <ol className="flex flex-col gap-2">
              {data.mitigations.map((m, i) => (
                <li key={i} className="flex gap-2" style={{ fontSize: 13, color: 'var(--nx-text)' }}>
                  <span style={{ fontFamily: mono, color: CYAN }}>{i + 1}.</span> {m}
                </li>
              ))}
            </ol>
            <div className="mt-4">
              <button
                onClick={() => nav('/simulations')}
                className="flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm"
                style={{ borderColor: CYAN, color: CYAN }}
              >
                {t('Simuler en détail (What-If)', 'Simulate in detail (What-If)')} <ArrowRight size={14} />
              </button>
            </div>
          </Panel>
        </div>
      )}
    </div>
  )
}

function critColor(c: number): string {
  if (c >= 85) return '#d15b54'
  if (c >= 65) return '#e0a458'
  if (c >= 40) return '#4bb3c9'
  return '#8aa0ad'
}

function Kpi({ label, value, sub, icon, accent }: { label: string; value: string; sub?: string; icon: React.ReactNode; accent?: boolean }) {
  return (
    <div className="rounded-lg border p-4" style={{ borderColor: accent ? CYAN : 'var(--nx-border)', background: 'var(--nx-panel)' }}>
      <div className="mb-1 flex items-center gap-1.5" style={{ fontSize: 11, color: 'var(--nx-text-muted)' }}>{icon} {label}</div>
      <div style={{ fontFamily: geist, fontSize: 22, color: accent ? CYAN : 'var(--nx-text)' }}>{value}</div>
      {sub && <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-outline)' }}>{sub}</div>}
    </div>
  )
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-5" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
      <h3 className="mb-3 flex items-center gap-1.5" style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: CYAN }}>{icon} {title}</h3>
      {children}
    </div>
  )
}
