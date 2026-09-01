// Types miroir des DTO de l'API Lenexus.

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
  code: 'spof' | 'supplier' | 'human' | 'undocumented'
  name: string
  entityType: string
  count: number
  systems: string[]
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
  estimatedFinancialImpactPerHour: number
  worstCaseImpact: number
  expectedImpact: number
  maxRecoveryHours: number
  avgProbability: number
  currency: string
  nodeDetails: NodeImpact[]
}
export interface NodeImpact {
  id: string
  name: string
  type: string
  depth: number
  criticality: number
  hourlyCost: number
  rtoHours: number
  probability: number
  nodeImpact: number
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
  category: 'spof' | 'supplier' | 'human'
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE'
  probability: number
  blastRadius: number
  affected: number
  entityName: string
  entityType: string
  dependents: number
  hasRedundancy: boolean
  systems: string[]
}
export interface IncidentBoard {
  summary: { total: number; critical: number; high: number; topBlastRadius: number; healthScore: number }
  incidents: Incident[]
}

export interface Snapshot {
  id: string
  capturedAt: string
  healthScore: number
  entityCount: number
  relationCount: number
  spofCount: number
  criticalSpofCount: number
  criticalAssetCount: number
  supplierConcentrationPercent: number
  topSpofs: { name: string; score: number }[]
}
export interface HistoryData { count: number; snapshots: Snapshot[] }

export interface ExtractedEntity { name: string; type: string; criticality: number }
export interface ExtractedRelation { source: string; sourceType: string; target: string; targetType: string; relationType: string; confidence: number; evidence?: string }

export type ActionStatus = 'Open' | 'InProgress' | 'Done'
export interface RemediationAction {
  id: string
  title: string
  detail: string
  priority: 'High' | 'Medium' | 'Low'
  status: ActionStatus
  kind: string
  targetId: string | null
  targetName: string
}
export interface ActionBoard {
  summary: { total: number; open: number; inProgress: number; done: number }
  actions: RemediationAction[]
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

// ── Modèle d'entreprise (couche Decision Intelligence) ──
export interface EnterpriseModel {
  configured: boolean
  isDemo: boolean
  currency: string
  company: {
    name: string; industry: string; employees: number; annualRevenue: number
    divisions: number; locations: number; customers: number; suppliers: number; projects: number
  }
  drivers: {
    units: number; avgPrice: number; cogsPercent: number; headcount: number; avgSalary: number
    billableRatio: number; marketing: number; rnD: number; ga: number; depreciation: number
    taxRate: number; interest: number; cashOnHand: number; churnRate: number
  }
  pnl: {
    revenue: number; cogs: number; grossProfit: number; grossMargin: number
    opex: { sgaSalaries: number; marketing: number; rnD: number; ga: number; total: number }
    ebitda: number; ebitdaMargin: number; depreciation: number; ebit: number; tax: number
    interest: number; netProfit: number; netMargin: number
  }
  cash: { operatingCashFlow: number; cashOnHand: number; freeCashFlow: number }
  trend: { month: string; revenue: number; ebitda: number; netProfit: number; cashFlow: number }[]
  divisions: { name: string; revenue: number; profit: number; employees: number; margin: number }[]
  segments: { name: string; revenue: number; customers: number; share: number }[]
  costStructure: { key: string; amount: number; percent: number }[]
  kpis: { key: string; value: number; unit: string; deltaPercent: number }[]
  dataQuality: { finance: number; sales: number; hr: number; operations: number; customers: number }
}

export interface DecisionEffect {
  pricePct: number; volumePct: number; headcountDelta: number; salaryPct: number; marketingPct: number; cogsPts: number
  newService: { name: string; division: string; annualRevenue: number; annualCost: number; headcount: number } | null
  interpretation: string; assumptions: string[]; risks: string[]; confidence: number; aiUsed: boolean
}

export interface ScenarioSummary { id: string; name: string; payload: string; createdAt: string }


export interface DecisionAnalysis {
  headline: string; narrative: string; consequences: string[]; risks: string[]
  recommendation: string; verdict: string; aiUsed: boolean
}
export interface DecisionResponse { effect: DecisionEffect; analysis: DecisionAnalysis }

export interface ResolvedTarget { id: string; name: string; entityType: string; criticality: number; matchScore: number; resolved: boolean }
export interface ImpactCriticalItem { id: string; name: string; type: string; depth: number; criticality: number; nodeImpact: number }
export interface DangerousDependency { id: string; name: string; type: string; directDependents: number }
export interface FuzzyMatch { id: string; name: string; entityType: string; score: number }
export interface ImpactAnalysis {
  target: ResolvedTarget
  scenario: string
  affectedTotal: number
  maxDepth: number
  affectedByType: Record<string, number>
  perHourImpact: number
  worstCaseImpact: number
  expectedImpact: number
  maxRecoveryHours: number
  currency: string
  criticalItems: ImpactCriticalItem[]
  dangerousDependencies: DangerousDependency[]
  mitigations: string[]
  narrative: string
  aiUsed: boolean
  alternatives: FuzzyMatch[]
}
