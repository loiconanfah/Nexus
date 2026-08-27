import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertOctagon, Activity, Play, Radar, ShieldAlert } from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import { entityTypeLabel } from '../lib/labels'
import type { Incident } from '../lib/types'

type T = (fr: string, en: string) => string

function incidentTitle(i: Incident, t: T): string {
  const n = i.entityName
  if (i.category === 'spof') return t(`Panne de ${n}`, `${n} outage`)
  if (i.category === 'supplier') return t(`Interruption du service ${n}`, `${n} service disruption`)
  return t(`Perte de savoir — ${n} indisponible`, `Knowledge loss — ${n} unavailable`)
}
function categoryLabel(i: Incident, t: T): string {
  if (i.category === 'spof') return t('Point unique de défaillance', 'Single point of failure')
  if (i.category === 'supplier') return t('Défaillance fournisseur', 'Supplier failure')
  return t('Dépendance humaine', 'Human dependency')
}
function severityLabel(sev: Incident['severity'], t: T): string {
  return sev === 'CRITICAL' ? t('CRITIQUE', 'CRITICAL') : sev === 'HIGH' ? t('ÉLEVÉ', 'HIGH') : t('MODÉRÉ', 'MODERATE')
}
function incidentTrigger(i: Incident, t: T): string {
  const type = entityTypeLabel(i.entityType, t)
  const list = i.systems.join(', ')
  if (i.category === 'spof') return t(`${i.entityName} (${type}) a ${i.dependents} dépendant(s) et aucune redondance.`, `${i.entityName} (${type}) has ${i.dependents} dependent(s) and no redundancy.`)
  if (i.category === 'supplier') return t(`${i.entityName} soutient ${i.dependents} système(s) : ${list}.`, `${i.entityName} supports ${i.dependents} system(s): ${list}.`)
  return t(`${i.entityName} est l’unique détenteur du savoir pour ${list}.`, `${i.entityName} is the sole knowledge holder for ${list}.`)
}
function incidentReco(i: Incident, t: T): string {
  if (i.category === 'spof') return i.hasRedundancy
    ? t('Valider les chemins de bascule et le RTO.', 'Validate failover paths and RTO.')
    : t(`Introduire de la redondance pour ${i.entityName} afin d’éliminer ce point unique de défaillance.`, `Introduce redundancy for ${i.entityName} to remove this single point of failure.`)
  if (i.category === 'supplier') return t(`Identifier un fournisseur alternatif pour ${i.entityName} et formaliser des SLA.`, `Identify an alternative supplier for ${i.entityName} and formalise SLAs.`)
  return t(`Documenter ${i.systems.join(', ')} et former un expert de secours.`, `Document ${i.systems.join(', ')} and cross-train a backup expert.`)
}

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'

