import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { disposeObject, makeLabelSprite } from '../lib/holoThree'
import { useLang } from '../lib/i18n'
import type { GraphData } from '../lib/types'

/**
 * Topologie du tableau de bord, en STRATES ORBITALES.
 *
 * Délibérément différente des deux autres vues 3D de la plateforme, qui
 * disposent leurs nœuds sur une sphère : ici les actifs se posent sur quatre
 * anneaux empilés, un par couche — métier, applicatif, infrastructure, externe.
 * La pile se lit d'un coup d'œil, et les dépendances qui la TRAVERSENT (une
 * ligne longue, d'un anneau du haut jusqu'en bas) sautent aux yeux : c'est
 * exactement ce qu'on vient chercher dans une carte de dépendances.
 *
 * Sur chaque anneau, les actifs les plus critiques sont poussés vers
 * l'extérieur : plus un point est loin de l'axe, plus il compte.
 */

const CYAN = '#00e5ff'

type LayerKey = 'business' | 'app' | 'infra' | 'external'

const LAYERS: { key: LayerKey; y: number; radius: number; color: string; label: [string, string]; types: string[] }[] = [
  {
    key: 'business', y: 33, radius: 26, color: '#00e5ff',
    label: ['Services métier', 'Business services'],
    types: ['BusinessProcess', 'BusinessService', 'Process'],
  },
  {
    key: 'app', y: 11, radius: 36, color: '#a3defe',
    label: ['Applications', 'Applications'],
    types: ['Application', 'Service', 'System'],
  },
  {
    key: 'infra', y: -11, radius: 44, color: '#7d8f93',
    label: ['Infrastructure', 'Infrastructure'],
    types: ['Server', 'Database', 'Network', 'Device', 'CloudResource', 'DataStore', 'Infrastructure', 'Location'],
  },
  {
    key: 'external', y: -33, radius: 32, color: '#c9a227',
    label: ['Fournisseurs & personnes', 'Suppliers & people'],
    types: ['Supplier', 'Contract', 'Person', 'Role', 'Team'],
  },
]

function layerOf(type: string): LayerKey {
  return LAYERS.find((l) => l.types.includes(type))?.key ?? 'infra'
}

function critColor(c: number): string {
  if (c >= 80) return '#d15b54'
  if (c >= 60) return '#d9772e'
  if (c >= 40) return '#c69a4e'
  return '#5a97a3'
}

