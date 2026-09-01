import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Check, Database, KeyRound, Loader2, LogOut, RotateCcw, Server, Settings, ShieldCheck, Sparkles, X } from 'lucide-react'
import { api } from '../lib/api'
import { getTenantId, resetTenant } from '../lib/tenant'
import { logout } from '../lib/auth'
import { useLang } from '../lib/i18n'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'

export function Admin() {
  const navigate = useNavigate()
  const { t } = useLang()
  const tenant = getTenantId()
  const { data: health, isLoading } = useQuery({ queryKey: ['health'], queryFn: api.health, refetchInterval: 15000 })
  const { data: overview } = useQuery({ queryKey: ['overview'], queryFn: api.overview })

  const ready = health?.status === 'ready'

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-2" style={{ fontFamily: geist, fontSize: 24, color: 'var(--nx-text)' }}>
          <Settings size={22} style={{ color: CYAN }} /> {t('Admin & système', 'Admin & System')}
        </h2>
        <p className="mt-1" style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>{t('Configuration de l’espace de travail et santé de la plateforme.', 'Workspace configuration and platform health.')}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Sante plateforme */}
        <div className="rounded-sm border" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
          <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: 'var(--nx-border)' }}>
            <ShieldCheck size={15} style={{ color: ready ? '#4ade80' : '#facc15' }} />
            <h3 style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text)' }}>{t('Santé de la plateforme', 'Platform Health')}</h3>
            <span className="ml-auto rounded px-2 py-0.5" style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: ready ? '#4ade80' : '#facc15', background: ready ? 'rgba(74,222,128,0.12)' : 'rgba(250,204,21,0.12)' }}>{isLoading ? '…' : (health?.status === 'ready' ? t('prêt', 'ready') : health?.status)}</span>
          </div>
          <div className="flex flex-col divide-y" style={{ borderColor: 'var(--nx-border)' }}>
            <HealthRow icon={Database} label={t('PostgreSQL (plan de contrôle)', 'PostgreSQL (control plane)')} ok={health?.dependencies.postgres} />
            <HealthRow icon={Server} label={t('Neo4j (graphe de connaissance)', 'Neo4j (knowledge graph)')} ok={health?.dependencies.neo4j} />
          </div>
          <div className="px-4 py-2" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{t('Rafraîchissement auto 15s · dernière vérification', 'Auto-refresh every 15s · last check')} {health ? new Date(health.utc).toLocaleTimeString() : '—'}</div>
        </div>

        {/* Workspace */}
        <div className="rounded-sm border" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
          <div className="border-b px-4 py-3" style={{ borderColor: 'var(--nx-border)' }}>
            <h3 style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text)' }}>{t('Espace de travail', 'Workspace')}</h3>
          </div>
          <div className="flex flex-col divide-y" style={{ borderColor: 'var(--nx-border)' }}>
            <InfoRow label={t('ID du tenant', 'Tenant ID')} value={tenant} mono />
            <InfoRow label={t('Entités', 'Entities')} value={String(overview?.entityCount ?? '—')} />
            <InfoRow label={t('Relations', 'Relations')} value={String(overview?.relationCount ?? '—')} />
            <InfoRow label={t('Score de santé', 'Health score')} value={String(overview?.organizationHealthScore ?? '—')} />
          </div>
        </div>
      </div>

      {/* Intégrations IA */}
      <AiIntegration />

      {/* Actions */}
      <div className="rounded-sm border" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
        <div className="border-b px-4 py-3" style={{ borderColor: 'var(--nx-border)' }}>
          <h3 style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text)' }}>Actions</h3>
        </div>
        <div className="flex flex-wrap gap-3 p-4">
          <button onClick={() => navigate('/onboarding')} className="flex items-center gap-2 rounded-sm px-3 py-2" style={{ background: 'rgba(0,229,255,0.10)', border: '1px solid rgba(0,229,255,0.30)', color: CYAN_T, fontFamily: mono, fontSize: 12 }}>
            <Database size={14} /> {t('Ingérer des données', 'Ingest data')}
          </button>
          <button onClick={() => { if (confirm(t('Démarrer un espace de travail vierge ? Le tenant de démo actuel sera remplacé localement.', 'Start a fresh, empty workspace? The current demo tenant will be replaced locally.'))) { resetTenant(); window.location.href = '/' } }} className="flex items-center gap-2 rounded-sm px-3 py-2" style={{ background: 'var(--nx-surface)', border: '1px solid var(--nx-border)', color: 'var(--nx-text)', fontFamily: mono, fontSize: 12 }}>
            <RotateCcw size={14} /> {t('Nouvel espace vierge', 'New empty workspace')}
          </button>
          <button onClick={() => { logout(); navigate('/login') }} className="flex items-center gap-2 rounded-sm px-3 py-2" style={{ background: 'var(--nx-surface)', border: '1px solid var(--nx-border)', color: '#ffb4ab', fontFamily: mono, fontSize: 12 }}>
            <LogOut size={14} /> {t('Se déconnecter', 'Sign out')}
          </button>
        </div>
      </div>
    </div>
  )
}

