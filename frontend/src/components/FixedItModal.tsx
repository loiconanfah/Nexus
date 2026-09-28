import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, X } from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import { notify } from '../lib/notify'
import { useMoney } from '../lib/money'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'

/**
 * « J'ai corrigé ça », depuis l'endroit où le défaut est signalé.
 *
 * Le produit détectait et recommandait, puis s'arrêtait. Poser un secours ou
 * nommer un responsable obligeait à quitter l'écran du problème, à retrouver
 * l'actif ailleurs et à devinier quel lien créer. Le travail le plus utile
 * restait donc invisible.
 *
 * Chaque correction proposée ici écrit un VRAI lien dans la cartographie : c'est
 * la condition pour qu'un score bouge. La dernière option n'écrit rien et
 * l'assume, parce qu'une note ne rend pas une organisation plus résiliente.
 */
/**
 * Monté à l'ouverture, démonté à la fermeture : son état part donc toujours de la
 * correction que le contexte suggère, sans avoir à le réinitialiser dans un effet.
 */
export function FixedItModal({ open, onClose, targetId, targetName, suggest, only, reason }: {
  open: boolean
  onClose: () => void
  targetId: string
  targetName: string
  /** La correction que le contexte rend probable, pré-sélectionnée. */
  suggest?: string
  /** Les corrections qui ont un sens ici. « Autre » reste toujours offerte. */
  only?: string[]
  /** Le défaut auquel on répond, rappelé en tête. */
  reason?: string
}) {
  const { t } = useLang()
  const qc = useQueryClient()
  const money = useMoney()
  const [kind, setKind] = useState(suggest ?? 'backup')
  const [withName, setWithName] = useState('')
  const [note, setNote] = useState('')

  const KINDS: { key: string; fr: string; en: string; askFr: string; askEn: string }[] = [
    { key: 'backup', fr: 'Un secours existe désormais', en: 'A backup now exists', askFr: 'Qui prend le relais ?', askEn: 'What takes over?' },
    { key: 'supplier', fr: 'Un second fournisseur est qualifié', en: 'A second supplier is qualified', askFr: 'Lequel ?', askEn: 'Which one?' },
    { key: 'procedure', fr: 'Une procédure écrite existe', en: 'A written procedure exists', askFr: 'Son titre ?', askEn: 'Its title?' },
    { key: 'owner', fr: 'Un responsable est nommé', en: 'Someone is now responsible', askFr: 'Qui ?', askEn: 'Who?' },
    { key: 'second_person', fr: 'Une seconde personne sait le faire fonctionner', en: 'A second person can run it', askFr: 'Qui ?', askEn: 'Who?' },
    { key: 'note', fr: 'Autre, sans changement dans la carte', en: 'Other, no change to the map', askFr: '', askEn: '' },
  ]
  // Restreindre la liste à ce qui a un sens ici vaut mieux que de tout proposer :
  // un écran de dépendance humaine n'a pas à offrir « second fournisseur ».
  const offered = only?.length ? KINDS.filter((k) => only.includes(k.key) || k.key === 'note') : KINDS
  const chosen = KINDS.find((k) => k.key === kind) ?? offered[0]
  const needsName = chosen.key !== 'note'

  const apply = useMutation({
    mutationFn: () => api.applyRemediation({
      kind, targetId,
      withName: needsName ? withName.trim() : undefined,
      note: note.trim() || undefined,
    }),
    onSuccess: (r) => {
      qc.invalidateQueries()
      onClose()
      setWithName(''); setNote('')
      const d = r.delta
      notify({
        kind: 'success',
        title: r.remediation.changedGraph
          ? t('Correction enregistrée et mesurée', 'Correction recorded and measured')
          : t('Correction notée', 'Correction noted'),
        message: r.remediation.changedGraph
          ? t(
            `${targetName} : score ${r.remediation.scoreBefore} puis ${r.remediation.scoreAfter}, indice ${d.index >= 0 ? '+' : ''}${d.index}` +
            `${d.spofRemoved ? ', un point unique de défaillance en moins' : ''}` +
            `${d.hourlyCost !== 0 ? `, ${money.compact(Math.abs(d.hourlyCost))} par heure ${d.hourlyCost < 0 ? 'en moins' : 'en plus'}` : ''}.`,
            `${targetName}: score ${r.remediation.scoreBefore} then ${r.remediation.scoreAfter}, index ${d.index >= 0 ? '+' : ''}${d.index}` +
            `${d.spofRemoved ? ', one single point of failure removed' : ''}.`)
          : t('Conservée dans le journal, sans effet sur les scores : rien n’a changé dans la cartographie.',
            'Kept in the log, with no effect on scores: nothing changed in the map.'),
        duration: 0,
      })
    },
    onError: (e) => notify({
      kind: 'error',
      title: t('Enregistrement impossible', 'Could not record'),
      message: (e as Error).message.includes('counterpart_required')
        ? t('Nommez l’élément qui porte la correction.', 'Name the element that carries the correction.')
        : (e as Error).message.slice(0, 160),
    }),
  })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="flex w-full max-w-lg flex-col gap-4 rounded-md border p-5"
        style={{ background: 'var(--nx-panel)', borderColor: 'var(--nx-border)' }}>
        <div className="flex items-start justify-between">
          <div>
            <h3 style={{ fontFamily: geist, fontSize: 20, color: 'var(--nx-text)' }}>{t('J’ai corrigé ça', 'I fixed this')}</h3>
            <p className="mt-0.5" style={{ fontSize: 12.5, color: 'var(--nx-text-muted)' }}>{targetName}</p>
            {reason && <p className="mt-0.5" style={{ fontSize: 12, color: 'var(--nx-warning)' }}>{reason}</p>}
          </div>
          <button onClick={onClose} style={{ color: 'var(--nx-text-muted)' }}><X size={18} /></button>
        </div>

        <div className="flex flex-col gap-1.5">
          {offered.map((k) => (
            <label key={k.key} className="flex cursor-pointer items-start gap-2" style={{ fontSize: 13, color: 'var(--nx-text)' }}>
              <input type="radio" name="fix" checked={kind === k.key} onChange={() => setKind(k.key)}
                className="mt-0.5" style={{ accentColor: CYAN }} />
              <span>{t(k.fr, k.en)}</span>
            </label>
          ))}
        </div>

        {needsName && (
          <label className="flex flex-col gap-1">
            <span style={{ fontFamily: mono, fontSize: 10.5, textTransform: 'uppercase', color: 'var(--nx-label)' }}>
              {t(chosen.askFr, chosen.askEn)}
            </span>
            <input autoFocus value={withName} onChange={(e) => setWithName(e.target.value)}
              placeholder={t('Nom exact. S’il n’existe pas encore dans la carte, il y sera ajouté.',
                'Exact name. If it is not in the map yet, it will be added.')}
              className="rounded-sm border bg-transparent px-2 py-1.5 outline-none"
              style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text)', fontSize: 13 }} />
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span style={{ fontFamily: mono, fontSize: 10.5, textTransform: 'uppercase', color: 'var(--nx-label)' }}>
            {t('Ce qui a été fait, en une ligne', 'What was done, in one line')}
          </span>
          <input value={note} onChange={(e) => setNote(e.target.value)}
            placeholder={t('Sert de preuve : qui, quand, comment.', 'Serves as evidence: who, when, how.')}
            className="rounded-sm border bg-transparent px-2 py-1.5 outline-none"
            style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text)', fontSize: 13 }} />
        </label>

        <p style={{ fontSize: 11.5, color: 'var(--nx-text-muted)', lineHeight: 1.5 }}>
          {t('Le score et l’indice sont mesurés avant puis après, par les mêmes moteurs que les écrans. Une correction sans changement dans la carte est conservée mais n’améliore aucun score.',
            'The score and index are measured before and after, by the same engines as the screens. A correction that changes nothing in the map is kept but improves no score.')}
        </p>

        <div className="flex items-center gap-3">
          <button onClick={() => apply.mutate()} disabled={apply.isPending || (needsName && !withName.trim())}
            className="flex items-center gap-2 rounded-sm px-4 py-2 disabled:opacity-50"
            style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontSize: 13, fontWeight: 600 }}>
            {apply.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {t('Enregistrer et mesurer', 'Record and measure')}
          </button>
          <button onClick={onClose} style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>{t('Annuler', 'Cancel')}</button>
        </div>
      </div>
    </div>
  )
}
