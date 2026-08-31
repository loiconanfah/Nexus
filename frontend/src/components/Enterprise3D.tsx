import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  AppWindow, Box, Building2, Contact, FolderKanban, Layers, MapPin, Move3d, Package, RotateCcw, Truck, Users,
} from 'lucide-react'
import { fibSpherePoint, makeIconSprite, makeLabelSprite, disposeObject, type IconCmp } from '../lib/holoThree'
import { useLang } from '../lib/i18n'

const CYAN = '#00e5ff'
const VIOLET = '#8b7fc0'
function marginColor(m: number): string {
  return m >= 0.12 ? '#3fb27f' : m >= 0.08 ? '#c69a4e' : '#d15b54'
}
const ELEMENT_ICON: Record<string, IconCmp> = {
  Service: AppWindow, Produit: Package, Département: Building2, Équipe: Users,
  Client: Contact, Fournisseur: Truck, Projet: FolderKanban, Site: MapPin,
}
function elementIcon(type: string): IconCmp { return ELEMENT_ICON[type] ?? Box }

export interface HoloDivision { name: string; revenue: number; margin: number; employees: number }
export interface HoloSegment { name: string; revenue: number; share: number; customers: number }
export interface HoloElement { id: string; name: string; type: string; revenue: number; cost: number; headcount: number }
export interface HoloRelation { id: string; from: string; to: string }

interface Props {
  companyName: string
  companyRevenue: number
  divisions: HoloDivision[]
  segments: HoloSegment[]
  elements: HoloElement[]
  relations: HoloRelation[]
  selectedId?: string | null
  relFrom?: string | null
  onSelect?: (id: string) => void
}
interface Hover { name: string; sub: string; x: number; y: number }

