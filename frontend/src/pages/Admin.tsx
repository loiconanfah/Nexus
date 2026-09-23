import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Check, Database, Download, KeyRound, Loader2, LogOut, RotateCcw, Server, Settings, ShieldCheck, Sparkles, Upload, X } from 'lucide-react'
import { api } from '../lib/api'
import { getTenantId } from '../lib/tenant'
import { logout } from '../lib/auth'
import { useLang } from '../lib/i18n'
import { CollectorsPanel } from '../components/CollectorsPanel'
import { UsersPanel } from '../components/UsersPanel'
import type { ImpactTuning, WorkspaceSummary } from '../lib/types'
import { notify } from '../lib/notify'
import { useMoney, useOrganization } from '../lib/money'
import { SECTOR_LABELS } from '../lib/orgLists'

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
            <ShieldCheck size={15} style={{ color: ready ? 'var(--nx-success)' : 'var(--nx-warning)' }} />
            <h3 style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text)' }}>{t('Santé de la plateforme', 'Platform Health')}</h3>
            <span className="ml-auto rounded px-2 py-0.5" style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: ready ? 'var(--nx-success)' : 'var(--nx-warning)', background: ready ? 'color-mix(in srgb, var(--nx-success) 12%, transparent)' : 'color-mix(in srgb, var(--nx-warning) 12%, transparent)' }}>{isLoading ? '…' : (health?.status === 'ready' ? t('prêt', 'ready') : health?.status)}</span>
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

      {/* Profil de l'organisation (saisi à l'assistant de démarrage) */}
      <OrganizationCard />

      {/* Intégrations IA */}
      <AiIntegration />

      {/* Comptes de l'espace de travail */}
      <UsersPanel />

      {/* Sondes de collecte installées chez le client */}
      <CollectorsPanel />

      {/* Réglages du modèle d'impact */}
      <ImpactTuningPanel />

      {/* Sauvegarde et remise à zéro */}
      <WorkspaceDataPanel />

      {/* Actions */}
      <div className="rounded-sm border" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
        <div className="border-b px-4 py-3" style={{ borderColor: 'var(--nx-border)' }}>
          <h3 style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text)' }}>Actions</h3>
        </div>
        <div className="flex flex-wrap gap-3 p-4">
          <button onClick={() => navigate('/onboarding')} className="flex items-center gap-2 rounded-sm px-3 py-2" style={{ background: 'color-mix(in srgb, var(--nx-cyan) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--nx-cyan) 30%, transparent)', color: CYAN_T, fontFamily: mono, fontSize: 12 }}>
            <Database size={14} /> {t('Ingérer des données', 'Ingest data')}
          </button>
          <button onClick={() => { logout(); navigate('/login') }} className="flex items-center gap-2 rounded-sm px-3 py-2" style={{ background: 'var(--nx-surface)', border: '1px solid var(--nx-border)', color: 'var(--nx-danger)', fontFamily: mono, fontSize: 12 }}>
            <LogOut size={14} /> {t('Se déconnecter', 'Sign out')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Réglages du modèle d'impact financier (par tenant) ──
const COST_FIELDS: [keyof ImpactTuning, string, string][] = [
  ['costVeryHigh', 'Coût/h · criticité ≥ 90', 'Cost/h · criticality ≥ 90'],
  ['costHigh', 'Coût/h · ≥ 80', 'Cost/h · ≥ 80'],
  ['costElevated', 'Coût/h · ≥ 70', 'Cost/h · ≥ 70'],
  ['costSignificant', 'Coût/h · ≥ 60', 'Cost/h · ≥ 60'],
  ['costModerate', 'Coût/h · ≥ 40', 'Cost/h · ≥ 40'],
  ['costLow', 'Coût/h · ≥ 20', 'Cost/h · ≥ 20'],
  ['costMinimal', 'Coût/h · < 20', 'Cost/h · < 20'],
]
const CURVE_FIELDS: [keyof ImpactTuning, string, string, string][] = [
  ['rtoMultiplier', 'Multiplicateur RTO', 'RTO multiplier', '×'],
  ['probabilityDecay', 'Décroissance de probabilité', 'Probability decay', '0–1'],
  ['probabilityFloor', 'Plancher de probabilité', 'Probability floor', '0–1'],
]

function ImpactTuningPanel() {
  const { t } = useLang()
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['impact-config'], queryFn: api.impactConfig })
  const [form, setForm] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState(false)

  // Initialise le formulaire depuis les réglages effectifs.
  useEffect(() => {
    if (data && !dirty) {
      const f: Record<string, string> = {}
      for (const k of Object.keys(data.tuning) as (keyof ImpactTuning)[]) f[k] = String(data.tuning[k])
      setForm(f)
    }
  }, [data, dirty])

  const set = (k: string, v: string) => { setDirty(true); setForm((s) => ({ ...s, [k]: v })) }
  const save = useMutation({
    mutationFn: () => {
      const tuning = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, Number(v) || 0])) as unknown as ImpactTuning
      return api.saveImpactConfig(tuning)
    },
    onSuccess: () => { setDirty(false); qc.invalidateQueries({ queryKey: ['impact-config'] }) },
  })
  const reset = useMutation({ mutationFn: api.resetImpactConfig, onSuccess: () => { setDirty(false); qc.invalidateQueries({ queryKey: ['impact-config'] }) } })

  return (
    <div className="rounded-sm border" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
      <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: 'var(--nx-border)' }}>
        <Settings size={15} style={{ color: CYAN }} />
        <h3 style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text)' }}>{t('Modèle d’impact financier', 'Financial impact model')}</h3>
        <span className="ml-auto rounded px-2 py-0.5" style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: data?.customized ? 'var(--nx-warning)' : 'var(--nx-text-muted)', background: data?.customized ? 'rgba(224,178,60,0.12)' : 'var(--nx-surface)' }}>
          {data?.customized ? t('personnalisé', 'customized') : t('valeurs par défaut', 'defaults')}
        </span>
      </div>
      <div className="p-4">
        <p className="mb-3" style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>
          {t('Adaptez les hypothèses d’impact à votre organisation. Un coût réel saisi par actif prime toujours sur ces paliers.',
             'Tune the impact assumptions to your organization. A real per-asset cost always overrides these tiers.')}
        </p>
        <div className="mb-2" style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--nx-label)' }}>{t('Paliers de coût d’arrêt (par heure)', 'Downtime cost tiers (per hour)')}</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {COST_FIELDS.map(([k, fr, en]) => (
            <TuneInput key={k} label={t(fr, en)} value={form[k] ?? ''} onChange={(v) => set(k, v)} />
          ))}
        </div>
        <div className="mb-2 mt-4" style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--nx-label)' }}>{t('Courbes', 'Curves')}</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {CURVE_FIELDS.map(([k, fr, en, suffix]) => (
            <TuneInput key={k} label={t(fr, en)} value={form[k] ?? ''} onChange={(v) => set(k, v)} suffix={suffix} />
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button onClick={() => save.mutate()} disabled={save.isPending || !dirty} className="flex items-center gap-1.5 rounded-sm px-3 py-2" style={{ background: dirty ? CYAN : 'var(--nx-surface)', color: dirty ? 'var(--nx-on-cyan)' : 'var(--nx-text-muted)', fontFamily: mono, fontSize: 12 }}>
            <Check size={14} /> {save.isPending ? t('Enregistrement…', 'Saving…') : t('Enregistrer', 'Save')}
          </button>
          <button onClick={() => reset.mutate()} disabled={reset.isPending} className="flex items-center gap-1.5 rounded-sm border px-3 py-2" style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text-muted)', fontFamily: mono, fontSize: 12 }}>
            <RotateCcw size={14} /> {t('Valeurs par défaut', 'Reset to defaults')}
          </button>
        </div>
      </div>
    </div>
  )
}

