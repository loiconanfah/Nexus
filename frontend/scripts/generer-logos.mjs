/**
 * Génère src/lib/vendor-logos.ts à partir de simple-icons.
 *
 * Pourquoi générer plutôt qu'importer le paquet : simple-icons pèse 3 400 icônes,
 * dont quinze nous servent. Le fichier produit ne contient que celles-là, donc
 * rien à charger à l'exécution, aucun appel réseau, et l'application reste
 * utilisable hors ligne.
 *
 * Quatre marques ont demandé leur retrait de simple-icons (Microsoft, Amazon,
 * ServiceNow, Freshworks). Elles reçoivent un monogramme dans leur couleur : ce
 * n'est pas un oubli, c'est le respect de ce retrait.
 *
 *     node scripts/generer-logos.mjs
 */
import { writeFileSync } from 'node:fs'
import * as si from 'simple-icons'

/** Connecteur -> icône simple-icons (slug) ou monogramme de repli. */
const VENDORS = {
  entra: { fallback: 'MS', hex: '0078D4' },
  okta: { slug: 'okta' },
  'google-workspace': { slug: 'google' },
  azure: { fallback: 'AZ', hex: '0078D4' },
  aws: { fallback: 'AWS', hex: 'FF9900' },
  gcp: { slug: 'googlecloud' },
  servicenow: { fallback: 'SN', hex: '293E40' },
  freshservice: { fallback: 'FS', hex: '2C9E4B' },
  datadog: { slug: 'datadog' },
  dynatrace: { slug: 'dynatrace' },
  kubernetes: { slug: 'kubernetes' },
  atlassian: { slug: 'atlassian' },
  github: { slug: 'github' },
  gitlab: { slug: 'gitlab' },
  backstage: { slug: 'backstage' },
}

const entries = []
for (const [id, spec] of Object.entries(VENDORS)) {
  if (spec.slug) {
    const key = 'si' + spec.slug.charAt(0).toUpperCase() + spec.slug.slice(1)
    const icon = si[key]
    if (!icon) throw new Error(`Icône introuvable dans simple-icons : ${spec.slug}`)
    entries.push(`  '${id}': { hex: '#${icon.hex}', title: ${JSON.stringify(icon.title)}, path: ${JSON.stringify(icon.path)} },`)
  } else {
    entries.push(`  '${id}': { hex: '#${spec.hex}', title: '', initials: '${spec.fallback}' },`)
  }
}

const file = `// Généré par scripts/generer-logos.mjs. Ne pas modifier à la main.
//
// Les marques appartiennent à leurs propriétaires ; elles ne sont utilisées ici
// que pour DÉSIGNER le système auquel Lenexux se branche. Quatre d'entre elles
// ont demandé leur retrait de simple-icons et reçoivent un monogramme.

export interface VendorLogo {
  /** Couleur officielle de la marque, pour le fond du carré. */
  hex: string
  title: string
  /** Tracé SVG (viewBox 24x24), absent pour un monogramme. */
  path?: string
  /** Monogramme de repli, quand la marque n'offre pas de tracé libre. */
  initials?: string
}

export const VENDOR_LOGOS: Record<string, VendorLogo> = {
${entries.join('\n')}
}
`

writeFileSync(new URL('../src/lib/vendor-logos.ts', import.meta.url), file)
console.log(`${entries.length} logos générés.`)
