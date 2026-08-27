// Types miroir des DTO de l'API NEXUS.

export type RiskBand = 'Low' | 'Moderate' | 'Elevated' | 'High' | 'Critical'

export interface GraphEntityRecord {
  id: string
  tenantId: string
  entityType: string
  name: string
  criticality: number
  aliases: string[]
  description: string | null
  sourceSystem: string | null
}

export interface SpofSummary {
  id: string
  name: string
  entityType: string
  score: number
  directDependents: number
  blastRadius: number
  criticality: number
}

export interface PriorityItem {
  severity: 'SEV_CRIT' | 'SEV_HIGH' | 'SEV_WARN'
  confidence: number
  text: string
}

export interface Overview {
  organizationHealthScore: number
  entityCount: number
  relationCount: number
  criticalRiskCount: number
  highRiskCount: number
  criticalAssetCount: number
  unknownDependencyCount: number
  spofCount: number
  criticalSpofCount: number
  supplierConcentrationPercent: number
  topSpofs: SpofSummary[]
  priorityIntelligence: PriorityItem[]
}

export interface RiskFactor {
  factor: string
  value: number
  weight: number
  points: number
}

export interface RiskAssessment {
  score: number
  band: RiskBand
  breakdown: RiskFactor[]
}

export interface EntityRisk {
  entity: GraphEntityRecord
  assessment: RiskAssessment
  effectiveCriticality: number
  directDependents: number
  blastRadius: number
  hasRedundancy: boolean
}

export interface BlastNode {
  entity: GraphEntityRecord
  depth: number
}

export type ScenarioType =
  | 'ServerFailure' | 'DatabaseFailure' | 'ApplicationFailure' | 'NetworkFailure'
  | 'SupplierFailure' | 'EmployeeLoss' | 'LocationFailure' | 'CloudRegionFailure'
  | 'CyberIncident' | 'DataLoss' | 'PowerOutage' | 'CommunicationFailure'

export interface PropagationResult {
  assetId: string
  scenario: ScenarioType
  maxDepth: number
  affectedTotal: number
  affectedByType: Record<string, number>
  estimatedOperationalImpact: number
  affected: BlastNode[]
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  type: string
  confidence: number
  status: string
  sourceSystem?: string | null
  evidence?: string | null
}

export interface GraphData {
  nodes: GraphEntityRecord[]
  edges: GraphEdge[]
}

export interface RiskRow {
  id: string
  name: string
  entityType: string
  score: number
  band: RiskBand
  effectiveCriticality: number
  directDependents: number
  blastRadius: number
  hasRedundancy: boolean
}

export interface ReportRiskItem {
  name: string
  entityType: string
  score: number
  band: string
  dependents: number
  blastRadius: number
  hasRedundancy: boolean
}
export interface ReportSupplier { name: string; dependentSystems: number; dependents: string[] }
export interface ReportHumanDependency { person: string; knownSystems: string[] }
export interface ReportUndocumented { source: string; target: string; type: string; confidence: number; status: string }
export interface ReportRecommendation { priority: string; title: string; detail: string }

export interface ExecutiveReport {
  generatedAt: string
  organizationHealthScore: number
  entityCount: number
  relationCount: number
  spofCount: number
  criticalSpofCount: number
  supplierConcentrationPercent: number
  topRisks: ReportRiskItem[]
  singlePointsOfFailure: ReportRiskItem[]
  supplierConcentration: ReportSupplier[]
  humanDependencies: ReportHumanDependency[]
  undocumentedDependencies: ReportUndocumented[]
  recommendations: ReportRecommendation[]
}

export interface Supplier {
  id: string
  name: string
  riskScore: number
  riskBand: string
  criticalServices: number
  dependencies: number
  connectedAssets: number
  concentrationPercent: number
  dependents: string[]
  alternatives: number
}
export interface SupplierEdge { supplier: string; asset: string; assetCritical: boolean }
export interface SupplierIntel {
  summary: { criticalSuppliers: number; singleDependencies: number; concentrationPercent: number; contractsExpiring: number }
  suppliers: Supplier[]
  edges: SupplierEdge[]
}

export interface Incident {
  id: string
  title: string
  category: string
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE'
  probability: number
  blastRadius: number
  affected: number
  entityType: string
  trigger: string
  recommendation: string
}
export interface IncidentBoard {
  summary: { total: number; critical: number; high: number; topBlastRadius: number; healthScore: number }
  incidents: Incident[]
}

export interface AuditStatusRow { status: string; count: number; avgConfidence: number }
export interface AuditLowConf { source: string; target: string; type: string; confidence: number; status: string; sourceSystem: string; evidence: string }
export interface AuditLedgerRow { source: string; target: string; type: string; confidence: number; status: string; sourceSystem: string }
export interface AuditData {
  summary: { totalDependencies: number; verified: number; verifiedPercent: number; undocumented: number; avgConfidence: number }
  byStatus: AuditStatusRow[]
  lowConfidence: AuditLowConf[]
  ledger: AuditLedgerRow[]
}

export interface HumanPerson {
  id: string
  name: string
  role: string
  knownSystems: string[]
  criticalSystems: number
  soleKnowledgeSystems: number
  backupExperts: number
  riskLevel: 'CRITICAL' | 'HIGH' | 'MODERATE'
  documentationPercent: number
}
export interface HumanEdge { person: string; system: string; systemCritical: boolean; relation: string }
export interface HumanDependencies {
  summary: { criticalKnowledgeAreas: number; singleKnowledgeOwners: number; undocumentedProcesses: number; keyDependencyEmployees: number }
  people: HumanPerson[]
  edges: HumanEdge[]
}

export interface AiEvidence {
  label: string
  detail: string
  confidence: number | null
}

export interface AiSource {
  type: string
  reference: string
}

export interface AiAnswer {
  question: string
  intent: string
  answer: string
  confidence: number
  evidence: AiEvidence[]
  sources: AiSource[]
  affectedAssets: string[]
  recommendedAction: string | null
  llmNaturalized: boolean
}

export interface ImportResult {
  recordsRead: number
  entitiesCreated: number
  entitiesMatched: number
  relationsCreated: number
  relationsUnresolved: number
  skipped: number
  duration: string
  timeToFirstGraph: string | null
}