const SEV: Record<Incident['severity'], { color: string; bg: string }> = {
  CRITICAL: { color: '#ffb4ab', bg: 'rgba(255,180,171,0.12)' },
  HIGH: { color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
  MODERATE: { color: '#facc15', bg: 'rgba(250,204,21,0.10)' },
}

export function Incidents() {
  const navigate = useNavigate()
  const { t } = useLang()
  const { data, isLoading, error } = useQuery({ queryKey: ['incidents'], queryFn: api.incidents })
  const [filter, setFilter] = useState<'ALL' | Incident['severity']>('ALL')

  if (isLoading) return <div style={{ fontFamily: mono, color: 'var(--nx-text-muted)' }}>{t('PRÉVISION DES SCÉNARIOS DE DÉFAILLANCE…', 'FORECASTING FAILURE SCENARIOS…')}</div>
  if (error) return <div style={{ color: '#ffb4ab' }}>{(error as Error).message}</div>
  if (!data) return null

  const list = filter === 'ALL' ? data.incidents : data.incidents.filter((i) => i.severity === filter)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h2 className="flex items-center gap-2" style={{ fontFamily: geist, fontSize: 24, color: 'var(--nx-text)' }}>
            <Radar size={22} style={{ color: CYAN }} /> {t('Alerte anticipée d’incident', 'Incident Early-Warning')}
          </h2>
          <p className="mt-1" style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>{t('Scénarios de défaillance prédits à partir de la topologie en direct — anticipez les pannes avant qu’elles ne surviennent.', 'Predicted failure scenarios derived from live topology — anticipate outages before they happen.')}</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 md:grid-cols-4 lg:w-auto">
          <Tile icon={AlertOctagon} label={t('SCÉNARIOS PRÉDITS', 'PREDICTED SCENARIOS')} value={data.summary.total} color="var(--nx-text)" />
          <Tile icon={ShieldAlert} label={t('CRITIQUES', 'CRITICAL')} value={data.summary.critical} color="#ffb4ab" />
          <Tile icon={Activity} label={t('ÉLEVÉS', 'HIGH')} value={data.summary.high} color="#fb923c" />
          <Tile icon={Radar} label={t('PORTÉE MAX', 'MAX BLAST RADIUS')} value={data.summary.topBlastRadius} color={CYAN_T} />
        </div>
      </div>

      {/* Filtres */}
      <div className="flex gap-2">
        {(['ALL', 'CRITICAL', 'HIGH', 'MODERATE'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className="rounded-sm border px-3 py-1.5" style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.05em', borderColor: filter === f ? CYAN : 'var(--nx-border)', color: filter === f ? CYAN_T : 'var(--nx-text-muted)', background: filter === f ? 'rgba(0,229,255,0.08)' : 'transparent' }}>{f === 'ALL' ? t('TOUS', 'ALL') : f === 'CRITICAL' ? t('CRITIQUE', 'CRITICAL') : f === 'HIGH' ? t('ÉLEVÉ', 'HIGH') : t('MODÉRÉ', 'MODERATE')}</button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {list.map((i) => {
          const s = SEV[i.severity]
          const entityId = i.id.split('-').slice(1).join('-')
          return (
            <div key={i.id} className="flex flex-col gap-3 rounded-sm border p-4" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)', borderLeft: `3px solid ${s.color}` }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded px-2 py-0.5" style={{ fontFamily: mono, fontSize: 10, color: s.color, background: s.bg, border: `1px solid ${s.color}40` }}>{severityLabel(i.severity, t)}</span>
                    <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{categoryLabel(i, t)}</span>
                  </div>
                  <h3 className="mt-1.5" style={{ fontFamily: geist, fontSize: 17, color: 'var(--nx-text)' }}>{incidentTitle(i, t)}</h3>
                </div>
                <div className="text-right">
                  <div style={{ fontFamily: geist, fontSize: 26, lineHeight: 1, color: s.color }}>{i.probability}<span style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>%</span></div>
                  <div style={{ fontFamily: mono, fontSize: 9, color: 'var(--nx-text-muted)', textTransform: 'uppercase' }}>{t('probabilité', 'likelihood')}</div>
                </div>
              </div>

              <div className="flex gap-4" style={{ fontFamily: mono, fontSize: 11 }}>
                <span style={{ color: 'var(--nx-text-muted)' }}>{t('PORTÉE', 'BLAST RADIUS')} · <span style={{ color: 'var(--nx-text)' }}>{i.blastRadius}</span></span>
                <span style={{ color: 'var(--nx-text-muted)' }}>{t('AFFECTÉS', 'AFFECTED')} · <span style={{ color: 'var(--nx-text)' }}>{i.affected}</span></span>
              </div>

              <p style={{ fontSize: 12.5, color: 'var(--nx-text-muted)', lineHeight: 1.5 }}>{incidentTrigger(i, t)}</p>
              <div className="rounded-sm p-2.5" style={{ background: 'var(--nx-surface)', border: '1px solid var(--nx-border)' }}>
                <span style={{ fontFamily: mono, fontSize: 10, color: CYAN_T, textTransform: 'uppercase' }}>{t('Action recommandée', 'Recommended action')}</span>
                <p className="mt-0.5" style={{ fontSize: 12.5, color: 'var(--nx-text)' }}>{incidentReco(i, t)}</p>
              </div>

              <button onClick={() => navigate(`/simulations?asset=${entityId}&name=${encodeURIComponent(i.entityName)}`)} className="mt-auto flex items-center justify-center gap-2 self-start rounded-sm px-3 py-1.5" style={{ background: 'rgba(0,229,255,0.10)', border: '1px solid rgba(0,229,255,0.30)', color: CYAN_T, fontFamily: mono, fontSize: 11, textTransform: 'uppercase' }}>
                <Play size={13} /> {t('Simuler le scénario', 'Simulate scenario')}
              </button>
            </div>
          )
        })}
        {list.length === 0 && <div style={{ fontFamily: mono, color: 'var(--nx-text-muted)' }}>{t('Aucun scénario à ce niveau de sévérité.', 'No scenarios at this severity.')}</div>}
      </div>
    </div>
  )
}

function Tile({ icon: Icon, label, value, color }: { icon: typeof Radar; label: string; value: number; color: string }) {
  return (
    <div className="rounded-sm border p-3" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
      <div className="flex items-center gap-1" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}><Icon size={11} /> {label}</div>
      <div style={{ fontFamily: geist, fontSize: 24, fontWeight: 500, color }}>{value}</div>
    </div>
  )
}
