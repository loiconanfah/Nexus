import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Activity, Boxes, Cpu, Radio, X, Trash2, PowerOff, RotateCcw, ExternalLink, Save, Archive } from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import { entityTypeLabel } from '../lib/labels'
import type { GraphEntityRecord } from '../lib/types'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'

type T = (fr: string, en: string) => string
function statusOf(crit: number, deg: number, t: T) {
  const eff = crit + deg
  if (eff >= 85) return { label: t('CRITIQUE', 'CRITICAL'), color: 'var(--nx-danger)' }
  if (eff >= 65) return { label: t('ÉLEVÉ', 'ELEVATED'), color: 'var(--nx-orange)' }
  if (eff >= 45) return { label: t('SURVEILLÉ', 'WATCH'), color: 'var(--nx-warning)' }
  return { label: t('NOMINAL', 'NOMINAL'), color: 'var(--nx-success)' }
}

export function DigitalTwin() {
  const navigate = useNavigate()
  const { t } = useLang()
  const qc = useQueryClient()
  const [selected, setSelected] = useState<GraphEntityRecord | null>(null)
  const { data: overview } = useQuery({ queryKey: ['overview'], queryFn: api.overview })
  const { data: graph, isLoading } = useQuery({ queryKey: ['graph'], queryFn: api.graph })
  const { data: archived } = useQuery({ queryKey: ['entities-archived'], queryFn: api.archivedEntities })

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ['graph'] })
    qc.invalidateQueries({ queryKey: ['entities-archived'] })
    qc.invalidateQueries({ queryKey: ['overview'] })
  }
  const reactivate = useMutation({ mutationFn: (id: string) => api.reactivateEntity(id), onSuccess: refreshAll })

  // Degre entrant = nombre de dependants (poids operationnel dans le twin).
  const inDegree = useMemo(() => {
    const m = new Map<string, number>()
    graph?.edges.forEach((e) => m.set(e.target, (m.get(e.target) ?? 0) + 1))
    return m
  }, [graph])

  const grouped = useMemo(() => {
    const g: Record<string, GraphEntityRecord[]> = {}
    graph?.nodes.forEach((n) => { (g[n.entityType] ??= []).push(n) })
    Object.values(g).forEach((arr) => arr.sort((a, b) => b.criticality - a.criticality))
    return g
  }, [graph])

  if (isLoading) return <div style={{ fontFamily: mono, color: 'var(--nx-text-muted)' }}>{t('SYNCHRONISATION DU JUMEAU OPÉRATIONNEL…', 'SYNCING OPERATIONAL TWIN…')}</div>
  if (!graph) return null

  const health = overview?.organizationHealthScore ?? 0
  const healthColor = health >= 75 ? 'var(--nx-success)' : health >= 50 ? 'var(--nx-warning)' : 'var(--nx-danger)'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h2 className="flex items-center gap-2" style={{ fontFamily: geist, fontSize: 24, color: 'var(--nx-text)' }}>
            <Radio size={22} style={{ color: CYAN }} /> {t('Jumeau numérique opérationnel', 'Operational Digital Twin')}
          </h2>
          <p className="mt-1" style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>{t('Un miroir vivant de votre parc opérationnel — chaque nœud reflète la criticité et la charge de dépendance réelles.', 'A live mirror of your operational estate — each node reflects real criticality and dependency load.')}</p>
        </div>
        <div className="flex items-center gap-4 rounded-sm border px-5 py-3" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
          <div className="text-center">
            <div style={{ fontFamily: geist, fontSize: 30, lineHeight: 1, color: healthColor }}>{health}</div>
            <div style={{ fontFamily: mono, fontSize: 9, color: 'var(--nx-text-muted)', textTransform: 'uppercase' }}>{t('Santé', 'Health')}</div>
          </div>
          <div className="h-8 w-px" style={{ background: 'var(--nx-border)' }} />
          <Stat icon={Boxes} label={t('NŒUDS', 'NODES')} value={graph.nodes.length} />
          <Stat icon={Activity} label={t('LIENS', 'LINKS')} value={graph.edges.length} />
          <Stat icon={Cpu} label="SPOF" value={overview?.spofCount ?? 0} color="var(--nx-danger)" />
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {Object.entries(grouped).map(([type, items]) => (
          <div key={type}>
            <div className="mb-2 flex items-center gap-2">
              <span style={{ fontFamily: mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--nx-label)' }}>{entityTypeLabel(type, t)}</span>
              <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>· {items.length}</span>
              <div className="h-px flex-1" style={{ background: 'var(--nx-border)' }} />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {items.map((n) => {
                const deg = inDegree.get(n.id) ?? 0
                const st = statusOf(n.criticality, deg * 3, t)
                return (
                  <button key={n.id} onClick={() => setSelected(n)} className="group relative flex flex-col gap-1 rounded-sm border p-3 text-left transition-transform hover:-translate-y-0.5" style={{ background: 'var(--nx-panel)', borderColor: 'var(--nx-border)' }}>
                    <div className="flex items-center justify-between">
                      <span className="nx-node-pulse inline-block h-2 w-2 rounded-full" style={{ background: st.color, boxShadow: `0 0 6px ${st.color}` }} />
                      <span style={{ fontFamily: mono, fontSize: 9, color: st.color }}>{st.label}</span>
                    </div>
                    <span className="truncate" style={{ fontSize: 13, fontWeight: 500, color: 'var(--nx-text)' }} title={n.name}>{n.name}</span>
                    <div className="flex items-center justify-between" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>
                      <span>{t('crit', 'crit')} {n.criticality}</span>
                      <span>↓{deg} {t('dép.', 'deps')}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Actifs mis de côté (désinstallés) */}
      {archived && archived.length > 0 && (
        <div className="mt-2">
          <div className="mb-2 flex items-center gap-2">
            <Archive size={14} style={{ color: 'var(--nx-text-muted)' }} />
            <span style={{ fontFamily: mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--nx-text-muted)' }}>{t('Mis de côté (désinstallés)', 'Set aside (uninstalled)')}</span>
            <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-outline)' }}>· {archived.length}</span>
            <div className="h-px flex-1" style={{ background: 'var(--nx-border)' }} />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {archived.map((n) => (
              <div key={n.id} className="flex items-center justify-between gap-2 rounded-sm border p-3" style={{ background: 'var(--nx-surface)', borderColor: 'var(--nx-border)', opacity: 0.85 }}>
                <div className="min-w-0">
                  <div className="truncate" style={{ fontSize: 13, color: 'var(--nx-text-muted)', textDecoration: 'line-through' }} title={n.name}>{n.name}</div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-outline)' }}>{entityTypeLabel(n.entityType, t)} · {t('crit', 'crit')} {n.criticality}</div>
                </div>
                <button onClick={() => reactivate.mutate(n.id)} disabled={reactivate.isPending} className="flex shrink-0 items-center gap-1.5 rounded-sm border px-2.5 py-1.5" style={{ borderColor: 'var(--nx-border)', fontSize: 12, color: CYAN_T }}>
                  <RotateCcw size={12} /> {t('Réactiver', 'Reactivate')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <NodePanel node={selected} onClose={() => setSelected(null)} onChanged={refreshAll} onGraph={(id) => navigate(`/graph?focus=${id}`)} />
      )}
    </div>
  )
}

function NodePanel({ node, onClose, onChanged, onGraph }: { node: GraphEntityRecord; onClose: () => void; onChanged: () => void; onGraph: (id: string) => void }) {
  const { t } = useLang()
  const [cost, setCost] = useState(node.costPerHour != null ? String(node.costPerHour) : '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const done = () => { onChanged(); onClose() }

  const saveCost = useMutation({ mutationFn: () => api.setEntityCost(node.id, cost.trim() === '' ? null : Number(cost)), onSuccess: onChanged })
  const decommission = useMutation({ mutationFn: () => api.decommissionEntity(node.id), onSuccess: done })
  const remove = useMutation({ mutationFn: () => api.deleteEntity(node.id), onSuccess: done })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(2,8,12,0.66)' }} onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-lg border" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-bg)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b px-5 py-4" style={{ borderColor: 'var(--nx-border)' }}>
          <div className="min-w-0">
            <h3 className="truncate" style={{ fontFamily: geist, fontSize: 17, color: 'var(--nx-text)' }} title={node.name}>{node.name}</h3>
            <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>{entityTypeLabel(node.entityType, t)} · {t('criticité', 'criticality')} {node.criticality}</div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--nx-text-muted)' }}><X size={18} /></button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          {/* Coût d'arrêt réel */}
          <div>
            <label className="mb-1 block" style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>{t('Coût d’arrêt réel (par heure)', 'Real downtime cost (per hour)')}</label>
            <div className="flex items-center gap-2">
              <input type="number" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder={t('estimé par criticité', 'estimated by criticality')}
                className="w-full rounded-md border bg-transparent px-3 py-2 outline-none" style={{ borderColor: 'var(--nx-border)', fontFamily: mono, fontSize: 14, color: 'var(--nx-text)' }} />
              <button onClick={() => saveCost.mutate()} disabled={saveCost.isPending} className="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium" style={{ background: CYAN, color: 'var(--nx-on-cyan)', opacity: saveCost.isPending ? 0.6 : 1 }}>
                <Save size={14} /> {saveCost.isSuccess ? t('Enregistré', 'Saved') : t('Enregistrer', 'Save')}
              </button>
            </div>
            <p className="mt-1" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-outline)' }}>{t('Vide = estimation par paliers de criticité. Renseigné = prime dans le calcul d’impact.', 'Empty = estimated by criticality tiers. Set = overrides in impact calculation.')}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => onGraph(node.id)} className="flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm" style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text)' }}>
              <ExternalLink size={14} /> {t('Voir dans le graphe', 'View in graph')}
            </button>
            <button onClick={() => decommission.mutate()} disabled={decommission.isPending} className="flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm" style={{ borderColor: 'rgba(224,178,60,0.4)', color: 'var(--nx-warning)' }}>
              <PowerOff size={14} /> {t('Mettre de côté', 'Set aside')}
            </button>
          </div>

          {/* Suppression définitive */}
          {confirmDelete ? (
            <div className="rounded-md border p-3" style={{ borderColor: 'color-mix(in srgb, var(--nx-danger) 50%, transparent)', background: 'color-mix(in srgb, var(--nx-danger) 6%, transparent)' }}>
              <p style={{ fontSize: 12, color: 'var(--nx-danger)' }}>{t('Supprimer définitivement cet actif et ses relations ? Irréversible.', 'Permanently delete this asset and its relations? Irreversible.')}</p>
              <div className="mt-2 flex justify-end gap-2">
                <button onClick={() => setConfirmDelete(false)} className="rounded-md border px-3 py-1.5 text-sm" style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text-muted)' }}>{t('Annuler', 'Cancel')}</button>
                <button onClick={() => remove.mutate()} disabled={remove.isPending} className="rounded-md px-3 py-1.5 text-sm font-medium" style={{ background: 'var(--nx-danger)', color: '#fff', opacity: remove.isPending ? 0.6 : 1 }}>{t('Supprimer', 'Delete')}</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm" style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-danger)' }}>
              <Trash2 size={14} /> {t('Supprimer définitivement', 'Delete permanently')}
            </button>
          )}
          <p className="flex items-center gap-1" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-outline)' }}>
            <PowerOff size={11} /> {t('« Mettre de côté » conserve l’actif mais l’exclut de l’impact — réactivable.', '“Set aside” keeps the asset but excludes it from impact — reversible.')}
          </p>
        </div>
      </div>
    </div>
  )
}

function Stat({ icon: Icon, label, value, color }: { icon: typeof Boxes; label: string; value: number; color?: string }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1" style={{ fontFamily: geist, fontSize: 20, color: color ?? 'var(--nx-text)' }}><Icon size={14} style={{ color: 'var(--nx-text-muted)' }} /> {value}</div>
      <div style={{ fontFamily: mono, fontSize: 9, color: 'var(--nx-text-muted)', textTransform: 'uppercase' }}>{label}</div>
    </div>
  )
}
