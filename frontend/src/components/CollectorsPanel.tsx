import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Radio, Plus, Trash2, Play, Copy, Check, Loader2, RefreshCw } from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import type { Collector, CollectorCreated } from '../lib/types'

const mono = 'var(--font-mono)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'

/** Profils de mapping prêts à l'emploi (mêmes conventions que l'import CSV). */
const PRESETS = {
  nodes: {
    label: ['Systèmes & actifs', 'Systems & assets'],
    columns: 'name, type, criticality, costPerHour',
    build: () => ({
      sourceSystem: 'Collector',
      entities: [{ dataset: 'rest', entityType: 'Asset', nameColumn: 'name', entityTypeColumn: 'type', criticalityColumn: 'criticality', costPerHourColumn: 'costPerHour' }],
      relations: [],
    }),
  },
  edges: {
    label: ['Dépendances', 'Dependencies'],
    columns: 'source, source_type, target, target_type, confidence',
    build: () => ({
      sourceSystem: 'Collector',
      entities: [
        { dataset: 'rest', entityType: 'Asset', nameColumn: 'source', entityTypeColumn: 'source_type' },
        { dataset: 'rest', entityType: 'Asset', nameColumn: 'target', entityTypeColumn: 'target_type' },
      ],
      relations: [{
        dataset: 'rest', relationType: 'DEPENDS_ON', sourceEntityType: 'Asset', sourceNameColumn: 'source',
        targetEntityType: 'Asset', targetNameColumn: 'target', sourceTypeColumn: 'source_type',
        targetTypeColumn: 'target_type', confidenceColumn: 'confidence', defaultConfidence: 0.9,
      }],
    }),
  },
} as const

/**
 * Gestion des sondes Collector : déclarer, surveiller, planifier des collectes,
 * révoquer. C'est par ici qu'une DSI branche Lenexux sur ses systèmes internes,
 * sans jamais les exposer sur Internet.
 */
