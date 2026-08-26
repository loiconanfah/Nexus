import { getTenantId } from './tenant'
import type {
  EntityRisk,
  GraphEntityRecord,
  ImportResult,
  Overview,
  PropagationResult,
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
