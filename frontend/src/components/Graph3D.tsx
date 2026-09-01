import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { DragControls } from 'three/examples/jsm/controls/DragControls.js'
import {
  AppWindow, Box, Database, Laptop, MapPin, Move3d, Network, RotateCcw, Server, Truck,
  User, Users, Workflow, FileText,
} from 'lucide-react'
import { fibSpherePoint, makeIconSprite, makeLabelSprite, disposeObject, type IconCmp } from '../lib/holoThree'
import { useLang } from '../lib/i18n'
import { entityTypeLabel } from '../lib/labels'
import type { GraphEntityRecord } from '../lib/types'

const CYAN = '#00e5ff'
const ERR = '#d15b54'

function bandColor(crit: number): string {
  if (crit >= 80) return '#d15b54'
  if (crit >= 60) return '#c69a4e'
  if (crit >= 40) return '#d9772e'
  return '#5a97a3'
}

const TYPE_ICON: Record<string, IconCmp> = {
  Server, System: Server, Infrastructure: Server,
  Database, DataStore: Database,
  Application: AppWindow, Service: AppWindow, BusinessService: AppWindow,
  Network,
  Device: Laptop,
  Supplier: Truck,
  Contract: FileText,
  Person: User, Role: Users, Team: Users,
  BusinessProcess: Workflow, Process: Workflow,
  Location: MapPin,
}
function iconFor(type: string): IconCmp { return TYPE_ICON[type] ?? Box }

export interface Graph3DEdge { id: string; source: string; target: string; type?: string; status?: string; confidence?: number }

interface Props {
  nodes: GraphEntityRecord[]
  edges: Graph3DEdge[]
  query?: string
  selectedId?: string | null
  onSelect?: (id: string) => void
}

interface Hover { name: string; sub: string; x: number; y: number }

