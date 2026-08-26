import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ChevronRight, Send, Sparkles } from 'lucide-react'
import { api } from '../lib/api'
import { healthColor } from '../lib/format'
import type { AiAnswer } from '../lib/types'
import { Badge, Card, Spinner } from '../components/ui'

const SUGGESTIONS = [
  'Quels sont nos plus grands risques ?',
  'Pourquoi SQL01 est-il critique ?',
  'Que se passe-t-il si SQL01 tombe ?',
  'Quels sont les single points of failure ?',
  'Quelles dépendances sont non documentées ?',
]

interface Turn {
  question: string
  answer?: AiAnswer
  error?: string
}

export function AiAnalyst() {
  const [input, setInput] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])

  const ask = useMutation({
    mutationFn: (q: string) => api.ask(q),
    onMutate: (q) => setTurns((t) => [...t, { question: q }]),
    onSuccess: (answer) => setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, answer } : x))),
    onError: (err) => setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, error: (err as Error).message } : x))),
  })

  const submit = (q: string) => {
    const question = q.trim()
    if (!question || ask.isPending) return
    setInput('')
    ask.mutate(question)
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-7.5rem)] max-w-3xl flex-col">
      <div className="flex-1 space-y-4 overflow-auto pb-4">
        {turns.length === 0 && (
          <Card className="text-center">
            <div className="mx-auto mb-3 w-fit rounded-full p-3" style={{ background: 'var(--color-surface-2)' }}>
              <Sparkles size={24} style={{ color: 'var(--color-brand)' }} />
            </div>
            <div className="text-lg font-semibold" style={{ color: 'var(--color-text-strong)' }}>NEXUS Analyst</div>
            <p className="mx-auto mt-1 max-w-md text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Posez une question sur vos dépendances et vos risques. Chaque réponse est ancrée dans les moteurs
              déterministes, avec ses preuves et son niveau de confiance.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="rounded-full border px-3 py-1.5 text-xs transition-colors hover:brightness-125"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                >
                  {s}
                </button>
              ))}
            </div>
          </Card>
        )}

        {turns.map((turn, i) => (
          <div key={i} className="space-y-2">
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-2 text-sm" style={{ background: 'var(--color-brand-soft)', color: 'var(--color-text-strong)' }}>
                {turn.question}
              </div>
            </div>
            {turn.error && <div className="text-sm" style={{ color: 'var(--color-critical)' }}>{turn.error}</div>}
            {!turn.answer && !turn.error && <Spinner label="NEXUS analyse le graphe…" />}
            {turn.answer && <AnswerCard a={turn.answer} />}
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); submit(input) }}
        className="flex items-center gap-2 rounded-xl border p-2"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Poser une question…"
          className="flex-1 bg-transparent px-2 text-sm outline-none"
          style={{ color: 'var(--color-text-strong)' }}
        />
        <button
          type="submit"
          disabled={ask.isPending || !input.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: 'var(--color-brand)', color: '#fff' }}
        >
          <Send size={15} /> Demander
        </button>
      </form>
    </div>
  )
}

function AnswerCard({ a }: { a: AiAnswer }) {
  const [showEvidence, setShowEvidence] = useState(false)
  return (
    <Card>
      <div className="mb-2 flex items-center gap-2">
        <Badge color="var(--color-brand)">{a.intent}</Badge>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          confiance <span style={{ color: healthColor(a.confidence * 100) }}>{Math.round(a.confidence * 100)}%</span>
        </span>
        {a.llmNaturalized && <Badge>LLM</Badge>}
        <span className="ml-auto text-xs" style={{ color: 'var(--color-text-muted)' }}>{a.sources.length} source(s)</span>
      </div>

      <div className="whitespace-pre-line text-sm" style={{ color: 'var(--color-text)' }}>{a.answer}</div>

      {a.recommendedAction && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border p-2 text-sm" style={{ borderColor: 'var(--color-elevated)', background: 'color-mix(in srgb, var(--color-elevated) 10%, transparent)' }}>
          <ChevronRight size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--color-elevated)' }} />
          <span style={{ color: 'var(--color-text)' }}>{a.recommendedAction}</span>
        </div>
      )}

      {a.evidence.length > 0 && (
        <div className="mt-3">
          <button onClick={() => setShowEvidence((v) => !v)} className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
            {showEvidence ? '▾' : '▸'} Preuves ({a.evidence.length})
          </button>
          {showEvidence && (
            <div className="mt-2 space-y-1">
              {a.evidence.map((e, i) => (
                <div key={i} className="flex justify-between rounded-md px-2 py-1 text-xs" style={{ background: 'var(--color-surface-2)' }}>
                  <span style={{ color: 'var(--color-text)' }}>{e.label}</span>
                  <span style={{ color: 'var(--color-text-muted)' }}>{e.detail}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
