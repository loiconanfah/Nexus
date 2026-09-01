import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, Database, Eye, RefreshCw, Search, Send, Sparkles, Terminal, User, Zap,
} from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import type { AiAnswer } from '../lib/types'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'
const ERR = '#ffb4ab'

type T = (fr: string, en: string) => string

function intentMeta(intent: string, t: T): { title: string; color: string } {
  switch (intent) {
    case 'SinglePointsOfFailure': return { title: t('POINTS UNIQUES DE DÉFAILLANCE', 'SINGLE POINTS OF FAILURE'), color: ERR }
    case 'TopRisks': return { title: t('VULNÉRABILITÉS STRUCTURELLES', 'STRUCTURAL VULNERABILITIES'), color: ERR }
    case 'ExplainCriticality': return { title: t('ANALYSE DE CRITICITÉ', 'CRITICALITY ANALYSIS'), color: '#fb923c' }
    case 'SimulateFailure': return { title: t('PROJECTION D’IMPACT', 'IMPACT PROJECTION'), color: '#fb923c' }
    case 'UndocumentedDependencies': return { title: t('DÉPENDANCES NON VÉRIFIÉES', 'UNVERIFIED DEPENDENCIES'), color: '#facc15' }
    default: return { title: t('BRIEF OPÉRATIONNEL', 'OPERATIONAL BRIEF'), color: CYAN }
  }
}

interface Turn { question: string; ts: string; answer?: AiAnswer; error?: string }

export function AiAnalyst() {
  const navigate = useNavigate()
  const { t, lang } = useLang()
  const [input, setInput] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])

  const SUGGESTIONS = lang === 'fr' ? [
    'Quels sont nos cinq plus grands risques opérationnels ?',
    'Que se passe-t-il si un fournisseur disparaît ?',
    'Trouve les dépendances inconnues.',
    'Pourquoi SQL01 est-il critique ?',
  ] : [
    'What are our five biggest operational risks?',
    'What breaks if a supplier disappears?',
    'Find unknown dependencies.',
    'Why is SQL01 critical?',
  ]

  const ask = useMutation({
    mutationFn: (q: string) => api.ask(lang === 'fr' ? `${q}\n\n(Réponds en français.)` : q),
    onMutate: (q) => setTurns((t) => [...t, { question: q, ts: nowUtc() }]),
    onSuccess: (answer) => setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, answer } : x))),
    onError: (err) => setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, error: (err as Error).message } : x))),
  })

  const submit = (q: string) => { const question = q.trim(); if (!question || ask.isPending) return; setInput(''); ask.mutate(question) }
  const lastAnswer = [...turns].reverse().find((t) => t.answer)?.answer

  return (
    <div className="flex h-[calc(100vh-7rem)] overflow-hidden rounded-sm border" style={{ borderColor: 'var(--nx-border)' }}>
      {/* ===== Investigation Log ===== */}
      <section className="flex flex-1 flex-col overflow-hidden border-r" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface)' }}>
        <header className="flex h-16 shrink-0 flex-col justify-center border-b px-6" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface-container)' }}>
          <h2 className="flex items-center gap-2" style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--nx-text)' }}>
            <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: CYAN, boxShadow: '0 0 8px #00e5ff' }} /> {t('Analyste Lenexus', 'Lenexus Analyst')}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>{t('Posez des questions sur les dépendances opérationnelles de votre organisation.', "Ask questions about your organization's operational dependencies.")}</p>
        </header>

        {/* Log */}
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
          {turns.length === 0 && (
            <div className="m-auto max-w-md text-center">
              <div className="mx-auto mb-3 w-fit rounded-sm p-3" style={{ background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.3)' }}><Sparkles size={24} style={{ color: CYAN }} /></div>
              <div style={{ fontFamily: geist, fontSize: 18, color: 'var(--nx-text)' }}>{t('Analyste Lenexus', 'Lenexus Analyst')}</div>
              <p className="mt-1" style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>{t('Chaque réponse s’appuie sur les moteurs déterministes, avec ses preuves et son niveau de confiance.', 'Every answer is grounded in the deterministic engines, with its evidence and confidence.')}</p>
            </div>
          )}

          {turns.map((turn, i) => (
            <div key={i} className="flex flex-col gap-6">
              {/* User */}
              <div className="ml-auto flex w-full max-w-3xl items-start justify-end gap-4">
                <div className="rounded-lg rounded-tr-none border p-4 text-right" style={{ background: 'var(--nx-surface-high)', borderColor: 'var(--nx-border)' }}>
                  <p style={{ fontSize: 14, color: 'var(--nx-text)' }}>{turn.question}</p>
                  <span className="mt-2 block opacity-70" style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>{turn.ts} | Operator: OP-4A</span>
                </div>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}><User size={15} style={{ color: 'var(--nx-text-muted)' }} /></div>
              </div>

              {/* Typing */}
              {!turn.answer && !turn.error && (
                <div className="flex w-full max-w-3xl items-center gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border" style={{ background: 'rgba(0,229,255,0.1)', borderColor: 'rgba(0,229,255,0.3)' }}><RefreshCw size={15} className="animate-spin" style={{ color: CYAN }} /></div>
                  <span className="animate-pulse" style={{ fontFamily: mono, fontSize: 12, color: CYAN_T }}>{t('Interrogation du graphe de dépendances…', 'Querying dependency graph…')}</span>
                </div>
              )}
              {turn.error && <div style={{ color: ERR, fontSize: 13 }}>{turn.error}</div>}
              {turn.answer && <AnswerCard a={turn.answer} t={t} onView={() => navigate('/graph')} onSimulate={(name) => navigate(`/simulations?name=${encodeURIComponent(name)}`)} />}
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="flex flex-col gap-3 border-t p-4" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => submit(s)} className="flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 transition-colors"
                style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface-high)', color: 'var(--nx-text-muted)', fontFamily: mono, fontSize: 12 }}>
                <Sparkles size={13} style={{ color: CYAN }} /> {s}
              </button>
            ))}
          </div>
          <form className="relative flex items-center" onSubmit={(e) => { e.preventDefault(); submit(input) }}>
            <Terminal size={18} className="absolute left-4" style={{ color: 'var(--nx-text-muted)' }} />
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('Demandez n’importe quoi à Lenexus…', 'Ask Lenexus anything… (e.g. ⌘+K)')}
              className="w-full rounded-sm border py-3 pl-12 pr-14 outline-none" style={{ background: 'var(--nx-surface)', borderColor: 'var(--nx-border)', color: 'var(--nx-text)', fontFamily: mono, fontSize: 13 }} />
            <button type="submit" disabled={ask.isPending || !input.trim()} className="absolute right-3 flex h-8 w-8 items-center justify-center rounded-sm disabled:opacity-40"
              style={{ background: 'rgba(0,229,255,0.2)', border: '1px solid rgba(0,229,255,0.5)', color: CYAN }}><Send size={15} /></button>
          </form>
        </div>
      </section>

      {/* ===== Context Viewer ===== */}
      <aside className="hidden w-[320px] shrink-0 flex-col overflow-hidden lg:flex" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
        <header className="flex h-16 shrink-0 items-center border-b px-4" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
          <h3 className="flex items-center gap-2" style={{ fontFamily: mono, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}><Database size={14} /> {t('Visualiseur de contexte', 'Context Viewer')}</h3>
        </header>
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
          <ContextViewer affected={lastAnswer?.affectedAssets ?? []} t={t} onView={() => navigate('/graph')} />
        </div>
      </aside>
    </div>
  )
}

