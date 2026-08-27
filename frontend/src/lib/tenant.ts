// Gestion du tenant côté client (STUB DE DÉVELOPPEMENT).
// En production, le tenant provient du jeton d'authentification (Entra ID),
// pas d'un stockage navigateur — voir SECURITY.md / Phase 6.

const KEY = 'nexus.tenantId'

// Tenant de démo entreprise CGI Inc. (49 entités / 62 relations, FR).
const DEMO_TENANT = 'c6100000-cf1c-4000-8000-000000000001'
// Anciens tenants de démo à migrer automatiquement vers CGI.
const LEGACY_DEMOS = new Set(['d2aa8808-fb57-4970-a64c-176bd157eae4'])

function uuid(): string {
  return crypto.randomUUID()
}

export function getTenantId(): string {
  // MODE DÉMO : on force le jeu de démo entreprise CGI, quel que soit ce qui
  // se trouve dans le stockage du navigateur (évite tout résidu d'ancien tenant).
  // Pour réactiver le multi-tenant, remplacer ce bloc par la lecture localStorage.
  try {
    localStorage.setItem(KEY, DEMO_TENANT)
  } catch {
    /* ignore */
  }
  void LEGACY_DEMOS
  return DEMO_TENANT
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
