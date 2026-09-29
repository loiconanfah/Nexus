import { useSyncExternalStore } from 'react'

/*
  Thème du site vitrine, SÉPARÉ de celui de l'application.

  Le sombre reste la tenue par défaut : c'est l'identité de la marque et le
  registre dans lequel les captures ont été faites. Mais un site sombre se lit
  mal sur un écran de bureau en plein jour, et se photocopie encore plus mal
  quand on fait circuler une page dans un comité. Le choix appartient donc au
  visiteur, et il est retenu d'une visite à l'autre.
*/
export type SiteTheme = 'dark' | 'light'
const SITE_THEME_KEY = 'nexus.site-theme'

function readSiteTheme(): SiteTheme {
  try { return localStorage.getItem(SITE_THEME_KEY) === 'light' ? 'light' : 'dark' } catch { return 'dark' }
}

let siteTheme: SiteTheme = readSiteTheme()
const siteThemeListeners = new Set<() => void>()

export function setSiteTheme(next: SiteTheme) {
  siteTheme = next
  try { localStorage.setItem(SITE_THEME_KEY, next) } catch { /* navigation privée */ }
  siteThemeListeners.forEach((notify) => notify())
}

export function useSiteTheme(): SiteTheme {
  return useSyncExternalStore(
    (listener) => { siteThemeListeners.add(listener); return () => { siteThemeListeners.delete(listener) } },
    () => siteTheme,
    () => 'dark' as SiteTheme)
}
