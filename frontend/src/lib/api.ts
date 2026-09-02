import { getTenantId } from './tenant'
import { getToken, handleUnauthorized } from './auth'
import type {
  ActionBoard,
  ActionStatus,
  AiAnswer,
  DecisionResponse,
  EnterpriseModel,
  ImpactAnalysis,
  InferenceResult,
  ProposedRelation,
  RestSource,
  RestPreview,
  ScenarioSummary,
  AuditData,
  EntityRisk,
  ExecutiveReport,
  ExtractedEntity,
  ExtractedRelation,
  GraphData,
  GraphEntityRecord,
  HistoryData,
  HumanDependencies,
  ImportResult,
  IncidentBoard,
  Snapshot,
  Overview,
  PropagationResult,
  RiskRow,
  ScenarioType,
  SimExplain,
  SimExplainPayload,
  SupplierIntel,
} from './types'

const BASE = '/api/v1'

function headers(json = true): HeadersInit {
  // Le tenant provient du jeton côté serveur ; l'en-tête X-Tenant-Id n'est utilisé
  // qu'en repli démo (si AllowHeaderTenant est activé). Le Bearer est la source
  // d'autorité.
  const h: Record<string, string> = { 'X-Tenant-Id': getTenantId() }
  const token = getToken()
  if (token) h['Authorization'] = `Bearer ${token}`
  if (json) h['Content-Type'] = 'application/json'
  return h
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    if (res.status === 401) {
      handleUnauthorized()
      throw new Error('401 — session expirée, veuillez vous reconnecter')
    }
    const text = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}${text ? ` — ${text}` : ''}`)
  }
  return (await res.json()) as T
}

export const api = {
  overview: () => fetch(`${BASE}/overview`, { headers: headers(false) }).then(handle<Overview>),

  enterpriseModel: () => fetch(`${BASE}/enterprise/model`, { headers: headers(false) }).then(handle<EnterpriseModel>),
  saveEnterpriseModel: (body: { companyName: string; industry: string; drivers: Record<string, number> }) =>
    fetch(`${BASE}/enterprise/model`, { method: 'PUT', headers: headers(), body: JSON.stringify(body) }).then(handle<EnterpriseModel>),

  decideEnterprise: (text: string, lang: string) =>
    fetch(`${BASE}/enterprise/decision`, { method: 'POST', headers: headers(), body: JSON.stringify({ text, lang }) }).then(handle<DecisionResponse>),

  analyzeImpact: (question: string, lang: string) =>
    fetch(`${BASE}/impact/analyze`, { method: 'POST', headers: headers(), body: JSON.stringify({ question, lang }) }).then(handle<ImpactAnalysis>),

  restPreview: (source: RestSource) =>
    fetch(`${BASE}/imports/rest/preview`, { method: 'POST', headers: headers(), body: JSON.stringify(source) }).then(handle<RestPreview>),
  restImport: (source: RestSource, profile: unknown) =>
    fetch(`${BASE}/imports/rest`, { method: 'POST', headers: headers(), body: JSON.stringify({ source, profile }) }).then(handle<ImportResult>),

  inferRelations: () =>
    fetch(`${BASE}/inference/relations`, { method: 'POST', headers: headers() }).then(handle<InferenceResult>),
  ingestInferredRelations: (relations: ProposedRelation[]) =>
    fetch(`${BASE}/inference/relations/ingest`, { method: 'POST', headers: headers(), body: JSON.stringify({ relations }) }).then(handle<{ created: number; unresolved: number }>),

  listScenarios: () => fetch(`${BASE}/enterprise/scenarios`, { headers: headers(false) }).then(handle<ScenarioSummary[]>),
  saveScenario: (name: string, payload: string) =>
    fetch(`${BASE}/enterprise/scenarios`, { method: 'POST', headers: headers(), body: JSON.stringify({ name, payload }) }).then(handle<{ id: string }>),
  deleteScenario: (id: string) =>
    fetch(`${BASE}/enterprise/scenarios/${id}`, { method: 'DELETE', headers: headers(false) }).then((r) => { if (!r.ok) throw new Error(String(r.status)) }),

  graph: () => fetch(`${BASE}/graph`, { headers: headers(false) }).then(handle<GraphData>),

  riskEntities: () => fetch(`${BASE}/risks/entities`, { headers: headers(false) }).then(handle<RiskRow[]>),

  executiveReport: () => fetch(`${BASE}/reports/executive`, { headers: headers(false) }).then(handle<ExecutiveReport>),

  humanDependencies: () => fetch(`${BASE}/human-dependencies`, { headers: headers(false) }).then(handle<HumanDependencies>),

  suppliers: () => fetch(`${BASE}/suppliers`, { headers: headers(false) }).then(handle<SupplierIntel>),

  incidents: () => fetch(`${BASE}/incidents`, { headers: headers(false) }).then(handle<IncidentBoard>),

  history: (limit = 90) => fetch(`${BASE}/history?limit=${limit}`, { headers: headers(false) }).then(handle<HistoryData>),

  captureSnapshot: () => fetch(`${BASE}/history/snapshot`, { method: 'POST', headers: headers(false) }).then(handle<Snapshot>),

  audit: () => fetch(`${BASE}/audit`, { headers: headers(false) }).then(handle<AuditData>),

  actions: () => fetch(`${BASE}/actions`, { headers: headers(false) }).then(handle<ActionBoard>),

  createAction: (body: { title: string; detail?: string; priority?: string; kind?: string; targetId?: string | null }) =>
    fetch(`${BASE}/actions`, { method: 'POST', headers: headers(), body: JSON.stringify(body) })
      .then(handle<{ id: string; title: string; priority: string; status: string; kind: string; targetName: string }>),

  updateActionStatus: (id: string, status: ActionStatus) =>
    fetch(`${BASE}/actions/${id}/status`, { method: 'PATCH', headers: headers(), body: JSON.stringify({ status }) })
      .then(handle<{ id: string; status: ActionStatus }>),

  aiConfig: () =>
    fetch(`${BASE}/ai/config`, { headers: headers(false) })
      .then(handle<{ providers: string[]; provider: string; configured: boolean; model: string; endpointHost: string | null }>),

  setAiKey: (body: { provider: string; apiKey: string; endpoint?: string; model?: string }) =>
    fetch(`${BASE}/ai/config`, { method: 'PUT', headers: headers(), body: JSON.stringify(body) })
      .then(handle<{ provider: string; configured: boolean; model: string; endpointHost: string | null }>),

  clearAiKey: () =>
    fetch(`${BASE}/ai/config`, { method: 'DELETE', headers: headers(false) }).then(handle<{ configured: boolean }>),

  testAiKey: () =>
    fetch(`${BASE}/ai/config/test`, { method: 'POST', headers: headers(false) }).then(handle<{ ok: boolean; message: string }>),

  aiModels: () =>
    fetch(`${BASE}/ai/config/models`, { method: 'POST', headers: headers(false) }).then(handle<{ ok: boolean; message: string; models: string[] }>),

  autoPickModel: () =>
    fetch(`${BASE}/ai/config/autopick`, { method: 'POST', headers: headers(false) }).then(handle<{ ok: boolean; model?: string; message?: string }>),

  setAiModel: (model: string) =>
    fetch(`${BASE}/ai/config/model`, { method: 'PATCH', headers: headers(), body: JSON.stringify({ model }) })
      .then(handle<{ provider: string; configured: boolean; model: string; endpointHost: string | null }>),

  health: () =>
    fetch('/health/ready', { headers: headers(false) })
      .then((r) => r.json())
      .then((d) => d as { status: string; dependencies: { postgres: boolean; neo4j: boolean }; utc: string })
      .catch(() => ({ status: 'unreachable', dependencies: { postgres: false, neo4j: false }, utc: new Date().toISOString() })),

  entity: (id: string) =>
    fetch(`${BASE}/entities/${id}`, { headers: headers(false) }).then(handle<GraphEntityRecord>),

  dependencies: (id: string) =>
    fetch(`${BASE}/entities/${id}/dependencies`, { headers: headers(false) }).then(
      handle<{ target: GraphEntityRecord; relationType: string; confidence: number; status: string }[]>,
    ),

  dependents: (id: string) =>
    fetch(`${BASE}/entities/${id}/dependents`, { headers: headers(false) }).then(handle<GraphEntityRecord[]>),

  searchEntity: (name: string, type: string) =>
    fetch(`${BASE}/entities/search?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`, {
      headers: headers(false),
    }).then(handle<{ match: GraphEntityRecord | null }>),

  entityRisk: (id: string) =>
    fetch(`${BASE}/entities/${id}/risk`, { headers: headers(false) }).then(handle<EntityRisk>),

  explainSimulation: (payload: SimExplainPayload) =>
    fetch(`${BASE}/simulations/explain`, { method: 'POST', headers: headers(), body: JSON.stringify(payload) }).then(handle<SimExplain>),

  simulate: (assetId: string, scenario: ScenarioType, maxDepth = 10, durationHours = 8) =>
    fetch(`${BASE}/simulations`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ assetId, scenario, maxDepth, durationHours }),
    }).then(handle<PropagationResult>),

  ask: (question: string) =>
    fetch(`${BASE}/ai/ask`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ question }),
    }).then(handle<AiAnswer>),

  extractDocument: (text: string) =>
    fetch(`${BASE}/documents/extract`, { method: 'POST', headers: headers(), body: JSON.stringify({ text }) })
      .then(handle<{ usedAi: boolean; message: string; entities: ExtractedEntity[]; relations: ExtractedRelation[] }>),

  ingestDocument: (body: { entities: ExtractedEntity[]; relations: ExtractedRelation[] }) =>
    fetch(`${BASE}/documents/ingest`, { method: 'POST', headers: headers(), body: JSON.stringify(body) })
      .then(handle<{ entitiesCreated: number; relationsCreated: number; unresolved: number }>),

  analyzeImport: (sample: string) =>
    fetch(`${BASE}/imports/analyze`, { method: 'POST', headers: headers(), body: JSON.stringify({ sample }) })
      .then(handle<{ usedAi: boolean; message: string; mapping: null | { kind: 'entities' | 'relations'; name: string; type: string; crit: string; source: string; sourceType: string; target: string; targetType: string; relation: string; confidence: string; defaultEntityType: string } }>),

  importCsv: (file: Blob, filename: string, profile: string) => {
    const form = new FormData()
    form.append('file', file, filename)
    form.append('profile', profile)
    // headers(false) = X-Tenant-Id + Authorization Bearer, sans Content-Type
    // (le navigateur pose lui-même la frontière multipart). Sans le Bearer,
    // l'API renvoie 401 en production (tout est protégé par défaut).
    return fetch(`${BASE}/imports/csv`, {
      method: 'POST',
      headers: headers(false),
      body: form,
    }).then(handle<ImportResult>)
  },
}
