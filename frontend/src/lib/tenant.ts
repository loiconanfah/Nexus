// Gestion du tenant côté client (STUB DE DÉVELOPPEMENT).
// En production, le tenant provient du jeton d'authentification (Entra ID),
// pas d'un stockage navigateur — voir SECURITY.md / Phase 6.

const KEY = 'nexus.tenantId'

function uuid(): string {
  return crypto.randomUUID()
}

export function getTenantId(): string {
  let id: string | null = null
  try {
    id = localStorage.getItem(KEY)
  } catch {
    /* stockage indisponible */
  }
  if (!id) {
    id = uuid()
    try {
      localStorage.setItem(KEY, id)
    } catch {
      /* ignore */
    }
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