function AiIntegration() {
  const { t } = useLang()
  const qc = useQueryClient()
  const { data: cfg } = useQuery({ queryKey: ['aiConfig'], queryFn: api.aiConfig })
  const [provider, setProvider] = useState('anthropic')
  const [apiKey, setApiKey] = useState('')
  const [endpoint, setEndpoint] = useState('')
  const [model, setModel] = useState('')
  const [testMsg, setTestMsg] = useState<{ ok: boolean; message: string } | null>(null)
  const [models, setModels] = useState<string[]>([])

  const loadModels = useMutation({
    mutationFn: api.aiModels,
    onSuccess: (r) => { setModels(r.models); if (!r.ok) setTestMsg({ ok: false, message: r.message }) },
  })
  const save = useMutation({
    mutationFn: () => api.setAiKey({ provider, apiKey, endpoint: endpoint || undefined, model: model || undefined }),
    onSuccess: () => { setApiKey(''); setTestMsg(null); qc.invalidateQueries({ queryKey: ['aiConfig'] }); loadModels.mutate() },
  })
  const test = useMutation({ mutationFn: api.testAiKey, onSuccess: (r) => setTestMsg(r) })
  const pickModel = useMutation({ mutationFn: (m: string) => api.setAiModel(m), onSuccess: () => { setTestMsg(null); qc.invalidateQueries({ queryKey: ['aiConfig'] }) } })
  const autoPick = useMutation({ mutationFn: api.autoPickModel, onSuccess: (r) => { setTestMsg({ ok: r.ok, message: r.ok ? `Modèle auto-sélectionné : ${r.model}` : (r.message ?? 'Aucun modèle utilisable.') }); qc.invalidateQueries({ queryKey: ['aiConfig'] }) } })
  const clear = useMutation({ mutationFn: api.clearAiKey, onSuccess: () => { setTestMsg(null); setModels([]); qc.invalidateQueries({ queryKey: ['aiConfig'] }) } })

  const providerLabel = (p: string) => p === 'anthropic' ? 'Claude (Anthropic)' : p === 'azure-openai' ? 'Azure OpenAI' : p === 'openai' ? 'OpenAI' : p === 'gemini' ? 'Google Gemini' : p
  const configured = cfg?.configured

  return (
    <div className="rounded-sm border" style={{ background: 'var(--nx-surface-container)', borderColor: configured ? 'rgba(192,132,252,0.35)' : 'var(--nx-border)' }}>
      <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: 'var(--nx-border)' }}>
        <KeyRound size={15} style={{ color: '#c084fc' }} />
        <h3 style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text)' }}>{t('Intégrations IA', 'AI Integrations')}</h3>
        <span className="ml-auto rounded px-2 py-0.5" style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: configured ? '#4ade80' : 'var(--nx-text-muted)', background: configured ? 'rgba(74,222,128,0.12)' : 'var(--nx-surface)' }}>
          {configured ? `${t('Configuré', 'Configured')} · ${providerLabel(cfg!.provider)}` : t('Non configuré', 'Not configured')}
        </span>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <p style={{ fontSize: 12.5, color: 'var(--nx-text-muted)', lineHeight: 1.5 }}>
          {t('Ajoutez votre clé pour activer la naturalisation des réponses de l’Analyste IA et le mapping assisté. Elle est enregistrée côté serveur, propre à votre espace de travail — elle persiste entre les sessions et les redéploiements, n’est jamais renvoyée au navigateur ni partagée avec les autres tenants.', 'Add your key to enable AI Analyst naturalization and assisted mapping. It is stored server-side, scoped to your workspace — it persists across sessions and redeploys, is never returned to the browser and never shared with other tenants.')}
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{t('Fournisseur', 'Provider')}</span>
            <select value={provider} onChange={(e) => setProvider(e.target.value)} className="rounded-sm px-3 py-2 outline-none" style={inputStyle}>
              <option value="anthropic">Claude (Anthropic)</option>
              <option value="gemini">Google Gemini {t('(palier gratuit)', '(free tier)')}</option>
              <option value="openai">OpenAI</option>
              <option value="azure-openai">Azure OpenAI</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{t('Clé API', 'API key')}</span>
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" placeholder={configured ? '•••••••• ' + t('(remplacer)', '(replace)') : provider === 'gemini' ? 'AIza…' : 'sk-…'} className="rounded-sm px-3 py-2 outline-none" style={inputStyle} />
          </label>
          {provider === 'azure-openai' && (
            <label className="flex flex-col gap-1">
              <span style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{t('Endpoint Azure', 'Azure endpoint')}</span>
              <input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://xxx.openai.azure.com" className="rounded-sm px-3 py-2 outline-none" style={inputStyle} />
            </label>
          )}
          <label className="flex flex-col gap-1">
            <span className="flex items-center justify-between" style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>
              {t('Modèle', 'Model')}
              {configured && (
                <span className="flex gap-3">
                  <button type="button" onClick={() => autoPick.mutate()} style={{ color: CYAN_T, textTransform: 'none' }}>{autoPick.isPending ? '…' : t('auto-choisir', 'auto-pick')}</button>
                  <button type="button" onClick={() => loadModels.mutate()} style={{ color: CYAN_T, textTransform: 'none' }}>{loadModels.isPending ? '…' : t('charger la liste', 'load list')}</button>
                </span>
              )}
            </span>
            {models.length > 0 ? (
              <select value={cfg?.model ?? ''} onChange={(e) => pickModel.mutate(e.target.value)} className="rounded-sm px-3 py-2 outline-none" style={inputStyle}>
                {!cfg?.model && <option value="">—</option>}
                {models.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : (
              <input value={model} onChange={(e) => setModel(e.target.value)} placeholder={configured ? (cfg?.model ?? '') : t('optionnel — laissez vide pour le défaut', 'optional — leave blank for default')} className="rounded-sm px-3 py-2 outline-none" style={inputStyle} />
            )}
          </label>
        </div>

        {testMsg && (
          <div className="flex items-center gap-2 rounded-sm p-2.5" style={{ background: testMsg.ok ? 'rgba(74,222,128,0.08)' : 'rgba(255,180,171,0.08)', border: `1px solid ${testMsg.ok ? '#4ade8040' : '#ffb4ab40'}` }}>
            {testMsg.ok ? <Check size={15} style={{ color: '#4ade80' }} /> : <X size={15} style={{ color: '#ffb4ab' }} />}
            <span style={{ fontSize: 12.5, color: testMsg.ok ? '#4ade80' : '#ffb4ab' }}>{testMsg.message}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button onClick={() => save.mutate()} disabled={!apiKey.trim() || save.isPending} className="flex items-center gap-2 rounded-sm px-3 py-2" style={{ background: apiKey.trim() ? '#c084fc' : 'var(--nx-surface-high)', color: apiKey.trim() ? '#1a0a2e' : 'var(--nx-text-muted)', fontFamily: mono, fontSize: 12, fontWeight: 600, cursor: apiKey.trim() ? 'pointer' : 'not-allowed' }}>
            {save.isPending ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />} {t('Enregistrer la clé', 'Save key')}
          </button>
          <button onClick={() => test.mutate()} disabled={!configured || test.isPending} className="flex items-center gap-2 rounded-sm px-3 py-2" style={{ background: 'rgba(0,229,255,0.10)', border: '1px solid rgba(0,229,255,0.30)', color: CYAN_T, fontFamily: mono, fontSize: 12, cursor: configured ? 'pointer' : 'not-allowed', opacity: configured ? 1 : 0.5 }}>
            {test.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {t('Tester la connexion', 'Test connection')}
          </button>
          <button onClick={() => clear.mutate()} disabled={!configured || clear.isPending} className="flex items-center gap-2 rounded-sm px-3 py-2" style={{ background: 'var(--nx-surface)', border: '1px solid var(--nx-border)', color: '#ffb4ab', fontFamily: mono, fontSize: 12, cursor: configured ? 'pointer' : 'not-allowed', opacity: configured ? 1 : 0.5 }}>
            <X size={14} /> {t('Effacer', 'Clear')}
          </button>
        </div>
        <p style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{t('Votre clé est conservée dans la base privée du serveur, rattachée à votre espace de travail. L’administrateur peut aussi définir une clé globale (variable d’environnement) comme repli.', 'Your key is kept in the server’s private database, scoped to your workspace. An operator may also set a global key (environment variable) as a fallback.')}</p>
      </div>
    </div>
  )
}

const inputStyle = { background: 'var(--nx-panel)', border: '1px solid var(--nx-border)', color: 'var(--nx-text)', fontSize: 13 } as const

function HealthRow({ icon: Icon, label, ok }: { icon: typeof Database; label: string; ok?: boolean }) {
  const { t } = useLang()
  const color = ok == null ? '#849396' : ok ? '#4ade80' : '#ffb4ab'
  return (
    <div className="flex items-center justify-between px-4 py-3" style={{ borderColor: 'var(--nx-border)' }}>
      <span className="flex items-center gap-2" style={{ fontSize: 13, color: 'var(--nx-text)' }}><Icon size={15} style={{ color: 'var(--nx-text-muted)' }} /> {label}</span>
      <span className="flex items-center gap-1.5" style={{ fontFamily: mono, fontSize: 11, color }}>
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
        {ok == null ? t('VÉRIFICATION', 'CHECKING') : ok ? t('CONNECTÉ', 'CONNECTED') : t('HORS SERVICE', 'DOWN')}
      </span>
    </div>
  )
}

function InfoRow({ label, value, mono: isMono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3" style={{ borderColor: 'var(--nx-border)' }}>
      <span style={{ fontFamily: mono, fontSize: 11, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{label}</span>
      <span style={{ fontFamily: isMono ? mono : geist, fontSize: 13, color: 'var(--nx-text)' }}>{value}</span>
    </div>
  )
}
