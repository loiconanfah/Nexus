import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, FileSearch, ShieldQuestion, Check, ChevronDown, Loader2 } from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import type { AuditLowConf, EvidenceSourceName } from '../lib/types'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN_T = 'var(--nx-cyan-text)'

const STATUS_COLOR: Record<string, string> = {
  Verified: '#4ade80',
  Imported: '#00e5ff',
  Inferred: '#facc15',
  AiSuggested: '#c084fc',
  Unknown: '#849396',
}
function sc(status: string) { return STATUS_COLOR[status] ?? '#849396' }

export function Audit() {
  const { t } = useLang()
  const { data, isLoading, error } = useQuery({ queryKey: ['audit'], queryFn: api.audit })

  if (isLoading) return <div style={{ fontFamily: mono, color: 'var(--nx-text-muted)' }}>{t('AUDIT DE LA PROVENANCE DES DÉPENDANCES…', 'AUDITING DEPENDENCY PROVENANCE…')}</div>
  if (error) return <div style={{ color: '#ffb4ab' }}>{(error as Error).message}</div>
  if (!data) return null

  const maxStatus = Math.max(1, ...data.byStatus.map((s) => s.count))

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-2" style={{ fontFamily: geist, fontSize: 24, color: 'var(--nx-text)' }}>
          <FileSearch size={22} style={{ color: 'var(--nx-cyan)' }} /> {t('Confiance & audit', 'Confidence & Audit')}
        </h2>
        <p className="mt-1" style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>{t('Chaque dépendance porte une provenance et un niveau de confiance — séparez le vérifié du supposé.', 'Every dependency carries a provenance and a confidence score — separate what is verified from what is assumed.')}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Tile label={t('TOTAL DÉPENDANCES', 'TOTAL DEPENDENCIES')} value={String(data.summary.totalDependencies)} color="var(--nx-text)" />
        <Tile label={t('VÉRIFIÉES', 'VERIFIED')} value={`${data.summary.verifiedPercent}%`} sub={`${data.summary.verified} ${t('arêtes', 'edges')}`} color="#4ade80" />
        <Tile label={t('CONFIANCE MOY.', 'AVG CONFIDENCE')} value={`${data.summary.avgConfidence}%`} color={CYAN_T} />
        <Tile label={t('À REVOIR', 'NEEDS REVIEW')} value={String(data.summary.undocumented)} color="#facc15" />
      </div>

      {/* Distribution + low confidence */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="rounded-sm border p-4" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
          <h3 className="mb-3 flex items-center gap-2" style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text)' }}><BadgeCheck size={14} /> {t('Distribution de la confiance', 'Confidence Distribution')}</h3>
          <div className="flex flex-col gap-3">
            {data.byStatus.map((s) => (
              <div key={s.status}>
                <div className="mb-1 flex items-center justify-between" style={{ fontFamily: mono, fontSize: 11 }}>
                  <span style={{ color: sc(s.status) }}>{s.status}</span>
                  <span style={{ color: 'var(--nx-text-muted)' }}>{s.count} · avg {s.avgConfidence}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-sm" style={{ background: 'var(--nx-surface)' }}>
                  <div className="h-full rounded-sm" style={{ width: `${(s.count / maxStatus) * 100}%`, background: sc(s.status), transition: 'width .4s' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-sm border" style={{ borderColor: 'var(--nx-border)' }}>
          <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: 'var(--nx-border)' }}>
            <ShieldQuestion size={14} style={{ color: '#facc15' }} />
            <h3 style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text)' }}>{t('Dépendances à revoir', 'Dependencies Needing Review')}</h3>
          </div>
          <div className="flex flex-col divide-y" style={{ maxHeight: 320, overflowY: 'auto' }}>
            {data.lowConfidence.map((e) => <ReviewRow key={e.id} row={e} />)}
            {data.lowConfidence.length === 0 && <div className="p-4" style={{ fontFamily: mono, fontSize: 12, color: '#4ade80' }}>{t('Toutes les dépendances sont vérifiées. Aucune revue requise.', 'All dependencies verified. No review required.')}</div>}
          </div>
        </div>
      </div>

      {/* Ledger complet */}
      <div className="overflow-x-auto rounded-sm border" style={{ borderColor: 'var(--nx-border)' }}>
        <div className="border-b px-4 py-3" style={{ borderColor: 'var(--nx-border)' }}>
          <h3 style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--nx-text)' }}>{t('Registre de provenance des dépendances', 'Dependency Provenance Ledger')}</h3>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--nx-border)' }}>
              {[t('Source', 'Source'), t('Relation', 'Relation'), t('Cible', 'Target'), t('Confiance', 'Confidence'), t('Statut', 'Status'), t('Origine', 'Origin')].map((h, i) => (
                <th key={h} className={`px-4 py-2 ${i === 3 ? 'text-right' : ''}`} style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.ledger.map((e, idx) => (
              <tr key={idx} className="border-b" style={{ borderColor: 'var(--nx-border)' }}>
                <td className="px-4 py-2.5" style={{ fontSize: 13, color: CYAN_T }}>{e.source}</td>
                <td className="px-4 py-2.5" style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>{e.type}</td>
                <td className="px-4 py-2.5" style={{ fontSize: 13, color: CYAN_T }}>{e.target}</td>
                <td className="px-4 py-2.5 text-right" style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: sc(e.status) }}>{e.confidence}%</td>
                <td className="px-4 py-2.5"><span className="rounded px-1.5 py-0.5" style={{ fontFamily: mono, fontSize: 10, color: sc(e.status), background: `${sc(e.status)}18` }}>{e.status}</span></td>
                <td className="px-4 py-2.5" style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>{e.sourceSystem}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Libellés lisibles des sources de preuve (l'API renvoie l'identifiant technique).
const SOURCE_LABEL: Record<EvidenceSourceName, [string, string]> = {
  HumanValidation: ['Validation humaine', 'Human validation'],
  Observation: ['Observation technique', 'Technical observation'],
  RestApi: ['API interrogée en direct', 'Live API'],
  DeterministicInference: ['Déduction du moteur', 'Engine deduction'],
  Import: ['Fichier importé', 'Imported file'],
  Declared: ['Saisie manuelle', 'Manually declared'],
  Document: ['Document', 'Document'],
  AiInference: ['Proposée par l’IA', 'AI-proposed'],
}

/**
 * Une dépendance à revoir : d'où vient son score (décomposition des preuves) et
 * possibilité de la VALIDER — ce qui ajoute une preuve humaine sans écraser
 * les sources d'origine.
 */
function ReviewRow({ row }: { row: AuditLowConf }) {
  const { t, lang } = useLang()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)

  const explain = useQuery({
    queryKey: ['relation-confidence', row.id],
    queryFn: () => api.explainRelationConfidence(row.id),
    enabled: open,
  })

  const verify = useMutation({
    mutationFn: () => api.verifyRelation(row.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit'] })
      qc.invalidateQueries({ queryKey: ['relation-confidence', row.id] })
    },
  })

  const pct = (v: number) => `${Math.round(v * 100)}%`

  return (
    <div className="p-3" style={{ borderColor: 'var(--nx-border)' }}>
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 13, color: 'var(--nx-text)' }}>
          <span style={{ color: CYAN_T }}>{row.source}</span>{' '}
          <span style={{ color: 'var(--nx-text-muted)', fontFamily: mono, fontSize: 11 }}>{row.type}</span>{' '}
          <span style={{ color: CYAN_T }}>{row.target}</span>
        </span>
        <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: sc(row.status) }}>{row.confidence}%</span>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-2" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>
        <span className="rounded px-1.5 py-0.5" style={{ color: sc(row.status), background: `${sc(row.status)}18` }}>{row.status}</span>
        <span>src: {row.sourceSystem}</span>
        {row.evidenceCount > 0 && <span>· {row.evidenceCount} {t('preuve(s)', 'evidence')}</span>}
      </div>

      <p className="mt-1" style={{ fontSize: 12, color: 'var(--nx-text-muted)', fontStyle: 'italic' }}>{row.evidence}</p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 rounded-sm border px-2 py-1"
          style={{ borderColor: 'var(--nx-border)', fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>
          {t('Pourquoi ce score ?', 'Why this score?')}
          <ChevronDown size={12} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
        </button>
        <button onClick={() => verify.mutate()} disabled={verify.isPending || verify.isSuccess}
          className="flex items-center gap-1 rounded-sm border px-2 py-1"
          style={{
            borderColor: verify.isSuccess ? 'rgba(74,222,128,0.4)' : 'var(--nx-border)',
            fontFamily: mono, fontSize: 11,
            color: verify.isSuccess ? '#4ade80' : CYAN_T,
          }}>
          {verify.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          {verify.isSuccess ? t('Validée', 'Verified') : t('Valider', 'Verify')}
        </button>
        {verify.isSuccess && (
          <span style={{ fontFamily: mono, fontSize: 11, color: '#4ade80' }}>
            → {pct(verify.data.confidence)}
          </span>
        )}
      </div>

      {open && (
        <div className="mt-2 rounded-sm border p-2" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface)' }}>
          {explain.isLoading && <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>{t('Calcul…', 'Computing…')}</span>}
          {explain.data && explain.data.contributions.length === 0 && (
            <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>
              {t('Aucune preuve structurée — confiance héritée de la source d’origine.', 'No structured evidence — confidence inherited from the original source.')}
            </span>
          )}
          {explain.data && explain.data.contributions.map((c, i) => (
            <div key={i} className="flex flex-col gap-0.5 py-1" style={{ borderTop: i > 0 ? '1px solid var(--nx-border)' : undefined }}>
              <div className="flex items-baseline justify-between gap-2" style={{ fontFamily: mono, fontSize: 11 }}>
                <span style={{ color: 'var(--nx-text)' }}>{t(...(SOURCE_LABEL[c.source] ?? [c.source, c.source]))}</span>
                <span style={{ color: 'var(--nx-text-muted)' }}>
                  {t('fiab.', 'rel.')} {pct(c.weight)} × {t('fraîch.', 'fresh.')} {pct(c.freshness)} → <b style={{ color: CYAN_T }}>{pct(c.scoreAfter)}</b>
                </span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--nx-text-muted)' }}>{c.observation}</p>
            </div>
          ))}
          {explain.data && explain.data.contributions.length > 1 && (
            <p className="mt-1" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-outline)' }}>
              {lang === 'fr'
                ? 'Les preuves se renforcent à rendements décroissants : la seconde ajoute moins que la première.'
                : 'Evidence compounds with diminishing returns: the second adds less than the first.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function Tile({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="rounded-sm border p-3" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
      <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{label}</div>
      <div style={{ fontFamily: geist, fontSize: 24, fontWeight: 500, color }}>{value}</div>
      {sub && <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{sub}</div>}
    </div>
  )
}
