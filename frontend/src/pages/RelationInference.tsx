import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Sparkles, GitBranch, ArrowRight, Check, Settings } from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import type { ProposedRelation } from '../lib/types'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const NEG = '#d15b54'

export function RelationInference() {
  const { t } = useLang()
  const nav = useNavigate()
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [ingested, setIngested] = useState<number | null>(null)

  const infer = useMutation({
    mutationFn: api.inferRelations,
    onSuccess: (r) => { setSelected(new Set(r.proposals.map((_, i) => i))); setIngested(null) },
  })
  const ingest = useMutation({
    mutationFn: (rels: ProposedRelation[]) => api.ingestInferredRelations(rels),
    onSuccess: (r) => setIngested(r.created),
  })
  const data = infer.data
  const proposals = data?.proposals ?? []

  const toggle = (i: number) => setSelected((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n })
  const submit = () => ingest.mutate(proposals.filter((_, i) => selected.has(i)))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <GitBranch size={22} style={{ color: CYAN }} />
          <h2 style={{ fontFamily: geist, fontSize: 22, color: 'var(--nx-text)' }}>
            {t('Dépendances inférées', 'Inferred dependencies')}
          </h2>
        </div>
        <p style={{ fontSize: 13, color: 'var(--nx-text-muted)', maxWidth: 660 }}>
          {t(
            'Lenexus lit les entités déjà présentes dans votre graphe et propose les dépendances manquantes les plus plausibles. Un graphe n’a de valeur que s’il apprend : vous validez, Lenexus enrichit. Rien n’est écrit sans votre confirmation.',
            'Lenexus reads the entities already in your graph and proposes the most plausible missing dependencies. A graph is only valuable if it learns: you approve, Lenexus enriches. Nothing is written without your confirmation.',
          )}
        </p>
      </div>

      <div>
        <button
          onClick={() => infer.mutate()}
          disabled={infer.isPending}
          className="flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium"
          style={{ background: CYAN, color: '#04121a', opacity: infer.isPending ? 0.6 : 1 }}
        >
          <Sparkles size={16} /> {infer.isPending ? t('Analyse du graphe…', 'Analyzing graph…') : t('Analyser mon graphe et proposer des dépendances', 'Analyze my graph and propose dependencies')}
        </button>
      </div>

      {infer.isError && <p style={{ color: NEG, fontSize: 13 }}>{(infer.error as Error).message}</p>}

      {data && !data.usedAi && (
        <div className="rounded-lg border p-6" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
          <p style={{ fontSize: 14, color: 'var(--nx-text)' }}>{data.message}</p>
          <button
            onClick={() => nav('/admin')}
            className="mt-3 flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm"
            style={{ borderColor: CYAN, color: CYAN }}
          >
            <Settings size={14} /> {t('Configurer une clé IA', 'Configure an AI key')}
          </button>
        </div>
      )}

      {data && data.usedAi && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>
              {t(
                `${proposals.length} proposition(s) · ${data.entitiesScanned} entités analysées · ${data.existingRelations} relations existantes`,
                `${proposals.length} proposal(s) · ${data.entitiesScanned} entities scanned · ${data.existingRelations} existing relations`,
              )}
            </div>
            {proposals.length > 0 && (
              <div className="flex items-center gap-2">
                <button onClick={() => setSelected(new Set(proposals.map((_, i) => i)))} className="rounded border px-2.5 py-1" style={{ borderColor: 'var(--nx-border)', fontSize: 12, color: 'var(--nx-text-muted)' }}>{t('Tout', 'All')}</button>
                <button onClick={() => setSelected(new Set())} className="rounded border px-2.5 py-1" style={{ borderColor: 'var(--nx-border)', fontSize: 12, color: 'var(--nx-text-muted)' }}>{t('Aucun', 'None')}</button>
                <button
                  onClick={submit}
                  disabled={ingest.isPending || selected.size === 0}
                  className="flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium"
                  style={{ background: CYAN, color: '#04121a', opacity: ingest.isPending || selected.size === 0 ? 0.5 : 1 }}
                >
                  <Check size={14} /> {t(`Ingérer (${selected.size})`, `Ingest (${selected.size})`)}
                </button>
              </div>
            )}
          </div>

          {ingested !== null && (
            <div className="rounded-md border px-4 py-2" style={{ borderColor: CYAN, background: 'var(--nx-surface-container)', fontSize: 13, color: CYAN }}>
              {t(`${ingested} dépendance(s) ajoutée(s) au graphe (statut « Suggéré par IA »). Elles sont maintenant prises en compte par l’analyse d’impact.`, `${ingested} dependency(ies) added to the graph (status “AI-suggested”). They now feed the impact analysis.`)}
            </div>
          )}

          <div className="rounded-lg border" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
            {proposals.length === 0 ? (
              <p className="p-5" style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>{t('Aucune dépendance manquante évidente — le graphe semble complet.', 'No obvious missing dependency — the graph looks complete.')}</p>
            ) : proposals.map((p, i) => (
              <label key={i} className="flex cursor-pointer items-start gap-3 border-b p-3" style={{ borderColor: 'var(--nx-border)' }}>
                <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} className="mt-1" style={{ accentColor: CYAN as unknown as string }} />
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-1.5" style={{ fontSize: 13 }}>
                    <span style={{ color: 'var(--nx-text)' }}>{p.source}</span>
                    <span style={{ fontSize: 10, color: 'var(--nx-outline)' }}>{p.sourceType}</span>
                    <span className="rounded px-1.5" style={{ fontFamily: mono, fontSize: 10, background: 'var(--nx-surface-container)', color: CYAN }}>{p.relationType}</span>
                    <ArrowRight size={12} style={{ color: 'var(--nx-outline)' }} />
                    <span style={{ color: 'var(--nx-text)' }}>{p.target}</span>
                    <span style={{ fontSize: 10, color: 'var(--nx-outline)' }}>{p.targetType}</span>
                    <span className="ml-auto" style={{ fontFamily: mono, fontSize: 11, color: confColor(p.confidence) }}>{Math.round(p.confidence * 100)}%</span>
                  </div>
                  {p.rationale && <p className="mt-0.5" style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>{p.rationale}</p>}
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function confColor(c: number): string {
  if (c >= 0.75) return '#3fb27f'
  if (c >= 0.5) return '#e0a458'
  return '#8aa0ad'
}
