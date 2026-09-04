import { useEffect } from 'react'

const SITE = 'https://lenexux.com'

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

/**
 * Met à jour le titre, la description et l'URL canonique de la page courante.
 * Sans dépendance (pas de react-helmet) : agit directement sur le <head>, utile
 * pour les moteurs qui exécutent le JavaScript. Le repli <noscript> et les
 * balises statiques de index.html couvrent les robots sans JS.
 *
 * @param path chemin canonique (ex. "/docs"). "/" par défaut.
 */
export function usePageMeta(title: string, description: string, path = '/') {
  useEffect(() => {
    const url = `${SITE}${path === '/' ? '/' : path}`
    document.title = title
    setMeta('name', 'description', description)
    setMeta('property', 'og:title', title)
    setMeta('property', 'og:description', description)
    setMeta('property', 'og:url', url)
    setMeta('name', 'twitter:title', title)
    setMeta('name', 'twitter:description', description)
    setCanonical(url)
  }, [title, description, path])
}
