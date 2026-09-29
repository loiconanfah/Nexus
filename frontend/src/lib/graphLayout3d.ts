/**
 * Disposition en ÉTAGES du graphe 3D.
 *
 * Le nuage sphérique précédent était joli et ne disait rien : la position d'un
 * nœud venait de son rang dans la liste, et les arêtes traversaient la sphère de
 * part en part. On obtenait une pelote, impossible à lire en réunion.
 *
 * Ici, chaque coordonnée porte un sens, et tient en une phrase :
 *
 *   la HAUTEUR   = la place dans la chaîne de dépendances. Tout en bas, ce dont
 *                  tout le reste dépend ; tout en haut, ce dont rien ne dépend.
 *                  Une dépendance descend donc toujours.
 *   l'ANGLE      = la famille (application, personne, fournisseur…). Les mêmes
 *                  types occupent un secteur, ce qui fait apparaître les
 *                  quartiers de l'organisation.
 *   le RAYON     = la criticité. Le cœur du disque est le cœur du métier ; la
 *                  périphérie, l'accessoire.
 *
 * Aucun rendu ici : cette fonction est pure, donc vérifiable sans WebGL.
 */

export interface LayoutNode {
  id: string
  entityType: string
  criticality: number
}

export interface LayoutEdge {
  source: string
  target: string
}

export interface Placed {
  x: number
  y: number
  z: number
  /** Étage, 0 pour le socle. */
  level: number
}

export interface LayeredLayout {
  positions: Map<string, Placed>
  /** Nombre d'étages occupés. */
  levels: number
  /** Rayon maximal atteint, pour cadrer la caméra. */
  radius: number
  /** Hauteur totale, du socle au dernier étage. */
  height: number
  /** Ordonnée du socle, où poser la grille de sol. */
  floorY: number
  /** Un étage : sa hauteur, son rayon, son effectif. Sert à le dessiner. */
  tiers: Tier[]
}

export interface Tier {
  index: number
  y: number
  radius: number
  count: number
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5))

export interface LayoutOptions {
  /** Écart vertical entre deux étages. */
  layerGap?: number
  /** Rayon de base d'un étage, avant prise en compte du nombre de nœuds. */
  baseRadius?: number
  /** Hauteur totale maximale : au-delà, les étages se resserrent. */
  maxHeight?: number
}

/**
 * Profondeur de chaque nœud dans la chaîne.
 *
 * Une arête « A dépend de B » place B SOUS A. La profondeur d'un nœud est donc
 * la plus longue chaîne qui part de lui : un socle vaut 0, et quelque chose qui
 * s'appuie sur trois niveaux vaut 3.
 *
 * Les cycles existent dans la vraie vie (deux systèmes qui s'appellent l'un
 * l'autre) : l'arête qui referme la boucle est ignorée plutôt que de faire
 * tourner le calcul sans fin.
 */
export function dependencyLevels(nodes: LayoutNode[], edges: LayoutEdge[]): Map<string, number> {
  const known = new Set(nodes.map((n) => n.id))
  const out = new Map<string, string[]>()
  for (const e of edges) {
    if (!known.has(e.source) || !known.has(e.target) || e.source === e.target) continue
    const list = out.get(e.source)
    if (list) list.push(e.target)
    else out.set(e.source, [e.target])
  }

  const level = new Map<string, number>()
  const onStack = new Set<string>()

  const depth = (id: string): number => {
    const cached = level.get(id)
    if (cached !== undefined) return cached
    if (onStack.has(id)) return 0 // arête refermant un cycle

    onStack.add(id)
    let best = 0
    for (const target of out.get(id) ?? []) best = Math.max(best, depth(target) + 1)
    onStack.delete(id)

    level.set(id, best)
    return best
  }

  for (const n of nodes) depth(n.id)
  return level
}

