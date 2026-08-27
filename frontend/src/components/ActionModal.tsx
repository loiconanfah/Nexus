import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, X } from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'

interface Props {
  open: boolean
  onClose: () => void
  defaultTitle?: string
  defaultTargetId?: string | null
  defaultTargetName?: string
  kind?: 'remediation' | 'contingency'
}

export function ActionModal({ open, onClose, defaultTitle = '', defaultTargetId = null, defaultTargetName, kind = 'remediation' }: Props) {
  const { t } = useLang()
  const qc = useQueryClient()
  const [title, setTitle] = useState(defaultTitle)
  const [detail, setDetail] = useState('')
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('High')
  const [targetId, setTargetId] = useState<string | null>(defaultTargetId)

  const { data: graph } = useQuery({ queryKey: ['graph'], queryFn: api.graph, enabled: open && !defaultTargetId })

  const mut = useMutation({
    mutationFn: () => api.createAction({ title, detail, priority, kind, targetId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['actions'] })
      qc.invalidateQueries({ queryKey: ['graph'] })
      reset(); onClose()
    },
  })

  function reset() { setTitle(defaultTitle); setDetail(''); setPriority('High'); setTargetId(defaultTargetId) }
  if (!open) return null

  const kindLabel = kind === 'contingency' ? t('Plan de contingence', 'Contingency plan') : t('Action de remédiation', 'Remediation action')

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-sm border" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--nx-border)' }}>
          <h3 style={{ fontFamily: geist, fontSize: 17, color: 'var(--nx-text)' }}>{kindLabel}</h3>
          <button onClick={onClose} style={{ color: 'var(--nx-text-muted)' }}><X size={18} /></button>
        </div>
        <div className="flex flex-col gap-3 p-4">
          <Field label={t('Titre', 'Title')}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus className="w-full rounded-sm px-3 py-2 outline-none" style={inputStyle} placeholder={t('Ex. Ajouter un réplica de base de données', 'e.g. Add a database replica')} />
          </Field>
          <Field label={t('Détail', 'Detail')}>
            <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} className="w-full resize-y rounded-sm px-3 py-2 outline-none" style={inputStyle} placeholder={t('Ce que cette action accomplit…', 'What this action achieves…')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('Priorité', 'Priority')}>
              <select value={priority} onChange={(e) => setPriority(e.target.value as 'High')} className="w-full rounded-sm px-3 py-2 outline-none" style={inputStyle}>
                <option value="High">{t('Haute', 'High')}</option>
                <option value="Medium">{t('Moyenne', 'Medium')}</option>
                <option value="Low">{t('Basse', 'Low')}</option>
              </select>
            </Field>
            <Field label={t('Actif ciblé', 'Target asset')}>
              {defaultTargetId
                ? <div className="rounded-sm px-3 py-2" style={{ ...inputStyle, color: 'var(--nx-cyan-text)' }}>{defaultTargetName ?? '—'}</div>
                : (
                  <select value={targetId ?? ''} onChange={(e) => setTargetId(e.target.value || null)} className="w-full rounded-sm px-3 py-2 outline-none" style={inputStyle}>
                    <option value="">{t('Aucun', 'None')}</option>
                    {(graph?.nodes ?? []).map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                  </select>
                )}
            </Field>
          </div>
          {mut.isError && <div style={{ color: '#ffb4ab', fontFamily: mono, fontSize: 11 }}>{(mut.error as Error).message}</div>}
          <button onClick={() => mut.mutate()} disabled={!title.trim() || mut.isPending} className="mt-1 flex items-center justify-center gap-2 rounded-sm py-2.5" style={{ background: title.trim() ? CYAN : 'var(--nx-surface-high)', color: title.trim() ? 'var(--nx-on-cyan)' : 'var(--nx-text-muted)', fontSize: 13, fontWeight: 600, cursor: title.trim() ? 'pointer' : 'not-allowed' }}>
            {mut.isPending && <Loader2 size={15} className="animate-spin" />} {t('Créer l’action', 'Create action')}
          </button>
        </div>
      </div>
    </div>
  )
}

const inputStyle = { background: 'var(--nx-panel)', border: '1px solid var(--nx-border)', color: 'var(--nx-text)', fontSize: 13 } as const

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{label}</span>
      {children}
    </label>
  )
}
