import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle, Blocks, Check, Clock, Download, ExternalLink, Loader2,
  Plug, RefreshCw, Server, Shield, Trash2, X,
} from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import { notify } from '../lib/notify'
import { VendorLogo } from '../components/VendorLogo'
import type { ConnectorSpec, IntegrationRecord } from '../lib/types'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'

const CATEGORIES: { key: string; fr: string; en: string }[] = [
  { key: 'identity', fr: 'Identité et personnes', en: 'Identity and people' },
  { key: 'cloud', fr: 'Nuages', en: 'Clouds' },
  { key: 'cmdb', fr: 'Référentiel de configuration', en: 'Configuration management' },
  { key: 'observability', fr: 'Topologie observée', en: 'Observed topology' },
  { key: 'delivery', fr: 'Livraison et savoir', en: 'Delivery and knowledge' },
  { key: 'platform', fr: 'Plateforme interne', en: 'Internal platform' },
]

/** Les périodicités offertes. Sous une heure, on harcèlerait l'éditeur pour rien. */
const INTERVALS = [
  { minutes: 0, fr: 'Manuel', en: 'Manual' },
  { minutes: 1440, fr: 'Chaque jour', en: 'Daily' },
  { minutes: 10080, fr: 'Chaque semaine', en: 'Weekly' },
]

/**
 * Connecteurs : ce que Lenexux INTERROGE.
 *
 * Cet écran ne montre que des sources réellement lues par leur API. Les logos
 * qui renvoyaient vers un téléversement de fichier ont été retirés : ils
 * promettaient une intégration que le produit n'avait pas, et la promesse se
 * cassait au premier essai. Un import de fichier reste possible, mais il a son
 * propre écran et ne se déguise plus en connecteur.
 */
