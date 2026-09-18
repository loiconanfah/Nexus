// Types miroir des DTO de l'API Lenexux.

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
  costPerHour?: number | null
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
  /** Solidité des preuves soutenant la cascade (Evidence Engine). */
  evidence?: CascadeEvidence | null
  evidenceSummary?: string | null
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
export interface AuditLowConf { id: string; source: string; target: string; type: string; confidence: number; status: string; sourceSystem: string; evidence: string; evidenceCount: number }
export interface AuditLedgerRow { id: string; source: string; target: string; type: string; confidence: number; status: string; sourceSystem: string; evidenceCount: number }

// ── Evidence Engine ──
/** Origine d'une preuve, telle que sérialisée par l'API. */
export type EvidenceSourceName =
  | 'HumanValidation' | 'Observation' | 'RestApi' | 'DeterministicInference'
  | 'Import' | 'Declared' | 'Document' | 'AiInference'

export interface ConfidenceContribution {
  source: EvidenceSourceName
  observation: string
  collectedAt: string
  weight: number
  freshness: number
  effective: number
  scoreAfter: number
}
export interface ConfidenceExplain {
  id: string
  type: string
  storedConfidence: number
  confidence: number
  status: string
  contributions: ConfidenceContribution[]
}
export interface VerifyResult {
  confidence: number
  status: string
  contributions: ConfidenceContribution[]
}

// ── Comptes de l'espace de travail ──
export type WorkspaceRole = 'admin' | 'member'
export interface WorkspaceUser {
  email: string
  role: WorkspaceRole
  createdAt: string
  isSelf: boolean
}
export interface WorkspaceUsers {
  users: WorkspaceUser[]
  /** Vrai si l'utilisateur courant peut gérer les comptes (rôle admin). */
  canManage: boolean
}

// ── Collector (sonde installée chez le client) ──
export interface Collector {
  id: string
  name: string
  version: string | null
  createdAt: string
  lastSeenAt: string | null
  online: boolean
}
export interface CollectorCreated {
  id: string
  name: string
  /** Clé en clair — affichée une seule fois, non récupérable ensuite. */
  key: string
  hint: string
}
export interface CollectorJob {
  id: string
  collectorId: string
  kind: string
  status: 'pending' | 'running' | 'done' | 'failed'
  createdAt: string
  completedAt: string | null
  error: string | null
  entitiesCreated: number
  relationsCreated: number
  scheduledFor: string
  intervalMinutes: number | null
  url: string | null
}

export type EvidenceQuality = 'Solid' | 'Moderate' | 'Fragile'
export interface WeakLink {
  id: string; source: string; target: string; type: string
  confidence: number; status: string; topEvidence: string | null
}
export interface CascadeEvidence {
  relationsTotal: number
  verified: number
  solid: number
  weak: number
  unvalidated: number
  averageConfidence: number
  weakestConfidence: number
  quality: EvidenceQuality
  weakestLinks: WeakLink[]
}
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
    divisions: number; locations: number; suppliers: number; projects: number
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
  /** Solidité des preuves sur lesquelles repose ce chiffrage. */
  evidence?: CascadeEvidence | null
  /** Phrase prête à afficher résumant la qualité des preuves. */
  evidenceSummary?: string | null
}

export interface ProposedRelation {
  source: string; sourceType: string; target: string; targetType: string
  relationType: string; confidence: number; rationale: string
}
export interface InferenceResult {
  usedAi: boolean; message: string
  entitiesScanned?: number; existingRelations?: number
  proposals: ProposedRelation[]
}

export interface RestSource {
  url: string; authHeaderName?: string; authHeaderValue?: string; recordsPath?: string; dataset?: string
}
export interface RestPreview { ok: boolean; dataset: string; columns: string[]; estimatedRows?: number }

export interface SimExplain { usedAi: boolean; narrative: string; risks: string[]; mitigations: string[] }
export interface SimExplainPayload {
  originName: string; originType: string; action: string; actionLabel: string
  direct: number; indirect: number; spared: number
  worstCase: number; expected: number; currency: string
  byType: Record<string, number>; topElements: { name: string; type: string; direct: boolean; criticality: number }[]
  lang: string
}

export interface AttackChainStep { name: string; type: string; via: string | null }
export interface AttackExplainPayload {
  entryName: string; entryType: string; scenario: string
  compromised: number; servicesExposed: number; dataExposed: number
  worstCase: number; expected: number; currency: string
  byType: Record<string, number>; chain: AttackChainStep[]; lang: string
}
export interface AttackExplain { usedAi: boolean; narrative: string; risks: string[]; countermeasures: string[] }

export interface BusinessDriversDto {
  units: number; avgPrice: number; cogsPercent: number; headcount: number; avgSalary: number
  billableRatio: number; marketing: number; rnd: number; ga: number; depreciation: number
  taxRate: number; interest: number; cashOnHand: number; churnRate: number
  divisions: number; locations: number; suppliers: number; projects: number
}
export interface ModelVersion {
  id: string; version: number; companyName: string; industry: string
  drivers: BusinessDriversDto; note: string | null; createdAt: string
}

export interface ImpactTuning {
  costVeryHigh: number; costHigh: number; costElevated: number; costSignificant: number
  costModerate: number; costLow: number; costMinimal: number
  rtoMultiplier: number; probabilityDecay: number; probabilityFloor: number
}
export interface ImpactConfig {
  tuning: ImpactTuning; customized: boolean; defaults: ImpactTuning
}

// --- Organisation, mise en place et notifications ---------------------------

export interface OrganizationProfile {
  name: string
  sector: string
  country: string
  currency: string
  sizeBand: string
  annualRevenue: number
  headcount: number
  operatingMode: 'business' | '24x7'
  completedAt: string | null
  updatedAt: string
  completed: boolean
}

export interface CalibrationPreview {
  hourlyRevenue: number
  operatingHours: number
  costVeryHigh: number
  costModerate: number
  costMinimal: number
}

export interface OrganizationState {
  profile: OrganizationProfile | null
  requiresOnboarding: boolean
  waitingForAdmin: boolean
  canEdit: boolean
  currency: string
  currencies: { code: string; name: string; symbol: string; decimals: number }[]
  sectors: string[]
  sizeBands: string[]
  calibration: CalibrationPreview | null
}

export interface OrganizationInput {
  name: string
  sector: string
  country: string
  currency: string
  sizeBand: string
  annualRevenue: number
  headcount: number
  operatingMode: 'business' | '24x7'
  recalibrate?: boolean
}

export interface SetupStep {
  key: string
  required: boolean
  done: boolean
  current: number
  target: number
  route: string
}

export interface SetupProgress {
  percent: number
  requiredDone: boolean
  doneCount: number
  total: number
  steps: SetupStep[]
  next: string | null
}

export interface Notice {
  id: string
  kind: 'task' | 'operation' | 'alert'
  severity: 'danger' | 'warning' | 'info' | 'success'
  code: string
  data: Record<string, unknown>
  route: string | null
  at: string | null
}
