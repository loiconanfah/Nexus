// Authentification réelle (JWT) — article 41 du durcissement.
// Le jeton est émis par le backend (/api/v1/auth/login), stocké localement, et
// envoyé en Bearer sur chaque appel. Le tenant provient du CLAIM du jeton, pas
// d'un en-tête client. Aucune clé/API n'est stockée ici.

const TOKEN_KEY = 'nexus.jwt'
const CGI_DEMO_TENANT = 'c6100000-cf1c-4000-8000-000000000001'

/** Erreur d'authentification : `message` est le code serveur, `data` le reste de la réponse. */
export class AuthError extends Error {
  data: Record<string, unknown>
  constructor(code: string, data: Record<string, unknown> = {}) {
    super(code)
    this.data = data
  }
}

async function failure(res: Response, fallback: string): Promise<AuthError> {
  try {
    const body = (await res.json()) as Record<string, unknown>
    return new AuthError(typeof body.error === 'string' ? body.error : fallback, body)
  } catch {
    return new AuthError(fallback)
  }
}

function store(data: { token: string; email: string; role: string; tenantId: string }): Session {
  try {
    localStorage.setItem(TOKEN_KEY, data.token)
  } catch {
    /* ignore */
  }
  return { email: data.email, role: data.role, tenantId: data.tenantId }
}

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
    if (res.status === 401) throw new AuthError('invalid_credentials')
    // 403 email_not_verified : le serveur a (re)envoyé un code, on passe à la vérification.
    throw await failure(res, `login_failed_${res.status}`)
  }
  return store(await res.json())
}

/** Échange un jeton d'identité Microsoft (MSAL) contre un jeton Lenexux. */
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

export interface SignupInput {
  firstName: string
  lastName: string
  email: string
  jobTitle: string
  phone: string
  organization: string
  sector: string
  country: string
  sizeBand: string
  password: string
  confirmPassword: string
  acceptTerms: boolean
  marketingOptIn: boolean
  lang: 'fr' | 'en'
}

/**
 * Inscription : crée le compte et son espace de travail. Si la vérification du
 * courriel est active, le serveur envoie un code et aucune session n'est ouverte
 * avant sa saisie ; sinon la session est ouverte immédiatement.
 */
export type RegisterResult =
  | { kind: 'session'; session: Session }
  | { kind: 'verify'; email: string; resendAfter: number }

export async function register(input: SignupInput): Promise<RegisterResult> {
  const res = await fetch('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw await failure(res, `register_failed_${res.status}`)
  const data = (await res.json()) as { token?: string; email: string; role?: string; tenantId?: string; resendAfter?: number }
  // Sans vérification du courriel (aucun service d'envoi), la session est ouverte tout de suite.
  if (data.token) return { kind: 'session', session: store(data as { token: string; email: string; role: string; tenantId: string }) }
  return { kind: 'verify', email: data.email, resendAfter: data.resendAfter ?? 60 }
}

/** Confirme l'adresse avec le code reçu ; ouvre la session en cas de succès. */
export async function verifyEmail(email: string, code: string): Promise<Session> {
  const res = await fetch('/api/v1/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  })
  if (!res.ok) throw await failure(res, `verify_failed_${res.status}`)
  return store(await res.json())
}

/** Demande un nouveau code. Retourne le délai (secondes) avant le prochain renvoi possible. */
export async function resendCode(email: string, lang: 'fr' | 'en'): Promise<number> {
  const res = await fetch('/api/v1/auth/resend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, lang }),
  })
  if (!res.ok) throw await failure(res, `resend_failed_${res.status}`)
  const data = (await res.json()) as { resendAfter?: number }
  return data.resendAfter ?? 60
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
