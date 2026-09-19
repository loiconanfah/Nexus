/* ══════════════════════════════════════════════════════════════════════════════
   RÉSEAUX ET PUBLICATIONS — source unique (pied de page du site, blog).

   Ajouter un réseau : une entrée dans SOCIAL (l'icône LinkedIn est dessinée ;
   les autres s'affichent par leur nom). Penser à ajouter aussi l'adresse dans
   « sameAs » des données structurées d'index.html.
   ══════════════════════════════════════════════════════════════════════════ */
export type Social = { key: 'linkedin' | 'devto' | 'medium' | 'x' | 'youtube' | 'facebook' | 'instagram' | 'github'; label: string; url: string }

export const SOCIAL: Social[] = [
  { key: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/company/lenexux/' },
  { key: 'devto', label: 'DEV', url: 'https://dev.to/yvanlloic' },
  { key: 'medium', label: 'Medium', url: 'https://medium.com/@yayzoy' },
]

/** Article publié sur une autre plateforme, présenté avec sa source et son auteur. */
export type ExternalPost = {
  url: string
  source: 'DEV' | 'Medium' | 'LinkedIn'
  date: string
  title: string
  lang: 'fr' | 'en'
  author: [string, string]
  summary: [string, string]
}

export const EXTERNAL_POSTS: ExternalPost[] = [
  {
    url: 'https://dev.to/yvanlloic/lenexus-wants-to-map-everything-that-could-take-your-business-down-1f68',
    source: 'DEV', date: '2026-09-04', lang: 'en',
    title: 'Lenexux wants to map everything that could take your business down',
    author: ['Yvan Loic Nanfah Wamba, fondateur', 'Yvan Loic Nanfah Wamba, founder'],
    summary: [
      'Un tour de la démo : graphe de dépendances, jumeau numérique, simulation d’attaque et de panne, extraction de dépendances depuis des documents — et le pari d’un moteur déterministe entouré d’une IA interchangeable.',
      'A walk through the demo: dependency graph, digital twin, attack and outage simulation, dependency extraction from documents — and the bet on a deterministic engine wrapped in a swappable AI.',
    ],
  },
  {
    url: 'https://medium.com/@yayzoy/lenexus-wants-to-map-everything-that-could-take-your-business-down-81d0a4ca0361',
    source: 'Medium', date: '2026-09-05', lang: 'en',
    title: 'Lenexux wants to map everything that could take your business down',
    author: ['Yvan Loic Nanfah Wamba, fondateur', 'Yvan Loic Nanfah Wamba, founder'],
    summary: [
      'Le même article, publié sur Medium.',
      'The same article, published on Medium.',
    ],
  },
]