function TuneInput({ label, value, onChange, suffix }: { label: string; value: string; onChange: (v: string) => void; suffix?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--nx-text-muted)' }}>{label}</span>
      <div className="flex items-center rounded-sm border" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-bg)' }}>
        <input type="number" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent px-2 py-1.5 outline-none" style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--nx-text)' }} />
        {suffix && <span className="px-2" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--nx-outline)' }}>{suffix}</span>}
      </div>
    </label>
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
  // Ce que l'espace a consommé ce mois-ci : sans ce chiffre, on ne peut que
  // supposer qu'une analyse coûte cher.
  const { data: usage } = useQuery({ queryKey: ['aiUsage'], queryFn: api.aiUsage, refetchInterval: 60000 })

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
  // « shared » : l'espace n'a pas de clé propre et utilise celle de Lenexux.
  const shared = cfg?.source === 'shared'
  // Réglages propres (modèle, effacement) : seulement avec une clé de l'espace.
  const configured = cfg?.configured && !shared

  // Charge automatiquement la liste des modèles dès qu'une clé est configurée :
  // on peut ainsi CHANGER de modèle via le menu déroulant, sans re-saisir la clé.
  const autoLoaded = useRef(false)
  useEffect(() => {
    if (configured && !autoLoaded.current) { autoLoaded.current = true; loadModels.mutate() }
    if (!configured) autoLoaded.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured])

  return (
    <div className="rounded-sm border" style={{ background: 'var(--nx-surface-container)', borderColor: configured ? 'color-mix(in srgb, var(--nx-violet) 35%, transparent)' : 'var(--nx-border)' }}>
      <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: 'var(--nx-border)' }}>
        <KeyRound size={15} style={{ color: 'var(--nx-violet)' }} />
        <h3 style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text)' }}>{t('Intégrations IA', 'AI Integrations')}</h3>
        <span className="ml-auto rounded px-2 py-0.5" style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: configured || shared ? 'var(--nx-success)' : 'var(--nx-text-muted)', background: configured || shared ? 'color-mix(in srgb, var(--nx-success) 12%, transparent)' : 'var(--nx-surface)' }}>
          {shared ? `${t('Active', 'Active')} · ${t('clé Lenexux', 'Lenexux key')}` : configured ? `${t('Configuré', 'Configured')} · ${providerLabel(cfg!.provider)}` : t('Non configuré', 'Not configured')}
        </span>
      </div>

      <div className="flex flex-col gap-3 p-4">
        {usage && (usage.calls > 0 || usage.chars > 0) && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-sm border px-3 py-2"
            style={{ borderColor: usage.capReached ? 'color-mix(in srgb, var(--nx-danger) 35%, transparent)' : 'var(--nx-border)', background: 'var(--nx-surface)' }}>
            <span style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--nx-label)' }}>
              {t(`Consommation ${usage.period}`, `Usage ${usage.period}`)}
            </span>
            <span style={{ fontFamily: mono, fontSize: 11.5, color: 'var(--nx-text)' }}>
              {usage.calls} {t('appels', 'calls')}{usage.callCap > 0 ? ` / ${usage.callCap}` : ''}
            </span>
            <span style={{ fontFamily: mono, fontSize: 11.5, color: 'var(--nx-text)' }}>
              {Math.round(usage.chars / 1000)} k {t('caractères', 'characters')}{usage.charCap > 0 ? ` / ${Math.round(usage.charCap / 1000)} k` : ''}
            </span>
            {usage.capReached && (
              <span style={{ fontSize: 12, color: 'var(--nx-danger)' }}>
                {t('Plafond mensuel atteint : les analyses repassent en mode déterministe.', 'Monthly cap reached: analyses fall back to deterministic mode.')}
              </span>
            )}
            <span style={{ fontSize: 11.5, color: 'var(--nx-text-muted)' }}>
              {t('Compte ce qui est envoyé et reçu par Lenexux ; la facturation de votre fournisseur peut y ajouter ses propres jetons de réflexion.',
                'Counts what Lenexux sends and receives; your provider may bill its own reasoning tokens on top.')}
            </span>
          </div>
        )}
        {shared && (
          <div className="flex items-start gap-2 rounded-sm p-3" style={{ background: 'color-mix(in srgb, var(--nx-success) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--nx-success) 30%, transparent)' }}>
            <Check size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--nx-success)' }} />
            <span style={{ fontSize: 12.5, color: 'var(--nx-text)', lineHeight: 1.5 }}>
              {t('L’IA est déjà active pour votre espace, avec la clé fournie par Lenexux : rien à configurer. Vous pouvez ajouter votre propre clé si vous voulez choisir le fournisseur et le modèle, ou ne pas dépendre du quota mensuel de la clé partagée.',
                'AI is already active for your workspace, using the key provided by Lenexux: nothing to set up. You can add your own key to choose the provider and model, or to avoid depending on the shared key’s monthly quota.')}
            </span>
          </div>
        )}
        <p style={{ fontSize: 12.5, color: 'var(--nx-text-muted)', lineHeight: 1.5 }}>
          {shared ? t('Clé propre (facultatif) : enregistrée côté serveur, rattachée à votre espace, jamais renvoyée au navigateur ni partagée avec d’autres espaces.', 'Own key (optional): stored server-side, scoped to your workspace, never returned to the browser nor shared with other workspaces.') : t('Ajoutez votre clé pour activer la naturalisation des réponses de l’Analyste IA et le mapping assisté. Elle est enregistrée côté serveur, propre à votre espace de travail — elle persiste entre les sessions et les redéploiements, n’est jamais renvoyée au navigateur ni partagée avec les autres tenants.', 'Add your key to enable AI Analyst naturalization and assisted mapping. It is stored server-side, scoped to your workspace — it persists across sessions and redeploys, is never returned to the browser and never shared with other tenants.')}
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
            <span className="flex items-center justify-between" style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>
              {t('Clé API', 'API key')}
              {configured && <span className="flex items-center gap-1" style={{ color: 'var(--nx-success)', textTransform: 'none' }}><Check size={11} /> {t('enregistrée · laissez vide pour la conserver', 'saved · leave blank to keep')}</span>}
            </span>
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
          <div className="flex items-center gap-2 rounded-sm p-2.5" style={{ background: testMsg.ok ? 'color-mix(in srgb, var(--nx-success) 8%, transparent)' : 'color-mix(in srgb, var(--nx-danger) 8%, transparent)', border: `1px solid ${testMsg.ok ? '#4ade8040' : '#ffb4ab40'}` }}>
            {testMsg.ok ? <Check size={15} style={{ color: 'var(--nx-success)' }} /> : <X size={15} style={{ color: 'var(--nx-danger)' }} />}
            <span style={{ fontSize: 12.5, color: testMsg.ok ? 'var(--nx-success)' : 'var(--nx-danger)' }}>{testMsg.message}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button onClick={() => save.mutate()} disabled={!apiKey.trim() || save.isPending} className="flex items-center gap-2 rounded-sm px-3 py-2" style={{ background: apiKey.trim() ? 'var(--nx-violet)' : 'var(--nx-surface-high)', color: apiKey.trim() ? '#1a0a2e' : 'var(--nx-text-muted)', fontFamily: mono, fontSize: 12, fontWeight: 600, cursor: apiKey.trim() ? 'pointer' : 'not-allowed' }}>
            {save.isPending ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />} {t('Enregistrer la clé', 'Save key')}
          </button>
          <button onClick={() => test.mutate()} disabled={!(configured || shared) || test.isPending} className="flex items-center gap-2 rounded-sm px-3 py-2" style={{ background: 'color-mix(in srgb, var(--nx-cyan) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--nx-cyan) 30%, transparent)', color: CYAN_T, fontFamily: mono, fontSize: 12, cursor: configured || shared ? 'pointer' : 'not-allowed', opacity: configured || shared ? 1 : 0.5 }}>
            {test.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {t('Tester la connexion', 'Test connection')}
          </button>
          <button onClick={() => clear.mutate()} disabled={!configured || clear.isPending} className="flex items-center gap-2 rounded-sm px-3 py-2" style={{ background: 'var(--nx-surface)', border: '1px solid var(--nx-border)', color: 'var(--nx-danger)', fontFamily: mono, fontSize: 12, cursor: configured ? 'pointer' : 'not-allowed', opacity: configured ? 1 : 0.5 }}>
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
  const color = ok == null ? 'var(--nx-text-muted)' : ok ? 'var(--nx-success)' : 'var(--nx-danger)'
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

function OrganizationCard() {
  const { t } = useLang()
  const navigate = useNavigate()
  const { data } = useOrganization()
  const money = useMoney()
  const p = data?.profile
  return (
    <div className="rounded-sm border" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--nx-border)' }}>
        <h3 style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text)' }}>{t('Profil de l’organisation', 'Organisation profile')}</h3>
        {data?.canEdit && (
          <button onClick={() => navigate('/demarrage')} className="rounded-sm border px-2.5 py-1 text-xs" style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-cyan-text)' }}>
            {p ? t('Modifier', 'Edit') : t('Compléter', 'Complete')}
          </button>
        )}
      </div>
      {p ? (
        <div className="grid sm:grid-cols-2">
          <InfoRow label={t('Nom', 'Name')} value={p.name} />
          <InfoRow label={t('Secteur', 'Industry')} value={t(...(SECTOR_LABELS[p.sector] ?? [p.sector, p.sector]))} />
          <InfoRow label={t('Devise', 'Currency')} value={`${money.currency.name} (${money.symbol})`} />
          <InfoRow label={t('Chiffre d’affaires', 'Revenue')} value={money.compact(p.annualRevenue)} />
          <InfoRow label={t('Effectif', 'Headcount')} value={String(p.headcount)} />
          <InfoRow label={t('Fonctionnement', 'Operation')} value={p.operatingMode === '24x7'
            ? t('En continu 24 h/24', 'Around the clock')
            : t(`${p.openDaysPerWeek || 5} j/semaine × ${p.openHoursPerDay || 8} h`, `${p.openDaysPerWeek || 5} days/week × ${p.openHoursPerDay || 8} h`)} />
        </div>
      ) : (
        <p className="px-4 py-4 text-sm" style={{ color: 'var(--nx-text-muted)' }}>
          {t('Aucun profil saisi : les montants s’affichent en dollars canadiens et le coût d’arrêt n’est pas étalonné sur votre organisation.',
            'No profile yet: amounts are shown in Canadian dollars and downtime cost is not calibrated to your organisation.')}
        </p>
      )}
      <LogoRow />
    </div>
  )
}

