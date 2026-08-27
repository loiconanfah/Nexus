import { useQuery } from '@tanstack/react-query'
import { BadgeCheck, FileSearch, ShieldQuestion } from 'lucide-react'
import { api } from '../lib/api'

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
  const { data, isLoading, error } = useQuery({ queryKey: ['audit'], queryFn: api.audit })

  if (isLoading) return <div style={{ fontFamily: mono, color: 'var(--nx-text-muted)' }}>AUDITING DEPENDENCY PROVENANCE…</div>
  if (error) return <div style={{ color: '#ffb4ab' }}>{(error as Error).message}</div>
  if (!data) return null

  const maxStatus = Math.max(1, ...data.byStatus.map((s) => s.count))

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-2" style={{ fontFamily: geist, fontSize: 24, color: 'var(--nx-text)' }}>
          <FileSearch size={22} style={{ color: 'var(--nx-cyan)' }} /> Confidence &amp; Audit
        </h2>
        <p className="mt-1" style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>Every dependency carries a provenance and a confidence score — separate what is verified from what is assumed.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Tile label="TOTAL DEPENDENCIES" value={String(data.summary.totalDependencies)} color="var(--nx-text)" />
        <Tile label="VERIFIED" value={`${data.summary.verifiedPercent}%`} sub={`${data.summary.verified} edges`} color="#4ade80" />
        <Tile label="AVG CONFIDENCE" value={`${data.summary.avgConfidence}%`} color={CYAN_T} />
        <Tile label="NEEDS REVIEW" value={String(data.summary.undocumented)} color="#facc15" />
      </div>

      {/* Distribution + low confidence */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="rounded-sm border p-4" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
          <h3 className="mb-3 flex items-center gap-2" style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text)' }}><BadgeCheck size={14} /> Confidence Distribution</h3>
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
            <h3 style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text)' }}>Dependencies Needing Review</h3>
          </div>
          <div className="flex flex-col divide-y" style={{ maxHeight: 320, overflowY: 'auto' }}>
            {data.lowConfidence.map((e, idx) => (
              <div key={idx} className="p-3" style={{ borderColor: 'var(--nx-border)' }}>
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 13, color: 'var(--nx-text)' }}><span style={{ color: CYAN_T }}>{e.source}</span> <span style={{ color: 'var(--nx-text-muted)', fontFamily: mono, fontSize: 11 }}>{e.type}</span> <span style={{ color: CYAN_T }}>{e.target}</span></span>
                  <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: sc(e.status) }}>{e.confidence}%</span>
                </div>
                <div className="mt-1 flex items-center gap-2" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>
                  <span className="rounded px-1.5 py-0.5" style={{ color: sc(e.status), background: `${sc(e.status)}18` }}>{e.status}</span>
                  <span>src: {e.sourceSystem}</span>
                </div>
                <p className="mt-1" style={{ fontSize: 12, color: 'var(--nx-text-muted)', fontStyle: 'italic' }}>{e.evidence}</p>
              </div>
            ))}
            {data.lowConfidence.length === 0 && <div className="p-4" style={{ fontFamily: mono, fontSize: 12, color: '#4ade80' }}>All dependencies verified. No review required.</div>}
          </div>
        </div>
      </div>

      {/* Ledger complet */}
      <div className="overflow-x-auto rounded-sm border" style={{ borderColor: 'var(--nx-border)' }}>
        <div className="border-b px-4 py-3" style={{ borderColor: 'var(--nx-border)' }}>
          <h3 style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--nx-text)' }}>Dependency Provenance Ledger</h3>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--nx-border)' }}>
              {['Source', 'Relation', 'Target', 'Confidence', 'Status', 'Origin'].map((h, i) => (
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

function Tile({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="rounded-sm border p-3" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
      <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{label}</div>
      <div style={{ fontFamily: geist, fontSize: 24, fontWeight: 500, color }}>{value}</div>
      {sub && <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{sub}</div>}
    </div>
  )
}
