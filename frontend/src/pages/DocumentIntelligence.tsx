import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { FileText, Loader2, ScanText, Sparkles } from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import type { AiAnswer } from '../lib/types'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'

export function DocumentIntelligence() {
  const { t, lang } = useLang()
  const [text, setText] = useState('')
  const [answer, setAnswer] = useState<AiAnswer | null>(null)

  const SAMPLES = lang === 'fr' ? [
    'Le traitement de facturation nocturne dépend de l’ERP, qui s’authentifie auprès de AD01 et stocke ses données sur SQL01. Si SQL01 tombe, les factures ne peuvent pas être générées.',
    'Notre CRM est hébergé chez CloudProviderX. Seul Bob sait redémarrer l’intégration ERP.',
  ] : [
    'The nightly billing run depends on the ERP, which authenticates against AD01 and stores data on SQL01. If SQL01 is down, invoices cannot be generated.',
    'Our CRM is hosted on CloudProviderX. Only Bob knows how to restart the ERP integration.',
  ]

  const mut = useMutation({
    mutationFn: (doc: string) => api.ask(
      lang === 'fr'
        ? `Analyse ce document opérationnel et identifie les dépendances, points uniques de défaillance et risques qu’il décrit, en les recoupant avec nos systèmes. Réponds en français :\n\n"""${doc}"""`
        : `Analyze this operational document and identify the dependencies, single points of failure and risks it describes, cross-referenced with our systems:\n\n"""${doc}"""`,
    ),
    onSuccess: setAnswer,
  })

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-2" style={{ fontFamily: geist, fontSize: 24, color: 'var(--nx-text)' }}>
          <ScanText size={22} style={{ color: CYAN }} /> {t('Intelligence documentaire', 'Document Intelligence')}
        </h2>
        <p className="mt-1" style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>{t('Collez des runbooks, notes d’incident ou documents d’architecture — NEXUS en extrait les dépendances et risques, recoupés avec votre graphe en direct.', 'Paste runbooks, incident notes or architecture docs — NEXUS extracts the dependencies and risks they reference against your live graph.')}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Entree */}
        <div className="flex flex-col gap-3 rounded-sm border p-4" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
          <div className="flex items-center gap-2" style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text)' }}><FileText size={14} /> {t('Document source', 'Source document')}</div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} placeholder={t('Collez du texte opérationnel ici…', 'Paste operational text here…')} className="w-full resize-y rounded-sm p-3 outline-none" style={{ background: 'var(--nx-panel)', border: '1px solid var(--nx-border)', color: 'var(--nx-text)', fontSize: 13, lineHeight: 1.5 }} />
          <div className="flex flex-wrap gap-2">
            {SAMPLES.map((s, i) => (
              <button key={i} onClick={() => setText(s)} className="rounded-sm border px-2 py-1" style={{ fontFamily: mono, fontSize: 10, borderColor: 'var(--nx-border)', color: 'var(--nx-text-muted)' }}>{t('Exemple', 'Sample')} {i + 1}</button>
            ))}
          </div>
          <button onClick={() => mut.mutate(text)} disabled={!text.trim() || mut.isPending} className="flex items-center justify-center gap-2 rounded-sm py-2.5" style={{ background: text.trim() ? CYAN : 'var(--nx-surface-high)', color: text.trim() ? 'var(--nx-on-cyan)' : 'var(--nx-text-muted)', fontSize: 13, fontWeight: 600, cursor: text.trim() ? 'pointer' : 'not-allowed' }}>
            {mut.isPending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {t('Analyser le document', 'Analyze document')}
          </button>
        </div>

        {/* Resultat */}
        <div className="flex flex-col gap-3 rounded-sm border p-4" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
          <div className="flex items-center justify-between">
            <span style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text)' }}>{t('Intelligence extraite', 'Extracted intelligence')}</span>
            {answer && <span className="rounded px-2 py-0.5" style={{ fontFamily: mono, fontSize: 10, color: CYAN_T, background: 'rgba(0,229,255,0.1)' }}>{t('confiance', 'confidence')} {Math.round(answer.confidence * 100)}%</span>}
          </div>

          {!answer && !mut.isPending && <div className="flex flex-1 items-center justify-center" style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text-muted)' }}>{t('En attente d’un document à analyser.', 'Awaiting a document to analyze.')}</div>}
          {mut.isPending && <div className="flex flex-1 items-center justify-center gap-2" style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text-muted)' }}><Loader2 size={14} className="animate-spin" /> {t('Raisonnement sur le graphe…', 'Reasoning over the graph…')}</div>}

          {answer && (
            <div className="flex flex-col gap-3">
              <p style={{ fontSize: 14, color: 'var(--nx-text)', lineHeight: 1.55 }}>{answer.answer}</p>

              {answer.affectedAssets.length > 0 && (
                <div>
                  <div style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{t('Systèmes référencés', 'Referenced systems')}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {answer.affectedAssets.map((a) => <span key={a} className="rounded px-2 py-0.5" style={{ fontFamily: mono, fontSize: 11, color: CYAN_T, background: 'rgba(0,229,255,0.08)', border: '1px solid var(--nx-border)' }}>{a}</span>)}
                  </div>
                </div>
              )}

              {answer.evidence.length > 0 && (
                <div>
                  <div style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{t('Preuves', 'Evidence')}</div>
                  <div className="mt-1 flex flex-col gap-1.5">
                    {answer.evidence.map((ev, i) => (
                      <div key={i} className="rounded-sm p-2" style={{ background: 'var(--nx-panel)', border: '1px solid var(--nx-border)' }}>
                        <div className="flex items-center justify-between"><span style={{ fontSize: 12.5, color: 'var(--nx-text)' }}>{ev.label}</span>{ev.confidence != null && <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{Math.round(ev.confidence * 100)}%</span>}</div>
                        <div style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>{ev.detail}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {answer.recommendedAction && (
                <div className="rounded-sm p-2.5" style={{ background: 'var(--nx-surface)', border: '1px solid var(--nx-border)' }}>
                  <span style={{ fontFamily: mono, fontSize: 10, color: CYAN_T, textTransform: 'uppercase' }}>{t('Action recommandée', 'Recommended action')}</span>
                  <p style={{ fontSize: 12.5, color: 'var(--nx-text)' }}>{answer.recommendedAction}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