/** Place les nœuds en étages, secteurs et anneaux. */
export function layeredLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  options: LayoutOptions = {},
): LayeredLayout {
  const requestedGap = options.layerGap ?? 150
  const baseRadius = options.baseRadius ?? 170
  /** Hauteur totale au-delà de laquelle la pile ne tient plus dans le cadre. */
  const maxHeight = options.maxHeight ?? 1500
  const positions = new Map<string, Placed>()

  if (nodes.length === 0) {
    return { positions, levels: 0, radius: baseRadius, height: 0, floorY: 0, tiers: [] }
  }

  const level = dependencyLevels(nodes, edges)
  const byLevel = new Map<number, LayoutNode[]>()
  for (const n of nodes) {
    const l = level.get(n.id) ?? 0
    const bucket = byLevel.get(l)
    if (bucket) bucket.push(n)
    else byLevel.set(l, [n])
  }

  // Les étages vides sont supprimés : un trou dans la pile se lirait comme une
  // information alors qu'il n'en est pas une.
  const used = [...byLevel.keys()].sort((a, b) => a - b)
  const levels = used.length

  // L'écart entre étages se déduit de la LARGEUR de la pile, pas l'inverse. Une
  // tour deux fois plus haute que large se cadre de si loin que tout devient
  // minuscule ; on vise donc une pile un peu plus large que haute, quitte à
  // resserrer les étages quand la chaîne est profonde.
  const widest = Math.max(...used.map((l) => radiusFor(byLevel.get(l)!.length, baseRadius)))
  const target = Math.min(maxHeight, Math.max(420, widest * 2.1))
  const layerGap = levels > 1
    ? Math.min(requestedGap, Math.max(78, target / (levels - 1)))
    : requestedGap
  const centre = (levels - 1) / 2
  let maxRadius = baseRadius
  const tiers: Tier[] = []

  used.forEach((sourceLevel, index) => {
    const group = byLevel.get(sourceLevel)!
    const y = (index - centre) * layerGap
    const count = group.length
    const rMax = radiusFor(count, baseRadius)
    const rMin = count <= 3 ? 0 : rMax * 0.28
    maxRadius = Math.max(maxRadius, rMax)
    tiers.push({ index, y, radius: rMax, count })

    // Un secteur angulaire par famille, proportionnel à son effectif.
    const families = new Map<string, LayoutNode[]>()
    for (const n of group) {
      const bucket = families.get(n.entityType)
      if (bucket) bucket.push(n)
      else families.set(n.entityType, [n])
    }
    const ordered = [...families.entries()].sort(
      (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))

    // Décalage d'or entre étages : sans lui, les nœuds se superposent à la
    // verticale et l'on ne distingue plus les étages de trois quarts.
    let cursor = index * GOLDEN
    for (const [, members] of ordered) {
      const share = (members.length / count) * Math.PI * 2
      const from = cursor
      cursor += share

      // Le plus critique au centre, donc en tête.
      members.sort((a, b) => b.criticality - a.criticality || a.id.localeCompare(b.id))
      members.forEach((n, i) => {
        const fraction = (i + 0.5) / members.length
        const angle = from + share * fraction
        // Un peu d'épaisseur dans l'anneau, sinon les nœuds de même criticité
        // se chevauchent exactement.
        const jitter = ((i % 3) - 1) * (rMax - rMin) * 0.06
        const radius = Math.max(0, rMin + (1 - clamp(n.criticality) / 100) * (rMax - rMin) + jitter)
        positions.set(n.id, {
          x: Math.cos(angle) * radius,
          y,
          z: Math.sin(angle) * radius,
          level: index,
        })
      })
    }
  })

  const height = (levels - 1) * layerGap
  return {
    positions,
    levels,
    radius: maxRadius,
    height,
    floorY: -centre * layerGap,
    tiers,
  }
}

/** Rayon d'un étage : il s'élargit avec l'effectif, sans exploser. */
function radiusFor(count: number, baseRadius: number) {
  return baseRadius + Math.sqrt(count) * 34
}

function clamp(value: number) {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0
}
