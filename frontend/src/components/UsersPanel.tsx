import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Users, UserPlus, Trash2, KeyRound, Loader2, Check, ShieldCheck } from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import type { WorkspaceRole, WorkspaceUser } from '../lib/types'

const mono = 'var(--font-mono)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'

/**
 * Comptes de l'espace de travail. Un pilote réunit plusieurs personnes — elles
 * doivent partager le MÊME espace, alors qu'une inscription libre en crée un
 * nouveau à chaque fois.
 */
export function UsersPanel() {
  const { t } = useLang()
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<WorkspaceRole>('member')

  const { data } = useQuery({ queryKey: ['workspace-users'], queryFn: api.workspaceUsers })
  const refresh = () => qc.invalidateQueries({ queryKey: ['workspace-users'] })

  const invite = useMutation({
    mutationFn: () => api.inviteUser(email.trim(), password, role),
    onSuccess: () => { setEmail(''); setPassword(''); setRole('member'); setAdding(false); refresh() },
  })
  const changeRole = useMutation({ mutationFn: (v: { email: string; role: WorkspaceRole }) => api.setUserRole(v.email, v.role), onSuccess: refresh })
  const remove = useMutation({ mutationFn: (e: string) => api.removeUser(e), onSuccess: refresh })

  const canManage = data?.canManage ?? false
  const errorOf = (e: unknown) => (e as Error)?.message ?? ''

  return (
    <div className="rounded-sm border" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3" style={{ borderColor: 'var(--nx-border)' }}>
        <Users size={15} style={{ color: CYAN }} />
        <h3 style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text)' }}>
          {t('Comptes & rôles', 'Accounts & roles')}
        </h3>
        {canManage && (
          <button onClick={() => setAdding((v) => !v)} className="ml-auto flex items-center gap-1 rounded-sm px-2 py-1"
            style={{ background: 'rgba(0,229,255,0.10)', border: '1px solid rgba(0,229,255,0.30)', fontFamily: mono, fontSize: 11, color: CYAN_T }}>
            <UserPlus size={12} /> {t('Ajouter une personne', 'Add a person')}
          </button>
        )}
      </div>

      <div className="p-4">
        <p className="mb-3" style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>
          {t('Les personnes ajoutées ici partagent CET espace de travail et ses données. Un administrateur configure (comptes, sondes, IA, réglages d’impact) ; un membre consulte et analyse.',
             'People added here share THIS workspace and its data. An admin configures (accounts, probes, AI, impact settings); a member views and analyses.')}
        </p>

        {adding && canManage && (
          <div className="mb-3 flex flex-wrap items-end gap-2 rounded-sm border p-3" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface)' }}>
            <label className="flex-1" style={{ minWidth: 180 }}>
              <span className="mb-1 block" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{t('Courriel', 'Email')}</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom.nom@entreprise.com"
                className="w-full rounded-sm border bg-transparent px-2 py-1.5 outline-none"
                style={{ borderColor: 'var(--nx-border)', fontSize: 13, color: 'var(--nx-text)' }} />
            </label>
            <label className="flex-1" style={{ minWidth: 160 }}>
              <span className="mb-1 block" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{t('Mot de passe provisoire (8+)', 'Temporary password (8+)')}</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-sm border bg-transparent px-2 py-1.5 outline-none"
                style={{ borderColor: 'var(--nx-border)', fontSize: 13, color: 'var(--nx-text)' }} />
            </label>
            <label>
              <span className="mb-1 block" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{t('Rôle', 'Role')}</span>
              <select value={role} onChange={(e) => setRole(e.target.value as WorkspaceRole)}
                className="rounded-sm border bg-transparent px-2 py-1.5 outline-none"
                style={{ borderColor: 'var(--nx-border)', fontSize: 13, color: 'var(--nx-text)' }}>
                <option value="member" style={{ background: 'var(--nx-bg)' }}>{t('Membre', 'Member')}</option>
                <option value="admin" style={{ background: 'var(--nx-bg)' }}>{t('Administrateur', 'Admin')}</option>
              </select>
            </label>
            <button onClick={() => invite.mutate()} disabled={!email.trim() || password.length < 8 || invite.isPending}
              className="flex items-center gap-1 rounded-sm px-3 py-2"
              style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontFamily: mono, fontSize: 12, opacity: email.trim() && password.length >= 8 ? 1 : 0.5 }}>
              {invite.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} {t('Ajouter', 'Add')}
            </button>
            {invite.isError && (
              <p className="w-full" style={{ fontSize: 12, color: '#ffb4ab' }}>
                {errorOf(invite.error).includes('409')
                  ? t('Ce courriel est déjà utilisé sur la plateforme.', 'This email is already used on the platform.')
                  : errorOf(invite.error)}
              </p>
            )}
            <p className="w-full" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-outline)' }}>
              {t('Transmettez ce mot de passe provisoire hors bande ; la personne se connectera ensuite normalement.',
                 'Share this temporary password out of band; the person then signs in normally.')}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-1">
          {(data?.users ?? []).map((u) => (
            <UserRow key={u.email} user={u} canManage={canManage}
              onRole={(r) => changeRole.mutate({ email: u.email, role: r })}
              onRemove={() => { if (confirm(t(`Retirer ${u.email} de l’espace de travail ?`, `Remove ${u.email} from the workspace?`))) remove.mutate(u.email) }} />
          ))}
        </div>

        {(changeRole.isError || remove.isError) && (
          <p className="mt-2" style={{ fontSize: 12, color: '#ffb4ab' }}>
            {t('Opération refusée — l’espace doit conserver au moins un administrateur, et vous ne pouvez pas retirer votre propre compte.',
               'Operation refused — the workspace must keep at least one admin, and you cannot remove your own account.')}
          </p>
        )}

        {!canManage && (
          <p className="mt-3 flex items-center gap-1" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-outline)' }}>
            <ShieldCheck size={11} /> {t('Lecture seule : seul un administrateur peut gérer les comptes.', 'Read-only: only an admin can manage accounts.')}
          </p>
        )}
      </div>
    </div>
  )
}