/**
 * Logo de l'organisation, affiché à côté du nom de Lenexux dans le menu.
 * L'image est réduite à 256 px dans le navigateur avant l'envoi : le stockage
 * reste léger et le rendu net sur les écrans à forte densité.
 */
function LogoRow() {
  const { t } = useLang()
  const qc = useQueryClient()
  const { data } = useOrganization()
  const inputRef = useRef<HTMLInputElement>(null)
  const [err, setErr] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: (dataUrl: string | null) => api.setOrganizationLogo(dataUrl),
    onSuccess: () => { setErr(null); qc.invalidateQueries({ queryKey: ['organization'] }) },
    onError: (e: Error) => setErr(e.message),
  })

  async function onFile(file: File) {
    setErr(null)
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setErr(t('Formats acceptés : PNG, JPEG, WebP.', 'Accepted formats: PNG, JPEG, WebP.')); return
    }
    if (file.size > 5 * 1024 * 1024) { setErr(t('Image trop lourde (5 Mo au maximum).', 'Image too large (5 MB maximum).')); return }
    try {
      save.mutate(await downscale(file, 256))
    } catch {
      setErr(t('Image illisible.', 'Unreadable image.'))
    }
  }

  const logo = data?.logo ?? null
  if (!data?.canEdit && !logo) return null
  return (
    <div className="flex flex-wrap items-center gap-3 border-t px-4 py-3" style={{ borderColor: 'var(--nx-border)' }}>
      <span style={{ fontFamily: mono, fontSize: 11, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{t('Logo', 'Logo')}</span>
      {logo
        ? <img src={logo} alt={t('Logo de l’organisation', 'Organisation logo')} style={{ maxHeight: 34, maxWidth: 120, objectFit: 'contain' }} />
        : <span style={{ fontSize: 12.5, color: 'var(--nx-text-muted)' }}>{t('Aucun logo. Il s’affichera à côté de « Lenexux » dans le menu.', 'No logo yet. It will appear next to “Lenexux” in the menu.')}</span>}
      {data?.canEdit && (
        <span className="ml-auto flex items-center gap-2">
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = '' }} />
          <button onClick={() => inputRef.current?.click()} disabled={save.isPending} className="rounded-sm border px-2.5 py-1 text-xs"
            style={{ borderColor: 'var(--nx-border)', color: CYAN_T }}>
            {save.isPending ? t('Envoi…', 'Uploading…') : logo ? t('Remplacer', 'Replace') : t('Ajouter un logo', 'Add a logo')}
          </button>
          {logo && (
            <button onClick={() => save.mutate(null)} disabled={save.isPending} className="rounded-sm border px-2.5 py-1 text-xs"
              style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-danger)' }}>{t('Retirer', 'Remove')}</button>
          )}
        </span>
      )}
      {err && <span className="w-full" style={{ fontSize: 12, color: 'var(--nx-danger)' }}>{err}</span>}
    </div>
  )
}