function AnswerCard({ a, t, onView, onSimulate }: { a: AiAnswer; t: T; onView: () => void; onSimulate: (name: string) => void }) {
  const meta = intentMeta(a.intent, t)
  const severity = Math.round(a.confidence * 100)
  const evidence = a.evidence[0]
  const path = a.affectedAssets.length > 0 ? ['Root', a.affectedAssets[0], 'Operations'] : ['Root', 'Graph', 'Operations']

  return (
    <div className="flex w-full max-w-3xl items-start gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border" style={{ background: 'var(--nx-surface)', borderColor: CYAN, boxShadow: '0 0 10px rgba(0,229,255,0.15)' }}><Zap size={15} style={{ color: CYAN }} /></div>
      <div className="relative w-full overflow-hidden rounded-lg rounded-tl-none border" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
        <div className="absolute left-0 top-0 h-full w-1" style={{ background: CYAN, boxShadow: '0 0 12px #00e5ff' }} />
        <div className="border-b p-4" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
          <p className="whitespace-pre-line" style={{ fontSize: 14, color: 'var(--nx-text)' }}>{a.answer}</p>
          {a.llmNaturalized && <span className="mt-1 inline-block rounded px-1.5" style={{ fontFamily: mono, fontSize: 10, color: CYAN_T, background: 'rgba(0,229,255,0.1)' }}>LLM</span>}
        </div>

        <div className="p-4">
          <div className="rounded-sm border p-4" style={{ background: 'var(--nx-surface)', borderColor: 'var(--nx-border)' }}>
            <div className="mb-3 flex items-start justify-between">
              <h3 className="flex items-center gap-2" style={{ fontFamily: mono, fontSize: 14, letterSpacing: '0.05em', color: meta.color }}>{meta.title}</h3>
              <div className="flex flex-col items-end">
                <span style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: meta.color }}>{severity}<span style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>/100</span></span>
                <span style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{t('Indice de confiance', 'Confidence Index')}</span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-3">
                {evidence && (
                  <div>
                    <span className="mb-1 block" style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text-muted)' }}>{t('Preuve :', 'Evidence:')}</span>
                    <div className="border-l-2 py-1 pl-2" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)', fontSize: 13, color: 'var(--nx-text)', opacity: 0.85 }}>{evidence.label} — {evidence.detail}</div>
                  </div>
                )}
                {a.affectedAssets.length > 0 && (
                  <div>
                    <span className="mb-1 block" style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text-muted)' }}>{t('Actifs affectés :', 'Affected Assets:')}</span>
                    <div className="flex flex-wrap gap-2">
                      {a.affectedAssets.slice(0, 6).map((n) => (
                        <span key={n} className="rounded border px-2 py-0.5" style={{ fontFamily: mono, fontSize: 11, borderColor: 'var(--nx-border)', background: 'var(--nx-surface-highest)', color: 'var(--nx-text)' }}>{n}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-3 border-t pt-3 md:border-l md:border-t-0 md:pl-4 md:pt-0" style={{ borderColor: 'var(--nx-border)' }}>
                <div>
                  <div className="mb-1 flex justify-between" style={{ fontFamily: mono, fontSize: 12 }}><span style={{ color: 'var(--nx-text-muted)' }}>{t('Niveau de confiance', 'Confidence Level')}</span><span style={{ color: CYAN_T }}>{severity}%</span></div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--nx-surface-highest)' }}><div className="h-full" style={{ width: `${severity}%`, background: CYAN }} /></div>
                </div>
                <div>
                  <span className="mb-1 block" style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text-muted)' }}>{t('Chemin dans le graphe :', 'Graph Path:')}</span>
                  <div className="flex items-center gap-1" style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text)', opacity: 0.75 }}>
                    {path.map((p, i) => (<span key={i} className="flex items-center gap-1"><span style={{ color: i === 1 ? meta.color : undefined }}>{p}</span>{i < path.length - 1 && <ArrowRight size={12} />}</span>))}
                  </div>
                </div>
                {a.recommendedAction && <div style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>▸ {a.recommendedAction}</div>}
                <div className="flex gap-2">
                  <button onClick={onView} className="flex flex-1 items-center justify-center gap-1 rounded border px-3 py-1.5 transition-colors" style={{ borderColor: 'rgba(0,229,255,0.3)', color: CYAN_T, fontFamily: mono, fontSize: 11, textTransform: 'uppercase' }}><Eye size={13} /> {t('Sous-graphe', 'Subgraph')}</button>
                  {a.affectedAssets.length > 0 && <button onClick={() => onSimulate(a.affectedAssets[0])} className="flex flex-1 items-center justify-center gap-1 rounded border px-3 py-1.5" style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text-muted)', fontFamily: mono, fontSize: 11, textTransform: 'uppercase' }}><Zap size={13} /> {t('Simuler', 'Simulate')}</button>}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-2 text-right" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{a.sources.length} source(s)</div>{/* source(s) identique FR/EN */}
        </div>
      </div>
    </div>
  )
}