function UserRow({ user, canManage, onRole, onRemove }: {
  user: WorkspaceUser; canManage: boolean; onRole: (r: WorkspaceRole) => void; onRemove: () => void
}) {
  const { t } = useLang()
  const [resetting, setResetting] = useState(false)
  const [pwd, setPwd] = useState('')
  const reset = useMutation({
    mutationFn: () => api.setUserPassword(user.email, pwd),
    onSuccess: () => { setPwd(''); setResetting(false) },
  })

  return (
    <div className="rounded-sm border px-3 py-2" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface)' }}>
      <div className="flex flex-wrap items-center gap-2">
        <span style={{ fontSize: 13, color: 'var(--nx-text)' }}>{user.email}</span>
        {user.isSelf && <span style={{ fontFamily: mono, fontSize: 10, color: CYAN_T }}>({t('vous', 'you')})</span>}

        {canManage && !user.isSelf ? (
          <select value={user.role} onChange={(e) => onRole(e.target.value as WorkspaceRole)}
            className="rounded-sm border bg-transparent px-1.5 py-0.5"
            style={{ borderColor: 'var(--nx-border)', fontFamily: mono, fontSize: 11, color: 'var(--nx-text)' }}>
            <option value="member" style={{ background: 'var(--nx-bg)' }}>{t('Membre', 'Member')}</option>
            <option value="admin" style={{ background: 'var(--nx-bg)' }}>{t('Administrateur', 'Admin')}</option>
          </select>
        ) : (
          <span className="rounded px-1.5 py-0.5" style={{ fontFamily: mono, fontSize: 10, color: user.role === 'admin' ? CYAN_T : 'var(--nx-text-muted)', background: user.role === 'admin' ? 'rgba(0,229,255,0.10)' : 'transparent' }}>
            {user.role === 'admin' ? t('Administrateur', 'Admin') : t('Membre', 'Member')}
          </span>
        )}

        {canManage && (
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => setResetting((v) => !v)} className="flex items-center gap-1 rounded-sm border px-2 py-1"
              style={{ borderColor: 'var(--nx-border)', fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>
              <KeyRound size={11} /> {t('Mot de passe', 'Password')}
            </button>
            {!user.isSelf && (
              <button onClick={onRemove} className="flex items-center gap-1 rounded-sm border px-2 py-1"
                style={{ borderColor: 'var(--nx-border)', fontFamily: mono, fontSize: 11, color: '#ffb4ab' }}>
                <Trash2 size={11} /> {t('Retirer', 'Remove')}
              </button>
            )}
          </div>
        )}
      </div>

      {resetting && canManage && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder={t('Nouveau mot de passe (8+)', 'New password (8+)')}
            className="flex-1 rounded-sm border bg-transparent px-2 py-1.5 outline-none"
            style={{ borderColor: 'var(--nx-border)', fontSize: 13, color: 'var(--nx-text)', minWidth: 200 }} />
          <button onClick={() => reset.mutate()} disabled={pwd.length < 8 || reset.isPending}
            className="rounded-sm px-3 py-1.5"
            style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontFamily: mono, fontSize: 11, opacity: pwd.length >= 8 ? 1 : 0.5 }}>
            {reset.isPending ? t('…', '…') : reset.isSuccess ? t('Réinitialisé', 'Reset') : t('Réinitialiser', 'Reset')}
          </button>
        </div>
      )}
    </div>
  )
}
