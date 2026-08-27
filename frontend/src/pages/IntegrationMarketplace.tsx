import { useNavigate } from 'react-router-dom'
import { Blocks, Check, Clock, FileSpreadsheet } from 'lucide-react'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN_T = 'var(--nx-cyan-text)'

type Status = 'available' | 'planned'
interface Connector { name: string; category: string; desc: string; status: Status; glyph: string }

// Statuts honnetes : seul le connecteur CSV est operationnel aujourd'hui ;
// les autres sont la roadmap d'ingestion declaree.
const CONNECTORS: Connector[] = [
  { name: 'CSV / Excel Upload', category: 'Files', desc: 'Map any spreadsheet of assets or dependencies into the ontology.', status: 'available', glyph: 'CSV' },
  { name: 'ServiceNow CMDB', category: 'ITSM', desc: 'Sync configuration items and relationships from the CMDB.', status: 'planned', glyph: 'SN' },
  { name: 'AWS Config', category: 'Cloud', desc: 'Discover cloud resources and their dependencies automatically.', status: 'planned', glyph: 'AWS' },
  { name: 'Azure Resource Graph', category: 'Cloud', desc: 'Ingest Azure resources, regions and service links.', status: 'planned', glyph: 'AZ' },
  { name: 'Datadog', category: 'Observability', desc: 'Infer service dependencies from live telemetry and traces.', status: 'planned', glyph: 'DD' },
  { name: 'Kubernetes', category: 'Platform', desc: 'Map workloads, services and namespaces as graph entities.', status: 'planned', glyph: 'K8s' },
  { name: 'Active Directory', category: 'Identity', desc: 'Import people, roles and authentication dependencies.', status: 'planned', glyph: 'AD' },
  { name: 'Jira / Confluence', category: 'Knowledge', desc: 'Extract human dependencies and undocumented processes.', status: 'planned', glyph: 'JR' },
]

export function IntegrationMarketplace() {
  const navigate = useNavigate()
  const available = CONNECTORS.filter((c) => c.status === 'available').length

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-2" style={{ fontFamily: geist, fontSize: 24, color: 'var(--nx-text)' }}>
          <Blocks size={22} style={{ color: 'var(--nx-cyan)' }} /> Integration Marketplace
        </h2>
        <p className="mt-1" style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>Feed NEXUS from the systems you already run. <span style={{ color: CYAN_T }}>{available} connector live</span> · more on the ingestion roadmap.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {CONNECTORS.map((c) => {
          const live = c.status === 'available'
          return (
            <div key={c.name} className="flex flex-col gap-3 rounded-sm border p-4" style={{ background: 'var(--nx-surface-container)', borderColor: live ? 'rgba(0,229,255,0.35)' : 'var(--nx-border)' }}>
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-sm" style={{ background: 'var(--nx-panel)', border: '1px solid var(--nx-border)', fontFamily: mono, fontSize: 11, color: live ? CYAN_T : 'var(--nx-text-muted)' }}>{c.glyph}</div>
                <span className="flex items-center gap-1 rounded px-2 py-0.5" style={{ fontFamily: mono, fontSize: 9, textTransform: 'uppercase', color: live ? '#4ade80' : 'var(--nx-text-muted)', background: live ? 'rgba(74,222,128,0.12)' : 'var(--nx-surface)', border: `1px solid ${live ? '#4ade8040' : 'var(--nx-border)'}` }}>
                  {live ? <Check size={10} /> : <Clock size={10} />} {live ? 'Live' : 'Planned'}
                </span>
              </div>
              <div>
                <h3 style={{ fontFamily: geist, fontSize: 15, color: 'var(--nx-text)' }}>{c.name}</h3>
                <div style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{c.category}</div>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--nx-text-muted)', lineHeight: 1.5, flex: 1 }}>{c.desc}</p>
              <button
                onClick={() => live && navigate('/onboarding')}
                disabled={!live}
                className="flex items-center justify-center gap-2 rounded-sm py-2"
                style={{ background: live ? 'rgba(0,229,255,0.10)' : 'transparent', border: `1px solid ${live ? 'rgba(0,229,255,0.30)' : 'var(--nx-border)'}`, color: live ? CYAN_T : 'var(--nx-text-muted)', fontFamily: mono, fontSize: 11, textTransform: 'uppercase', cursor: live ? 'pointer' : 'not-allowed' }}
              >
                {live ? <><FileSpreadsheet size={13} /> Connect</> : 'Notify me'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
