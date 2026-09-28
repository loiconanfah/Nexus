import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookmarkPlus, Check, Loader2, Save, Trash2, X } from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import { notify } from '../lib/notify'
import type { SavedView, ViewConfig } from '../lib/types'

const mono = 'var(--font-mono)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'

/**
 * Barre des vues enregistrées, partagée par les écrans de risques et de graphe.
 *
 * Les deux écrans savaient déjà filtrer ; ce qui leur manquait était de GARDER
 * une sélection. Une vue ne stocke que des critères, si bien qu'elle reste juste
 * quand le graphe change, et elle appartient à l'espace de travail : un tableau
 * utile doit servir aux collègues plutôt que de mourir avec le compte qui l'a
 * construit.
 */
export function SavedViews({ kind, current, onApply, active, onActiveChange }: {
  kind: 'risk' | 'graph'
  current: ViewConfig
  onApply: (config: ViewConfig) => void
  active: string | null
  onActiveChange: (id: string | null) => void
}) {
  const { t } = useLang()
  const qc = useQueryClient()
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')

  const views = useQuery({ queryKey: ['views', kind], queryFn: () => api.views(kind) })
  const done = () => { qc.invalidateQueries({ queryKey: ['views', kind] }); setNaming(false); setName('') }

  const create = useMutation({
    mutationFn: () => api.createView(kind, name.trim(), current),
    onSuccess: (v) => {
      done()
      onActiveChange(v.id)
      notify({
        kind: 'success',
        title: t('Vue enregistrée', 'View saved'),
        message: t(`« ${v.name} » est disponible pour tout votre espace.`, `“${v.name}” is available to your whole workspace.`),
      })
    },
    onError: (e) => notify({ kind: 'error', title: t('Enregistrement impossible', 'Could not save'), message: message(e) }),
  })

  const save = useMutation({
    mutationFn: (v: SavedView) => api.updateView(v.id, kind, v.name, current),
    onSuccess: (v) => {
      qc.invalidateQueries({ queryKey: ['views', kind] })
      notify({ kind: 'success', title: t('Vue mise à jour', 'View updated'), message: v.name })
    },
    onError: (e) => notify({ kind: 'error', title: t('Mise à jour impossible', 'Could not update'), message: message(e) }),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteView(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['views', kind] }); onActiveChange(null) },
    onError: (e) => notify({ kind: 'error', title: t('Suppression impossible', 'Could not delete'), message: message(e) }),
  })

  const list = views.data ?? []
  const current$ = list.find((v) => v.id === active) ?? null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--nx-label)' }}>
        {kind === 'risk' ? t('Mes tableaux', 'My tables') : t('Mes vues', 'My views')}
      </span>

      {list.map((v) => {
        const on = v.id === active
        return (
          <span key={v.id} className="flex items-center gap-1 rounded-sm border px-2 py-1"
            style={{ borderColor: on ? CYAN : 'var(--nx-border)', background: on ? 'color-mix(in srgb, var(--nx-cyan) 10%, transparent)' : 'var(--nx-surface)' }}>
            <button onClick={() => { onApply(v.config); onActiveChange(v.id) }}
              style={{ fontSize: 12.5, color: on ? CYAN_T : 'var(--nx-text)' }}>{v.name}</button>
            {on && (
              <button onClick={() => save.mutate(v)} disabled={save.isPending}
                title={t('Enregistrer les filtres actuels dans cette vue', 'Save the current filters into this view')}
                aria-label={t('Enregistrer', 'Save')} style={{ color: 'var(--nx-text-muted)' }}>
                {save.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              </button>
            )}
            <button onClick={() => remove.mutate(v.id)} disabled={remove.isPending}
              title={t('Supprimer cette vue', 'Delete this view')} aria-label={t('Supprimer', 'Delete')}
              style={{ color: 'var(--nx-outline)' }}><Trash2 size={12} /></button>
          </span>
        )
      })}

      {list.length === 0 && !naming && (
        <span style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>
          {t('Aucune pour l’instant. Filtrez, puis enregistrez.', 'None yet. Filter, then save.')}
        </span>
      )}

      {naming ? (
        <span className="flex items-center gap-1.5">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) create.mutate(); if (e.key === 'Escape') setNaming(false) }}
            placeholder={kind === 'risk' ? t('Ex. Agences critiques', 'e.g. Critical branches') : t('Ex. Chaîne paiement', 'e.g. Payment chain')}
            className="rounded-sm border bg-transparent px-2 py-1 outline-none"
            style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text)', fontSize: 12.5, width: 200 }} />
          <button onClick={() => create.mutate()} disabled={!name.trim() || create.isPending}
            className="flex items-center gap-1 rounded-sm px-2 py-1 disabled:opacity-50"
            style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontSize: 12, fontWeight: 600 }}>
            {create.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          </button>
          <button onClick={() => setNaming(false)} style={{ color: 'var(--nx-text-muted)' }}><X size={14} /></button>
        </span>
      ) : (
        <button onClick={() => { setNaming(true); setName('') }}
          className="flex items-center gap-1.5 rounded-sm border px-2 py-1"
          style={{ borderColor: 'var(--nx-border)', color: CYAN_T, fontSize: 12 }}>
          <BookmarkPlus size={13} /> {t('Enregistrer cette sélection', 'Save this selection')}
        </button>
      )}

      {current$ && (
        <span style={{ fontSize: 11.5, color: 'var(--nx-outline)' }}>
          {t('Vue active', 'Active view')} : {current$.name}
        </span>
      )}
    </div>
  )
}

function message(e: unknown) {
  const raw = e instanceof Error ? e.message : ''
  return raw.includes('too_many_views')
    ? 'Le nombre maximal de vues est atteint. Supprimez-en une.'
    : raw.slice(0, 160)
}
