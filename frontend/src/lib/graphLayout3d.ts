/**
 * Disposition en GRAPPES du graphe 3D.
 *
 * Deux dispositions ont été essayées avant celle-ci, et toutes deux échouaient,
 * pour des raisons opposées.
 *
 * Le nuage sphérique unique était joli et muet : la position d'un nœud venait de
 * son rang dans la liste, et les arêtes traversaient la boule de part en part.
 *
 * La pile d'étages disait quelque chose de juste mais se manipulait mal : une
 * tour est haute et étroite, donc elle part de travers au moindre mouvement de
 * souris, et il faut sans cesse monter ou descendre pour suivre une chaîne.
 * Lisible sur une capture, pénible à l'usage.
 *
 * Les grappes gardent le sens et rendent la vue maniable :
 *
 *   une GRAPPE par famille  (applications, personnes, fournisseurs…), séparée des
 *                           autres, comme le mode « par familles » du plan 2D ;
 *   au CENTRE de sa grappe  le plus critique de la famille, à la périphérie
 *                           l'accessoire ;
 *   un ENSEMBLE ramassé     les grappes se répartissent sur une sphère aplatie,
 *                           si bien que la vue reste compacte sous tous les
 *                           angles et que l'orbite ne part jamais dans le vide.
 *
 * Aucun rendu ici : cette fonction est pure, donc vérifiable sans WebGL.
 */

export interface LayoutNode {
  id: string
  entityType: string
  criticality: number
}

export interface Placed {
  x: number
  y: number
  z: number
  /** Famille à laquelle appartient le nœud. */
  cluster: string
}

export interface Cluster {
  key: string
  count: number
  radius: number
  x: number
  y: number
  z: number
}

export interface ClusteredLayout {
  positions: Map<string, Placed>
  clusters: Cluster[]
  /** Rayon englobant, pour cadrer la caméra. */
  radius: number
}

export interface LayoutOptions {
  /** Écart minimal entre deux grappes, en plus de leurs rayons. */
  margin?: number
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

/** Direction régulièrement répartie sur une sphère (suite de Fibonacci). */
function sphereDirection(index: number, total: number): [number, number, number] {
  if (total <= 1) return [0, 0, 0]
  const y = 1 - (index / (total - 1)) * 2
  const r = Math.sqrt(Math.max(0, 1 - y * y))
  const theta = GOLDEN_ANGLE * index
  return [Math.cos(theta) * r, y, Math.sin(theta) * r]
}

/** Rayon d'une grappe : elle grossit avec son effectif, sans exploser. */
export function clusterRadius(count: number) {
  return 34 + Math.sqrt(Math.max(1, count)) * 26
}

/**
 * Place les nœuds par familles.
 *
 * Les grappes sont d'abord posées sur une sphère, puis écartées tant qu'elles se
 * chevauchent. Cette relaxation compte : sans elle, deux familles nombreuses
 * finissent l'une dans l'autre et l'on retrouve la pelote que l'on cherchait
 * précisément à éviter.
 */
export function clusteredLayout(nodes: LayoutNode[], options: LayoutOptions = {}): ClusteredLayout {
  const margin = options.margin ?? 46
  const positions = new Map<string, Placed>()
  if (nodes.length === 0) return { positions, clusters: [], radius: 200 }

  // Familles, les plus nombreuses d'abord. L'ordre doit être stable d'un rendu à
  // l'autre, sinon la carte se réorganise sous les yeux de l'utilisateur.
  const families = new Map<string, LayoutNode[]>()
  for (const n of nodes) {
    const bucket = families.get(n.entityType)
    if (bucket) bucket.push(n)
    else families.set(n.entityType, [n])
  }
  const ordered = [...families.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))

  const spread = (clusterRadius(nodes.length / ordered.length) + margin)
    * Math.max(1.5, Math.sqrt(ordered.length))

  const clusters: Cluster[] = ordered.map(([key, members], index) => {
    const [dx, dy, dz] = sphereDirection(index, ordered.length)
    return {
      key,
      count: members.length,
      radius: clusterRadius(members.length),
      // Un peu aplati : une galaxie se lit mieux qu'une boule parfaite, et l'on
      // garde un haut et un bas stables pour s'orienter.
      x: dx * spread,
      y: dy * spread * 0.55,
      z: dz * spread,
    }
  })

  relax(clusters, margin)

  for (const [key, members] of ordered) {
    const centre = clusters.find((c) => c.key === key)!
    // Le plus critique au cœur de sa famille.
    const sorted = [...members].sort((a, b) => b.criticality - a.criticality || a.id.localeCompare(b.id))
    sorted.forEach((n, i) => {
      const [dx, dy, dz] = sphereDirection(i, sorted.length)
      // Racine cubique : les nœuds occupent le VOLUME de la grappe au lieu de
      // s'entasser sur sa coque.
      const depth = sorted.length <= 1 ? 0 : Math.cbrt((i + 0.35) / sorted.length)
      const r = centre.radius * depth
      positions.set(n.id, {
        x: centre.x + dx * r,
        y: centre.y + dy * r,
        z: centre.z + dz * r,
        cluster: key,
      })
    })
  }

  const radius = clusters.reduce(
    (max, c) => Math.max(max, Math.hypot(c.x, c.y, c.z) + c.radius), 200)

  return { positions, clusters, radius }
}

/** Écarte les grappes qui se chevauchent, en quelques passes. */
function relax(clusters: Cluster[], margin: number) {
  for (let pass = 0; pass < 24; pass++) {
    let moved = false
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const a = clusters[i], b = clusters[j]
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z
        const distance = Math.hypot(dx, dy, dz) || 0.001
        const wanted = a.radius + b.radius + margin
        if (distance >= wanted) continue

        const push = (wanted - distance) / 2
        const ux = dx / distance, uy = dy / distance, uz = dz / distance
        a.x -= ux * push; a.y -= uy * push; a.z -= uz * push
        b.x += ux * push; b.y += uy * push; b.z += uz * push
        moved = true
      }
    }
    if (!moved) break
  }
}
