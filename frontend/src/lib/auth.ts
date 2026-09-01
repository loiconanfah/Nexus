// Authentification réelle (JWT) — article 41 du durcissement.
// Le jeton est émis par le backend (/api/v1/auth/login), stocké localement, et
// envoyé en Bearer sur chaque appel. Le tenant provient du CLAIM du jeton, pas
// d'un en-tête client. Aucune clé/API n'est stockée ici.

const TOKEN_KEY = 'nexus.jwt'
const CGI_DEMO_TENANT = 'c6100000-cf1c-4000-8000-000000000001'

export interface Session {
  email: string
  role: string
  tenantId: string
}

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function decode(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

export function getToken(): string | null {
  const token = readToken()
  if (!token) return null
  // Rejette un jeton expiré (nettoyage local ; le backend valide de toute façon).
  const claims = decode(token)
  const exp = claims && typeof claims.exp === 'number' ? (claims.exp as number) : 0
  if (exp && exp * 1000 < Date.now()) {
    logout()
    return null
  }
  return token
}

export function isAuthed(): boolean {
  return getToken() !== null
}

export function getSession(): Session | null {
  const token = getToken()
  if (!token) return null
  const c = decode(token)
  if (!c) return null
  return {
    email: String(c.email ?? ''),
    role: String(c.role ?? 'user'),
    tenantId: String(c.tenant ?? ''),
  }
}

/** Tenant issu du jeton (repli sur le tenant de démo CGI si non authentifié). */
export function tenantFromToken(): string {
  return getSession()?.tenantId || CGI_DEMO_TENANT
}

export async function login(email: string, password: string): Promise<Session> {
  const res = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    if (res.status === 401) throw new Error('invalid_credentials')
    throw new Error(`login_failed_${res.status}`)
  }
  const data = (await res.json()) as { token: string; email: string; role: string; tenantId: string }
  try {
    localStorage.setItem(TOKEN_KEY, data.token)
  } catch {
    /* ignore */
  }
  return { email: data.email, role: data.role, tenantId: data.tenantId }
}

/** Échange un jeton d'identité Microsoft (MSAL) contre un jeton Lenexus. */
export async function loginWithEntra(msToken: string): Promise<Session> {
  const res = await fetch('/api/v1/auth/entra', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: msToken }),
  })
  if (!res.ok) {
    if (res.status === 401) throw new Error('invalid_entra_token')
    if (res.status === 404) throw new Error('entra_disabled')
    throw new Error(`entra_login_failed_${res.status}`)
  }
  const data = (await res.json()) as { token: string; email: string; role: string; tenantId: string }
  try {
    localStorage.setItem(TOKEN_KEY, data.token)
  } catch {
    /* ignore */
  }
  return { email: data.email, role: data.role, tenantId: data.tenantId }
}

/** Inscription libre : crée un compte + un espace de travail vierge, puis connecte. */
export async function register(email: string, password: string): Promise<Session> {
  const res = await fetch('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    let code = `register_failed_${res.status}`
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) code = body.error
    } catch {
      /* ignore */
    }
    throw new Error(code)
  }
  const data = (await res.json()) as { token: string; email: string; role: string; tenantId: string }
  try {
    localStorage.setItem(TOKEN_KEY, data.token)
  } catch {
    /* ignore */
  }
  return { email: data.email, role: data.role, tenantId: data.tenantId }
}

export function logout(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem('nexus.authed')
  } catch {
    /* ignore */
  }
}

/** Redirige vers la connexion sur 401 (jeton absent/expiré/refusé). */
export function handleUnauthorized(): void {
  logout()
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.assign('/login')
  }
}
