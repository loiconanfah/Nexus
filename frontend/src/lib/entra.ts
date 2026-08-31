// SSO Entra ID (OpenID Connect) via MSAL — activé dynamiquement selon la config
// serveur (/api/v1/auth/config). Aucun secret ici : clientId/tenantId sont des
// identifiants PUBLICS d'application. Le jeton Microsoft obtenu est échangé côté
// backend contre un jeton NEXUS (voir lib/auth.loginWithEntra).

import { PublicClientApplication } from '@azure/msal-browser'

export interface AuthConfig {
  registrationEnabled: boolean
  entraEnabled: boolean
  entraClientId: string | null
  entraTenantId: string | null
  entraAuthority: string | null
}

let cfgPromise: Promise<AuthConfig> | null = null
let msalInstance: PublicClientApplication | null = null

/** Récupère (et met en cache) la configuration d'authentification publique. */
export function getAuthConfig(): Promise<AuthConfig> {
  if (!cfgPromise) {
    cfgPromise = fetch('/api/v1/auth/config')
      .then((r) => (r.ok ? (r.json() as Promise<AuthConfig>) : Promise.reject()))
      .catch(() => ({ registrationEnabled: false, entraEnabled: false, entraClientId: null, entraTenantId: null, entraAuthority: null }))
  }
  return cfgPromise
}

async function getMsal(cfg: AuthConfig): Promise<PublicClientApplication> {
  if (msalInstance) return msalInstance
  const instance = new PublicClientApplication({
    auth: {
      clientId: cfg.entraClientId!,
      authority: cfg.entraAuthority!,
      redirectUri: window.location.origin,
    },
    cache: { cacheLocation: 'sessionStorage' },
  })
  await instance.initialize()
  msalInstance = instance
  return instance
}

/**
 * Ouvre la fenêtre de connexion Microsoft et retourne le jeton d'identité (idToken)
 * à échanger côté backend. Lève une erreur si le SSO n'est pas configuré.
 */
export async function signInWithMicrosoft(): Promise<string> {
  const cfg = await getAuthConfig()
  if (!cfg.entraEnabled) throw new Error('entra_disabled')
  const msal = await getMsal(cfg)
  const result = await msal.loginPopup({ scopes: ['openid', 'profile', 'email'] })
  if (!result.idToken) throw new Error('no_id_token')
  return result.idToken
}
