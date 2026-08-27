import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { BookOpen, FileDown, Server, ShieldPlus, User } from 'lucide-react'
import { api } from '../lib/api'
import type { HumanPerson } from '../lib/types'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'
const ERR = '#ffb4ab'

const RISK_COLOR: Record<string, string> = { CRITICAL: '#ffb4ab', HIGH: '#fb923c', MODERATE: '#facc15' }

export function HumanDependency() {
  const navigate = useNavigate()
  const { data, isLoading, error } = useQuery({ queryKey: ['humanDeps'], queryFn: api.humanDependencies })
  const [selId, setSelId] = useState<string | null>(null)

  const people = data?.people ?? []
  const selected = people.find((p) => p.id === selId) ?? people[0]

  if (isLoading) return <div style={{ fontFamily: mono, color: 'var(--nx-text-muted)' }}>ANALYZING KNOWLEDGE CONCENTRATION…</div>
  if (error) return <div style={{ color: ERR }}>{(error as Error).message}</div>
  if (!data) return null

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 style={{ fontFamily: geist, fontSize: 24, color: 'var(--nx-text)' }}>Human Dependency</h2>
          <p className="mt-1" style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>Identify operational knowledge that exists in too few people.</p>
        </div>
        <div className="hidden gap-2 lg:flex">
          <button className="flex items-center gap-2 rounded-sm border px-3 py-1.5" style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text-muted)', fontFamily: mono, fontSize: 12 }}><FileDown size={14} /> Export Report</button>
          <button className="flex items-center gap-2 rounded-sm px-3 py-1.5" style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontFamily: mono, fontSize: 12, fontWeight: 600 }}><ShieldPlus size={14} /> Create Contingency</button>
        </div>
      </div>

      {/* Tuiles */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Tile label="CRITICAL KNOWLEDGE AREAS" value={data.summary.criticalKnowledgeAreas} color={ERR} />
        <Tile label="SINGLE-KNOWLEDGE OWNERS" value={data.summary.singleKnowledgeOwners} color="#fb923c" />
        <Tile label="UNDOCUMENTED PROCESSES" value={data.summary.undocumentedProcesses} color="#facc15" />
        <Tile label="KEY DEPENDENCY EMPLOYEES" value={data.summary.keyDependencyEmployees} color={CYAN_T} />
      </div>

      {/* Graphe + profil */}
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-h-[320px] flex-1 rounded-sm border" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
          {selected && <KnowledgeGraph person={selected} onSystem={(name) => navigate(`/simulations?name=${encodeURIComponent(name)}`)} />}
        </div>
        {selected && <Profile person={selected} onSimulate={() => navigate(`/simulations?asset=${selected.knownSystems[0] ?? ''}&name=${encodeURIComponent(selected.knownSystems[0] ?? '')}`)} />}
      </div>

      {/* Directory */}
      <div className="overflow-x-auto rounded-sm border" style={{ borderColor: 'var(--nx-border)' }}>
        <div className="border-b px-4 py-3" style={{ borderColor: 'var(--nx-border)' }}>
          <h3 style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--nx-text)' }}>Knowledge Risk Directory</h3>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--nx-border)' }}>
              {['Employee', 'Role', 'Critical Knowledge', 'Backup', 'Risk Level', 'Documentation'].map((h, i) => (
                <th key={h} className={`px-4 py-2 ${i >= 3 && i <= 3 ? 'text-right' : ''}`} style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.map((p) => {
              const c = RISK_COLOR[p.riskLevel]
              const sel = selected?.id === p.id
              return (
                <tr key={p.id} onClick={() => setSelId(p.id)} className="cursor-pointer border-b transition-colors" style={{ borderColor: 'var(--nx-border)', background: sel ? 'var(--nx-surface-high)' : 'transparent', borderLeft: `2px solid ${sel ? CYAN : 'transparent'}` }}>
                  <td className="px-4 py-3" style={{ fontSize: 13, fontWeight: 500, color: CYAN_T }}>{p.name}</td>
                  <td className="px-4 py-3" style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>{p.role}</td>
                  <td className="px-4 py-3" style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text)' }}>{p.knownSystems.join(', ')}</td>
                  <td className="px-4 py-3 text-right" style={{ fontFamily: mono, fontSize: 12, color: p.backupExperts === 0 ? ERR : 'var(--nx-text-muted)' }}>{p.backupExperts}</td>
                  <td className="px-4 py-3"><span className="rounded px-2 py-0.5" style={{ fontFamily: mono, fontSize: 11, color: c, background: `color-mix(in srgb, ${c} 18%, transparent)`, border: `1px solid color-mix(in srgb, ${c} 30%, transparent)` }}>{p.riskLevel}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1 w-16 overflow-hidden rounded-full" style={{ background: 'var(--nx-surface-highest)' }}><div className="h-full" style={{ width: `${p.documentationPercent}%`, background: p.documentationPercent < 40 ? ERR : CYAN }} /></div>
                      <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>{p.documentationPercent}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function KnowledgeGraph({ person, onSystem }: { person: HumanPerson; onSystem: (name: string) => void }) {
  const systems = person.knownSystems.slice(0, 6)
  const pos = useMemo(() => {
    const n = systems.length || 1
    return systems.map((name, i) => { const a = (i / n) * 2 * Math.PI - Math.PI / 2; return { name, x: 50 + Math.cos(a) * 32, y: 50 + Math.sin(a) * 30 } })
  }, [systems])
  return (
    <div className="relative h-full min-h-[320px] w-full">
      <div className="nx-grid absolute inset-0" />
      <div className="absolute left-3 top-3" style={{ fontFamily: mono, fontSize: 11, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>Knowledge Concentration</div>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        {pos.map((p) => <line key={`l${p.name}`} x1={50} y1={50} x2={p.x} y2={p.y} stroke={CYAN} strokeWidth={0.4} strokeDasharray="2 1" opacity={0.5} />)}
        {pos.map((p) => (
          <g key={p.name} style={{ cursor: 'pointer' }} onClick={() => onSystem(p.name)}>
            <rect x={p.x - 9} y={p.y - 3} width={18} height={6} rx={1} fill="var(--nx-surface)" stroke="var(--nx-border)" strokeWidth={0.3} />
            <text x={p.x} y={p.y + 1.2} textAnchor="middle" fill="var(--nx-text)" fontFamily="JetBrains Mono" fontSize="2.6">{p.name}</text>
          </g>
        ))}
        <circle cx={50} cy={50} r={6} fill="rgba(0,229,255,0.1)" stroke={CYAN} strokeWidth={0.6} />
        <circle cx={50} cy={46.5} r={1.6} fill={CYAN} />
        <path d={`M ${50 - 2.5} ${52.5} q 2.5 -2 5 0`} fill="none" stroke={CYAN} strokeWidth={0.5} />
        <text x={50} y={60} textAnchor="middle" fill="var(--nx-text)" fontFamily="JetBrains Mono" fontSize="3" fontWeight="700">{person.name}</text>
      </svg>
    </div>
  )
}

function Profile({ person, onSimulate }: { person: HumanPerson; onSimulate: () => void }) {
  const c = RISK_COLOR[person.riskLevel]
  return (
    <aside className="flex w-full shrink-0 flex-col gap-5 rounded-sm border p-5 lg:w-[320px]" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
      <h3 style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--nx-text-muted)' }}>Dependency Profile</h3>
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-sm border" style={{ background: 'var(--nx-surface)', borderColor: CYAN }}><User size={22} style={{ color: CYAN }} /></div>
        <div>
          <div style={{ fontFamily: geist, fontSize: 18, color: 'var(--nx-text)' }}>{person.name}</div>
          <div style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>{person.role}</div>
        </div>
      </div>
      {person.soleKnowledgeSystems > 0 && <span className="w-fit rounded px-2 py-0.5" style={{ fontFamily: mono, fontSize: 10, color: ERR, background: 'rgba(255,180,171,0.15)', border: '1px solid rgba(255,180,171,0.3)' }}>⚠ CRITICAL CONCENTRATION</span>}

      <div>
        <h4 className="mb-2 border-b pb-1" style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: 'var(--nx-text-muted)', borderColor: 'var(--nx-border)' }}>Core Knowledge Areas</h4>
        <div className="flex flex-wrap gap-2">
          {person.knownSystems.map((s) => (
            <span key={s} className="flex items-center gap-1 rounded border px-2 py-0.5" style={{ fontFamily: mono, fontSize: 11, borderColor: 'var(--nx-border)', background: 'var(--nx-surface)', color: 'var(--nx-text)' }}><Server size={11} /> {s}</span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MiniStat label="CRITICAL SYSTEMS" value={person.criticalSystems || person.knownSystems.length} color={c} />
        <MiniStat label="BACKUP EXPERTS" value={person.backupExperts} color={person.backupExperts === 0 ? ERR : CYAN_T} />
      </div>

      <div>
        <div className="mb-1 flex justify-between" style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}><span>Documentation</span><span>{person.documentationPercent}% Covered</span></div>
        <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--nx-surface-highest)' }}><div className="h-full" style={{ width: `${person.documentationPercent}%`, background: person.documentationPercent < 40 ? ERR : CYAN }} /></div>
      </div>

      <button onClick={onSimulate} className="mt-auto flex w-full items-center justify-center gap-2 rounded-sm py-2" style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontSize: 13, fontWeight: 600 }}><BookOpen size={16} /> Simulate Knowledge Loss</button>
    </aside>
  )
}

function Tile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-sm border p-3" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
      <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{label}</div>
      <div style={{ fontFamily: geist, fontSize: 28, fontWeight: 500, color }}>{value}</div>
    </div>
  )
}
function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-sm border p-2 text-center" style={{ background: 'var(--nx-surface)', borderColor: 'var(--nx-border)' }}>
      <div style={{ fontFamily: geist, fontSize: 22, fontWeight: 600, color }}>{value}</div>
      <div style={{ fontFamily: mono, fontSize: 9, color: 'var(--nx-text-muted)' }}>{label}</div>
    </div>
  )
}
