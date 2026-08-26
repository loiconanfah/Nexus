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

export interface Overview {
  organizationHealthScore: number
  entityCount: number
  relationCount: number
  entitiesByType: Record<string, number>
  spofCount: number
  criticalSpofCount: number
  topSpofs: SpofSummary[]
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