/** Réduit l'image à `max` pixels de côté et renvoie une data URL PNG. */
function downscale(file: File, max: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.width * scale))
      canvas.height = Math.max(1, Math.round(img.height * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('canvas')); return }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')) }
    img.src = url
  })
}


// ── Sauvegarde, remise à zéro, restauration ──

/**
 * Repartir d'une feuille blanche après un import raté ou une phase d'essai.
 * La sauvegarde vient AVANT l'effacement : le bouton de remise à zéro ne
 * s'ouvre qu'une fois le fichier téléchargé, et ce fichier se recharge.
 */
function WorkspaceDataPanel() {
  const { t } = useLang()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [saved, setSaved] = useState(false)      // sauvegarde téléchargée dans cette session
  const [confirming, setConfirming] = useState(false)
  const [keepProfile, setKeepProfile] = useState(true)

  const summary = useQuery<WorkspaceSummary>({ queryKey: ['workspace-summary'], queryFn: api.workspaceSummary })
  const s = summary.data

  const backup = useMutation({
    mutationFn: api.exportWorkspace,
    onSuccess: (snapshot) => {
      // Téléchargement côté navigateur : le fichier reste chez l'utilisateur.
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `lenexux-sauvegarde-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`
      a.click()
      URL.revokeObjectURL(url)
      setSaved(true)
      notify({
        kind: 'success',
        title: t('Sauvegarde téléchargée', 'Backup downloaded'),
        message: t('Elle contient vos actifs, vos dépendances, votre profil et votre modèle d’entreprise. Conservez-la avant toute remise à zéro.',
          'It holds your assets, dependencies, profile and business model. Keep it before any reset.'),
      })
    },
    onError: (e) => notify({ kind: 'error', title: t('Sauvegarde impossible', 'Backup failed'), message: (e as Error).message.slice(0, 160) }),
  })

  const reset = useMutation({
    mutationFn: () => api.resetWorkspace(keepProfile),
    onSuccess: (r) => {
      setConfirming(false)
      setSaved(false)
      qc.invalidateQueries()
      notify({
        kind: 'success',
        title: t('Espace remis à zéro', 'Workspace reset'),
        message: t(`${r.entitiesRemoved} actif(s) et ${r.relationsRemoved} dépendance(s) retirés. ${r.profileKept ? 'Le profil de l’organisation est conservé.' : 'Le profil a été effacé lui aussi.'} Vous pouvez repartir d’un import.`,
          `${r.entitiesRemoved} asset(s) and ${r.relationsRemoved} dependency(ies) removed. ${r.profileKept ? 'The organisation profile was kept.' : 'The profile was cleared as well.'} You can start again from an import.`),
        duration: 0,
        actions: [{ label: t('Importer des données', 'Import data'), to: '/onboarding' }],
      })
    },
    onError: (e) => notify({
      kind: 'error',
      title: t('Remise à zéro impossible', 'Reset failed'),
      message: (e as Error).message.startsWith('403')
        ? t('Seul un administrateur peut remettre l’espace à zéro.', 'Only an administrator can reset the workspace.')
        : (e as Error).message.slice(0, 160),
    }),
  })

  const restore = useMutation({
    mutationFn: async (file: File) => {
      const snapshot = JSON.parse(await file.text())
      const empty = (s?.entities ?? 0) === 0
      return api.restoreWorkspace(snapshot, !empty)
    },
    onSuccess: (r) => {
      qc.invalidateQueries()
      notify({
        kind: 'success',
        title: t('Sauvegarde restaurée', 'Backup restored'),
        message: t(`${r.entitiesRestored} actif(s) et ${r.relationsRestored} dépendance(s) remis en place.`,
          `${r.entitiesRestored} asset(s) and ${r.relationsRestored} dependency(ies) put back.`),
      })
    },
    onError: (e) => notify({
      kind: 'error',
      title: t('Restauration impossible', 'Restore failed'),
      message: (e as Error).message.includes('JSON')
        ? t('Ce fichier n’est pas une sauvegarde Lenexux.', 'This file is not a Lenexux backup.')
        : (e as Error).message.slice(0, 160),
    }),
  })

  const busy = backup.isPending || reset.isPending || restore.isPending
  const empty = (s?.entities ?? 0) === 0 && (s?.relations ?? 0) === 0

  return (
    <div className="rounded-sm border" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
      <div className="border-b px-4 py-3" style={{ borderColor: 'var(--nx-border)' }}>
        <h3 style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text)' }}>
          {t('Sauvegarde et remise à zéro', 'Backup and reset')}
        </h3>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <p style={{ fontSize: 13, color: 'var(--nx-text-muted)', lineHeight: 1.6 }}>
          {t('Téléchargez d’abord une sauvegarde, puis repartez d’un espace vierge. La sauvegarde se recharge à tout moment : rien n’est perdu définitivement tant que vous gardez le fichier.',
            'Download a backup first, then start from a blank workspace. The backup can be loaded back at any time: nothing is lost for good as long as you keep the file.')}
        </p>

        <div className="flex flex-wrap gap-4" style={{ fontFamily: mono, fontSize: 11.5, color: 'var(--nx-text-muted)' }}>
          <span>{t('Actifs', 'Assets')} : <strong style={{ color: 'var(--nx-text)' }}>{s?.entities ?? '—'}</strong></span>
          <span>{t('Dépendances', 'Dependencies')} : <strong style={{ color: 'var(--nx-text)' }}>{s?.relations ?? '—'}</strong></span>
          <span>{t('Mis de côté', 'Set aside')} : <strong style={{ color: 'var(--nx-text)' }}>{s?.archivedEntities ?? '—'}</strong></span>
          <span>{t('Modèle d’entreprise', 'Business model')} : <strong style={{ color: 'var(--nx-text)' }}>{s?.hasBusinessModel ? t('oui', 'yes') : t('non', 'no')}</strong></span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => backup.mutate()} disabled={busy} className="flex items-center gap-2 rounded-sm px-3 py-2 disabled:opacity-60"
            style={{ background: 'color-mix(in srgb, var(--nx-cyan) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--nx-cyan) 30%, transparent)', color: CYAN_T, fontFamily: mono, fontSize: 12 }}>
            {backup.isPending ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} {t('Télécharger la sauvegarde', 'Download the backup')}
          </button>

          <button onClick={() => fileRef.current?.click()} disabled={busy} className="flex items-center gap-2 rounded-sm px-3 py-2 disabled:opacity-60"
            style={{ background: 'var(--nx-surface)', border: '1px solid var(--nx-border)', color: 'var(--nx-text)', fontFamily: mono, fontSize: 12 }}>
            {restore.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {t('Restaurer une sauvegarde', 'Restore a backup')}
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) restore.mutate(f); e.target.value = '' }} />

          {!confirming && (
            <button onClick={() => setConfirming(true)} disabled={busy || empty} className="flex items-center gap-2 rounded-sm px-3 py-2 disabled:opacity-50"
              style={{ background: 'var(--nx-surface)', border: '1px solid color-mix(in srgb, var(--nx-danger) 35%, transparent)', color: 'var(--nx-danger)', fontFamily: mono, fontSize: 12 }}>
              <RotateCcw size={14} /> {t('Repartir de zéro', 'Start from scratch')}
            </button>
          )}
        </div>

        {confirming && (
          <div className="flex flex-col gap-2 rounded-sm border p-3"
            style={{ borderColor: 'color-mix(in srgb, var(--nx-danger) 35%, transparent)', background: 'color-mix(in srgb, var(--nx-danger) 6%, transparent)' }}>
            <span className="flex items-center gap-2" style={{ fontSize: 13, fontWeight: 600, color: 'var(--nx-text)' }}>
              <AlertTriangle size={15} style={{ color: 'var(--nx-danger)' }} />
              {t(`Effacer ${s?.entities ?? 0} actif(s) et ${s?.relations ?? 0} dépendance(s) ?`, `Erase ${s?.entities ?? 0} asset(s) and ${s?.relations ?? 0} dependency(ies)?`)}
            </span>
            <span style={{ fontSize: 12.5, color: 'var(--nx-text-muted)', lineHeight: 1.6 }}>
              {t('Le modèle d’entreprise, les scénarios et l’historique partent aussi. Les comptes, les sondes et votre clé IA restent en place.',
                'The business model, scenarios and history go too. Accounts, collectors and your AI key stay in place.')}
            </span>
            <label className="flex items-center gap-2" style={{ fontSize: 12.5, color: 'var(--nx-text)' }}>
              <input type="checkbox" checked={keepProfile} onChange={(e) => setKeepProfile(e.target.checked)} style={{ accentColor: CYAN }} />
              {t('Conserver le profil de l’organisation (devise, taille, horaires)', 'Keep the organisation profile (currency, size, opening hours)')}
            </label>
            {!saved && (
              <span style={{ fontSize: 12.5, color: 'var(--nx-warning)' }}>
                {t('Aucune sauvegarde téléchargée depuis cet écran. Téléchargez-la d’abord.', 'No backup downloaded from this screen yet. Download it first.')}
              </span>
            )}
            <div className="flex items-center gap-3">
              <button onClick={() => reset.mutate()} disabled={!saved || reset.isPending} className="flex items-center gap-2 rounded-sm px-3 py-1.5 disabled:opacity-50"
                style={{ background: 'var(--nx-danger)', color: 'var(--nx-on-cyan)', fontSize: 12.5, fontWeight: 600 }}>
                {reset.isPending ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} {t('Oui, tout effacer', 'Yes, erase everything')}
              </button>
              <button onClick={() => setConfirming(false)} style={{ fontSize: 12.5, color: 'var(--nx-text-muted)' }}>{t('Annuler', 'Cancel')}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
