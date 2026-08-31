import { createElement, useEffect, useRef, useState, type ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { DragControls } from 'three/examples/jsm/controls/DragControls.js'
import {
  AlertTriangle, AppWindow, Box, Cloud, Contact, Database, FileText, Laptop, MapPin,
  Move3d, Network, RotateCcw, Server, Trash2, Truck, Undo2, Users, User, Workflow, X,
  type LucideProps,
} from 'lucide-react'
import { useLang } from '../lib/i18n'
import { entityTypeLabel } from '../lib/labels'
import type { BlastNode } from '../lib/types'

// Palette sobre « enterprise » (Palantir/Bloomberg) : désaturée, sans néon.
const CRIT = '#d15b54'   // rouge terni (chemin critique)
const HIGH = '#c69a4e'   // ambre discret (fort impact)
const LOW = '#657781'    // ardoise (impact faible)
const ORIGIN_COLOR = '#d9524b'
const CYAN = '#00e5ff'

function depthColor(depth: number, max: number): string {
  if (depth <= 1) return CRIT
  if (depth <= Math.ceil(max / 2)) return HIGH
  return LOW
}

// Icône vectorielle (lucide) par type d'entité de l'ontologie.
type IconCmp = ComponentType<LucideProps>
const TYPE_ICON: Record<string, IconCmp> = {
  Server: Server, System: Server, Infrastructure: Server,
  Database: Database, DataStore: Database,
  Application: AppWindow, Service: AppWindow, BusinessService: AppWindow,
  CloudResource: Cloud,
  Network: Network,
  Device: Laptop,
  Supplier: Truck,
  Contract: FileText,
  Person: User, Role: Users, Team: Users,
  BusinessProcess: Workflow, Process: Workflow,
  Location: MapPin,
  Contact: Contact,
}
function iconFor(type: string): IconCmp {
  return TYPE_ICON[type] ?? Box
}

// Teintes neutres et professionnelles (aucune couleur criarde).
const ICON_TINT = '#d3dcde'
const ICON_TINT_ORIGIN = '#f4f6f6'

/** SVG d'une icône lucide → data URL (rendu statique, stroke = teinte pro). */
function iconDataUrl(Icon: IconCmp, color: string): string {
  const markup = renderToStaticMarkup(createElement(Icon, { size: 96, color, strokeWidth: 1.9 }))
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup)
}

/** Sprite texte (nom) dessiné sur un canvas — fait toujours face à la caméra. */
function makeLabelSprite(text: string, worldHeight = 13): THREE.Sprite {
  const label = text.length > 24 ? text.slice(0, 23) + '…' : text
  const font = 30
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')!
  ctx.font = `600 ${font}px "JetBrains Mono", monospace`
  const w = Math.ceil(ctx.measureText(label).width)
  const padX = 14, padY = 9
  c.width = w + padX * 2
  c.height = font + padY * 2
  const g = c.getContext('2d')!
  g.font = `500 ${font}px "JetBrains Mono", monospace`
  const rr = 7
  const inset = 1.5
  g.beginPath()
  g.moveTo(rr + inset, inset)
  g.arcTo(c.width - inset, inset, c.width - inset, c.height - inset, rr)
  g.arcTo(c.width - inset, c.height - inset, inset, c.height - inset, rr)
  g.arcTo(inset, c.height - inset, inset, inset, rr)
  g.arcTo(inset, inset, c.width - inset, inset, rr)
  g.closePath()
  g.fillStyle = 'rgba(17,19,22,0.68)'
  g.fill()
  g.lineWidth = 1.5
  g.strokeStyle = 'rgba(180,196,200,0.14)'
  g.stroke()
  g.fillStyle = '#c3cdd0'
  g.textBaseline = 'middle'
  g.fillText(label, padX, c.height / 2 + 1)
  const tex = new THREE.CanvasTexture(c)
  tex.minFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }))
  spr.scale.set(worldHeight * (c.width / c.height), worldHeight, 1)
  spr.renderOrder = 20
  return spr
}

/** Sprite icône vectorielle (lucide) — au centre de la sphère, face caméra. */
function makeIconSprite(Icon: IconCmp, worldSize: number, color = ICON_TINT): THREE.Sprite {
  const s = 128
  const c = document.createElement('canvas')
  c.width = c.height = s
  const tex = new THREE.CanvasTexture(c)
  tex.minFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }))
  spr.scale.set(worldSize, worldSize, 1)
  spr.renderOrder = 21
  // Rendu asynchrone du SVG dans le canvas, puis rafraîchissement de la texture.
  const img = new Image()
  img.onload = () => {
    const g = c.getContext('2d')!
    g.clearRect(0, 0, s, s)
    g.drawImage(img, 16, 16, s - 32, s - 32)
    tex.needsUpdate = true
  }
  img.src = iconDataUrl(Icon, color)
  return spr
}

