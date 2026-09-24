import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertOctagon, Activity, ListChecks, Loader2, Play, Radar, ShieldAlert } from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import { notify } from '../lib/notify'
import { entityTypeLabel } from '../lib/labels'
import type { ActionRecommendation, Incident } from '../lib/types'

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
const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'

const SEV: Record<Incident['severity'], { color: string; bg: string }> = {
  CRITICAL: { color: 'var(--nx-danger)', bg: 'color-mix(in srgb, var(--nx-danger) 12%, transparent)' },
  HIGH: { color: 'var(--nx-orange)', bg: 'color-mix(in srgb, var(--nx-orange) 12%, transparent)' },
  MODERATE: { color: 'var(--nx-warning)', bg: 'color-mix(in srgb, var(--nx-warning) 10%, transparent)' },
}

export function Incidents() {
  const navigate = useNavigate()
  const { t } = useLang()
  const { data, isLoading, error } = useQuery({ queryKey: ['incidents'], queryFn: api.incidents })
  const [filter, setFilter] = useState<'ALL' | Incident['severity']>('ALL')

  if (isLoading) return <div style={{ fontFamily: mono, color: 'var(--nx-text-muted)' }}>{t('PRÉVISION DES SCÉNARIOS DE DÉFAILLANCE…', 'FORECASTING FAILURE SCENARIOS…')}</div>
  if (error) return <div style={{ color: 'var(--nx-danger)' }}>{(error as Error).message}</div>
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
          <Tile icon={ShieldAlert} label={t('CRITIQUES', 'CRITICAL')} value={data.summary.critical} color="var(--nx-danger)" />
          <Tile icon={Activity} label={t('ÉLEVÉS', 'HIGH')} value={data.summary.high} color="var(--nx-orange)" />
          <Tile icon={Radar} label={t('PORTÉE MAX', 'MAX BLAST RADIUS')} value={data.summary.topBlastRadius} color={CYAN_T} />
        </div>
      </div>

      {/* Filtres */}
      <div className="flex gap-2">
        {(['ALL', 'CRITICAL', 'HIGH', 'MODERATE'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className="rounded-sm border px-3 py-1.5" style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.05em', borderColor: filter === f ? CYAN : 'var(--nx-border)', color: filter === f ? CYAN_T : 'var(--nx-text-muted)', background: filter === f ? 'color-mix(in srgb, var(--nx-cyan) 8%, transparent)' : 'transparent' }}>{f === 'ALL' ? t('TOUS', 'ALL') : f === 'CRITICAL' ? t('CRITIQUE', 'CRITICAL') : f === 'HIGH' ? t('ÉLEVÉ', 'HIGH') : t('MODÉRÉ', 'MODERATE')}</button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {list.map((i) => {
          const s = SEV[i.severity]
          // L'identifiant vient de l'API. Il était auparavant reconstitué en
          // découpant « spof-<nom> », ce qui donnait un NOM : la simulation et la
          // proposition de plan recevaient donc un identifiant invalide.
          const entityId = i.entityId
          return (
            <div key={i.id} className="flex flex-col gap-3 rounded-sm border p-4" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)', borderLeft: `3px solid ${s.color}` }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded px-2 py-0.5" style={{ fontFamily: mono, fontSize: 10, color: s.color, background: s.bg, border: `1px solid color-mix(in srgb, ${s.color} 25%, transparent)` }}>{severityLabel(i.severity, t)}</span>
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
              {entityId && <Plan entityId={entityId} name={i.entityName} />}

              <button onClick={() => navigate(`/simulations?asset=${entityId}&name=${encodeURIComponent(i.entityName)}`)} className="mt-auto flex items-center justify-center gap-2 self-start rounded-sm px-3 py-1.5" style={{ background: 'color-mix(in srgb, var(--nx-cyan) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--nx-cyan) 30%, transparent)', color: 'var(--nx-label)', fontFamily: mono, fontSize: 11, textTransform: 'uppercase' }}>
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


/**
 * Le plan pour CET élément, demandé à la demande.
 *
 * L'ancienne carte affichait « Introduire de la redondance pour X » sur chacune
 * d'elles : une phrase vraie et sans valeur, qui ne disait ni ce qui dépend de X,
 * ni ce que son arrêt coûte, ni par où commencer. Le plan est demandé au clic et
 * non au chargement : sinon chaque ouverture de la page paierait autant d'appels
 * au modèle qu'il y a de cartes.
 */
function Plan({ entityId, name }: { entityId: string; name: string }) {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [reco, setReco] = useState<ActionRecommendation | null>(null)

  const ask = useMutation({
    mutationFn: () => api.recommendAction(entityId, lang),
    onSuccess: (r) => setReco(r),
    onError: (e) => notify({ kind: 'error', title: t('Proposition indisponible', 'Proposal unavailable'), message: (e as Error).message.slice(0, 160) }),
  })

  const follow = useMutation({
    mutationFn: () => api.createAction({
      title: reco!.title, detail: reco!.why, priority: 'High', kind: 'remediation',
      targetId: entityId, steps: reco!.steps, expectedGain: reco!.expectedGain,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['actions'] })
      notify({
        kind: 'success',
        title: t('Ajouté au plan d’action', 'Added to the action plan'),
        message: t(`« ${reco!.title} » et ses ${reco!.steps.length} étapes attendent d’être cochées.`,
          `“${reco!.title}” and its ${reco!.steps.length} steps are waiting to be ticked off.`),
        actions: [{ label: t('Ouvrir le plan d’action', 'Open the action plan'), to: '/actions' }],
      })
    },
    onError: (e) => notify({ kind: 'error', title: t('Ajout impossible', 'Could not add'), message: (e as Error).message.slice(0, 160) }),
  })

  if (!reco) {
    return (
      <button onClick={() => ask.mutate()} disabled={ask.isPending}
        className="flex items-center gap-2 self-start rounded-sm px-3 py-1.5"
        style={{ background: 'var(--nx-surface)', border: '1px solid var(--nx-border)', color: CYAN_T, fontFamily: mono, fontSize: 11, textTransform: 'uppercase' }}>
        {ask.isPending ? <Loader2 size={13} className="animate-spin" /> : <ListChecks size={13} />}
        {ask.isPending ? t('Analyse de {x}…'.replace('{x}', name), 'Analysing {x}…'.replace('{x}', name)) : t('Proposer un plan', 'Propose a plan')}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-sm p-2.5" style={{ background: 'var(--nx-surface)', border: '1px solid var(--nx-border)' }}>
      <span className="flex items-center justify-between" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-label)', textTransform: 'uppercase' }}>
        {t('Plan proposé', 'Proposed plan')}
        <span style={{ color: 'var(--nx-outline)' }}>{reco.source === 'ai' ? t('rédigé par l’IA', 'written by AI') : t('règles', 'rules')}</span>
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--nx-text)' }}>{reco.title}</span>
      <span style={{ fontSize: 12, color: 'var(--nx-text-muted)', lineHeight: 1.5 }}>{reco.why}</span>
      <ol className="flex flex-col gap-1">
        {reco.steps.map((step, i) => (
          <li key={i} className="flex gap-2" style={{ fontSize: 12.5, color: 'var(--nx-text)', lineHeight: 1.45 }}>
            <span style={{ fontFamily: mono, fontSize: 11, color: CYAN_T }}>{i + 1}</span>{step}
          </li>
        ))}
      </ol>
      <span style={{ fontSize: 12, color: 'var(--nx-success)', lineHeight: 1.45 }}>{reco.expectedGain}</span>
      <div className="flex items-center gap-3">
        <button onClick={() => follow.mutate()} disabled={follow.isPending || follow.isSuccess}
          className="flex items-center gap-1.5 rounded-sm px-2.5 py-1.5"
          style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontSize: 12, fontWeight: 600 }}>
          {follow.isPending ? <Loader2 size={12} className="animate-spin" /> : <ListChecks size={12} />}
          {follow.isSuccess ? t('Ajouté', 'Added') : t('Suivre dans le plan d’action', 'Track in the action plan')}
        </button>
        {follow.isSuccess && (
          <button onClick={() => navigate('/actions')} style={{ fontSize: 12, color: CYAN_T }}>{t('Ouvrir le plan', 'Open the plan')}</button>
        )}
        <button onClick={() => ask.mutate()} disabled={ask.isPending} style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>
          {t('Reproposer', 'Propose again')}
        </button>
      </div>
    </div>
  )
}