export function Enterprise3D({ companyName, companyRevenue, divisions, segments, elements, relations, selectedId, relFrom, onSelect }: Props) {
  const { t, lang } = useLang()
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const orbitRef = useRef<OrbitControls | null>(null)
  const pickRef = useRef<THREE.Object3D[]>([])
  const onSelectRef = useRef(onSelect); onSelectRef.current = onSelect
  const [hover, setHover] = useState<Hover | null>(null)

  const nf = new Intl.NumberFormat(lang === 'fr' ? 'fr-CA' : 'en-CA')
  const money = (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)} M$` : `${(v / 1e3).toFixed(0)} k$`)

  // Init unique.
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const w = mount.clientWidth || 800, h = mount.clientHeight || 600
    const scene = new THREE.Scene(); sceneRef.current = scene
    const camera = new THREE.PerspectiveCamera(52, w / h, 0.1, 5000); camera.position.set(0, 90, 640); cameraRef.current = camera
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(w, h); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xffffff, 0.8))
    scene.add(new THREE.PointLight(0xffffff, 1.3, 0, 1.6))
    const rim = new THREE.PointLight(0x00e5ff, 0.5, 0, 2); rim.position.set(280, 200, 280); scene.add(rim)

    const starGeo = new THREE.BufferGeometry()
    const sp = new Float32Array(280 * 3)
    for (let i = 0; i < 280; i++) { const v = fibSpherePoint(i, 280).multiplyScalar(1600 + Math.random() * 500); sp.set([v.x, v.y, v.z], i * 3) }
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3))
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x3b494c, size: 2, transparent: true, opacity: 0.5 }))
    scene.add(stars)

    const orbit = new OrbitControls(camera, renderer.domElement)
    orbit.enableDamping = true; orbit.dampingFactor = 0.08; orbit.rotateSpeed = 0.7
    orbit.minDistance = 160; orbit.maxDistance = 2000; orbitRef.current = orbit

    const ray = new THREE.Raycaster(); const ptr = new THREE.Vector2(); let hot: THREE.Object3D | null = null
    function setPtr(e: PointerEvent) { const r = renderer.domElement.getBoundingClientRect(); ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1; ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1; return r }
    function onMove(e: PointerEvent) {
      const r = setPtr(e)
      ray.setFromCamera(ptr, camera)
      const hit = ray.intersectObjects(pickRef.current, false)[0]?.object
      if (hit !== hot) {
        if (hot) (hot.userData.visual as THREE.Mesh | undefined)?.scale.setScalar(1)
        hot = hit ?? null
        if (hot) (hot.userData.visual as THREE.Mesh | undefined)?.scale.setScalar(1.3)
        renderer.domElement.style.cursor = hot ? 'pointer' : 'grab'
      }
      if (hit) setHover({ name: hit.userData.name as string, sub: hit.userData.sub as string, x: e.clientX - r.left, y: e.clientY - r.top })
      else setHover(null)
    }
    let down: { x: number; y: number } | null = null
    function onDown(e: PointerEvent) { down = { x: e.clientX, y: e.clientY } }
    function onUp(e: PointerEvent) {
      if (!down) return
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null
      if (moved > 5) return
      setPtr(e); ray.setFromCamera(ptr, camera)
      const hit = ray.intersectObjects(pickRef.current, false)[0]?.object
      if (hit && onSelectRef.current) onSelectRef.current(hit.userData.id as string)
    }
    renderer.domElement.addEventListener('pointermove', onMove)
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointerup', onUp)

    let raf = 0; const clock = new THREE.Clock()
    function animate() {
      raf = requestAnimationFrame(animate)
      const el = clock.getElapsedTime()
      orbit.update(); stars.rotation.y = el * 0.008
      const c = scene.getObjectByName('company') as THREE.Mesh | null
      if (c) c.scale.setScalar(1 + Math.sin(el * 1.6) * 0.05)
      scene.traverse((o) => { if (o.userData.pulse) o.scale.setScalar(1 + Math.sin(el * 3) * 0.12) })
      renderer.render(scene, camera)
    }
    animate()

    const ro = new ResizeObserver(() => { const W = mount.clientWidth, H = mount.clientHeight; if (W && H) { camera.aspect = W / H; camera.updateProjectionMatrix(); renderer.setSize(W, H) } })
    ro.observe(mount)
    return () => {
      cancelAnimationFrame(raf); ro.disconnect()
      renderer.domElement.removeEventListener('pointermove', onMove)
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointerup', onUp)
      orbit.dispose(); renderer.dispose(); disposeObject(scene)
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
  }, [])

  // (Re)construction à chaque changement de données/sélection.
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    const old = scene.getObjectByName('holo'); if (old) { disposeObject(old); scene.remove(old) }
    const group = new THREE.Group(); group.name = 'holo'
    const picks: THREE.Object3D[] = []
    const posById = new Map<string, THREE.Vector3>()

    function node(id: string, pos: THREE.Vector3, radius: number, color: string, name: string, sub: string, Icon: IconCmp, opts?: { pulse?: boolean; iconColor?: string; edgeToCompany?: boolean }) {
      const col = new THREE.Color(color)
      const selected = selectedId === id || relFrom === id
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 24),
        new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: opts?.pulse ? 0.5 : 0.3, roughness: 0.55, metalness: 0.15 }))
      mesh.position.copy(pos); mesh.userData = { id, name, sub, pulse: opts?.pulse }
      const halo = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.45, 16, 16), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: opts?.pulse ? 0.14 : 0.07, side: THREE.BackSide }))
      mesh.add(halo)
      if (selected) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(radius + 5, 0.8, 8, 40), new THREE.MeshBasicMaterial({ color: relFrom === id ? 0xffffff : 0x00e5ff }))
        ring.rotation.x = Math.PI / 2; mesh.add(ring)
      }
      mesh.add(makeIconSprite(Icon, radius * 1.5, opts?.iconColor ?? '#eef3f4'))
      const label = makeLabelSprite(name); label.position.set(0, -(radius + 12), 0); mesh.add(label)
      group.add(mesh)
      // Cible de clic/survol invisible et plus large (tolérance).
      const hit = new THREE.Mesh(new THREE.SphereGeometry(radius * 2.4, 12, 12), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, depthTest: false }))
      hit.position.copy(pos); hit.userData = { id, name, sub, visual: mesh }
      group.add(hit); picks.push(hit); posById.set(id, pos.clone())
      if (opts?.edgeToCompany !== false) {
        const lgeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), pos.clone()])
        group.add(new THREE.Line(lgeo, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: opts?.pulse ? 0.45 : 0.22 })))
      }
      return mesh
    }

    // Entreprise (centre)
    const company = new THREE.Mesh(new THREE.SphereGeometry(24, 32, 32), new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00b8cc, emissiveIntensity: 0.55, roughness: 0.4, metalness: 0.2 }))
    company.name = 'company'; company.userData = { id: 'company', name: companyName, sub: money(companyRevenue) }
    company.add(new THREE.Mesh(new THREE.SphereGeometry(34, 24, 24), new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.08, side: THREE.BackSide })))
    company.add(makeIconSprite(Building2, 26, '#ffffff'))
    const cl = makeLabelSprite(companyName, 16); cl.position.set(0, -40, 0); company.add(cl)
    group.add(company)
    const companyHit = new THREE.Mesh(new THREE.SphereGeometry(50, 12, 12), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, depthTest: false }))
    companyHit.userData = { id: 'company', name: companyName, sub: money(companyRevenue), visual: company }
    group.add(companyHit); picks.push(companyHit); posById.set('company', new THREE.Vector3(0, 0, 0))

    const maxDivRev = Math.max(1, ...divisions.map((d) => d.revenue))
    divisions.forEach((d, i) => {
      const a = (i / Math.max(1, divisions.length)) * Math.PI * 2
      const pos = new THREE.Vector3(Math.cos(a) * 220, 60, Math.sin(a) * 220)
      const r = 8 + (d.revenue / maxDivRev) * 12
      node(`div:${i}`, pos, r, marginColor(d.margin), d.name, `${money(d.revenue)} · ${(d.margin * 100).toFixed(0)}% · ${nf.format(d.employees)} ${t('empl.', 'staff')}`, Layers)
    })

    const maxSegRev = Math.max(1, ...segments.map((s) => s.revenue))
    segments.forEach((s, i) => {
      const a = (i / Math.max(1, segments.length)) * Math.PI * 2 + 0.4
      const pos = new THREE.Vector3(Math.cos(a) * 220, -60, Math.sin(a) * 220)
      const r = 8 + (s.revenue / maxSegRev) * 12
      node(`seg:${i}`, pos, r, VIOLET, s.name, `${money(s.revenue)} · ${(s.share * 100).toFixed(0)}% · ${nf.format(s.customers)} ${t('clients', 'clients')}`, Contact)
    })

    // Éléments personnalisés (ajoutés à la main ou par décision) — anneau interne cyan.
    elements.forEach((e, i) => {
      const a = (i / Math.max(1, elements.length)) * Math.PI * 2 + 0.9
      const pos = new THREE.Vector3(Math.cos(a) * 130, 0, Math.sin(a) * 130)
      node(`el:${e.id}`, pos, 12, CYAN, e.name, `${e.type} · ${money(e.revenue)} · ${nf.format(e.headcount)} ${t('empl.', 'staff')}`, elementIcon(e.type), { pulse: true, iconColor: '#ffffff' })
    })

    // Relations personnalisées (entre nœuds quelconques).
    relations.forEach((rel) => {
      const a = posById.get(rel.from), b = posById.get(rel.to)
      if (!a || !b) return
      const lgeo = new THREE.BufferGeometry().setFromPoints([a, b])
      group.add(new THREE.Line(lgeo, new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.55 })))
    })

    scene.add(group); pickRef.current = picks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyName, companyRevenue, divisions, segments, elements, relations, selectedId, relFrom, lang])

  return (
    <div className="absolute inset-0">
      <div ref={mountRef} className="h-full w-full" style={{ cursor: 'grab' }} />
      {hover && (
        <div className="pointer-events-none absolute z-30 rounded-sm border px-2 py-1" style={{ left: hover.x + 14, top: hover.y + 10, background: 'var(--nx-panel)', borderColor: 'var(--nx-border)', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--nx-text)', whiteSpace: 'nowrap' }}>
          <div style={{ fontWeight: 700 }}>{hover.name}</div>
          <div style={{ color: 'var(--nx-text-muted)', fontSize: 10 }}>{hover.sub}</div>
        </div>
      )}
      <button onClick={() => { const c = cameraRef.current, o = orbitRef.current; if (c && o) { c.position.set(0, 90, 640); o.target.set(0, 0, 0); o.update() } }} title={t('Recentrer', 'Reset view')}
        className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-sm border transition-colors hover:brightness-125" style={{ background: 'color-mix(in srgb, var(--nx-panel) 92%, transparent)', borderColor: 'var(--nx-border)', color: 'var(--nx-cyan-text)' }}>
        <RotateCcw size={15} />
      </button>
      <div className="pointer-events-none absolute bottom-3 right-3 z-20 flex items-center gap-1.5 rounded-sm border px-2 py-1 backdrop-blur" style={{ background: 'color-mix(in srgb, var(--nx-panel) 92%, transparent)', borderColor: 'var(--nx-border)', fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--nx-text-muted)' }}>
        <Move3d size={12} style={{ color: CYAN }} /> {t('Glisser : orbiter · Molette : zoom · Clic : sélectionner', 'Drag: orbit · Wheel: zoom · Click: select')}
      </div>
    </div>
  )
}