/** Point réparti uniformément sur une sphère unité (spirale de Fibonacci). */
function fibSpherePoint(k: number, total: number): THREE.Vector3 {
  const t = Math.max(1, total)
  const offset = 2 / t
  const inc = Math.PI * (3 - Math.sqrt(5))
  const y = k * offset - 1 + offset / 2
  const r = Math.sqrt(Math.max(0, 1 - y * y))
  const phi = k * inc
  return new THREE.Vector3(Math.cos(phi) * r, y, Math.sin(phi) * r)
}

interface Selected { id: string; name: string; type: string; depth: number; criticality: number }

interface Props {
  origin: string
  affected: BlastNode[]
  maxDepth: number
  removedCount: number
  onRemove: (id: string) => void
  onRestore: () => void
}

export function Propagation3D({ origin, affected, maxDepth, removedCount, onRemove, onRestore }: Props) {
  const { t } = useLang()
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const orbitRef = useRef<OrbitControls | null>(null)
  const dragRef = useRef<DragControls | null>(null)
  const nodeMeshesRef = useRef<THREE.Mesh[]>([])
  const edgesRef = useRef<{ line: THREE.Line; mesh: THREE.Mesh }[]>([])
  const domRef = useRef<HTMLElement | null>(null)
  const onRemoveRef = useRef(onRemove)
  onRemoveRef.current = onRemove

  const [hover, setHover] = useState<{ name: string; x: number; y: number } | null>(null)
  const [selected, setSelected] = useState<Selected | null>(null)

  // ── Initialisation unique de la scène WebGL ──
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const width = mount.clientWidth || 800
    const height = mount.clientHeight || 600

    const scene = new THREE.Scene()
    sceneRef.current = scene
    const camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 4000)
    camera.position.set(0, 60, 560)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)
    domRef.current = renderer.domElement

    scene.add(new THREE.AmbientLight(0xffffff, 0.75))
    const pt = new THREE.PointLight(0xffffff, 1.4, 0, 1.6)
    pt.position.set(0, 0, 0)
    scene.add(pt)
    const rim = new THREE.PointLight(0x00e5ff, 0.6, 0, 2)
    rim.position.set(300, 200, 300)
    scene.add(rim)

    // Champ d'étoiles léger (repère de profondeur)
    const starGeo = new THREE.BufferGeometry()
    const starCount = 320
    const starPos = new Float32Array(starCount * 3)
    for (let i = 0; i < starCount; i++) {
      const v = fibSpherePoint(i, starCount).multiplyScalar(1300 + Math.random() * 500)
      starPos.set([v.x, v.y, v.z], i * 3)
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x3b494c, size: 2, sizeAttenuation: true, transparent: true, opacity: 0.6 }))
    scene.add(stars)

    const orbit = new OrbitControls(camera, renderer.domElement)
    orbit.enableDamping = true
    orbit.dampingFactor = 0.08
    orbit.rotateSpeed = 0.7
    orbit.zoomSpeed = 0.9
    orbit.minDistance = 120
    orbit.maxDistance = 1600
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
        if (hoveredMesh) hoveredMesh.scale.setScalar(1)
        hoveredMesh = mesh ?? null
        if (hoveredMesh) hoveredMesh.scale.setScalar(1.35)
        renderer.domElement.style.cursor = hoveredMesh ? 'pointer' : 'grab'
        // Sur un nœud : on coupe la rotation d'orbite pour permettre le déplacement.
        orbit.enableRotate = !hoveredMesh
      }
      if (mesh) setHover({ name: (mesh.userData.name as string) ?? '', x: px, y: py })
      else setHover(null)
    }

    // Sélection au clic (sans déplacement).
    let downPos: { x: number; y: number } | null = null
    function onPointerDown(e: PointerEvent) { downPos = { x: e.clientX, y: e.clientY } }
    function onPointerUp(e: PointerEvent) {
      if (!downPos) return
      const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y)
      downPos = null
      if (moved > 5) return // c'était un glisser (orbite/déplacement)
      updatePointer(e)
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects(nodeMeshesRef.current, false)
      const mesh = hits[0]?.object as THREE.Mesh | undefined
      if (mesh) {
        const u = mesh.userData
        setSelected({ id: u.id as string, name: u.name as string, type: u.type as string, depth: u.depth as number, criticality: u.criticality as number })
      } else {
        setSelected(null)
      }
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
      stars.rotation.y = el * 0.01
      // Pulsation de l'origine + mise à jour des arêtes (nœuds déplaçables).
      const originMesh = scene.getObjectByName('origin') as THREE.Mesh | null
      if (originMesh) originMesh.scale.setScalar(1 + Math.sin(el * 2) * 0.06)
      for (const { line, mesh } of edgesRef.current) {
        const pos = line.geometry.attributes.position as THREE.BufferAttribute
        pos.setXYZ(1, mesh.position.x, mesh.position.y, mesh.position.z)
        pos.needsUpdate = true
      }
      renderer.render(scene, camera)
    }
    animate()

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth, h = mount.clientHeight
      if (!w || !h) return
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    })
    ro.observe(mount)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      dragRef.current?.dispose()
      orbit.dispose()
      renderer.dispose()
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
        const mat = (m as THREE.Mesh).material
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
        else if (mat) (mat as THREE.Material).dispose()
      })
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
  }, [])

  // ── (Re)construction du graphe 3D quand les données changent ──
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    function build() {
      // Purge de l'ancien graphe.
      const old = scene!.getObjectByName('graph')
      if (old) {
        old.traverse((o) => {
          const m = o as THREE.Mesh
          if (m.geometry) m.geometry.dispose()
          const mat = (m as THREE.Mesh).material
          const mats = Array.isArray(mat) ? mat : mat ? [mat] : []
          mats.forEach((x) => {
            const map = (x as THREE.SpriteMaterial).map
            if (map) map.dispose()
            x.dispose()
          })
        })
        scene!.remove(old)
      }
      const group = new THREE.Group()
      group.name = 'graph'
      const meshes: THREE.Mesh[] = []
      const edges: { line: THREE.Line; mesh: THREE.Mesh }[] = []

      // Origine au centre.
      const originMesh = new THREE.Mesh(
        new THREE.SphereGeometry(20, 32, 32),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(ORIGIN_COLOR), emissive: new THREE.Color(ORIGIN_COLOR), emissiveIntensity: 0.5, roughness: 0.5, metalness: 0.15 }),
      )
      originMesh.name = 'origin'
      group.add(originMesh)
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(29, 24, 24),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(ORIGIN_COLOR), transparent: true, opacity: 0.07, side: THREE.BackSide }),
      )
      originMesh.add(halo)
      originMesh.add(makeIconSprite(AlertTriangle, 24, ICON_TINT_ORIGIN))
      const originLabel = makeLabelSprite(origin, 15)
      originLabel.position.set(0, -34, 0)
      originMesh.add(originLabel)

      // Coquilles sphériques par profondeur.
      const byDepth = new Map<number, BlastNode[]>()
      for (const a of affected) {
        const arr = byDepth.get(a.depth) ?? []
        arr.push(a); byDepth.set(a.depth, arr)
      }
      for (const [depth, list] of byDepth) {
        const shell = 100 + depth * 85
        list.forEach((a, k) => {
          const dir = fibSpherePoint(k, list.length)
          const pos = dir.clone().multiplyScalar(shell)
          const col = new THREE.Color(depthColor(a.depth, maxDepth))
          const r = 5 + (a.entity.criticality / 100) * 7
          const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(r, 24, 24),
            new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.3, roughness: 0.55, metalness: 0.15 }),
          )
          mesh.position.copy(pos)
          mesh.userData = { id: a.entity.id, name: a.entity.name, type: a.entity.entityType, depth: a.depth, criticality: a.entity.criticality }
          // Halo discret du nœud.
          const g = new THREE.Mesh(
            new THREE.SphereGeometry(r * 1.45, 16, 16),
            new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.07, side: THREE.BackSide }),
          )
          mesh.add(g)
          // Icône du type au centre + nom sous la sphère (enfants → suivent le nœud).
          mesh.add(makeIconSprite(iconFor(a.entity.entityType), r * 1.5))
          const label = makeLabelSprite(a.entity.name)
          label.position.set(0, -(r + 11), 0)
          mesh.add(label)
          group.add(mesh)
          meshes.push(mesh)

          // Arête origine → nœud.
          const lgeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), pos.clone()])
          const line = new THREE.Line(lgeo, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: a.depth <= 1 ? 0.55 : 0.28 }))
          group.add(line)
          edges.push({ line, mesh })
        })
      }

      scene!.add(group)
      nodeMeshesRef.current = meshes
      edgesRef.current = edges

      // Déplacement des nœuds (glisser) — désactive la rotation d'orbite pendant le drag.
      dragRef.current?.dispose()
      if (domRef.current && cameraRef.current) {
        const dc = new DragControls(meshes, cameraRef.current, domRef.current)
        dc.addEventListener('dragstart', () => { if (orbitRef.current) orbitRef.current.enableRotate = false })
        dc.addEventListener('dragend', () => { if (orbitRef.current) orbitRef.current.enableRotate = true })
        dragRef.current = dc
      }
    }

    build()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [affected, maxDepth])

  return (
    <div className="absolute inset-0 z-10">
      <div ref={mountRef} className="h-full w-full" style={{ cursor: 'grab' }} />

      {/* Badge d'origine */}
      <div className="pointer-events-none absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-2 rounded-sm border px-3 py-1 backdrop-blur"
        style={{ background: 'color-mix(in srgb, var(--nx-panel) 92%, transparent)', borderColor: 'var(--nx-border)', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--nx-text)' }}>
        <span className="h-2 w-2 rounded-full" style={{ background: ORIGIN_COLOR }} />
        {t('Origine', 'Origin')} : {origin}
      </div>

      {/* Infobulle au survol */}
      {hover && (
        <div className="pointer-events-none absolute z-30 rounded-sm border px-2 py-1"
          style={{ left: hover.x + 14, top: hover.y + 10, background: 'var(--nx-panel)', borderColor: 'var(--nx-border)', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--nx-text)', whiteSpace: 'nowrap' }}>
          {hover.name}
        </div>
      )}

      {/* Carte de l'élément sélectionné + action « Retirer » */}
      {selected && (
        <div className="absolute left-4 top-4 z-30 w-64 rounded-sm border p-3 backdrop-blur"
          style={{ background: 'color-mix(in srgb, var(--nx-panel) 92%, transparent)', borderColor: 'var(--nx-border)' }}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div style={{ fontFamily: 'var(--font-geist)', fontSize: 14, color: 'var(--nx-text)' }}>{selected.name}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--nx-text-muted)' }}>{entityTypeLabel(selected.type, t)} · {t('profondeur', 'depth')} {selected.depth} · c{selected.criticality}</div>
            </div>
            <button onClick={() => setSelected(null)} style={{ color: 'var(--nx-text-muted)' }}><X size={14} /></button>
          </div>
          <button
            onClick={() => { onRemoveRef.current(selected.id); setSelected(null) }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-sm py-2 transition-colors hover:brightness-110"
            style={{ background: 'rgba(209,91,84,0.12)', border: `1px solid ${CRIT}`, color: '#e0938d', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            <Trash2 size={13} /> {t('Retirer de la simulation', 'Remove from simulation')}
          </button>
        </div>
      )}

      {/* Contrôles */}
      <div className="absolute right-4 top-4 z-20 flex flex-col gap-1">
        <NavBtn onClick={() => { const c = cameraRef.current, o = orbitRef.current; if (c && o) { c.position.set(0, 60, 560); o.target.set(0, 0, 0); o.update() } }} title={t('Recentrer', 'Reset view')}><RotateCcw size={15} /></NavBtn>
        {removedCount > 0 && <NavBtn onClick={onRestore} title={t('Tout restaurer', 'Restore all')}><Undo2 size={15} /></NavBtn>}
      </div>

      {/* Indice de navigation */}
      <div className="pointer-events-none absolute bottom-4 right-4 z-20 flex items-center gap-1.5 rounded-sm border px-2 py-1 backdrop-blur"
        style={{ background: 'color-mix(in srgb, var(--nx-panel) 92%, transparent)', borderColor: 'var(--nx-border)', fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--nx-text-muted)' }}>
        <Move3d size={12} style={{ color: CYAN }} /> {t('Glisser : orbiter · Molette : zoom · Nœud : glisser/déplacer · Clic : sélectionner', 'Drag: orbit · Wheel: zoom · Node: drag to move · Click: select')}
      </div>

      {removedCount > 0 && (
        <div className="absolute bottom-4 left-4 z-20 rounded-sm border px-2 py-1"
          style={{ background: 'rgba(209,91,84,0.1)', borderColor: CRIT, fontFamily: 'var(--font-mono)', fontSize: 10, color: '#e0938d' }}>
          {removedCount} {t('retiré(s) — impact recalculé', 'removed — impact recomputed')}
        </div>
      )}
    </div>
  )
}

function NavBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title} aria-label={title}
      className="flex h-8 w-8 items-center justify-center rounded-sm border transition-colors hover:brightness-125"
      style={{ background: 'color-mix(in srgb, var(--nx-panel) 92%, transparent)', borderColor: 'var(--nx-border)', color: 'var(--nx-cyan-text)' }}>
      {children}
    </button>
  )
}
