import dagre from '@dagrejs/dagre'
import type { Edge, Node } from '@xyflow/react'

const NODE_W = 190
const NODE_H = 52

/** Positionne les nœuds avec dagre (layout hiérarchique). */
export function layoutGraph(nodes: Node[], edges: Edge[], rankdir: 'LR' | 'TB' = 'LR'): Node[] {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir, nodesep: 45, ranksep: 90, marginx: 20, marginy: 20 })

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }))
  edges.forEach((e) => g.setEdge(e.source, e.target))

  dagre.layout(g)

  return nodes.map((n) => {
    const p = g.node(n.id)
    return { ...n, position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 } }
  })
}

/** Cadre d'une grappe : de quoi dessiner le fond et son intitulé. */
export interface Cluster {
  key: string
  x: number
  y: number
  width: number
  height: number
  count: number
}

const PAD = 28        // marge intérieure d'une grappe
const HEADER = 34     // bandeau du titre
const GAP = 56        // écart entre grappes
const COL = 28        // écart entre colonnes d'une grille
const ROW = 22        // écart entre rangées d'une grille

/**
 * Mise en page PAR GRAPPES : les nœuds d'une même famille (type d'actif) sont
 * réunis dans un cadre, comme dans le jumeau numérique, au lieu d'être alignés
 * en colonnes sur toute la largeur. À l'intérieur d'une grappe, dagre conserve
 * le sens des dépendances internes ; les grappes elles-mêmes sont rangées de la
 * plus fournie à la plus petite, sur plusieurs rangées.
 */
export function layoutClustered(
  nodes: Node[],
  edges: Edge[],
  groupOf: (n: Node) => string,
): { nodes: Node[]; clusters: Cluster[] } {
  if (nodes.length === 0) return { nodes: [], clusters: [] }

  const groups = new Map<string, Node[]>()
  for (const n of nodes) {
    const k = groupOf(n)
    const list = groups.get(k)
    if (list) list.push(n)
    else groups.set(k, [n])
  }

  // Disposition interne de chaque grappe, indépendamment des autres.
  type Laid = { key: string; inner: { id: string; x: number; y: number }[]; w: number; h: number; count: number }
  const laid: Laid[] = []
  for (const [key, members] of groups) {
    const ids = new Set(members.map((m) => m.id))
    // Seuls les liens internes structurent une grappe ; les liens sortants la
    // relient aux autres, sans en déformer le contenu.
    const inside = edges.filter((e) => ids.has(e.source) && ids.has(e.target))
    const linked = new Set<string>()
    for (const e of inside) { linked.add(String(e.source)); linked.add(String(e.target)) }

    const inner: { id: string; x: number; y: number }[] = []
    let w = 0, h = 0

    // 1. Les membres reliés entre eux gardent le sens de la dépendance (dagre).
    const chained = members.filter((m) => linked.has(m.id))
    if (chained.length > 0) {
      const g = new dagre.graphlib.Graph()
      g.setDefaultEdgeLabel(() => ({}))
      g.setGraph({ rankdir: 'TB', nodesep: 26, ranksep: 54, marginx: 0, marginy: 0 })
      chained.forEach((m) => g.setNode(m.id, { width: NODE_W, height: NODE_H }))
      inside.forEach((e) => g.setEdge(e.source, e.target))
      dagre.layout(g)
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      const raw = chained.map((m) => {
        const q = g.node(m.id)
        const x = q.x - NODE_W / 2, y = q.y - NODE_H / 2
        minX = Math.min(minX, x); minY = Math.min(minY, y)
        maxX = Math.max(maxX, x + NODE_W); maxY = Math.max(maxY, y + NODE_H)
        return { id: m.id, x, y }
      })
      for (const q of raw) inner.push({ id: q.id, x: q.x - minX, y: q.y - minY })
      w = maxX - minX
      h = maxY - minY
    }

    // 2. Les membres sans lien interne se rangent en GRILLE. Alignés en une
    //    seule rangée, ils étireraient la grappe sur toute la largeur du plan.
    const loose = members.filter((m) => !linked.has(m.id))
    if (loose.length > 0) {
      const cols = Math.max(1, Math.min(5, Math.ceil(Math.sqrt(loose.length))))
      const top = h > 0 ? h + ROW : 0
      loose.forEach((m, i) => inner.push({
        id: m.id,
        x: (i % cols) * (NODE_W + COL),
        y: top + Math.floor(i / cols) * (NODE_H + ROW),
      }))
      const rows = Math.ceil(loose.length / cols)
      w = Math.max(w, Math.min(cols, loose.length) * NODE_W + (Math.min(cols, loose.length) - 1) * COL)
      h = top + rows * NODE_H + (rows - 1) * ROW
    }

    laid.push({ key, inner, w, h, count: members.length })
  }

  // Rangement des grappes : les plus fournies d'abord, sur une largeur de
  // bande proportionnelle à la surface totale — ni une bande unique, ni un
  // damier trop étalé.
  laid.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
  const area = laid.reduce((s, c) => s + (c.w + PAD * 2 + GAP) * (c.h + PAD * 2 + HEADER + GAP), 0)
  const bandWidth = Math.max(laid[0].w + PAD * 2, Math.sqrt(area) * 1.4)

  const clusters: Cluster[] = []
  const position = new Map<string, { x: number; y: number }>()
  let cursorX = 0, cursorY = 0, rowHeight = 0
  for (const c of laid) {
    const width = c.w + PAD * 2
    const height = c.h + PAD * 2 + HEADER
    if (cursorX > 0 && cursorX + width > bandWidth) { cursorX = 0; cursorY += rowHeight + GAP; rowHeight = 0 }
    clusters.push({ key: c.key, x: cursorX, y: cursorY, width, height, count: c.count })
    for (const p of c.inner) position.set(p.id, { x: cursorX + PAD + p.x, y: cursorY + HEADER + PAD / 2 + p.y })
    cursorX += width + GAP
    rowHeight = Math.max(rowHeight, height)
  }

  return {
    nodes: nodes.map((n) => ({ ...n, position: position.get(n.id) ?? { x: 0, y: 0 } })),
    clusters,
  }
}