function ContextViewer({ affected, t, onView }: { affected: string[]; t: T; onView: () => void }) {
  const nodes = affected.slice(0, 6)
  const pos = useMemo(() => {
    const n = nodes.length || 1
    return nodes.map((name, i) => { const a = (i / n) * 2 * Math.PI - Math.PI / 2; return { name, x: 50 + Math.cos(a) * 32, y: 50 + Math.sin(a) * 32 } })
  }, [nodes])

  return (
    <>
      <div>
        <h4 className="mb-3 flex items-center justify-between border-b pb-2" style={{ fontSize: 13, color: 'var(--nx-text)', borderColor: 'var(--nx-border)' }}>
          {t('Entités actives', 'Active Entities')} <span className="rounded px-2" style={{ fontFamily: mono, fontSize: 11, background: 'var(--nx-surface-highest)' }}>{affected.length}</span>
        </h4>
        {affected.length === 0 && <p style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>{t('Posez une question pour peupler le contexte.', 'Ask a question to populate the context.')}</p>}
        <div className="flex flex-col gap-2">
          {affected.slice(0, 8).map((name, i) => (
            <div key={name} onClick={onView} className="flex cursor-pointer items-center justify-between rounded-sm border p-2 transition-colors" style={{ background: 'var(--nx-surface)', borderColor: 'var(--nx-border)', borderLeft: i === 0 ? `2px solid ${CYAN}` : undefined }}>
              <div className="flex items-center gap-2"><Database size={15} style={{ color: 'var(--nx-text-muted)' }} /><span style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text)' }}>{name}</span></div>
              <span className="h-2 w-2 rounded-full" style={{ background: ERR }} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex min-h-[220px] flex-1 flex-col">
        <h4 className="mb-3 flex items-center gap-2 border-b pb-2" style={{ fontSize: 13, color: 'var(--nx-text)', borderColor: 'var(--nx-border)' }}><Search size={14} /> {t('Carte topologique', 'Topology Map')}</h4>
        <div className="relative flex-1 overflow-hidden rounded-sm border" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
          <div className="nx-grid absolute inset-0" />
          {nodes.length > 0 && (
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100">
              {pos.map((p) => <line key={`l${p.name}`} x1={50} y1={50} x2={p.x} y2={p.y} stroke="#3b494c" strokeWidth={0.4} />)}
              {pos.map((p) => <circle key={p.name} cx={p.x} cy={p.y} r={2} fill={ERR} />)}
              <circle cx={50} cy={50} r={3.5} fill="none" stroke={CYAN} strokeWidth={0.8} />
              <circle cx={50} cy={50} r={1.6} fill={CYAN} />
            </svg>
          )}
        </div>
      </div>
    </>
  )
}

function nowUtc(): string {
  return new Date().toISOString().slice(11, 19) + ' UTC'
}
