import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Globe, ChevronDown, CheckCircle2 } from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import type { ImportResult, RestSource } from '../lib/types'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const NEG = '#d15b54'

const ENTITY_TYPES = ['Application', 'Service', 'System', 'Database', 'Server', 'Supplier', 'Person', 'Organization', 'BusinessProcess', 'BusinessService', 'Network', 'CloudResource', 'Location', 'Contract']

/** Source REST/JSON live : URL → aperçu des colonnes → mapping simple → import réel via le pipeline. */
export function RestLiveImport({ onImported }: { onImported?: () => void }) {
  const { t } = useLang()
  const [url, setUrl] = useState('')
  const [recordsPath, setRecordsPath] = useState('')
  const [authName, setAuthName] = useState('')
  const [authValue, setAuthValue] = useState('')
  const [advanced, setAdvanced] = useState(false)
  const [nameCol, setNameCol] = useState('')
  const [descCol, setDescCol] = useState('')
  const [entityType, setEntityType] = useState('Application')

  const source = (): RestSource => ({
    url: url.trim(),
    recordsPath: recordsPath.trim() || undefined,
    authHeaderName: authName.trim() || undefined,
    authHeaderValue: authValue.trim() || undefined,
  })

  const preview = useMutation({
    mutationFn: () => api.restPreview(source()),
    onSuccess: (r) => { if (r.columns.length && !nameCol) setNameCol(guessName(r.columns)) },
  })
  const doImport = useMutation({
    mutationFn: () => api.restImport(source(), {
      sourceSystem: 'REST live',
      entities: [{ dataset: 'rest', entityType, nameColumn: nameCol, descriptionColumn: descCol || undefined }],
      relations: [],
    }),
    onSuccess: () => onImported?.(),
  })
  const columns = preview.data?.columns ?? []
  const res = doImport.data as ImportResult | undefined

  return (
    <div className="rounded-lg border p-5" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
      <h3 className="mb-1 flex items-center gap-2" style={{ fontFamily: geist, fontSize: 17, color: 'var(--nx-text)' }}>
        <Globe size={18} style={{ color: CYAN }} /> {t('Source REST / API JSON (live)', 'REST / JSON API source (live)')}
        <span className="rounded px-1.5 py-0.5" style={{ background: 'var(--nx-surface-container)', fontFamily: mono, fontSize: 10, color: CYAN }}>LIVE</span>
      </h3>
      <p className="mb-3" style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>
        {t('Pointez une API renvoyant un tableau JSON. Lenexus l’interroge en direct, détecte les colonnes et ingère via le pipeline.', 'Point to an API returning a JSON array. Lenexus queries it live, detects columns and ingests via the pipeline.')}
      </p>

      <div className="flex flex-col gap-2 md:flex-row">
        <input
          value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="https://api.exemple.com/assets"
          className="w-full rounded-md border bg-transparent px-3 py-2 outline-none"
          style={{ borderColor: 'var(--nx-border)', fontSize: 13, color: 'var(--nx-text)', fontFamily: mono }}
        />
        <button
          onClick={() => url.trim() && preview.mutate()}
          disabled={preview.isPending || !url.trim()}
          className="rounded-md px-4 py-2 text-sm font-medium"
          style={{ background: CYAN, color: '#04121a', opacity: preview.isPending || !url.trim() ? 0.6 : 1, whiteSpace: 'nowrap' }}
        >
          {preview.isPending ? t('Test…', 'Testing…') : t('Prévisualiser', 'Preview')}
        </button>
      </div>

      <button onClick={() => setAdvanced((a) => !a)} className="mt-2 flex items-center gap-1" style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>
        <ChevronDown size={13} style={{ transform: advanced ? 'rotate(180deg)' : 'none' }} /> {t('Options avancées', 'Advanced options')}
      </button>
      {advanced && (
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <Field label={t('Chemin des enregistrements', 'Records path')} value={recordsPath} onChange={setRecordsPath} placeholder="data.items" />
          <Field label={t('En-tête d’auth (nom)', 'Auth header (name)')} value={authName} onChange={setAuthName} placeholder="Authorization" />
          <Field label={t('En-tête d’auth (valeur)', 'Auth header (value)')} value={authValue} onChange={setAuthValue} placeholder="Bearer …" />
        </div>
      )}

      {preview.isError && <p className="mt-2" style={{ color: NEG, fontSize: 12 }}>{(preview.error as Error).message}</p>}

      {columns.length > 0 && (
        <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--nx-border)' }}>
          <div className="mb-2" style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: CYAN }}>
            {preview.data?.estimatedRows ?? '?'} {t('lignes ·', 'rows ·')} {columns.length} {t('colonnes détectées', 'columns detected')}
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {columns.map((c) => <span key={c} className="rounded border px-2 py-0.5" style={{ borderColor: 'var(--nx-border)', fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>{c}</span>)}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Select label={t('Type d’entité', 'Entity type')} value={entityType} onChange={setEntityType} options={ENTITY_TYPES} />
            <Select label={t('Colonne « nom » *', 'Name column *')} value={nameCol} onChange={setNameCol} options={columns} />
            <Select label={t('Colonne description', 'Description column')} value={descCol} onChange={setDescCol} options={['', ...columns]} />
          </div>
          <button
            onClick={() => nameCol && doImport.mutate()}
            disabled={doImport.isPending || !nameCol}
            className="mt-3 rounded-md px-5 py-2 text-sm font-medium"
            style={{ background: CYAN, color: '#04121a', opacity: doImport.isPending || !nameCol ? 0.6 : 1 }}
          >
            {doImport.isPending ? t('Import en cours…', 'Importing…') : t('Importer depuis l’API', 'Import from API')}
          </button>
        </div>
      )}

      {doImport.isError && <p className="mt-2" style={{ color: NEG, fontSize: 12 }}>{(doImport.error as Error).message}</p>}
      {res && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border px-4 py-2" style={{ borderColor: '#3fb27f66', fontSize: 13, color: 'var(--nx-text)' }}>
          <CheckCircle2 size={16} style={{ color: '#3fb27f' }} />
          <span><b>{res.entitiesCreated}</b> {t('créées', 'created')}</span>
          <span><b>{res.entitiesMatched}</b> {t('fusionnées', 'matched')}</span>
          <span><b>{res.relationsCreated}</b> {t('relations', 'relations')}</span>
          <span style={{ color: 'var(--nx-text-muted)' }}>{res.recordsRead} {t('lignes lues', 'records read')}</span>
        </div>
      )}
    </div>
  )
}

function guessName(cols: string[]): string {
  const pref = ['name', 'title', 'label', 'hostname', 'id']
  for (const p of pref) { const m = cols.find((c) => c.toLowerCase() === p); if (m) return m }
  return cols[0] ?? ''
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block" style={{ fontSize: 11, color: 'var(--nx-text-muted)' }}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-md border bg-transparent px-2.5 py-1.5 outline-none"
        style={{ borderColor: 'var(--nx-border)', fontSize: 12, color: 'var(--nx-text)', fontFamily: mono }} />
    </label>
  )
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="block">
      <span className="mb-1 block" style={{ fontSize: 11, color: 'var(--nx-text-muted)' }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border px-2.5 py-1.5 outline-none"
        style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-bg)', fontSize: 12, color: 'var(--nx-text)' }}>
        {options.map((o) => <option key={o} value={o}>{o || '—'}</option>)}
      </select>
    </label>
  )
}
