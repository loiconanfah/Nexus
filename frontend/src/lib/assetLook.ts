/**
 * L'identité visuelle d'un actif : sa famille, sa marque, son encre.
 *
 * Partagée par le plan 2D et l'hologramme 3D, pour une raison simple : une
 * couleur doit dire la même chose dans les deux vues, sinon l'utilisateur
 * réapprend la carte à chaque changement d'écran.
 */
import { BRAND_MARKS, type BrandMark } from './vendor-logos'

/**
 * La couleur d'une FAMILLE.
 *
 * C'est elle qui porte desormais la bille. Une famille = une teinte, donc une
 * grappe se reconnait de loin et la carte cesse d'etre monochrome. Les valeurs
 * sont plus soutenues en sombre, plus denses en clair, pour rester lisibles
 * dans les deux.
 */
export const FAMILY_COLORS: Record<string, [string, string]> = {
  // [sombre, clair]
  Person: ['#6ea8fe', '#2f6fd0'],
  Role: ['#6ea8fe', '#2f6fd0'],
  Team: ['#8f9bff', '#4a52c9'],
  BusinessUnit: ['#a78bfa', '#6d4bd0'],
  Organization: ['#a78bfa', '#6d4bd0'],
  Location: ['#4ade80', '#1f8a4c'],
  Supplier: ['#f0883e', '#b45f11'],
  Contract: ['#f0a93e', '#9a6a12'],
  Application: ['#22d3ee', '#0d7f94'],
  Service: ['#2dd4bf', '#0f7c70'],
  BusinessService: ['#34d399', '#12795a'],
  System: ['#38bdf8', '#0b6f9e'],
  Server: ['#94a3b8', '#4a5a6b'],
  Infrastructure: ['#94a3b8', '#4a5a6b'],
  CloudResource: ['#7dd3fc', '#1268a0'],
  Network: ['#67e8f9', '#0d7186'],
  Device: ['#cbd5e1', '#5b6776'],
  Database: ['#c084fc', '#7a3fc0'],
  DataStore: ['#c084fc', '#7a3fc0'],
  Dataset: ['#d8b4fe', '#8447c4'],
  Document: ['#fcd34d', '#8a6a12'],
  Process: ['#fbbf24', '#8f6410'],
  BusinessProcess: ['#fbbf24', '#8f6410'],
  Risk: ['#fb7185', '#a8283f'],
  Incident: ['#f87171', '#9f2f2f'],
  Control: ['#86efac', '#1d7a46'],
  Policy: ['#86efac', '#1d7a46'],
  AiModel: ['#e879f9', '#9a2bad'],
  AiAgent: ['#e879f9', '#9a2bad'],
  AiService: ['#f0abfc', '#8b2f9e'],
  Identity: ['#fda4af', '#a63a4c'],
}

const FAMILY_FALLBACK: [string, string] = ['#9fb3bb', '#516770']

export function familyColor(type: string, light: boolean): string {
  const pair = FAMILY_COLORS[type] ?? FAMILY_FALLBACK
  return light ? pair[1] : pair[0]
}

/**
 * La marque reconnue dans le nom d'un actif.
 *
 * Un « Microsoft 365 » ou un « PostgreSQL » se reconnait a son logo avant
 * qu'on ait lu son nom. La recherche se fait sur le nom normalise, et la
 * premiere correspondance gagne : les libelles precis sont declares avant les
 * generiques dans le catalogue.
 */
/**
 * Les familles o\u00f9 une marque cit\u00e9e dans le nom ne D\u00c9SIGNE pas la marque.
 *
 * \u00ab Responsable int\u00e9gration Azure \u00bb est une personne, pas un service Microsoft :
 * lui coller le logo Azure serait une erreur de lecture, et la couleur de sa
 * famille dispara\u00eetrait. Un fournisseur ou un contrat, au contraire, gagnent \u00e0
 * porter la marque dont ils parlent.
 */
export const NEVER_BRANDED = new Set(['Person', 'Role', 'Team', 'BusinessUnit', 'Organization', 'Location'])

export function brandFor(name: string, entityType: string): BrandMark | null {
  if (NEVER_BRANDED.has(entityType)) return null
  const flat = ` ${name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')} `
  for (const brand of BRAND_MARKS) {
    for (const token of brand.match) {
      if (flat.includes(` ${token} `) || flat.includes(`${token} `) || flat.includes(` ${token}`)) return brand
    }
  }
  return null
}

/** Luminance percue, pour choisir une encre lisible sur la bille. */
export function inkOn(hex: string): string {
  const v = hex.replace('#', '')
  const r = parseInt(v.slice(0, 2), 16) / 255
  const g = parseInt(v.slice(2, 4), 16) / 255
  const b = parseInt(v.slice(4, 6), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? '#10191d' : '#ffffff'
}
