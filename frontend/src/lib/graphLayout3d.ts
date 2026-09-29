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

/**
 * Place les nœuds par familles.
 *
 * Les grappes sont d'abord posées sur une sphère, puis écartées tant qu'elles se
 * chevauchent. Cette relaxation compte : sans elle, deux familles nombreuses
 * finissent l'une dans l'autre et l'on retrouve la pelote que l'on cherchait
 * précisément à éviter.
 */
export function clusteredLayout(nodes: LayoutNode[], options: LayoutOptions = {}): ClusteredLayout {
  const margin = options.margin ?? 56
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

  // ── 1. La disposition INTERNE de chaque famille, autour de son propre centre.
  //
  // Elle est calculée avant de placer les familles, parce que c'est elle qui
  // donne le vrai rayon d'une grappe. L'estimer à l'avance, comme on le faisait,
  // produisait des grappes trop petites pour leur contenu : les billes se
  // touchaient et il devenait impossible d'en viser une.
  const locals = new Map<string, Local[]>()
  const radii = new Map<string, number>()

  for (const [key, members] of ordered) {
    const sorted = [...members].sort((a, b) => b.criticality - a.criticality || a.id.localeCompare(b.id))
    const count = sorted.length
    // Un rayon de départ proportionnel à la RACINE CUBIQUE de l'effectif :
    // c'est ainsi que croît le volume nécessaire, pas en racine carrée.
    const ball = 30 + Math.cbrt(count) * 46

    const local: Local[] = sorted.map((n, i) => {
      const [dx, dy, dz] = sphereDirection(i, count)
      // Le plus critique au cœur, le reste vers la périphérie.
      const depth = count <= 1 ? 0 : Math.cbrt((i + 0.45) / count)
      const r = ball * depth
      return { id: n.id, x: dx * r, y: dy * r, z: dz * r, radius: nodeRadius(n.criticality) }
    })

    spreadNodes(local)
    locals.set(key, local)
    radii.set(key, local.reduce((max, n) => Math.max(max, Math.hypot(n.x, n.y, n.z) + n.radius), 40))
  }

  // ── 2. Les familles, posées sur une sphère aplatie puis écartées.
  const widest = Math.max(...radii.values())
  const spread = (widest + margin) * Math.max(1.5, Math.sqrt(ordered.length))

  const clusters: Cluster[] = ordered.map(([key, members], index) => {
    const [dx, dy, dz] = sphereDirection(index, ordered.length)
    return {
      key,
      count: members.length,
      radius: radii.get(key)!,
      // Un peu aplati : une galaxie se lit mieux qu'une boule parfaite, et l'on
      // garde un haut et un bas stables pour s'orienter.
      x: dx * spread,
      y: dy * spread * 0.55,
      z: dz * spread,
    }
  })

  relax(clusters, margin)

  // ── 3. Les positions finales : le local, translaté par le centre.
  for (const cluster of clusters) {
    for (const n of locals.get(cluster.key) ?? []) {
      positions.set(n.id, {
        x: cluster.x + n.x,
        y: cluster.y + n.y,
        z: cluster.z + n.z,
        cluster: cluster.key,
      })
    }
  }

  const radius = clusters.reduce(
    (max, c) => Math.max(max, Math.hypot(c.x, c.y, c.z) + c.radius), 200)

  return { positions, clusters, radius }
}

/** Une bille pendant le calcul : sa place dans sa famille, et sa taille. */
interface Local {
  id: string
  x: number
  y: number
  z: number
  radius: number
}

/**
 * Le rayon d'une bille, selon sa criticité.
 *
 * Défini ICI et pas dans le rendu : l'espacement doit être calculé avec la
 * taille réelle des billes, sinon la carte paraît aérée dans le calcul et
 * serrée à l'écran. Le rendu importe cette fonction plutôt que de refaire le
 * calcul de son côté.
 */
export function nodeRadius(criticality: number) {
  return 6 + (Math.min(100, Math.max(0, criticality)) / 100) * 8
}

/**
 * Écarte les billes d'une même famille jusqu'à ce qu'aucune n'en touche une
 * autre.
 *
 * C'est ce qui manquait : une distribution régulière sur le papier laisse
 * quand même des paires collées, parce que le rayon croît moins vite que le
 * nombre de voisins. On vise l'espace de DEUX billes entre deux billes, de quoi
 * en viser une à la souris et lire son auréole.
 */
function spreadNodes(local: Local[]) {
  if (local.length < 2) return
  for (let pass = 0; pass < 40; pass++) {
    let moved = false
    for (let i = 0; i < local.length; i++) {
      for (let j = i + 1; j < local.length; j++) {
        const a = local[i], b = local[j]
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z
        const distance = Math.hypot(dx, dy, dz) || 0.001
        // 1,9 fois les rayons : l'auréole d'un élément critique monte à 1,65 fois
        // sa bille, et deux auréoles qui se recouvrent se lisent comme une seule.
        const wanted = (a.radius + b.radius) * 1.9 + 8
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