export function IntegrationMarketplace() {
  const { t, lang } = useLang()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<{ spec: ConnectorSpec; existing?: IntegrationRecord } | null>(null)

  const catalog = useQuery({ queryKey: ['connector-catalog'], queryFn: api.connectorCatalog })
  const branched = useQuery({ queryKey: ['integrations'], queryFn: api.integrations })

  const connectors = catalog.data?.connectors ?? []
  // Dix entrees : le regroupement ne merite pas de memoisation, et memoiser sur
  // un tableau recree a chaque rendu ne memoiserait rien.
  const byCategory = CATEGORIES
    .map((cat) => ({ cat, items: connectors.filter((c) => c.category === cat.key) }))
    .filter((g) => g.items.length > 0)

  const refresh = useMutation({
    mutationFn: (id: string) => api.runIntegration({ id }),
    onSuccess: (r) => {
      qc.invalidateQueries()
      notify({
        kind: r.warnings.length > 0 ? 'warning' : 'success',
        title: t('Source relue', 'Source re-read'),
        message: r.summary + (r.warnings.length > 0 ? ` — ${r.warnings.join(' ; ')}` : ''),
        duration: 0,
      })
    },
    onError: (e) => notify({ kind: 'error', title: t('Relecture impossible', 'Could not re-read'), message: clean(e) }),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteIntegration(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
    onError: (e) => notify({ kind: 'error', title: t('Suppression impossible', 'Could not delete'), message: clean(e) }),
  })

  const live = branched.data ?? []

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="flex items-center gap-2" style={{ fontFamily: geist, fontSize: 24, color: 'var(--nx-text)' }}>
          <Blocks size={22} style={{ color: CYAN }} /> {t('Connecteurs', 'Connectors')}
        </h2>
        <p className="mt-1" style={{ fontSize: 13, color: 'var(--nx-text-muted)', lineHeight: 1.6 }}>
          {t(`${connectors.length} sources interrogées par leur API, puis relues automatiquement. Une cartographie qui n’est jamais relue perd sa valeur : la confiance de chaque dépendance décote avec le temps.`,
            `${connectors.length} sources queried through their API, then re-read automatically. A map that is never re-read loses its value: every dependency's confidence decays over time.`)}
        </p>
      </div>

      {catalog.data && !catalog.data.canStore && (
        <Banner
          tone="warning"
          text={t('Ce serveur n’a pas de clé de chiffrement : les accès ne peuvent pas être conservés, donc aucun rafraîchissement automatique. Un import ponctuel reste possible.',
            'This server has no encryption key: credentials cannot be stored, so no automatic refresh. A one-off import still works.')}
        />
      )}

      {/* ── Ce qui est branché ── */}
      {live.length > 0 && (
        <section className="flex flex-col gap-2">
          <Title label={t('Branché', 'Connected')} count={live.length} />
          <div className="flex flex-col gap-2">
            {live.map((i) => (
              <Branched
                key={i.id} record={i}
                busy={refresh.isPending && refresh.variables === i.id}
                onRefresh={() => refresh.mutate(i.id)}
                onEdit={() => {
                  const spec = connectors.find((c) => c.id === i.vendorId)
                  if (spec) setEditing({ spec, existing: i })
                }}
                onDelete={() => remove.mutate(i.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Ce qui reste à brancher ── */}
      {byCategory.map(({ cat, items }) => (
        <section key={cat.key} className="flex flex-col gap-2">
          <Title label={lang === 'fr' ? cat.fr : cat.en} count={items.length} />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((spec) => (
              <Card
                key={spec.id} spec={spec}
                connected={live.filter((i) => i.vendorId === spec.id).length}
                onConnect={() => setEditing({ spec })}
              />
            ))}
          </div>
        </section>
      ))}

      {catalog.isLoading && (
        <div className="flex items-center gap-2 rounded-sm border p-6"
          style={{ borderColor: 'var(--nx-border)', fontFamily: mono, fontSize: 12, color: 'var(--nx-text-muted)' }}>
          <Loader2 size={14} className="animate-spin" /> {t('Chargement des connecteurs…', 'Loading connectors…')}
        </div>
      )}

      {editing && (
        <ConnectForm
          spec={editing.spec}
          existing={editing.existing}
          canStore={catalog.data?.canStore ?? false}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function Title({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ fontFamily: mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--nx-label)' }}>{label}</span>
      <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>· {count}</span>
      <div className="h-px flex-1" style={{ background: 'var(--nx-border)' }} />
    </div>
  )
}

function Banner({ tone, text }: { tone: 'warning' | 'info'; text: string }) {
  const color = tone === 'warning' ? 'var(--nx-warning)' : CYAN
  return (
    <div className="flex items-start gap-2 rounded-sm border p-3"
      style={{ borderColor: `color-mix(in srgb, ${color} 35%, transparent)`, background: `color-mix(in srgb, ${color} 7%, transparent)` }}>
      <AlertTriangle size={14} style={{ color, marginTop: 2, flexShrink: 0 }} />
      <p style={{ fontSize: 12.5, color: 'var(--nx-text)', lineHeight: 1.5 }}>{text}</p>
    </div>
  )
}

/** Un branchement en service : son dernier résultat et sa prochaine relecture. */
function Branched({ record, busy, onRefresh, onEdit, onDelete }: {
  record: IntegrationRecord
  busy: boolean
  onRefresh: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { t, lang } = useLang()
  const interval = INTERVALS.find((i) => i.minutes === record.intervalMinutes)

  return (
    <div className="flex flex-col gap-2 rounded-sm border p-3 md:flex-row md:items-center md:justify-between"
      style={{
        background: 'var(--nx-surface-container)',
        borderColor: record.healthy ? 'var(--nx-border)' : 'color-mix(in srgb, var(--nx-danger) 45%, transparent)',
      }}>
      <div className="flex min-w-0 items-start gap-3">
        <VendorLogo id={record.vendorId} size={32} />
        <div className="min-w-0">
          <span className="float-right ml-2 mt-1.5 flex h-2 w-2 rounded-full"
            style={{ background: record.healthy ? 'var(--nx-success)' : 'var(--nx-danger)' }} />
          <div className="flex flex-wrap items-center gap-2">
            <span style={{ fontFamily: geist, fontSize: 14.5, color: 'var(--nx-text)' }}>{record.label}</span>
            <span style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--nx-text-muted)' }}>{record.vendorName}</span>
          </div>
          <p className="mt-0.5" style={{ fontSize: 12, color: 'var(--nx-text-muted)', lineHeight: 1.5 }}>
            {record.lastOutcome ?? t('Jamais relu depuis son enregistrement.', 'Never re-read since it was saved.')}
          </p>
          <p style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--nx-outline)' }}>
            {record.lastRunAt
              ? `${t('dernière lecture', 'last read')} ${when(record.lastRunAt, lang)}`
              : t('en attente', 'pending')}
            {interval && interval.minutes > 0 && ` · ${lang === 'fr' ? interval.fr.toLowerCase() : interval.en.toLowerCase()}`}
            {record.nextRunAt && ` · ${t('prochaine', 'next')} ${when(record.nextRunAt, lang)}`}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button onClick={onRefresh} disabled={busy}
          className="flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 disabled:opacity-50"
          style={{ borderColor: 'color-mix(in srgb, var(--nx-cyan) 35%, transparent)', color: CYAN_T, fontFamily: mono, fontSize: 11 }}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          {t('RELIRE', 'RE-READ')}
        </button>
        <button onClick={onEdit} className="rounded-sm border px-2.5 py-1.5"
          style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text-muted)', fontFamily: mono, fontSize: 11 }}>
          {t('MODIFIER', 'EDIT')}
        </button>
        <button onClick={onDelete} title={t('Retirer ce branchement', 'Remove this connection')}
          aria-label={t('Retirer', 'Remove')} style={{ color: 'var(--nx-outline)' }}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

/** Une source disponible, avec ce qu'elle écrira dans la carte. */
function Card({ spec, connected, onConnect }: { spec: ConnectorSpec; connected: number; onConnect: () => void }) {
  const { t, lang } = useLang()

  return (
    <div className="flex flex-col gap-3 rounded-sm border p-4"
      style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <VendorLogo id={spec.id} />
          <div className="min-w-0">
          <h3 style={{ fontFamily: geist, fontSize: 15.5, color: 'var(--nx-text)' }}>{spec.name}</h3>
          <div style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--nx-text-muted)' }}>
            {lang === 'fr' ? spec.bringsFr : spec.bringsEn}
          </div>
          </div>
        </div>
        {connected > 0 && (
          <span className="flex items-center gap-1 rounded px-2 py-0.5"
            style={{
              fontFamily: mono, fontSize: 9, textTransform: 'uppercase', color: 'var(--nx-success)',
              background: 'color-mix(in srgb, var(--nx-success) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--nx-success) 30%, transparent)',
            }}>
            <Check size={10} /> {t('branché', 'connected')}
          </span>
        )}
      </div>

      <p style={{ fontSize: 12.5, color: 'var(--nx-text-muted)', lineHeight: 1.55, flex: 1 }}>
        {lang === 'fr' ? spec.summaryFr : spec.summaryEn}
      </p>

      {/* Ce que le branchement écrira : savoir AVANT de brancher, pas après. */}
      <div className="flex flex-wrap gap-1">
        {[...spec.writes.entities, ...spec.writes.relations].slice(0, 7).map((w) => (
          <span key={w} className="rounded px-1.5 py-0.5"
            style={{ fontFamily: mono, fontSize: 9.5, color: 'var(--nx-label)', border: '1px solid var(--nx-border)' }}>
            {w}
          </span>
        ))}
      </div>

      {spec.internalOnly ? (
        <div className="flex flex-col gap-2">
          <p className="flex items-start gap-1.5" style={{ fontSize: 11.5, color: 'var(--nx-warning)', lineHeight: 1.5 }}>
            <Shield size={12} style={{ marginTop: 2, flexShrink: 0 }} />
            {t('Cette source vit dans votre réseau : elle passe par la sonde Collector, jamais par le cloud.',
              'This source lives in your network: it goes through the Collector probe, never through the cloud.')}
          </p>
          <Link to="/admin"
            className="flex items-center justify-center gap-1.5 rounded-sm border py-2"
            style={{ borderColor: 'var(--nx-border)', color: CYAN_T, fontFamily: mono, fontSize: 11, textTransform: 'uppercase' }}>
            <Server size={13} /> {t('Installer la sonde', 'Install the probe')}
          </Link>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button onClick={onConnect}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-sm py-2"
            style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontFamily: mono, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
            <Plug size={13} /> {connected > 0 ? t('Ajouter', 'Add') : t('Brancher', 'Connect')}
          </button>
          <a href={spec.docUrl} target="_blank" rel="noreferrer" title={t('Documentation de l’éditeur', 'Vendor documentation')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border"
            style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text-muted)' }}>
            <ExternalLink size={14} />
          </a>
        </div>
      )}
    </div>
  )
}

/**
 * Le formulaire de branchement.
 *
 * L'ordre des gestes est imposé : essayer, puis importer, puis seulement
 * programmer. Personne ne confie un rafraîchissement automatique à un accès
 * qu'il n'a pas vu fonctionner une fois.
 */
function ConnectForm({ spec, existing, canStore, onClose }: {
  spec: ConnectorSpec
  existing?: IntegrationRecord
  canStore: boolean
  onClose: () => void
}) {
  const { t, lang } = useLang()
  const qc = useQueryClient()
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...(existing?.settings ?? {}) }))
  const [label, setLabel] = useState(existing?.label ?? spec.name)
  const [interval, setInterval] = useState(existing?.intervalMinutes ?? 1440)
  const [tested, setTested] = useState<boolean | null>(null)
  const [detail, setDetail] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])

  // Un secret enregistré ne redescend jamais : le champ reste vide et le
  // laisser vide CONSERVE l'ancien, plutôt que de l'effacer.
  const keptSecrets = !!existing
  const missing = spec.fields.filter((f) => f.required && !values[f.key]?.trim()
    && !(keptSecrets && f.secret)).map((f) => f.key)
  const ready = missing.length === 0

  const body = () => ({ vendorId: spec.id, settings: values, ...(existing ? { id: existing.id } : {}) })

  const test = useMutation({
    mutationFn: () => api.testIntegration(existing && !dirty() ? { id: existing.id } : body()),
    onSuccess: (r) => { setTested(r.ok); setDetail(r.detail) },
    onError: (e) => { setTested(false); setDetail(clean(e)) },
  })

  const run = useMutation({
    mutationFn: () => api.runIntegration(existing && !dirty() ? { id: existing.id } : body()),
    onSuccess: (r) => {
      setWarnings(r.warnings)
      qc.invalidateQueries()
      notify({
        kind: r.warnings.length > 0 ? 'warning' : 'success',
        title: t(`${spec.name} lu`, `${spec.name} read`),
        message: r.summary,
        duration: 0,
      })
    },
    onError: (e) => { setTested(false); setDetail(clean(e)) },
  })

  const save = useMutation({
    mutationFn: () => api.saveIntegration({
      vendorId: spec.id, label: label.trim(), settings: values,
      intervalMinutes: interval, ...(existing ? { id: existing.id } : {}),
    }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['integrations'] })
      onClose()
      notify({
        kind: 'success',
        title: t('Branchement enregistré', 'Connection saved'),
        message: r.intervalMinutes > 0
          ? t(`${r.label} sera relu automatiquement, sans intervention.`, `${r.label} will be re-read automatically, with no action needed.`)
          : t(`${r.label} est enregistré. La relecture reste manuelle.`, `${r.label} is saved. Re-reading stays manual.`),
      })
    },
    onError: (e) => { setTested(false); setDetail(clean(e)) },
  })

  /** Des valeurs saisies ici primeront sur celles enregistrées. */
  function dirty() {
    return Object.values(values).some((v) => v.trim().length > 0)
      && JSON.stringify(values) !== JSON.stringify(existing?.settings ?? {})
  }

  const busy = test.isPending || run.isPending || save.isPending

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto p-4 py-10"
      style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="flex w-full max-w-xl flex-col gap-4 rounded-md border p-5"
        style={{ background: 'var(--nx-panel)', borderColor: 'var(--nx-border)' }}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <VendorLogo id={spec.id} size={40} />
            <div>
            <h3 style={{ fontFamily: geist, fontSize: 20, color: 'var(--nx-text)' }}>{spec.name}</h3>
            <p className="mt-0.5" style={{ fontSize: 12.5, color: 'var(--nx-text-muted)' }}>
              {lang === 'fr' ? spec.summaryFr : spec.summaryEn}
            </p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--nx-text-muted)' }}><X size={18} /></button>
        </div>

        <label className="flex flex-col gap-1">
          <Label text={t('Nom de ce branchement', 'Name for this connection')} />
          <input value={label} onChange={(e) => setLabel(e.target.value)}
            className="rounded-sm border bg-transparent px-2 py-1.5 outline-none"
            style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text)', fontSize: 13 }} />
        </label>

        {spec.fields.map((f) => (
          <label key={f.key} className="flex flex-col gap-1">
            <Label text={lang === 'fr' ? f.labelFr : f.labelEn} />
            <input
              type={f.secret ? 'password' : 'text'}
              autoComplete="off"
              value={values[f.key] ?? ''}
              onChange={(e) => { setValues({ ...values, [f.key]: e.target.value }); setTested(null) }}
              placeholder={f.secret && keptSecrets
                ? t('Enregistré. Laissez vide pour le conserver.', 'Stored. Leave empty to keep it.')
                : f.placeholder ?? ''}
              className="rounded-sm border bg-transparent px-2 py-1.5 outline-none"
              style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text)', fontSize: 13 }} />
            {(lang === 'fr' ? f.helpFr : f.helpEn) && (
              <span style={{ fontSize: 11.5, color: 'var(--nx-text-muted)', lineHeight: 1.45 }}>
                {lang === 'fr' ? f.helpFr : f.helpEn}
              </span>
            )}
          </label>
        ))}

        <div className="flex flex-col gap-1">
          <Label text={t('Relecture automatique', 'Automatic re-reading')} />
          <div className="flex flex-wrap gap-2">
            {INTERVALS.map((i) => (
              <button key={i.minutes} onClick={() => setInterval(i.minutes)}
                className="rounded-sm border px-2.5 py-1"
                style={{
                  borderColor: interval === i.minutes ? CYAN : 'var(--nx-border)',
                  background: interval === i.minutes ? 'color-mix(in srgb, var(--nx-cyan) 10%, transparent)' : 'transparent',
                  color: interval === i.minutes ? CYAN_T : 'var(--nx-text-muted)',
                  fontFamily: mono, fontSize: 11.5,
                }}>
                {lang === 'fr' ? i.fr : i.en}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--nx-text-muted)', lineHeight: 1.45 }}>
            {t('La confiance d’une dépendance décote avec le temps : une source relue chaque semaine garde sa valeur de preuve.',
              'A dependency’s confidence decays over time: a source re-read weekly keeps its evidential value.')}
          </span>
        </div>

        {tested !== null && (
          <div className="flex items-start gap-2 rounded-sm border p-2.5"
            style={{
              borderColor: tested ? 'color-mix(in srgb, var(--nx-success) 40%, transparent)' : 'color-mix(in srgb, var(--nx-danger) 40%, transparent)',
              background: tested ? 'color-mix(in srgb, var(--nx-success) 7%, transparent)' : 'color-mix(in srgb, var(--nx-danger) 7%, transparent)',
            }}>
            {tested ? <Check size={14} style={{ color: 'var(--nx-success)', marginTop: 2 }} />
              : <AlertTriangle size={14} style={{ color: 'var(--nx-danger)', marginTop: 2 }} />}
            <p style={{ fontSize: 12.5, color: 'var(--nx-text)', lineHeight: 1.5 }}>
              {tested
                ? t('Accès accepté, la source répond.', 'Credentials accepted, the source answers.')
                : detail ?? t('Refusé.', 'Refused.')}
            </p>
          </div>
        )}

        {warnings.length > 0 && (
          <Banner tone="warning" text={`${t('Lu en partie', 'Partially read')} : ${warnings.join(' ; ')}`} />
        )}

        {!canStore && (
          <Banner tone="warning" text={t('Aucune clé de chiffrement sur ce serveur : l’enregistrement sera refusé. L’import ponctuel fonctionne.',
            'No encryption key on this server: saving will be refused. A one-off import works.')} />
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => test.mutate()} disabled={busy || !ready}
            className="flex items-center gap-2 rounded-sm border px-3 py-2 disabled:opacity-50"
            style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text)', fontSize: 13 }}>
            {test.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />}
            {t('Essayer l’accès', 'Try the credentials')}
          </button>

          <button onClick={() => run.mutate()} disabled={busy || !ready}
            className="flex items-center gap-2 rounded-sm border px-3 py-2 disabled:opacity-50"
            style={{ borderColor: 'color-mix(in srgb, var(--nx-cyan) 35%, transparent)', color: CYAN_T, fontSize: 13 }}>
            {run.isPending ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {t('Lire maintenant', 'Read now')}
          </button>

          <button onClick={() => save.mutate()} disabled={busy || !ready || !canStore}
            className="flex items-center gap-2 rounded-sm px-4 py-2 disabled:opacity-50"
            style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontSize: 13, fontWeight: 600 }}>
            {save.isPending ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
            {t('Enregistrer', 'Save')}
          </button>

          <button onClick={onClose} style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>
            {t('Fermer', 'Close')}
          </button>
        </div>

        {missing.length > 0 && (
          <p style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-outline)' }}>
            {t('À renseigner', 'Still needed')} : {missing.join(', ')}
          </p>
        )}
      </div>
    </div>
  )
}

function Label({ text }: { text: string }) {
  return (
    <span style={{ fontFamily: mono, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--nx-label)' }}>
      {text}
    </span>
  )
}

/** Un message d'erreur d'API, ramené à ce que l'utilisateur peut lire. */
function clean(e: unknown) {
  const raw = e instanceof Error ? e.message : String(e)
  const detail = raw.match(/"detail"\s*:\s*"([^"]+)"/)?.[1]
  return (detail ?? raw).slice(0, 220)
}

function when(iso: string, lang: string) {
  const date = new Date(iso)
  const minutes = Math.round((date.getTime() - Date.now()) / 60000)
  const past = minutes < 0
  const abs = Math.abs(minutes)
  const value = abs < 60 ? `${abs} min` : abs < 1440 ? `${Math.round(abs / 60)} h` : `${Math.round(abs / 1440)} j`
  if (lang === 'fr') return past ? `il y a ${value}` : `dans ${value}`
  return past ? `${value} ago` : `in ${value}`
}
