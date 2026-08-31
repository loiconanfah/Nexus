// Gestion du tenant côté client.
// Le tenant fait AUTORITÉ côté serveur via le claim du jeton JWT (article 41).
// Ici, on ne fait que le refléter pour l'en-tête de repli (démo) : la valeur
// réelle appliquée provient toujours du jeton validé côté backend.

import { tenantFromToken } from './auth'

const KEY = 'nexus.tenantId'

// Tenant de démo entreprise CGI Inc. (repli si non authentifié).
const DEMO_TENANT = 'c6100000-cf1c-4000-8000-000000000001'

function uuid(): string {
  return crypto.randomUUID()
}

export function getTenantId(): string {
  // Le tenant provient du jeton (claim). En l'absence de jeton, repli sur la démo CGI.
  const id = tenantFromToken() || DEMO_TENANT
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* ignore */
  }
  return id
}

export function resetTenant(): string {
  const id = uuid()
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* ignore */
  }
  return id
}