export function Graph3D({ nodes, edges, query, selectedId, onSelect }: Props) {
  const { t } = useLang()
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const orbitRef = useRef<OrbitControls | null>(null)
  const dragRef = useRef<DragControls | null>(null)
  const domRef = useRef<HTMLElement | null>(null)
  const nodeMeshesRef = useRef<THREE.Mesh[]>([])
  const edgeLinesRef = useRef<{ line: THREE.Line; a: THREE.Mesh; b: THREE.Mesh }[]>([])
  const onSelectRef = useRef(onSelect); onSelectRef.current = onSelect
  const queryRef = useRef(query); queryRef.current = query
  const selectedRef = useRef(selectedId); selectedRef.current = selectedId

  const [hover, setHover] = useState<Hover | null>(null)

  // ── Initialisation unique de la scène WebGL ──
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const width = mount.clientWidth || 800
    const height = mount.clientHeight || 600

    const scene = new THREE.Scene(); sceneRef.current = scene
    const camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 6000)
    camera.position.set(0, 70, 640); cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)
    domRef.current = renderer.domElement

    scene.add(new THREE.AmbientLight(0xffffff, 0.78))
    const pt = new THREE.PointLight(0xffffff, 1.3, 0, 1.6); pt.position.set(0, 0, 0); scene.add(pt)
    const rim = new THREE.PointLight(0x00e5ff, 0.55, 0, 2); rim.position.set(320, 220, 320); scene.add(rim)

    // Champ d'étoiles (repère de profondeur).
    const starGeo = new THREE.BufferGeometry()
    const starCount = 340
    const starPos = new Float32Array(starCount * 3)
    for (let i = 0; i < starCount; i++) {
      const v = fibSpherePoint(i, starCount).multiplyScalar(1600 + Math.random() * 600)
      starPos.set([v.x, v.y, v.z], i * 3)
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x3b494c, size: 2, sizeAttenuation: true, transparent: true, opacity: 0.55 }))
    scene.add(stars)

    const orbit = new OrbitControls(camera, renderer.domElement)
    orbit.enableDamping = true; orbit.dampingFactor = 0.08
    orbit.rotateSpeed = 0.7; orbit.zoomSpeed = 0.9
    orbit.minDistance = 120; orbit.maxDistance = 2200
    orbitRef.current = orbit

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let hoveredMesh: THREE.Mesh | null = null

    function updatePointer(e: PointerEvent) {
      const r = renderer.domElement.getBoundingClientRect()
      pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1
      pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1
      return { px: e.clientX - r.left, py: e.clientY - r.top }
    }
    function onPointerMove(e: PointerEvent) {
      const { px, py } = updatePointer(e)
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects(nodeMeshesRef.current, false)
      const mesh = hits[0]?.object as THREE.Mesh | undefined
      if (mesh !== hoveredMesh) {
        if (hoveredMesh) hoveredMesh.scale.setScalar(hoveredMesh.userData.baseScale ?? 1)
        hoveredMesh = mesh ?? null
        if (hoveredMesh) hoveredMesh.scale.setScalar((hoveredMesh.userData.baseScale ?? 1) * 1.35)
        renderer.domElement.style.cursor = hoveredMesh ? 'pointer' : 'grab'
        orbit.enableRotate = !hoveredMesh
      }
      if (mesh) setHover({ name: mesh.userData.name as string, sub: mesh.userData.sub as string, x: px, y: py })
      else setHover(null)
    }
    let downPos: { x: number; y: number } | null = null
    function onPointerDown(e: PointerEvent) { downPos = { x: e.clientX, y: e.clientY } }
    function onPointerUp(e: PointerEvent) {
      if (!downPos) return
      const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y)
      downPos = null
      if (moved > 5) return
      updatePointer(e)
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects(nodeMeshesRef.current, false)
      const mesh = hits[0]?.object as THREE.Mesh | undefined
      if (mesh) onSelectRef.current?.(mesh.userData.id as string)
    }
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointerup', onPointerUp)

    let raf = 0
    const clock = new THREE.Clock()
    function animate() {
      raf = requestAnimationFrame(animate)
      const el = clock.getElapsedTime()
      orbit.update()
      stars.rotation.y = el * 0.008
      // Mise à jour des arêtes (les nœuds peuvent être déplacés).
      for (const { line, a, b } of edgeLinesRef.current) {
        const pos = line.geometry.attributes.position as THREE.BufferAttribute
        pos.setXYZ(0, a.position.x, a.position.y, a.position.z)
        pos.setXYZ(1, b.position.x, b.position.y, b.position.z)
        pos.needsUpdate = true
      }
      // Pulsation du nœud sélectionné.
      const sel = selectedRef.current
      if (sel) {
        const m = nodeMeshesRef.current.find((x) => x.userData.id === sel)
        if (m) m.scale.setScalar((m.userData.baseScale ?? 1) * (1 + Math.sin(el * 3) * 0.08))
      }
      renderer.render(scene, camera)
    }
    animate()

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth, h = mount.clientHeight
      if (!w || !h) return
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h)
    })
    ro.observe(mount)

    return () => {
      cancelAnimationFrame(raf); ro.disconnect()
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      dragRef.current?.dispose(); orbit.dispose(); renderer.dispose()
      scene.traverse((o) => disposeObject(o))
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
  }, [])

  // ── (Re)construction du graphe 3D quand les données changent ──
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    const old = scene.getObjectByName('graph3d')
    if (old) { disposeObject(old); scene.remove(old) }

    const group = new THREE.Group(); group.name = 'graph3d'
    const meshes: THREE.Mesh[] = []
    const posById = new Map<string, THREE.Mesh>()

    // Rayon de la sphère selon le nombre de nœuds.
    const total = Math.max(1, nodes.length)
    const radius = 160 + Math.sqrt(total) * 42

    nodes.forEach((n, k) => {
      const dir = fibSpherePoint(k, total)
      const pos = dir.multiplyScalar(radius)
      const col = new THREE.Color(bandColor(n.criticality))
      const r = 6 + (n.criticality / 100) * 8
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(r, 24, 24),
        new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.28, roughness: 0.55, metalness: 0.15, transparent: true }),
      )
      mesh.position.copy(pos)
      mesh.userData = { id: n.id, name: n.name, sub: `${entityTypeLabel(n.entityType, t)} · c${n.criticality}`, type: n.entityType, criticality: n.criticality, baseScale: 1, baseColor: col.clone() }
      // Halo discret.
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(r * 1.45, 16, 16),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.06, side: THREE.BackSide }),
      )
      mesh.add(halo)
      mesh.add(makeIconSprite(iconFor(n.entityType), r * 1.5))
      const label = makeLabelSprite(n.name)
      label.position.set(0, -(r + 11), 0)
      mesh.add(label)
      group.add(mesh); meshes.push(mesh); posById.set(n.id, mesh)
    })

    // Arêtes.
    const lines: { line: THREE.Line; a: THREE.Mesh; b: THREE.Mesh }[] = []
    for (const e of edges) {
      const a = posById.get(e.source), b = posById.get(e.target)
      if (!a || !b) continue
      const suggested = e.status === 'AiSuggested'
      const lgeo = new THREE.BufferGeometry().setFromPoints([a.position.clone(), b.position.clone()])
      const baseOpacity = (e.confidence ?? 1) < 0.5 ? 0.22 : 0.4
      const baseColor = new THREE.Color(suggested ? '#e08a3c' : CYAN)
      const line = new THREE.Line(lgeo, new THREE.LineBasicMaterial({
        color: baseColor.clone(), transparent: true, opacity: baseOpacity,
      }))
      line.userData = { baseOpacity, baseColor }
      group.add(line); lines.push({ line, a, b })
    }

    scene.add(group)
    nodeMeshesRef.current = meshes
    edgeLinesRef.current = lines

    // Déplacement des nœuds (glisser).
    dragRef.current?.dispose()
    if (domRef.current && cameraRef.current) {
      const dc = new DragControls(meshes, cameraRef.current, domRef.current)
      dc.addEventListener('dragstart', () => { if (orbitRef.current) orbitRef.current.enableRotate = false })
      dc.addEventListener('dragend', () => { if (orbitRef.current) orbitRef.current.enableRotate = true })
      dragRef.current = dc
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges])

  // ── Mise en évidence : recherche (atténuation) + sélection (nœud + relations liées) ──
  useEffect(() => {
    const q = (query ?? '').trim().toLowerCase()
    const sel = selectedId
    // Voisins du sélectionné (via les arêtes).
    const near = new Set<string>()
    if (sel) {
      near.add(sel)
      for (const { a, b } of edgeLinesRef.current) {
        const ai = a.userData.id as string, bi = b.userData.id as string
        if (ai === sel) near.add(bi)
        if (bi === sel) near.add(ai)
      }
    }
    for (const m of nodeMeshesRef.current) {
      const mat = m.material as THREE.MeshStandardMaterial
      const id = m.userData.id as string
      const isSel = id === sel
      const match = !q || (m.userData.name as string).toLowerCase().includes(q)
      const linked = !sel || near.has(id)
      mat.opacity = !match ? 0.08 : linked ? 1 : 0.07
      mat.emissiveIntensity = isSel ? 0.75 : linked ? 0.28 : 0.1
      const base = m.userData.baseColor as THREE.Color
      mat.emissive.copy(isSel ? new THREE.Color(CYAN) : base)
      if (!isSel) m.scale.setScalar(m.userData.baseScale ?? 1)
      // Étiquettes / icônes suivent l'atténuation.
      const vis = match && linked ? 1 : 0.1
      m.children.forEach((ch) => { const cm = (ch as THREE.Sprite).material as THREE.SpriteMaterial | undefined; if (cm) cm.opacity = vis })
    }
    for (const { line, a, b } of edgeLinesRef.current) {
      const lm = line.material as THREE.LineBasicMaterial
      const baseOp = (line.userData.baseOpacity as number) ?? 0.4
      const baseCol = line.userData.baseColor as THREE.Color
      if (!sel) { lm.opacity = baseOp; if (baseCol) lm.color.copy(baseCol) }
      else {
        const conn = a.userData.id === sel || b.userData.id === sel
        lm.opacity = conn ? 0.9 : 0.03
        lm.color.copy(conn ? new THREE.Color(CYAN) : (baseCol ?? new THREE.Color(CYAN)))
      }
    }
  }, [query, selectedId])

  return (
    <div className="absolute inset-0 z-10">
      <div ref={mountRef} className="h-full w-full" style={{ cursor: 'grab' }} />

      {/* Infobulle au survol */}
      {hover && (
        <div className="pointer-events-none absolute z-30 rounded-sm border px-2 py-1"
          style={{ left: hover.x + 14, top: hover.y + 10, background: 'var(--nx-panel)', borderColor: 'var(--nx-border)', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--nx-text)', whiteSpace: 'nowrap' }}>
          <div>{hover.name}</div>
          <div style={{ fontSize: 9.5, color: 'var(--nx-text-muted)' }}>{hover.sub}</div>
        </div>
      )}

      {/* Contrôle : recentrer */}
      <div className="absolute right-4 top-4 z-20">
        <button
          onClick={() => { const c = cameraRef.current, o = orbitRef.current; if (c && o) { c.position.set(0, 70, 640); o.target.set(0, 0, 0); o.update() } }}
          title={t('Recentrer', 'Reset view')} aria-label={t('Recentrer', 'Reset view')}
          className="flex h-8 w-8 items-center justify-center rounded-sm border transition-colors hover:brightness-125"
          style={{ background: 'color-mix(in srgb, var(--nx-panel) 92%, transparent)', borderColor: 'var(--nx-border)', color: 'var(--nx-cyan-text)' }}>
          <RotateCcw size={15} />
        </button>
      </div>

      {/* Indice de navigation */}
      <div className="pointer-events-none absolute bottom-4 right-4 z-20 flex items-center gap-1.5 rounded-sm border px-2 py-1 backdrop-blur"
        style={{ background: 'color-mix(in srgb, var(--nx-panel) 92%, transparent)', borderColor: 'var(--nx-border)', fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--nx-text-muted)' }}>
        <Move3d size={12} style={{ color: CYAN }} /> {t('Glisser : orbiter · Molette : zoom · Nœud : glisser · Clic : détails', 'Drag: orbit · Wheel: zoom · Node: drag · Click: details')}
      </div>

      {/* Légende */}
      <div className="pointer-events-none absolute bottom-4 left-4 z-20 flex items-center gap-3 rounded-sm border px-2.5 py-1.5 backdrop-blur"
        style={{ background: 'color-mix(in srgb, var(--nx-panel) 92%, transparent)', borderColor: 'var(--nx-border)', fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--nx-text-muted)' }}>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: ERR }} />{t('Critique', 'Critical')}</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: '#c69a4e' }} />{t('Élevé', 'High')}</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: '#5a97a3' }} />{t('Normal', 'Normal')}</span>
      </div>
    </div>
  )
}
