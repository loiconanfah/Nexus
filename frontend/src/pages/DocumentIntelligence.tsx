import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, CheckCircle2, FileText, FileUp, GitMerge, Loader2, ScanText, Sparkles, Upload } from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import { entityTypeLabel, relationTypeLabel } from '../lib/labels'
import type { AiAnswer, ExtractedEntity, ExtractedRelation } from '../lib/types'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'

export function DocumentIntelligence() {
  const { t, lang } = useLang()
  const [text, setText] = useState('')
  const [answer, setAnswer] = useState<AiAnswer | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileErr, setFileErr] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function onFile(f: File) {
    setFileErr(null)
    // Types texte lisibles côté client (runbooks, notes, exports).
    const okExt = /\.(txt|md|markdown|log|csv|tsv|json|yaml|yml|html?|xml|conf|ini)$/i.test(f.name)
    if (!okExt && !f.type.startsWith('text/')) {
      setFileErr(t('Formats texte pris en charge (.txt, .md, .log, .csv, .json, .html…). PDF/DOCX : bientôt.', 'Text formats supported (.txt, .md, .log, .csv, .json, .html…). PDF/DOCX: coming soon.'))
      return
    }
    if (f.size > 2 * 1024 * 1024) { setFileErr(t('Fichier trop volumineux (max 2 Mo).', 'File too large (max 2 MB).')); return }
    const content = await f.text()
    setText(content.slice(0, 20000))   // borne l'envoi au modèle
    setFileName(f.name)
  }

  const SAMPLES = lang === 'fr' ? [
    'Le traitement de facturation nocturne dépend de l’ERP, qui s’authentifie auprès de AD01 et stocke ses données sur SQL01. Si SQL01 tombe, les factures ne peuvent pas être générées.',
    'Notre CRM est hébergé chez CloudProviderX. Seul Bob sait redémarrer l’intégration ERP.',
  ] : [
    'The nightly billing run depends on the ERP, which authenticates against AD01 and stores data on SQL01. If SQL01 is down, invoices cannot be generated.',
    'Our CRM is hosted on CloudProviderX. Only Bob knows how to restart the ERP integration.',
  ]

  const qc = useQueryClient()
  const [candidates, setCandidates] = useState<{ entities: ExtractedEntity[]; relations: ExtractedRelation[] } | null>(null)
  const [ingestRes, setIngestRes] = useState<{ entitiesCreated: number; relationsCreated: number; unresolved: number } | null>(null)

  const mut = useMutation({
    mutationFn: (doc: string) => api.ask(
      lang === 'fr'
        ? `Analyse ce document opérationnel et identifie les dépendances, points uniques de défaillance et risques qu’il décrit, en les recoupant avec nos systèmes. Réponds en français :\n\n"""${doc}"""`
        : `Analyze this operational document and identify the dependencies, single points of failure and risks it describes, cross-referenced with our systems:\n\n"""${doc}"""`,
    ),
    onSuccess: setAnswer,
  })

  const extract = useMutation({
    mutationFn: (doc: string) => api.extractDocument(doc),
    onSuccess: (r) => { setCandidates(r.usedAi ? { entities: r.entities, relations: r.relations } : null); setIngestRes(null); if (!r.usedAi) setFileErr(r.message) },
  })
  const ingest = useMutation({
    mutationFn: () => api.ingestDocument(candidates!),
    onSuccess: (r) => { setIngestRes(r); setCandidates(null); qc.invalidateQueries() },
  })

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-2" style={{ fontFamily: geist, fontSize: 24, color: 'var(--nx-text)' }}>
          <ScanText size={22} style={{ color: CYAN }} /> {t('Intelligence documentaire', 'Document Intelligence')}
        </h2>
        <p className="mt-1" style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>{t('Importez ou collez des runbooks, notes d’incident ou documents d’architecture — NEXUS en extrait les dépendances et risques, recoupés avec votre graphe en direct.', 'Upload or paste runbooks, incident notes or architecture docs — NEXUS extracts the dependencies and risks they reference against your live graph.')}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Entree */}
        <div className="flex flex-col gap-3 rounded-sm border p-4" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2" style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text)' }}><FileText size={14} /> {t('Document source', 'Source document')}</span>
            <button onClick={() => inputRef.current?.click()} className="flex items-center gap-1.5 rounded-sm border px-2 py-1" style={{ fontFamily: mono, fontSize: 10, borderColor: 'rgba(0,229,255,0.3)', color: CYAN_T }}><Upload size={12} /> {t('Importer un fichier', 'Upload a file')}</button>
            <input ref={inputRef} type="file" accept=".txt,.md,.markdown,.log,.csv,.tsv,.json,.yaml,.yml,.html,.htm,.xml,.conf,.ini,text/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
          </div>
          <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f) }}>
            <textarea value={text} onChange={(e) => { setText(e.target.value); setFileName(null) }} rows={10} placeholder={t('Collez du texte, ou déposez / importez un fichier (.txt, .md, .log, .csv, .json, .html…)', 'Paste text, or drop / upload a file (.txt, .md, .log, .csv, .json, .html…)')} className="w-full resize-y rounded-sm p-3 outline-none" style={{ background: 'var(--nx-panel)', border: '1px solid var(--nx-border)', color: 'var(--nx-text)', fontSize: 13, lineHeight: 1.5 }} />
          </div>
          {fileName && <div className="flex items-center gap-1.5" style={{ fontFamily: mono, fontSize: 11, color: '#4ade80' }}><FileUp size={12} /> {fileName} · {text.length.toLocaleString()} {t('caractères', 'chars')}</div>}
          {fileErr && <div style={{ fontFamily: mono, fontSize: 11, color: '#facc15' }}>{fileErr}</div>}
          <div className="flex flex-wrap gap-2">
            {SAMPLES.map((s, i) => (
              <button key={i} onClick={() => { setText(s); setFileName(null) }} className="rounded-sm border px-2 py-1" style={{ fontFamily: mono, fontSize: 10, borderColor: 'var(--nx-border)', color: 'var(--nx-text-muted)' }}>{t('Exemple', 'Sample')} {i + 1}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => mut.mutate(text)} disabled={!text.trim() || mut.isPending} className="flex flex-1 items-center justify-center gap-2 rounded-sm py-2.5" style={{ background: text.trim() ? CYAN : 'var(--nx-surface-high)', color: text.trim() ? 'var(--nx-on-cyan)' : 'var(--nx-text-muted)', fontSize: 13, fontWeight: 600, cursor: text.trim() ? 'pointer' : 'not-allowed' }}>
              {mut.isPending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {t('Analyser', 'Analyze')}
            </button>
            <button onClick={() => extract.mutate(text)} disabled={!text.trim() || extract.isPending} className="flex flex-1 items-center justify-center gap-2 rounded-sm border py-2.5" style={{ borderColor: 'rgba(0,229,255,0.35)', color: CYAN_T, fontSize: 13, fontWeight: 600, cursor: text.trim() ? 'pointer' : 'not-allowed', opacity: text.trim() ? 1 : 0.5 }}>
              {extract.isPending ? <Loader2 size={16} className="animate-spin" /> : <GitMerge size={16} />} {t('Extraire → graphe', 'Extract → graph')}
            </button>
          </div>
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

      {/* Extraction → graphe */}
      {(extract.isPending || candidates || ingestRes) && (
        <div className="rounded-sm border p-4" style={{ background: 'var(--nx-surface-container)', borderColor: 'rgba(0,229,255,0.3)' }}>
          <div className="mb-3 flex items-center gap-2" style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: CYAN_T }}>
            <GitMerge size={14} /> {t('Dépendances extraites', 'Extracted dependencies')}
          </div>

          {extract.isPending && <div className="flex items-center gap-2" style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text-muted)' }}><Loader2 size={14} className="animate-spin" /> {t('Extraction par l’IA…', 'AI extraction…')}</div>}

          {ingestRes && (
            <div className="flex items-center gap-2 rounded-sm p-3" style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid #4ade8040' }}>
              <CheckCircle2 size={16} style={{ color: '#4ade80' }} />
              <span style={{ fontSize: 13, color: '#4ade80' }}>{t(`${ingestRes.entitiesCreated} entité(s) et ${ingestRes.relationsCreated} relation(s) ajoutées au graphe (statut « Suggéré par IA »). ${ingestRes.unresolved} non résolue(s).`, `${ingestRes.entitiesCreated} entity(ies) and ${ingestRes.relationsCreated} relation(s) added to the graph ('AI Suggested'). ${ingestRes.unresolved} unresolved.`)}</span>
            </div>
          )}

          {candidates && (
            <div className="flex flex-col gap-4">
              <p style={{ fontSize: 12.5, color: 'var(--nx-text-muted)' }}>{t('Vérifiez, puis ajoutez au graphe. Les liens sont marqués « Suggéré par IA » (faible confiance) et apparaîtront dans Confiance & audit pour validation.', 'Review, then add to the graph. Links are marked ‘AI Suggested’ (low confidence) and will appear in Confidence & Audit for validation.')}</p>

              {candidates.entities.length > 0 && (
                <div>
                  <div className="mb-1" style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{t('Entités', 'Entities')} ({candidates.entities.length})</div>
                  <div className="flex flex-wrap gap-1.5">
                    {candidates.entities.map((e, i) => <span key={i} className="rounded border px-2 py-0.5" style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text)', borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>{e.name} <span style={{ color: 'var(--nx-text-muted)' }}>· {entityTypeLabel(e.type, t)} · c{e.criticality}</span></span>)}
                  </div>
                </div>
              )}

              {candidates.relations.length > 0 && (
                <div>
                  <div className="mb-1" style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{t('Relations', 'Relations')} ({candidates.relations.length})</div>
                  <div className="flex flex-col gap-1">
                    {candidates.relations.map((r, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-sm p-1.5" style={{ background: 'var(--nx-panel)', border: '1px solid var(--nx-border)', fontSize: 12 }}>
                        <span style={{ color: CYAN_T, fontFamily: mono }}>{r.source}</span>
                        <ArrowRight size={12} style={{ color: 'var(--nx-text-muted)' }} />
                        <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{relationTypeLabel(r.relationType, t)}</span>
                        <ArrowRight size={12} style={{ color: 'var(--nx-text-muted)' }} />
                        <span style={{ color: CYAN_T, fontFamily: mono }}>{r.target}</span>
                        <span className="ml-auto" style={{ fontFamily: mono, fontSize: 10, color: '#facc15' }}>{Math.round(r.confidence * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={() => ingest.mutate()} disabled={ingest.isPending} className="flex w-fit items-center gap-2 rounded-sm px-3 py-2" style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontSize: 13, fontWeight: 600 }}>
                {ingest.isPending ? <Loader2 size={15} className="animate-spin" /> : <GitMerge size={15} />} {t('Ajouter au graphe', 'Add to graph')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
