import { getTenantId } from './tenant'
import type {
  AiAnswer,
  EntityRisk,
  ExecutiveReport,
  GraphData,
  GraphEntityRecord,
  HumanDependencies,
  ImportResult,
  Overview,
  PropagationResult,
  RiskRow,
  ScenarioType,
} from './types'

const BASE = '/api/v1'

function headers(json = true): HeadersInit {
  const h: Record<string, string> = { 'X-Tenant-Id': getTenantId() }
  if (json) h['Content-Type'] = 'application/json'
  return h
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}${text ? ` — ${text}` : ''}`)
  }
  return (await res.json()) as T
}

export const api = {
  overview: () => fetch(`${BASE}/overview`, { headers: headers(false) }).then(handle<Overview>),

  graph: () => fetch(`${BASE}/graph`, { headers: headers(false) }).then(handle<GraphData>),

  riskEntities: () => fetch(`${BASE}/risks/entities`, { headers: headers(false) }).then(handle<RiskRow[]>),

  executiveReport: () => fetch(`${BASE}/reports/executive`, { headers: headers(false) }).then(handle<ExecutiveReport>),

  humanDependencies: () => fetch(`${BASE}/human-dependencies`, { headers: headers(false) }).then(handle<HumanDependencies>),

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

  simulate: (assetId: string, scenario: ScenarioType, maxDepth = 10) =>
    fetch(`${BASE}/simulations`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ assetId, scenario, maxDepth }),
    }).then(handle<PropagationResult>),

  ask: (question: string) =>
    fetch(`${BASE}/ai/ask`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ question }),
    }).then(handle<AiAnswer>),

  importCsv: (file: Blob, filename: string, profile: string) => {
    const form = new FormData()
    form.append('file', file, filename)
    form.append('profile', profile)
    return fetch(`${BASE}/imports/csv`, {
      method: 'POST',
      headers: { 'X-Tenant-Id': getTenantId() },
      body: form,
    }).then(handle<ImportResult>)
  },
}