export function Topology3D({ graph, onNode }: { graph?: GraphData; onNode?: (id: string, name: string) => void }) {
  const { t, lang } = useLang()
  const mountRef = useRef<HTMLDivElement>(null)
  const [spin, setSpin] = useState(true)
  const spinRef = useRef(spin)
  spinRef.current = spin
  const resetRef = useRef<(() => void) | null>(null)
  const [hover, setHover] = useState<{ name: string; type: string; crit: number } | null>(null)

  // Les nœuds effectivement placés, avec leur position sur leur anneau.
  const placed = useMemo(() => {
    if (!graph) return []
    const byLayer = new Map<LayerKey, typeof graph.nodes>()
    for (const n of graph.nodes) {
      const k = layerOf(n.entityType)
      const arr = byLayer.get(k) ?? []
      arr.push(n)
      byLayer.set(k, arr)
    }
    const out: { id: string; name: string; type: string; crit: number; pos: THREE.Vector3; color: string }[] = []
    for (const layer of LAYERS) {
      const nodes = (byLayer.get(layer.key) ?? []).slice(0, 34)
      const n = nodes.length || 1
      nodes.forEach((node, i) => {
        const a = (i / n) * Math.PI * 2
        // Criticité -> distance à l'axe : ce qui compte s'éloigne du centre.
        const r = layer.radius * (0.62 + 0.38 * (node.criticality / 100))
        out.push({
          id: node.id, name: node.name, type: node.entityType, crit: node.criticality,
          pos: new THREE.Vector3(Math.cos(a) * r, layer.y, Math.sin(a) * r),
          color: critColor(node.criticality),
        })
      })
    }
    return out
  }, [graph])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount || placed.length === 0) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, 1, 1, 1000)
    camera.position.set(0, 40, 168)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.enablePan = false
    controls.minDistance = 85
    controls.maxDistance = 300

    const world = new THREE.Group()
    scene.add(world)

    // ── Anneaux ────────────────────────────────────────────────────────────
    const byId = new Map(placed.map((p) => [p.id, p]))
    for (const layer of LAYERS) {
      const has = placed.some((p) => layerOf(p.type) === layer.key)
      if (!has) continue
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(layer.radius, 0.16, 8, 128),
        new THREE.MeshBasicMaterial({ color: layer.color, transparent: true, opacity: 0.3 }),
      )
      ring.rotation.x = Math.PI / 2
      ring.position.y = layer.y
      world.add(ring)

      // Étiquette de strate posée DANS la scène : elle tourne avec les anneaux,
      // si bien qu'on sait toujours quelle couche on regarde. Discrète — la
      // légende du coin porte la lecture d'ensemble.
      const label = makeLabelSprite(lang === 'fr' ? layer.label[0] : layer.label[1], 3.2)
      label.position.set(0, layer.y + 5.5, 0)
      label.material.opacity = 0.75
      world.add(label)
    }

    // ── Liens ──────────────────────────────────────────────────────────────
    // Une dépendance qui traverse plusieurs strates est mise en avant : c'est
    // celle dont on ne soupçonne pas l'existence avant qu'elle ne casse.
    const linkGeom: number[] = []
    const linkCols: number[] = []
    const cross = new THREE.Color('#00e5ff')
    const flat = new THREE.Color('#3d5560')
    for (const e of graph?.edges ?? []) {
      const a = byId.get(e.source)
      const b = byId.get(e.target)
      if (!a || !b) continue
      const spans = Math.abs(a.pos.y - b.pos.y) > 1
      const c = spans ? cross : flat
      // Courbe légère, pour que les liens ne se confondent pas avec les anneaux.
      const mid = a.pos.clone().lerp(b.pos, 0.5)
      mid.multiplyScalar(0.74)
      const curve = new THREE.QuadraticBezierCurve3(a.pos, mid, b.pos)
      const pts = curve.getPoints(14)
      for (let k = 0; k < pts.length - 1; k++) {
        linkGeom.push(pts[k].x, pts[k].y, pts[k].z, pts[k + 1].x, pts[k + 1].y, pts[k + 1].z)
        for (let q = 0; q < 2; q++) linkCols.push(c.r, c.g, c.b)
      }
    }
    if (linkGeom.length) {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(linkGeom, 3))
      g.setAttribute('color', new THREE.Float32BufferAttribute(linkCols, 3))
      world.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({
        vertexColors: true, transparent: true, opacity: 0.34,
      })))
    }

    // ── Actifs ─────────────────────────────────────────────────────────────
    const nodeMeshes: THREE.Mesh[] = []
    for (const p of placed) {
      const size = 0.85 + (p.crit / 100) * 1.15
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(size, 16, 16),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(p.color) }),
      )
      m.position.copy(p.pos)
      m.userData = p
      world.add(m)
      nodeMeshes.push(m)

      // Un halo par actif critique noyait la vue : sur un parc réel ils sont
      // des dizaines et leurs nappes se cumulent. Réservé aux plus critiques.
      if (p.crit >= 92) {
        const halo = new THREE.Mesh(
          new THREE.SphereGeometry(size * 1.7, 12, 12),
          new THREE.MeshBasicMaterial({ color: new THREE.Color(p.color), transparent: true, opacity: 0.10 }),
        )
        halo.position.copy(p.pos)
        world.add(halo)
      }
    }

    // ── Survol & clic ──────────────────────────────────────────────────────
    const ray = new THREE.Raycaster()
    ray.params.Points = { threshold: 2 }
    const mouse = new THREE.Vector2()
    let hovered: THREE.Mesh | null = null

    function pick(ev: PointerEvent): THREE.Mesh | null {
      const r = renderer.domElement.getBoundingClientRect()
      mouse.x = ((ev.clientX - r.left) / r.width) * 2 - 1
      mouse.y = -((ev.clientY - r.top) / r.height) * 2 + 1
      ray.setFromCamera(mouse, camera)
      return (ray.intersectObjects(nodeMeshes, false)[0]?.object as THREE.Mesh) ?? null
    }
    function onMove(ev: PointerEvent) {
      const hit = pick(ev)
      if (hit === hovered) return
      hovered = hit
      renderer.domElement.style.cursor = hit ? 'pointer' : 'grab'
      setHover(hit ? { name: hit.userData.name, type: hit.userData.type, crit: hit.userData.crit } : null)
    }
    function onClick(ev: PointerEvent) {
      const hit = pick(ev)
      if (hit && onNode) onNode(hit.userData.id, hit.userData.name)
    }
    renderer.domElement.addEventListener('pointermove', onMove)
    renderer.domElement.addEventListener('pointerdown', onClick)

    // ── Boucle ─────────────────────────────────────────────────────────────
    function resize() {
      const w = mount!.clientWidth
      const h = mount!.clientHeight
      if (w === 0 || h === 0) return
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(mount)

    resetRef.current = () => {
      camera.position.set(0, 40, 168)
      controls.target.set(0, 0, 0)
      world.rotation.y = 0
      controls.update()
    }

    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      if (spinRef.current) world.rotation.y += 0.0016
      controls.update()
      renderer.render(scene, camera)
    }
    loop()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      renderer.domElement.removeEventListener('pointermove', onMove)
      renderer.domElement.removeEventListener('pointerdown', onClick)
      controls.dispose()
      disposeObject(scene)
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
      resetRef.current = null
    }
  }, [placed, graph, lang, onNode])

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={mountRef} className="absolute inset-0" />

      {/* Commandes */}
      <div className="absolute right-3 top-3 flex gap-1.5">
        <Ctl onClick={() => setSpin((s) => !s)} title={spin ? t('Arrêter la rotation', 'Stop rotation') : t('Reprendre la rotation', 'Resume rotation')}>
          {spin ? <Pause size={13} /> : <Play size={13} />}
        </Ctl>
        <Ctl onClick={() => resetRef.current?.()} title={t('Recadrer', 'Reset view')}><RotateCcw size={13} /></Ctl>
      </div>

      {/* Ce qu'on regarde */}
      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1">
        {LAYERS.map((l) => (
          <span key={l.key} className="flex items-center gap-2"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--nx-text-muted)' }}>
            <span style={{ width: 14, height: 2, background: l.color, opacity: 0.8 }} />
            {t(...l.label)}
          </span>
        ))}
      </div>

      {hover && (
        <div className="pointer-events-none absolute bottom-3 right-3 rounded-sm border px-3 py-2"
          style={{ background: 'var(--nx-panel)', borderColor: CYAN, maxWidth: 260 }}>
          <div style={{ fontSize: 13, color: 'var(--nx-text)' }}>{hover.name}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--nx-text-muted)' }}>
            {t('criticité', 'criticality')} {hover.crit}
          </div>
        </div>
      )}
    </div>
  )
}

function Ctl({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button onClick={onClick} title={title}
      className="flex h-7 w-7 items-center justify-center rounded-sm border transition-colors hover:brightness-125"
      style={{ background: 'var(--nx-surface)', borderColor: 'var(--nx-border)', color: 'var(--nx-text-muted)' }}>
      {children}
    </button>
  )
}