export function CollectorsPanel() {
  const { t } = useLang()
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [created, setCreated] = useState<CollectorCreated | null>(null)
  const [selected, setSelected] = useState<Collector | null>(null)

  const { data: collectors } = useQuery({ queryKey: ['collectors'], queryFn: api.collectors, refetchInterval: 20000 })
  const { data: jobs } = useQuery({ queryKey: ['collector-jobs'], queryFn: api.collectorJobs, refetchInterval: 20000 })

  const create = useMutation({
    mutationFn: () => api.createCollector(name.trim()),
    onSuccess: (c) => { setCreated(c); setName(''); setCreating(false); qc.invalidateQueries({ queryKey: ['collectors'] }) },
  })
  const revoke = useMutation({
    mutationFn: (id: string) => api.revokeCollector(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['collectors'] }); qc.invalidateQueries({ queryKey: ['collector-jobs'] }) },
  })

  return (
    <div className="rounded-sm border" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3" style={{ borderColor: 'var(--nx-border)' }}>
        <Radio size={15} style={{ color: CYAN }} />
        <h3 style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text)' }}>
          {t('Collectors (sondes internes)', 'Collectors (internal probes)')}
        </h3>
        <button onClick={() => setCreating((v) => !v)} className="ml-auto flex items-center gap-1 rounded-sm px-2 py-1"
          style={{ background: 'rgba(0,229,255,0.10)', border: '1px solid rgba(0,229,255,0.30)', fontFamily: mono, fontSize: 11, color: CYAN_T }}>
          <Plus size={12} /> {t('Déclarer une sonde', 'Declare a probe')}
        </button>
      </div>

      <div className="p-4">
        <p className="mb-3" style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>
          {t('Une sonde s’installe dans votre réseau et interroge vos systèmes internes. Elle n’expose aucun port et ne demande aucune ouverture de pare-feu entrante : elle sort en HTTPS pour venir chercher son travail.',
             'A probe runs inside your network and queries your internal systems. It exposes no port and needs no inbound firewall rule: it reaches out over HTTPS to fetch its work.')}
        </p>

        {/* Déclaration */}
        {creating && (
          <div className="mb-3 flex flex-wrap items-end gap-2 rounded-sm border p-3" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface)' }}>
            <label className="flex-1" style={{ minWidth: 200 }}>
              <span className="mb-1 block" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{t('Nom (ex. datacenter principal)', 'Name (e.g. main datacenter)')}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="DC-Principal"
                className="w-full rounded-sm border bg-transparent px-2 py-1.5 outline-none"
                style={{ borderColor: 'var(--nx-border)', fontSize: 13, color: 'var(--nx-text)' }} />
            </label>
            <button onClick={() => create.mutate()} disabled={!name.trim() || create.isPending}
              className="flex items-center gap-1 rounded-sm px-3 py-2"
              style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontFamily: mono, fontSize: 12, opacity: name.trim() ? 1 : 0.5 }}>
              {create.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} {t('Créer', 'Create')}
            </button>
          </div>
        )}

        {/* Clé affichée une seule fois */}
        {created && <KeyReveal created={created} onDismiss={() => setCreated(null)} />}

        {/* Liste des sondes */}
        {(!collectors || collectors.length === 0) ? (
          <p style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text-muted)' }}>
            {t('Aucune sonde déclarée.', 'No probe declared.')}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {collectors.map((c) => (
              <div key={c.id} className="rounded-sm border" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface)' }}>
                <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <span className="inline-block h-2 w-2 rounded-full"
                    style={{ background: c.online ? '#4ade80' : '#849396', boxShadow: c.online ? '0 0 6px #4ade80' : undefined }} />
                  <span style={{ fontSize: 13, color: 'var(--nx-text)' }}>{c.name}</span>
                  <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>
                    {c.online ? t('en ligne', 'online') : c.lastSeenAt ? `${t('vue', 'seen')} ${new Date(c.lastSeenAt).toLocaleString()}` : t('jamais vue', 'never seen')}
                    {c.version && ` · v${c.version}`}
                  </span>
                  <button onClick={() => setSelected(selected?.id === c.id ? null : c)}
                    className="ml-auto flex items-center gap-1 rounded-sm border px-2 py-1"
                    style={{ borderColor: 'var(--nx-border)', fontFamily: mono, fontSize: 11, color: CYAN_T }}>
                    <Play size={11} /> {t('Nouvelle collecte', 'New collection')}
                  </button>
                  <button onClick={() => { if (confirm(t('Révoquer cette sonde ? Sa clé cessera immédiatement de fonctionner.', 'Revoke this probe? Its key will stop working immediately.'))) revoke.mutate(c.id) }}
                    className="flex items-center gap-1 rounded-sm border px-2 py-1"
                    style={{ borderColor: 'var(--nx-border)', fontFamily: mono, fontSize: 11, color: '#ffb4ab' }}>
                    <Trash2 size={11} /> {t('Révoquer', 'Revoke')}
                  </button>
                </div>
                {selected?.id === c.id && <JobForm collector={c} onDone={() => { setSelected(null); qc.invalidateQueries({ queryKey: ['collector-jobs'] }) }} />}
              </div>
            ))}
          </div>
        )}

        {/* Historique des collectes */}
        {jobs && jobs.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2" style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>
              <RefreshCw size={11} /> {t('Collectes', 'Collections')}
            </div>
            <div className="flex flex-col gap-1" style={{ maxHeight: 220, overflowY: 'auto' }}>
              {jobs.slice(0, 20).map((j) => (
                <div key={j.id} className="flex flex-wrap items-center gap-2 rounded-sm border px-3 py-1.5"
                  style={{ borderColor: 'var(--nx-border)', fontFamily: mono, fontSize: 11 }}>
                  <span style={{ color: j.status === 'done' ? '#4ade80' : j.status === 'failed' ? '#ffb4ab' : j.status === 'running' ? CYAN_T : '#facc15' }}>
                    {j.status}
                  </span>
                  <span className="truncate" style={{ color: 'var(--nx-text-muted)', maxWidth: 320 }}>{j.url}</span>
                  {j.intervalMinutes ? <span style={{ color: CYAN_T }}>↻ {j.intervalMinutes} min</span> : null}
                  <span className="ml-auto" style={{ color: 'var(--nx-text-muted)' }}>
                    {j.status === 'done' ? `${j.entitiesCreated} ${t('entités', 'entities')} · ${j.relationsCreated} ${t('relations', 'relations')}` : (j.error ?? '')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** La clé n'est montrée qu'une fois : on donne aussi la commande de démarrage prête à coller. */
function KeyReveal({ created, onDismiss }: { created: CollectorCreated; onDismiss: () => void }) {
  const { t } = useLang()
  const [copied, setCopied] = useState<'key' | 'cmd' | null>(null)
  const cmd = `docker run -d --name lenexux-collector --restart unless-stopped \\
  -e LENEXUX_CLOUD_URL=${window.location.origin} \\
  -e LENEXUX_COLLECTOR_KEY=${created.key} \\
  lenexux-collector`

  const copy = async (what: 'key' | 'cmd', value: string) => {
    try { await navigator.clipboard.writeText(value); setCopied(what); setTimeout(() => setCopied(null), 1800) } catch { /* presse-papiers indisponible */ }
  }

  return (
    <div className="mb-3 rounded-sm border p-3" style={{ borderColor: 'rgba(224,178,60,0.45)', background: 'rgba(224,178,60,0.08)' }}>
      <p style={{ fontSize: 12, color: '#e0b23c' }}>
        <b>{t('Clé de la sonde « ', 'Probe key for “')}{created.name}{t(' » — affichée une seule fois.', '” — shown only once.')}</b>{' '}
        {t('Reportez-la maintenant dans la configuration de la sonde : elle n’est pas récupérable ensuite.',
           'Copy it into the probe configuration now: it cannot be retrieved later.')}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 truncate rounded-sm border px-2 py-1" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-bg)', fontFamily: mono, fontSize: 12, color: 'var(--nx-text)' }}>{created.key}</code>
        <button onClick={() => copy('key', created.key)} className="flex items-center gap-1 rounded-sm border px-2 py-1" style={{ borderColor: 'var(--nx-border)', fontFamily: mono, fontSize: 11, color: CYAN_T }}>
          {copied === 'key' ? <Check size={11} /> : <Copy size={11} />} {t('Copier', 'Copy')}
        </button>
      </div>
      <pre className="mt-2 overflow-x-auto rounded-sm border p-2" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-bg)', fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>{cmd}</pre>
      <div className="mt-1 flex gap-2">
        <button onClick={() => copy('cmd', cmd)} className="flex items-center gap-1 rounded-sm border px-2 py-1" style={{ borderColor: 'var(--nx-border)', fontFamily: mono, fontSize: 11, color: CYAN_T }}>
          {copied === 'cmd' ? <Check size={11} /> : <Copy size={11} />} {t('Copier la commande', 'Copy command')}
        </button>
        <button onClick={onDismiss} className="rounded-sm border px-2 py-1" style={{ borderColor: 'var(--nx-border)', fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>
          {t('J’ai noté la clé', 'I saved the key')}
        </button>
      </div>
    </div>
  )
}

/** Configure une collecte : source interne + format attendu + récurrence. */
function JobForm({ collector, onDone }: { collector: Collector; onDone: () => void }) {
  const { t, lang } = useLang()
  const [url, setUrl] = useState('')
  const [headerName, setHeaderName] = useState('')
  const [headerValue, setHeaderValue] = useState('')
  const [recordsPath, setRecordsPath] = useState('')
  const [preset, setPreset] = useState<keyof typeof PRESETS>('edges')
  const [interval, setInterval] = useState('1440')

  const enqueue = useMutation({
    mutationFn: () => api.enqueueCollectorJob(collector.id, {
      url: url.trim(),
      authHeaderName: headerName.trim() || null,
      authHeaderValue: headerValue.trim() || null,
      recordsPath: recordsPath.trim() || null,
      dataset: 'rest',
      profile: PRESETS[preset].build(),
      intervalMinutes: Number(interval) > 0 ? Number(interval) : null,
    }),
    onSuccess: () => onDone(),
  })

  return (
    <div className="flex flex-col gap-2 border-t p-3" style={{ borderColor: 'var(--nx-border)' }}>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label={t('URL interne de la source', 'Internal source URL')} value={url} onChange={setUrl} placeholder="http://cmdb.interne.local/api/ci" wide />
        <Field label={t('Chemin des enregistrements (optionnel)', 'Records path (optional)')} value={recordsPath} onChange={setRecordsPath} placeholder="data.items" />
        <Field label={t('En-tête d’authentification (optionnel)', 'Auth header (optional)')} value={headerName} onChange={setHeaderName} placeholder="Authorization" />
        <Field label={t('Valeur de l’en-tête', 'Header value')} value={headerValue} onChange={setHeaderValue} placeholder="Bearer …" secret />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label>
          <span className="mb-1 block" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{t('Type de données', 'Data type')}</span>
          <select value={preset} onChange={(e) => setPreset(e.target.value as keyof typeof PRESETS)}
            className="w-full rounded-sm border bg-transparent px-2 py-1.5 outline-none"
            style={{ borderColor: 'var(--nx-border)', fontSize: 13, color: 'var(--nx-text)' }}>
            {Object.entries(PRESETS).map(([k, p]) => (
              <option key={k} value={k} style={{ background: 'var(--nx-bg)' }}>{lang === 'fr' ? p.label[0] : p.label[1]}</option>
            ))}
          </select>
          <span className="mt-1 block" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-outline)' }}>
            {t('colonnes attendues', 'expected columns')} : {PRESETS[preset].columns}
          </span>
        </label>
        <Field label={t('Répéter toutes les (minutes, 0 = une seule fois)', 'Repeat every (minutes, 0 = once)')} value={interval} onChange={setInterval} placeholder="1440" />
      </div>

      {enqueue.isError && <p style={{ fontSize: 12, color: '#ffb4ab' }}>{(enqueue.error as Error).message}</p>}

      <button onClick={() => enqueue.mutate()} disabled={!url.trim() || enqueue.isPending}
        className="self-start flex items-center gap-1 rounded-sm px-3 py-2"
        style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontFamily: mono, fontSize: 12, opacity: url.trim() ? 1 : 0.5 }}>
        {enqueue.isPending ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
        {t('Lancer la collecte', 'Start collection')}
      </button>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, secret, wide }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; secret?: boolean; wide?: boolean
}) {
  return (
    <label className={wide ? 'sm:col-span-2' : undefined}>
      <span className="mb-1 block" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{label}</span>
      <input type={secret ? 'password' : 'text'} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-sm border bg-transparent px-2 py-1.5 outline-none"
        style={{ borderColor: 'var(--nx-border)', fontSize: 13, color: 'var(--nx-text)' }} />
    </label>
  )
}
