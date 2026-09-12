import { useState } from 'react'
import { ShieldCheck, ShieldAlert, ShieldQuestion, ChevronDown } from 'lucide-react'
import { useLang } from '../lib/i18n'
import type { CascadeEvidence, EvidenceQuality } from '../lib/types'

const mono = 'var(--font-mono)'

const TONE: Record<EvidenceQuality, { color: string; bg: string; border: string }> = {
  Solid: { color: '#3fb27f', bg: 'rgba(63,178,127,0.10)', border: 'rgba(63,178,127,0.35)' },
  Moderate: { color: '#e0b23c', bg: 'rgba(224,178,60,0.10)', border: 'rgba(224,178,60,0.35)' },
  Fragile: { color: '#d15b54', bg: 'rgba(209,91,84,0.10)', border: 'rgba(209,91,84,0.35)' },
}

/**
 * Affiche SUR QUOI REPOSE un chiffrage d'impact : proportion de dépendances
 * étayées / non validées, confiance moyenne, et les maillons les plus faibles
 * nommés — pour pouvoir aller les corriger.
 */
export function EvidenceBanner({ evidence, summary }: { evidence: CascadeEvidence; summary?: string | null }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)

  if (!evidence || evidence.relationsTotal === 0) return null

  const tone = TONE[evidence.quality] ?? TONE.Moderate
  const Icon = evidence.quality === 'Solid' ? ShieldCheck : evidence.quality === 'Fragile' ? ShieldAlert : ShieldQuestion
  const label = evidence.quality === 'Solid'
    ? t('Base probante solide', 'Solid evidence base')
    : evidence.quality === 'Fragile'
      ? t('Base probante fragile', 'Fragile evidence base')
      : t('Base probante correcte', 'Moderate evidence base')

  const pct = (v: number) => `${Math.round(v * 100)}%`

  return (
    <div className="rounded-md border" style={{ borderColor: tone.border, background: tone.bg }}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <Icon size={16} style={{ color: tone.color, flexShrink: 0 }} />
        <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: tone.color }}>
          {label}
        </span>
        {summary && (
          <span className="flex-1" style={{ fontSize: 13, color: 'var(--nx-text)', minWidth: 220 }}>{summary}</span>
        )}
        {evidence.weakestLinks.length > 0 && (
          <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 rounded-sm border px-2 py-1"
            style={{ borderColor: tone.border, fontFamily: mono, fontSize: 11, color: tone.color }}>
            {t('Maillons faibles', 'Weak links')} ({evidence.weakestLinks.length})
            <ChevronDown size={12} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
          </button>
        )}
      </div>

      {/* Décompte */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t px-4 py-2" style={{ borderColor: tone.border, fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>
        <Stat label={t('dépendances', 'dependencies')} value={evidence.relationsTotal} />
        <Stat label={t('validées', 'verified')} value={evidence.verified} color="#3fb27f" />
        <Stat label={t('étayées', 'supported')} value={evidence.solid} />
        <Stat label={t('faibles', 'weak')} value={evidence.weak} color={evidence.weak > 0 ? '#e0b23c' : undefined} />
        <Stat label={t('non validées', 'unvalidated')} value={evidence.unvalidated} color={evidence.unvalidated > 0 ? '#d15b54' : undefined} />
        <span>· {t('confiance moy.', 'avg confidence')} <b style={{ color: 'var(--nx-text)' }}>{pct(evidence.averageConfidence)}</b></span>
      </div>

      {/* Maillons faibles nommés */}
      {open && evidence.weakestLinks.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t px-4 py-3" style={{ borderColor: tone.border }}>
          <p style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>
            {t('Dépendances les moins étayées de cette cascade', 'Least-supported dependencies in this cascade')}
          </p>
          {evidence.weakestLinks.map((w) => (
            <div key={w.id} className="rounded-sm border px-3 py-2" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
              <div className="flex flex-wrap items-baseline gap-x-2" style={{ fontSize: 13, color: 'var(--nx-text)' }}>
                <span>{w.source}</span>
                <span style={{ color: 'var(--nx-outline)' }}>→</span>
                <span>{w.target}</span>
                <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-outline)' }}>{w.type}</span>
                <span className="ml-auto" style={{ fontFamily: mono, fontSize: 11, color: w.confidence < 0.5 ? '#d15b54' : '#e0b23c' }}>
                  {pct(w.confidence)} · {w.status}
                </span>
              </div>
              {w.topEvidence && (
                <p className="mt-1" style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>{w.topEvidence}</p>
              )}
            </div>
          ))}
          <p className="mt-1" style={{ fontSize: 11, color: 'var(--nx-text-muted)' }}>
            {t('Valider ces dépendances dans « Confiance & audit » renforcera ce chiffrage.',
               'Validating these dependencies in “Trust & audit” will strengthen this estimate.')}
          </p>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <span>
      <b style={{ color: color ?? 'var(--nx-text)' }}>{value}</b> {label}
    </span>
  )
}
