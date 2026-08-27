// Auth côté client (STUB DE DÉVELOPPEMENT en attendant Microsoft Entra ID).
// La page de login est réelle ; l'authentification est simulée localement.

const KEY = 'nexus.authed'

export function isAuthed(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function login(): void {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    /* ignore */
  }
}

export function logout(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
