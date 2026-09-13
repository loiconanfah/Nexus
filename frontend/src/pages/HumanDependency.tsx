import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { BookOpen, FileDown, Server, ShieldPlus, User } from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import { personRoleLabel, riskLevelLabel } from '../lib/labels'
import { HubSpoke, PickerList, type Spoke } from '../components/HubSpoke'
import { ActionModal } from '../components/ActionModal'
import { downloadCsv } from '../lib/download'
import type { HumanDependencies, HumanPerson } from '../lib/types'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'
const ERR = '#ffb4ab'

const RISK_COLOR: Record<string, string> = { CRITICAL: '#ffb4ab', HIGH: '#fb923c', MODERATE: '#facc15' }

function exportHuman(data: HumanDependencies) {
  const rows = [['person', 'role', 'risk', 'known_systems', 'sole_knowledge', 'backup_experts', 'doc_percent']]
  data.people.forEach((p) => rows.push([
    p.name, p.role, p.riskLevel, p.knownSystems.join(' | '),
    String(p.soleKnowledgeSystems), String(p.backupExperts), String(p.documentationPercent),
  ]))
  downloadCsv('nexus-human-dependencies.csv', rows)
}

export function HumanDependency() {
  const navigate = useNavigate()
  const { t } = useLang()
  const { data, isLoading, error } = useQuery({ queryKey: ['humanDeps'], queryFn: api.humanDependencies })
  const [selId, setSelId] = useState<string | null>(null)
  const [contingency, setContingency] = useState(false)

  const people = data?.people ?? []
  const selected = people.find((p) => p.id === selId) ?? people[0]

  if (isLoading) return <div style={{ fontFamily: mono, color: 'var(--nx-text-muted)' }}>{t('ANALYSE DE LA CONCENTRATION DE SAVOIR…', 'ANALYZING KNOWLEDGE CONCENTRATION…')}</div>
  if (error) return <div style={{ color: ERR }}>{(error as Error).message}</div>
  if (!data) return null

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 style={{ fontFamily: geist, fontSize: 24, color: 'var(--nx-text)' }}>{t('Dépendance humaine', 'Human Dependency')}</h2>
          <p className="mt-1" style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>{t('Repérez le savoir opérationnel détenu par trop peu de personnes.', 'Identify operational knowledge that exists in too few people.')}</p>
        </div>
        <div className="hidden gap-2 lg:flex">
          <button onClick={() => exportHuman(data)} className="flex items-center gap-2 rounded-sm border px-3 py-1.5" style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text-muted)', fontFamily: mono, fontSize: 12 }}><FileDown size={14} /> {t('Exporter', 'Export Report')}</button>
          <button onClick={() => setContingency(true)} className="flex items-center gap-2 rounded-sm px-3 py-1.5" style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontFamily: mono, fontSize: 12, fontWeight: 600 }}><ShieldPlus size={14} /> {t('Créer une contingence', 'Create Contingency')}</button>
        </div>
        {selected && (
          <ActionModal
            open={contingency}
            onClose={() => setContingency(false)}
            defaultTitle={t(`Documenter et former un backup pour ${selected.name}`, `Document and cross-train a backup for ${selected.name}`)}
            defaultTargetId={selected.id}
            defaultTargetName={selected.name}
            kind="contingency"
          />
        )}
      </div>

      {/* Tuiles */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Tile label={t('DOMAINES DE SAVOIR CRITIQUES', 'CRITICAL KNOWLEDGE AREAS')} value={data.summary.criticalKnowledgeAreas} color={ERR} />
        <Tile label={t('DÉTENTEURS UNIQUES', 'SINGLE-KNOWLEDGE OWNERS')} value={data.summary.singleKnowledgeOwners} color="#fb923c" />
        <Tile label={t('PROCESSUS NON DOCUMENTÉS', 'UNDOCUMENTED PROCESSES')} value={data.summary.undocumentedProcesses} color="#facc15" />
        <Tile label={t('EMPLOYÉS CLÉS', 'KEY DEPENDENCY EMPLOYEES')} value={data.summary.keyDependencyEmployees} color={CYAN_T} />
      </div>

      {/* Graphe + profil */}
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-h-[320px] flex-1 rounded-sm border" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
          {selected && <KnowledgeGraph data={data} person={selected} onPerson={setSelId} onSystem={(name) => navigate(`/simulations?name=${encodeURIComponent(name)}`)} />}
        </div>
        {selected && <Profile person={selected} onSimulate={() => navigate(`/simulations?asset=${selected.knownSystems[0] ?? ''}&name=${encodeURIComponent(selected.knownSystems[0] ?? '')}`)} />}
      </div>

      {/* Directory */}
      <div className="overflow-x-auto rounded-sm border" style={{ borderColor: 'var(--nx-border)' }}>
        <div className="border-b px-4 py-3" style={{ borderColor: 'var(--nx-border)' }}>
          <h3 style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--nx-text)' }}>{t('Répertoire des risques de savoir', 'Knowledge Risk Directory')}</h3>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--nx-border)' }}>
              {[t('Employé', 'Employee'), t('Rôle', 'Role'), t('Savoir critique', 'Critical Knowledge'), t('Secours', 'Backup'), t('Niveau de risque', 'Risk Level'), 'Documentation'].map((h, i) => (
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
                  <td className="px-4 py-3" style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>{personRoleLabel(p.role, t)}</td>
                  <td className="px-4 py-3" style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text)' }}>{p.knownSystems.join(', ')}</td>
                  <td className="px-4 py-3 text-right" style={{ fontFamily: mono, fontSize: 12, color: p.backupExperts === 0 ? ERR : 'var(--nx-text-muted)' }}>{p.backupExperts}</td>
                  <td className="px-4 py-3"><span className="rounded px-2 py-0.5" style={{ fontFamily: mono, fontSize: 11, color: c, background: `color-mix(in srgb, ${c} 18%, transparent)`, border: `1px solid color-mix(in srgb, ${c} 30%, transparent)` }}>{riskLevelLabel(p.riskLevel, t)}</span></td>
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

function KnowledgeGraph({ data, person, onPerson, onSystem }: {
  data: HumanDependencies; person: HumanPerson; onPerson: (id: string) => void; onSystem: (name: string) => void
}) {
  const { t } = useLang()

  // Un savoir est critique quand il porte sur un système lui-même critique :
  // c'est ce croisement qui fait qu'un départ devient un problème d'entreprise.
  const criticalSystems = useMemo(
    () => new Set(data.edges.filter((e) => e.person === person.name && e.systemCritical).map((e) => e.system)),
    [data.edges, person.name],
  )
  const spokes: Spoke[] = useMemo(
    () => person.knownSystems.map((name) => ({ name, critical: criticalSystems.has(name) })),
    [person.knownSystems, criticalSystems],
  )
  const accent = RISK_COLOR[person.riskLevel] ?? CYAN

  return (
    <div className="flex h-full min-h-[320px] w-full flex-col lg:flex-row">
      <PickerList
        title={t('Personnes clés', 'Key people')}
        items={data.people}
        selectedId={person.id}
        onPick={onPerson}
        meta={(p) => p.backupExperts === 0
          ? { text: t('seule', 'sole'), color: ERR }
          : { text: t(`${p.backupExperts} relève`, `${p.backupExperts} backup`), color: 'var(--nx-text-muted)' }}
      />
      <div className="relative min-w-0 flex-1">
        <div className="nx-grid absolute inset-0" />
        <div className="relative flex items-baseline gap-2 px-4 pt-3">
          <span style={{ fontFamily: mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--nx-text-muted)' }}>
            {t('Ce que cette personne est seule à bien connaître', 'What this person alone knows well')}
          </span>
          <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-outline)' }}>{person.knownSystems.length}</span>
        </div>
        <div className="relative px-2 pb-3 pt-1">
          <HubSpoke
            icon="person"
            accent={accent}
            hub={person.name}
            hubNote={person.backupExperts === 0
              ? t('personne pour prendre le relais', 'nobody to take over')
              : t(`${person.backupExperts} personne(s) pour prendre le relais`, `${person.backupExperts} person(s) can take over`)}
            spokes={spokes}
            onSpoke={onSystem}
            emptyLabel={t('Aucun savoir critique rattaché à cette personne pour l’instant.',
                          'No critical knowledge attached to this person yet.')}
          />
        </div>
      </div>
    </div>
  )
}

function Profile({ person, onSimulate }: { person: HumanPerson; onSimulate: () => void }) {
  const { t } = useLang()
  const c = RISK_COLOR[person.riskLevel]
  return (
    <aside className="flex w-full shrink-0 flex-col gap-5 rounded-sm border p-5 lg:w-[320px]" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
      <h3 style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--nx-text-muted)' }}>{t('Profil de dépendance', 'Dependency Profile')}</h3>
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-sm border" style={{ background: 'var(--nx-surface)', borderColor: CYAN }}><User size={22} style={{ color: CYAN }} /></div>
        <div>
          <div style={{ fontFamily: geist, fontSize: 18, color: 'var(--nx-text)' }}>{person.name}</div>
          <div style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>{personRoleLabel(person.role, t)}</div>
        </div>
      </div>
      {person.soleKnowledgeSystems > 0 && <span className="w-fit rounded px-2 py-0.5" style={{ fontFamily: mono, fontSize: 10, color: ERR, background: 'rgba(255,180,171,0.15)', border: '1px solid rgba(255,180,171,0.3)' }}>⚠ {t('SAVOIR DÉTENU PAR UNE SEULE PERSONNE', 'KNOWLEDGE HELD BY ONE PERSON ONLY')}</span>}

      <div>
        <h4 className="mb-2 border-b pb-1" style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: 'var(--nx-text-muted)', borderColor: 'var(--nx-border)' }}>{t('Domaines de savoir clés', 'Core Knowledge Areas')}</h4>
        <div className="flex flex-wrap gap-2">
          {person.knownSystems.map((s) => (
            <span key={s} className="flex items-center gap-1 rounded border px-2 py-0.5" style={{ fontFamily: mono, fontSize: 11, borderColor: 'var(--nx-border)', background: 'var(--nx-surface)', color: 'var(--nx-text)' }}><Server size={11} /> {s}</span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MiniStat label={t('SYSTÈMES CRITIQUES', 'CRITICAL SYSTEMS')} value={person.criticalSystems || person.knownSystems.length} color={c} />
        <MiniStat label={t('EXPERTS DE SECOURS', 'BACKUP EXPERTS')} value={person.backupExperts} color={person.backupExperts === 0 ? ERR : CYAN_T} />
      </div>

      <div>
        <div className="mb-1 flex justify-between" style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}><span>Documentation</span><span>{person.documentationPercent}% {t('couvert', 'Covered')}</span></div>
        <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--nx-surface-highest)' }}><div className="h-full" style={{ width: `${person.documentationPercent}%`, background: person.documentationPercent < 40 ? ERR : CYAN }} /></div>
      </div>

      <button onClick={onSimulate} className="mt-auto flex w-full items-center justify-center gap-2 rounded-sm py-2" style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontSize: 13, fontWeight: 600 }}><BookOpen size={16} /> {t('Simuler la perte de savoir', 'Simulate Knowledge Loss')}</button>
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
