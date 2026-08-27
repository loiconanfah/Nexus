import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Database, LogOut, RotateCcw, Server, Settings, ShieldCheck } from 'lucide-react'
import { api } from '../lib/api'
import { getTenantId, resetTenant } from '../lib/tenant'
import { logout } from '../lib/auth'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'

export function Admin() {
  const navigate = useNavigate()
  const tenant = getTenantId()
  const { data: health, isLoading } = useQuery({ queryKey: ['health'], queryFn: api.health, refetchInterval: 15000 })
  const { data: overview } = useQuery({ queryKey: ['overview'], queryFn: api.overview })

  const ready = health?.status === 'ready'

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-2" style={{ fontFamily: geist, fontSize: 24, color: 'var(--nx-text)' }}>
          <Settings size={22} style={{ color: CYAN }} /> Admin &amp; System
        </h2>
        <p className="mt-1" style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>Workspace configuration and platform health.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Sante plateforme */}
        <div className="rounded-sm border" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
          <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: 'var(--nx-border)' }}>
            <ShieldCheck size={15} style={{ color: ready ? '#4ade80' : '#facc15' }} />
            <h3 style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text)' }}>Platform Health</h3>
            <span className="ml-auto rounded px-2 py-0.5" style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: ready ? '#4ade80' : '#facc15', background: ready ? 'rgba(74,222,128,0.12)' : 'rgba(250,204,21,0.12)' }}>{isLoading ? '…' : health?.status}</span>
          </div>
          <div className="flex flex-col divide-y" style={{ borderColor: 'var(--nx-border)' }}>
            <HealthRow icon={Database} label="PostgreSQL (control plane)" ok={health?.dependencies.postgres} />
            <HealthRow icon={Server} label="Neo4j (knowledge graph)" ok={health?.dependencies.neo4j} />
          </div>
          <div className="px-4 py-2" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>Auto-refresh every 15s · last check {health ? new Date(health.utc).toLocaleTimeString() : '—'}</div>
        </div>

        {/* Workspace */}
        <div className="rounded-sm border" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
          <div className="border-b px-4 py-3" style={{ borderColor: 'var(--nx-border)' }}>
            <h3 style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text)' }}>Workspace</h3>
          </div>
          <div className="flex flex-col divide-y" style={{ borderColor: 'var(--nx-border)' }}>
            <InfoRow label="Tenant ID" value={tenant} mono />
            <InfoRow label="Entities" value={String(overview?.entityCount ?? '—')} />
            <InfoRow label="Relations" value={String(overview?.relationCount ?? '—')} />
            <InfoRow label="Health score" value={String(overview?.organizationHealthScore ?? '—')} />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="rounded-sm border" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
        <div className="border-b px-4 py-3" style={{ borderColor: 'var(--nx-border)' }}>
          <h3 style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text)' }}>Actions</h3>
        </div>
        <div className="flex flex-wrap gap-3 p-4">
          <button onClick={() => navigate('/onboarding')} className="flex items-center gap-2 rounded-sm px-3 py-2" style={{ background: 'rgba(0,229,255,0.10)', border: '1px solid rgba(0,229,255,0.30)', color: CYAN_T, fontFamily: mono, fontSize: 12 }}>
            <Database size={14} /> Ingest data
          </button>
          <button onClick={() => { if (confirm('Start a fresh, empty workspace? The current demo tenant will be replaced locally.')) { resetTenant(); window.location.href = '/' } }} className="flex items-center gap-2 rounded-sm px-3 py-2" style={{ background: 'var(--nx-surface)', border: '1px solid var(--nx-border)', color: 'var(--nx-text)', fontFamily: mono, fontSize: 12 }}>
            <RotateCcw size={14} /> New empty workspace
          </button>
          <button onClick={() => { logout(); navigate('/login') }} className="flex items-center gap-2 rounded-sm px-3 py-2" style={{ background: 'var(--nx-surface)', border: '1px solid var(--nx-border)', color: '#ffb4ab', fontFamily: mono, fontSize: 12 }}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

function HealthRow({ icon: Icon, label, ok }: { icon: typeof Database; label: string; ok?: boolean }) {
  const color = ok == null ? '#849396' : ok ? '#4ade80' : '#ffb4ab'
  return (
    <div className="flex items-center justify-between px-4 py-3" style={{ borderColor: 'var(--nx-border)' }}>
      <span className="flex items-center gap-2" style={{ fontSize: 13, color: 'var(--nx-text)' }}><Icon size={15} style={{ color: 'var(--nx-text-muted)' }} /> {label}</span>
      <span className="flex items-center gap-1.5" style={{ fontFamily: mono, fontSize: 11, color }}>
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
        {ok == null ? 'CHECKING' : ok ? 'CONNECTED' : 'DOWN'}
      </span>
    </div>
  )
}

function InfoRow({ label, value, mono: isMono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3" style={{ borderColor: 'var(--nx-border)' }}>
      <span style={{ fontFamily: mono, fontSize: 11, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{label}</span>
      <span style={{ fontFamily: isMono ? mono : geist, fontSize: 13, color: 'var(--nx-text)' }}>{value}</span>
    </div>
  )
}
