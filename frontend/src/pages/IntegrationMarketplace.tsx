import { useNavigate } from 'react-router-dom'
import { Blocks, Check, Clock, FileSpreadsheet } from 'lucide-react'
import { useLang } from '../lib/i18n'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN_T = 'var(--nx-cyan-text)'

type Status = 'available' | 'planned'
interface Connector { name: string; category: string; descFr: string; descEn: string; status: Status; glyph: string }

// Statuts honnetes : seul le connecteur CSV est operationnel aujourd'hui ;
// les autres sont la roadmap d'ingestion declaree.
const CONNECTORS: Connector[] = [
  { name: 'CSV / Excel', category: 'Fichiers', descFr: 'Cartographiez n’importe quel tableur d’actifs ou de dépendances dans l’ontologie.', descEn: 'Map any spreadsheet of assets or dependencies into the ontology.', status: 'available', glyph: 'CSV' },
  { name: 'ServiceNow CMDB', category: 'ITSM', descFr: 'Synchronisez les éléments de configuration et leurs relations depuis la CMDB.', descEn: 'Sync configuration items and relationships from the CMDB.', status: 'planned', glyph: 'SN' },
  { name: 'AWS Config', category: 'Cloud', descFr: 'Découvrez automatiquement les ressources cloud et leurs dépendances.', descEn: 'Discover cloud resources and their dependencies automatically.', status: 'planned', glyph: 'AWS' },
  { name: 'Azure Resource Graph', category: 'Cloud', descFr: 'Ingérez les ressources Azure, régions et liens de service.', descEn: 'Ingest Azure resources, regions and service links.', status: 'planned', glyph: 'AZ' },
  { name: 'Datadog', category: 'Observabilité', descFr: 'Inférez les dépendances de service à partir de la télémétrie et des traces.', descEn: 'Infer service dependencies from live telemetry and traces.', status: 'planned', glyph: 'DD' },
  { name: 'Kubernetes', category: 'Plateforme', descFr: 'Cartographiez charges, services et namespaces comme entités du graphe.', descEn: 'Map workloads, services and namespaces as graph entities.', status: 'planned', glyph: 'K8s' },
  { name: 'Active Directory', category: 'Identité', descFr: 'Importez personnes, rôles et dépendances d’authentification.', descEn: 'Import people, roles and authentication dependencies.', status: 'planned', glyph: 'AD' },
  { name: 'Jira / Confluence', category: 'Connaissance', descFr: 'Extrayez les dépendances humaines et les processus non documentés.', descEn: 'Extract human dependencies and undocumented processes.', status: 'planned', glyph: 'JR' },
]

export function IntegrationMarketplace() {
  const navigate = useNavigate()
  const { t } = useLang()
  const available = CONNECTORS.filter((c) => c.status === 'available').length

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-2" style={{ fontFamily: geist, fontSize: 24, color: 'var(--nx-text)' }}>
          <Blocks size={22} style={{ color: 'var(--nx-cyan)' }} /> {t('Place de marché des connecteurs', 'Integration Marketplace')}
        </h2>
        <p className="mt-1" style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>{t('Alimentez NEXUS depuis les systèmes que vous exploitez déjà.', 'Feed NEXUS from the systems you already run.')} <span style={{ color: CYAN_T }}>{available} {t('connecteur actif', 'connector live')}</span> · {t('d’autres sur la feuille de route.', 'more on the ingestion roadmap.')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {CONNECTORS.map((c) => {
          const live = c.status === 'available'
          return (
            <div key={c.name} className="flex flex-col gap-3 rounded-sm border p-4" style={{ background: 'var(--nx-surface-container)', borderColor: live ? 'rgba(0,229,255,0.35)' : 'var(--nx-border)' }}>
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-sm" style={{ background: 'var(--nx-panel)', border: '1px solid var(--nx-border)', fontFamily: mono, fontSize: 11, color: live ? CYAN_T : 'var(--nx-text-muted)' }}>{c.glyph}</div>
                <span className="flex items-center gap-1 rounded px-2 py-0.5" style={{ fontFamily: mono, fontSize: 9, textTransform: 'uppercase', color: live ? '#4ade80' : 'var(--nx-text-muted)', background: live ? 'rgba(74,222,128,0.12)' : 'var(--nx-surface)', border: `1px solid ${live ? '#4ade8040' : 'var(--nx-border)'}` }}>
                  {live ? <Check size={10} /> : <Clock size={10} />} {live ? t('Actif', 'Live') : t('Prévu', 'Planned')}
                </span>
              </div>
              <div>
                <h3 style={{ fontFamily: geist, fontSize: 15, color: 'var(--nx-text)' }}>{c.name}</h3>
                <div style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{c.category}</div>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--nx-text-muted)', lineHeight: 1.5, flex: 1 }}>{t(c.descFr, c.descEn)}</p>
              <button
                onClick={() => live && navigate('/onboarding')}
                disabled={!live}
                className="flex items-center justify-center gap-2 rounded-sm py-2"
                style={{ background: live ? 'rgba(0,229,255,0.10)' : 'transparent', border: `1px solid ${live ? 'rgba(0,229,255,0.30)' : 'var(--nx-border)'}`, color: live ? CYAN_T : 'var(--nx-text-muted)', fontFamily: mono, fontSize: 11, textTransform: 'uppercase', cursor: live ? 'pointer' : 'not-allowed' }}
              >
                {live ? <><FileSpreadsheet size={13} /> {t('Connecter', 'Connect')}</> : t('Me prévenir', 'Notify me')}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
