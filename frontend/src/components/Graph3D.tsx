import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { DragControls } from 'three/examples/jsm/controls/DragControls.js'
import {
  AppWindow, Box, Database, Laptop, MapPin, Move3d, Network, RotateCcw, Server, Truck,
  User, Users, Workflow, FileText, BrainCircuit, Bot, Cpu, Cloud,
} from 'lucide-react'
import {
  fibSpherePoint, makeIconSprite, makeLabelSprite, makeMarkSprite, makeInitialsSprite,
  disposeObject, type IconCmp,
} from '../lib/holoThree'
import { brandFor, familyColor, inkOn } from '../lib/assetLook'
import { clusteredLayout } from '../lib/graphLayout3d'
import { useLang } from '../lib/i18n'
import { entityTypeLabel } from '../lib/labels'
import type { GraphEntityRecord } from '../lib/types'
import { useMoney } from '../lib/money'
import { useTheme } from '../lib/theme'

const CYAN = '#00e5ff'

/**
 * Distance de caméra qui fait tenir toute la sphère dans le cadre.
 *
 * La caméra était placée à une distance FIXE (z = 640) alors que le rayon du
 * nuage croît avec le parc : à 119 actifs il atteint 618, et l'on arrivait donc
 * le nez dans le graphe, sans jamais voir l'ensemble. On résout la distance à
 * partir du champ de vision, avec une marge pour les étiquettes.
 */
const LAYOUT_RADIUS = (total: number) => 160 + Math.sqrt(Math.max(1, total)) * 42

/** Points d'une arete courbe : une droite qui traverse la pile se suit mal. */
const EDGE_SEGMENTS = 14

/**
 * Une arete bombee vers l'exterieur.
 *
 * Deux noeuds du MEME etage reliees en ligne droite tracent une corde qui coupe
 * le disque de part en part : dix aretes de ce genre et l'etage devient une
 * pelote. Le bombement est proportionnel a l'horizontalite du lien, si bien
 * qu'une dependance qui descend reste presque droite, donc lisible comme une
 * chute, et qu'un lien lateral contourne le disque.
 */
function edgeCurve(a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3[] {
  const length = a.distanceTo(b)
  const horizontal = length < 1 ? 0 : 1 - Math.abs(b.y - a.y) / length
  const mid = a.clone().add(b).multiplyScalar(0.5)
  const outward = new THREE.Vector3(mid.x, 0, mid.z)
  if (outward.lengthSq() < 1) outward.set(1, 0, 0)
  outward.normalize()

  const bow = horizontal * length * 0.22
  const control = mid.clone().addScaledVector(outward, bow).add(new THREE.Vector3(0, bow * 0.35, 0))
  return new THREE.QuadraticBezierCurve3(a.clone(), control, b.clone()).getPoints(EDGE_SEGMENTS)
}

/** Reecrit en place les points d'une arete courbe. */
function writeCurve(line: THREE.Line, a: THREE.Vector3, b: THREE.Vector3) {
  const attribute = line.geometry.attributes.position as THREE.BufferAttribute
  const points = edgeCurve(a, b)
  for (let i = 0; i < points.length && i < attribute.count; i++) {
    attribute.setXYZ(i, points[i].x, points[i].y, points[i].z)
  }
  attribute.needsUpdate = true
}

function frameDistance(total: number, fovDeg = 52): number {
  const r = LAYOUT_RADIUS(total)
  const halfFov = (fovDeg * Math.PI) / 180 / 2
  return (r / Math.tan(halfFov)) * 1.32
}

/**
 * Le recul necessaire pour voir tout l'amas.
 *
 * Legerement en hauteur et de trois quarts : de face, les grappes du fond se
 * cachent derriere celles de devant, et l'on croit le graphe plus petit qu'il
 * n'est.
 */
function frameBall(radius: number, fovDeg = 52): { x: number; y: number; z: number } {
  const halfFov = (fovDeg * Math.PI) / 180 / 2
  const distance = (radius / Math.tan(halfFov)) * 1.08
  return { x: distance * 0.28, y: radius * 0.42, z: distance * 0.94 }
}

/**
 * La couleur du HALO, qui dit la criticite.
 *
 * La criticite ne colore plus la bille elle-meme : quand les trois quarts du
 * parc sont critiques, on obtenait un mur rouge ou plus rien ne se distinguait.
 * Elle passe dans l'aureole, dont l'intensite suit le score : le risque se voit
 * toujours, mais il n'ecrase plus l'identite de chaque element.
 */
function bandColor(crit: number, light = false): string {
  if (crit >= 80) return light ? '#b3372f' : '#ff5d52'
  if (crit >= 60) return light ? '#9a6a12' : '#ffb340'
  if (crit >= 40) return light ? '#b35a12' : '#ff9450'
  return light ? '#2d6f7d' : '#5ad0e0'
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
  // Couche IA
  AiModel: BrainCircuit, AiService: BrainCircuit, ModelEndpoint: Cpu,
  AiAgent: Bot, AiWorkflow: Workflow, AiProvider: Cloud, Dataset: Database,
}
function iconFor(type: string): IconCmp { return TYPE_ICON[type] ?? Box }

/** Les objets d'eclairage dont le theme change le reglage. */
interface Themed {
  ambient: THREE.AmbientLight
  pt: THREE.PointLight
  rim: THREE.PointLight
  key: THREE.DirectionalLight
  fill: THREE.DirectionalLight
  starMaterial: THREE.PointsMaterial
}

/** Allume le jeu de lumieres du theme courant. */
function applyTheme(themed: Themed, light: boolean) {
  themed.ambient.intensity = light ? 0.62 : 0.78
  themed.pt.intensity = light ? 0.5 : 1.3
  themed.rim.visible = !light
  themed.key.visible = light
  themed.fill.visible = light
  themed.starMaterial.color.set(light ? 0xc3ced3 : 0x3b494c)
  themed.starMaterial.opacity = light ? 0.25 : 0.55
}

/** Assouplissement : depart vif, arrivee posee. */
function easeOut(p: number) {
  return 1 - Math.pow(1 - p, 3)
}

/** Une arête et ses deux extrémités, avec la dernière position connue. */
interface EdgeLink {
  line: THREE.Line
  a: THREE.Mesh
  b: THREE.Mesh
  lastA?: THREE.Vector3
  lastB?: THREE.Vector3
}

function setSpriteOpacity(mesh: THREE.Mesh, o: number) {
  mesh.children.forEach((ch) => { const cm = (ch as THREE.Sprite).material as THREE.SpriteMaterial | undefined; if (cm) cm.opacity = o })
}

const WAVE_DELAY = 0.32 // secondes par saut de profondeur

/** Peint une image de l'onde de cascade : origine → dépendants par profondeur, survivants atténués. */
function renderSimFrame(
  s: SimState,
  meshes: THREE.Mesh[],
  edges: EdgeLink[],
) {
  const tt = (performance.now() - s.startAt) / 1000
  for (const m of meshes) {
    const mat = m.material as THREE.MeshStandardMaterial
    const id = m.userData.id as string
    const baseScale = (m.userData.baseScale as number) ?? 1
    if (id === s.originId) {
      const pulse = 1 + Math.sin(tt * 10) * 0.12
      if (s.style === 'dissolve') {
        const shrink = Math.max(0.12, 1 - tt * 0.5)
        m.scale.setScalar(baseScale * shrink)
        mat.opacity = Math.max(0.12, 1 - tt * 0.4)
      } else {
        m.scale.setScalar(baseScale * 1.45 * pulse)
        mat.opacity = 1
      }
      mat.color.copy(s.originColor); mat.emissive.copy(s.originColor)
      mat.emissiveIntensity = 0.95 + (s.style === 'flicker' ? 0.4 * Math.sin(tt * 24) : 0)
      setSpriteOpacity(m, 1)
      continue
    }
    const d = s.affected.get(id)
    if (d !== undefined) {
      const localT = tt - d * WAVE_DELAY
      if (localT >= 0) {
        const flash = Math.max(0, 1 - localT * 1.6)
        const mix = Math.min(1, d / Math.max(1, s.maxDepth))
        const col = s.waveHot.clone().lerp(s.waveCold, mix)
        mat.color.copy(col); mat.emissive.copy(col)
        const errFlicker = s.style === 'flicker' ? 0.3 + 0.3 * Math.sin(tt * 20 + d) : 0
        mat.emissiveIntensity = 0.4 + flash * 0.8 + errFlicker
        mat.opacity = s.style === 'dissolve' ? 0.55 : 1
        m.scale.setScalar(baseScale * (1 + flash * 0.4))
        setSpriteOpacity(m, 1)
      } else {
        mat.emissiveIntensity = 0.12; mat.opacity = 0.18; m.scale.setScalar(baseScale)
        setSpriteOpacity(m, 0.15)
      }
    } else {
      mat.emissiveIntensity = 0.08; mat.opacity = 0.1; m.scale.setScalar(baseScale)
      setSpriteOpacity(m, 0.08)
    }
  }
  for (const { line, a, b } of edges) {
    const lm = line.material as THREE.LineBasicMaterial
    const ai = a.userData.id as string, bi = b.userData.id as string
    const aAff = ai === s.originId || s.affected.has(ai)
    const bAff = bi === s.originId || s.affected.has(bi)
    if (aAff && bAff) {
      const dA = ai === s.originId ? 0 : (s.affected.get(ai) ?? 0)
      const dB = bi === s.originId ? 0 : (s.affected.get(bi) ?? 0)
      const reach = Math.max(dA, dB)
      const on = tt >= reach * WAVE_DELAY
      if (!on) { lm.opacity = 0.05; continue }
      // Lien DIRECT (origine → dépendant immédiat) : vif et plein.
      // Lien INDIRECT (cascade plus profonde) : couleur froide, atténué (distinct).
      const direct = reach <= 1
      lm.color.copy(direct ? s.edgeColor : s.waveCold)
      lm.opacity = direct ? 0.98 : 0.34
    } else {
      lm.opacity = 0.03
    }
  }
}

export interface Graph3DEdge { id: string; source: string; target: string; type?: string; status?: string; confidence?: number; sourceSystem?: string | null }

export type SimAction =
  | 'fail' | 'error' | 'remove' | 'cyber' | 'power'
  | 'network' | 'data' | 'supplier' | 'cloud' | 'employee'
  | 'model-down' | 'model-wrong' | 'ai-provider' | 'agent-rogue'
/** Cascade de simulation à animer : origine + dépendants affectés (id→profondeur). */
export interface SimCascade { originId: string; affected: Record<string, number>; action: SimAction; nonce: number }

type SimStyle = 'wave' | 'flicker' | 'dissolve'

interface SimState {
  originId: string
  affected: Map<string, number>
  style: SimStyle
  maxDepth: number
  startAt: number
  active: boolean
  originColor: THREE.Color
  waveHot: THREE.Color
  waveCold: THREE.Color
  edgeColor: THREE.Color
}

// Chaque action = un style d'animation + une palette (déterministe, purement visuel).
const SIM_CONFIG: Record<SimAction, { style: SimStyle; origin: string; hot: string; cold: string; edge: string }> = {
  fail: { style: 'wave', origin: '#ff2d2d', hot: '#ff5a3c', cold: '#e0a44e', edge: '#ff6b4a' },
  error: { style: 'flicker', origin: '#f5c542', hot: '#ffd24a', cold: '#f59e0b', edge: '#ffcf5a' },
  remove: { style: 'dissolve', origin: '#7a8790', hot: '#9aa7b0', cold: '#5f6b73', edge: '#8892a0' },
  cyber: { style: 'flicker', origin: '#ff2d6b', hot: '#ff4d8d', cold: '#b3245a', edge: '#ff5a9e' },
  power: { style: 'wave', origin: '#ff8a3c', hot: '#ffb03c', cold: '#c96a1e', edge: '#ffa24a' },
  network: { style: 'wave', origin: '#3ca0ff', hot: '#4ab8ff', cold: '#2a6fb3', edge: '#5ab0ff' },
  data: { style: 'dissolve', origin: '#a26bff', hot: '#b98aff', cold: '#6f4ab3', edge: '#b07aff' },
  supplier: { style: 'wave', origin: '#d98c3c', hot: '#e0a44e', cold: '#9a6a2e', edge: '#e0994a' },
  cloud: { style: 'wave', origin: '#2fd0c0', hot: '#4ae0d0', cold: '#1e9a90', edge: '#3fd6c6' },
  employee: { style: 'flicker', origin: '#ff6bb0', hot: '#ff8ac6', cold: '#b3457e', edge: '#ff7ab8' },
  // Couche IA
  'model-down': { style: 'wave', origin: '#a26bff', hot: '#b98aff', cold: '#6f4ab3', edge: '#b07aff' },
  'model-wrong': { style: 'flicker', origin: '#f5a742', hot: '#ffce6a', cold: '#c97a1e', edge: '#ffb84a' },
  'ai-provider': { style: 'flicker', origin: '#ff2d6b', hot: '#ff4d8d', cold: '#b3245a', edge: '#ff5a9e' },
  'agent-rogue': { style: 'flicker', origin: '#c026d3', hot: '#e05ae0', cold: '#8a1fb3', edge: '#d84ae0' },
}

interface Props {
  nodes: GraphEntityRecord[]
  edges: Graph3DEdge[]
  query?: string
  selectedId?: string | null
  onSelect?: (id: string) => void
  sim?: SimCascade | null
  /** Impact € par nœud (affiché dans l'infobulle pendant une simulation). */
  impactById?: Record<string, number>
}

interface Hover { name: string; sub: string; x: number; y: number }

export function Graph3D({ nodes, edges, query, selectedId, onSelect, sim, impactById }: Props) {
  const { t } = useLang()
  const mountRef = useRef<HTMLDivElement>(null)
  const simRef = useRef<SimState | null>(null)
  const light = useTheme().theme !== 'dark'
  // Les familles réellement présentes, les plus nombreuses d'abord : c'est ce
  // que la légende doit nommer, et rien d'autre.
  const families = useMemo(() => {
    const count = new Map<string, number>()
    for (const n of nodes) count.set(n.entityType, (count.get(n.entityType) ?? 0) + 1)
    return [...count.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([type, total]) => ({ type, total }))
  }, [nodes])
  // Lu par la scene, montee une seule fois : la bascule de theme passe par son
  // propre effet, pas par une reconstruction.
  const lightRef = useRef(light); lightRef.current = light
  const impactRef = useRef<Record<string, number>>({}); impactRef.current = impactById ?? {}
  const money = useMoney()
  const moneyRef = useRef(money); moneyRef.current = money
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const orbitRef = useRef<OrbitControls | null>(null)
  const dragRef = useRef<DragControls | null>(null)
  /** Instant de depart de l'apparition, null une fois qu'elle est finie. */
  const introRef = useRef<number | null>(null)
  const themedRef = useRef<Themed | null>(null)
  /** Dernier geste de l'utilisateur : la rotation lente ne reprend qu'apres. */
  const lastTouchRef = useRef(performance.now())
  const domRef = useRef<HTMLElement | null>(null)
  const nodeMeshesRef = useRef<THREE.Mesh[]>([])
  /** Le cadrage initial n'a lieu qu'une fois : ensuite la caméra est à l'utilisateur. */
  const framedRef = useRef(false)
  /** Le cadrage calculé à la dernière construction, pour le bouton « recentrer ». */
  const frameRef = useRef<{ x: number; y: number; z: number } | null>(null)
  const edgeLinesRef = useRef<EdgeLink[]>([])
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

    // Sur fond noir, une lumiere centrale et un liseré cyan font l'hologramme.
    // Sur fond blanc, la meme recette aplatit tout : il faut une vraie lumiere
    // directionnelle pour que la bille redevienne une sphere. Les deux jeux sont
    // montes une fois pour toutes, et le theme n'en allume qu'un : changer de
    // theme ne doit pas obliger a reconstruire la scene.
    const ambient = new THREE.AmbientLight(0xffffff, 0.78); scene.add(ambient)
    const pt = new THREE.PointLight(0xffffff, 1.3, 0, 1.6); pt.position.set(0, 0, 0); scene.add(pt)
    const rim = new THREE.PointLight(0x00e5ff, 0.55, 0, 2); rim.position.set(320, 220, 320); scene.add(rim)
    const key = new THREE.DirectionalLight(0xffffff, 1.15); key.position.set(-260, 420, 320); scene.add(key)
    const fill = new THREE.DirectionalLight(0xdfe9ec, 0.45); fill.position.set(300, -180, -240); scene.add(fill)

    // Champ d'étoiles (repère de profondeur).
    const starGeo = new THREE.BufferGeometry()
    const starCount = 340
    const starPos = new Float32Array(starCount * 3)
    for (let i = 0; i < starCount; i++) {
      const v = fibSpherePoint(i, starCount).multiplyScalar(1600 + Math.random() * 600)
      starPos.set([v.x, v.y, v.z], i * 3)
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    // Le champ d'etoiles est un repere de profondeur dans le noir ; sur fond
    // blanc, ce ne sont que des poussieres. Il s'efface donc en theme clair.
    const starMaterial = new THREE.PointsMaterial({
      color: 0x3b494c, size: 2, sizeAttenuation: true, transparent: true, opacity: 0.55,
    })
    const stars = new THREE.Points(starGeo, starMaterial)
    scene.add(stars)

    themedRef.current = { ambient, pt, rim, key, fill, starMaterial }
    applyTheme(themedRef.current, lightRef.current)

    const orbit = new OrbitControls(camera, renderer.domElement)
    orbit.enableDamping = true; orbit.dampingFactor = 0.08
    orbit.rotateSpeed = 0.7; orbit.zoomSpeed = 0.9
    orbit.minDistance = 60; orbit.maxDistance = 4000
    // Zoomer vers le curseur plutôt que vers le centre : c'est ce qui permet
    // d'aller CHERCHER une grappe au lieu de zoomer puis de se repanoramiquer.
    orbit.zoomToCursor = true
    orbit.screenSpacePanning = true
    // Rotation lente au repos : la scene respire, et l'on voit qu'il y a
    // quelque chose derriere. Elle s'arrete des qu'on touche a la vue et ne
    // reprend qu'apres un long silence, sinon elle contrarie le geste.
    orbit.autoRotate = true
    orbit.autoRotateSpeed = 0.28
    orbit.addEventListener('start', () => {
      orbit.autoRotate = false
      lastTouchRef.current = performance.now()
    })
    orbit.addEventListener('end', () => { lastTouchRef.current = performance.now() })
    orbitRef.current = orbit

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let hoveredMesh: THREE.Mesh | null = null
    const IDLE_BEFORE_SPIN = 7000

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
        if (hoveredMesh) {
          hoveredMesh.userData.hovered = false
          // Le nom revient à l'état où la construction l'avait laissé : seuls les
          // plus critiques restent nommés en permanence.
          const previous = hoveredMesh.userData.label as THREE.Sprite | undefined
          if (previous) previous.visible = !!hoveredMesh.userData.labelAlways
        }
        hoveredMesh = mesh ?? null
        if (hoveredMesh) {
          hoveredMesh.userData.hovered = true
          const label = hoveredMesh.userData.label as THREE.Sprite | undefined
          if (label) label.visible = true
        }
        renderer.domElement.style.cursor = hoveredMesh ? 'pointer' : 'grab'
      }
      if (mesh) {
        const id = mesh.userData.id as string
        const imp = impactRef.current[id]
        const baseSub = mesh.userData.sub as string
        const sub = imp !== undefined ? `${baseSub} · ${moneyRef.current.full(imp)}` : baseSub
        setHover({ name: mesh.userData.name as string, sub, x: px, y: py })
      } else setHover(null)
    }
    let downPos: { x: number; y: number } | null = null
    function onPointerDown(e: PointerEvent) {
      downPos = { x: e.clientX, y: e.clientY }
      // Survoler un nœud ne doit pas empêcher de tourner : dans une grappe
      // dense, le curseur est presque toujours sur une bille, et la vue
      // paraissait alors bloquée. Seul un geste COMMENCÉ sur un nœud lui est
      // réservé, pour le déplacer.
      updatePointer(e)
      raycaster.setFromCamera(pointer, camera)
      orbit.enableRotate = raycaster.intersectObjects(nodeMeshesRef.current, false).length === 0
    }
    function onPointerUp(e: PointerEvent) {
      orbit.enableRotate = true
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
      // Les arêtes ne sont recalculées que si une extrémité a bougé : une courbe
      // coûte quinze points, et rien ne bouge tant que personne ne tire un nœud.
      for (const entry of edgeLinesRef.current) {
        const { line, a, b } = entry
        const moved = !entry.lastA || !entry.lastB
          || !entry.lastA.equals(a.position) || !entry.lastB.equals(b.position)
        if (!moved) continue
        writeCurve(line, a.position, b.position)
        entry.lastA = a.position.clone()
        entry.lastB = b.position.clone()
      }
      // Animation de cascade de simulation (prioritaire sur la mise en évidence).
      const s = simRef.current
      if (s && s.active) {
        renderSimFrame(s, nodeMeshesRef.current, edgeLinesRef.current)
      } else {
        // Apparition : les billes grossissent depuis rien, famille apres famille.
        // C'est le seul moment ou l'oeil peut saisir la structure d'ensemble
        // avant que tout soit dessine.
        const intro = introRef.current
        const now = performance.now()
        if (intro !== null) {
          let done = true
          for (const m of nodeMeshesRef.current) {
            const at = (m.userData.appearAt as number) ?? intro
            const p = Math.min(1, Math.max(0, (now - at) / 420))
            if (p < 1) done = false
            m.userData.intro = easeOut(p)
          }
          if (done) introRef.current = null
        }

        // Survol : un grossissement amene en douceur se lit comme une reponse,
        // alors qu'un saut brutal ressemble a un defaut d'affichage.
        const sel = selectedRef.current
        for (const m of nodeMeshesRef.current) {
          const base = (m.userData.baseScale as number) ?? 1
          const grow = m.userData.hovered ? 1.35 : 1
          const pulse = sel && m.userData.id === sel ? 1 + Math.sin(el * 3) * 0.08 : 1
          const wanted = base * grow * pulse * ((m.userData.intro as number) ?? 1)
          const current = m.scale.x
          m.scale.setScalar(current + (wanted - current) * 0.22)
        }
      }

      // Les elements critiques respirent : c'est le seul mouvement porteur de
      // sens de la scene, et il attire l'oeil la ou il doit aller.
      for (const m of nodeMeshesRef.current) {
        const halo = m.userData.halo as THREE.Mesh | undefined
        if (!halo?.userData.critical) continue
        const material = halo.material as THREE.MeshBasicMaterial
        const base = halo.userData.baseOpacity as number
        material.opacity = base * (1 + Math.sin(el * 1.7 + (m.position.x + m.position.z) * 0.01) * 0.35)
      }

      // Reprise de la rotation lente apres un silence.
      if (!orbit.autoRotate && performance.now() - lastTouchRef.current > IDLE_BEFORE_SPIN) orbit.autoRotate = true
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
      // Ce garde protège LA caméra créée ci-dessus ; si la scène est recréée
      // (React monte deux fois en mode strict), la nouvelle caméra n'a pas
      // encore été cadrée et doit pouvoir l'être. Sans cette remise à zéro, le
      // cadrage s'appliquait à une caméra déjà jetée — et la vue restait au
      // plus près, quelle que soit la distance calculée.
      framedRef.current = false
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

    // Les grappes : une par famille, le plus critique au cœur de la sienne.
    // Voir lib/graphLayout3d.
    const total = Math.max(1, nodes.length)
    const layout = clusteredLayout(
      nodes.map((n) => ({ id: n.id, entityType: n.entityType, criticality: n.criticality })))

    // L'apparition : chaque famille entre a son tour, 90 ms plus tard que la
    // precedente.
    const introStart = performance.now() + 60
    introRef.current = introStart
    const clusterDelay = new Map<string, number>()
    layout.clusters.forEach((c, i) => clusterDelay.set(c.key, i * 90))

    // Seuil d'affichage des noms : les 12 plus critiques, pas davantage.
    const sortedCrit = nodes.map((n) => n.criticality).sort((a, b) => b - a)
    const labelFloor = sortedCrit[Math.min(11, sortedCrit.length - 1)] ?? 0

    nodes.forEach((n, k) => {
      const placed = layout.positions.get(n.id)
      const pos = placed
        ? new THREE.Vector3(placed.x, placed.y, placed.z)
        : fibSpherePoint(k, total).multiplyScalar(LAYOUT_RADIUS(total))
      // La bille porte l'IDENTITE : la marque si on la reconnait, sinon la
      // couleur de sa famille. Le risque, lui, passe dans l'aureole.
      const brand = brandFor(n.name, n.entityType)
      const baseHex = brand ? brand.hex : familyColor(n.entityType, light)
      const col = new THREE.Color(baseHex)
      const r = 6 + (n.criticality / 100) * 8
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(r, 24, 24),
        new THREE.MeshStandardMaterial({
          color: col, emissive: col, emissiveIntensity: light ? 0.1 : 0.28,
          roughness: light ? 0.38 : 0.55, metalness: light ? 0.05 : 0.15, transparent: true,
        }),
      )
      mesh.position.copy(pos)
      mesh.userData = {
        id: n.id, name: n.name, sub: `${entityTypeLabel(n.entityType, t)} · c${n.criticality}`,
        type: n.entityType, criticality: n.criticality, baseScale: 1, baseColor: col.clone(),
        cluster: placed?.cluster ?? n.entityType,
      }
      // L'aureole porte le risque : sa couleur est la bande de criticite, son
      // intensite suit le score. Un element critique se voit donc dans
      // n'importe quelle famille, sans que tout devienne rouge.
      const riskColor = new THREE.Color(bandColor(n.criticality, light))
      const riskOpacity = 0.05 + (n.criticality / 100) * (light ? 0.22 : 0.3)
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(r * (1.35 + (n.criticality / 100) * 0.3), 18, 18),
        new THREE.MeshBasicMaterial({
          color: riskColor, transparent: true, opacity: riskOpacity,
          side: THREE.BackSide, depthWrite: false,
        }),
      )
      halo.userData = { baseOpacity: riskOpacity, critical: n.criticality >= 80 }
      mesh.add(halo)
      mesh.userData.halo = halo
      // Le logo officiel quand la marque est connue, l'icone de famille sinon.
      // Une encre choisie pour la bille, et non un gris passe-partout : c'est ce
      // qui rendait les icones fades.
      const ink = inkOn(baseHex)
      if (brand?.path) mesh.add(makeMarkSprite(brand.path, r * 1.45, ink))
      else if (brand?.initials) mesh.add(makeInitialsSprite(brand.initials, r * 1.5, ink))
      else mesh.add(makeIconSprite(iconFor(n.entityType), r * 1.5, ink))
      const label = makeLabelSprite(n.name, 13, light)
      label.position.set(0, -(r + 11), 0)
      // Cent étiquettes superposées ne se lisent pas, elles font du bruit. On
      // nomme les plus critiques, le survol nomme le reste à la demande.
      const always = nodes.length <= 28 || n.criticality >= labelFloor
      label.visible = always
      mesh.userData.label = label
      mesh.userData.labelAlways = always
      mesh.add(label)
      // Depart a zero : l'animation d'apparition les fait naitre, decalees par
      // famille pour que la structure se lise au lieu de surgir d'un bloc.
      mesh.scale.setScalar(0.001)
      mesh.userData.intro = 0
      mesh.userData.appearAt = introStart + (clusterDelay.get(placed?.cluster ?? n.entityType) ?? 0) + (k % 12) * 12

      group.add(mesh); meshes.push(mesh); posById.set(n.id, mesh)
    })

    // Arêtes.
    const lines: EdgeLink[] = []
    for (const e of edges) {
      const a = posById.get(e.source), b = posById.get(e.target)
      if (!a || !b) continue
      const suggested = e.status === 'AiSuggested'
      // Née d'une correction déclarée : vert, franc, comme sur le plan 2D. Une
      // même couleur doit dire la même chose dans les deux vues.
      const fixed = e.sourceSystem === 'Remediation'
      const lgeo = new THREE.BufferGeometry().setFromPoints(edgeCurve(a.position, b.position))
      // Sur fond clair, le cyan néon et une faible opacité rendaient les liens
      // presque invisibles : teinte plus profonde et trait plus marqué.
      const weak = (e.confidence ?? 1) < 0.5
      const baseOpacity = fixed ? (light ? 0.9 : 0.8) : light ? (weak ? 0.4 : 0.75) : (weak ? 0.22 : 0.4)
      const baseColor = new THREE.Color(
        fixed ? (light ? '#15803d' : '#4ade80')
          : suggested ? (light ? '#c2410c' : '#e08a3c')
            : (light ? '#0e7490' : CYAN))
      const line = new THREE.Line(lgeo, new THREE.LineBasicMaterial({
        color: baseColor.clone(), transparent: true, opacity: baseOpacity,
      }))
      line.userData = { baseOpacity, baseColor }
      group.add(line); lines.push({ line, a, b })
    }

    // Le nom de chaque famille, pose au-dessus de sa grappe.
    //
    // C'est ce qui distingue un amas de billes d'une carte : sans etiquette, on
    // voit des paquets sans savoir de quoi ils sont faits, et il faut survoler
    // chaque bille pour le deviner.
    const shells: THREE.Mesh[] = []
    for (const cluster of layout.clusters) {
      const caption = makeLabelSprite(
        `${entityTypeLabel(cluster.key, t)} · ${cluster.count}`, 15, light)
      caption.position.set(cluster.x, cluster.y + cluster.radius + 26, cluster.z)
      group.add(caption)

      // Le halo delimite la grappe sans l'enfermer, et sert de POIGNEE : on
      // attrape une famille entiere pour la deplacer, au lieu de trainer ses
      // billes une par une.
      const shell = new THREE.Mesh(
        new THREE.SphereGeometry(cluster.radius + 10, 24, 18),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(light ? '#7e949c' : '#2f4a52'),
          transparent: true, opacity: light ? 0.13 : 0.09,
          side: THREE.BackSide, depthWrite: false,
        }),
      )
      shell.position.set(cluster.x, cluster.y, cluster.z)
      shell.userData = { cluster: cluster.key, caption }
      group.add(shell)
      shells.push(shell)
    }

    scene.add(group)

    // Cadrer sur l'ensemble dès l'affichage : c'est la vue d'ensemble qu'on
    // veut voir en arrivant, pas un gros plan sur trois nœuds.
    const cam = cameraRef.current
    const orb = orbitRef.current
    // On attend d'avoir de VRAIS nœuds : au premier rendu la liste est encore
    // vide, et cadrer à ce moment-là figeait la caméra sur une sphère d'un seul
    // point — la vue restait donc au plus près une fois les données arrivées.
    if (cam && orb && !framedRef.current && nodes.length > 0) {
      framedRef.current = true
      const frame = frameBall(layout.radius)
      cam.position.set(frame.x, frame.y, frame.z)
      orb.target.set(0, 0, 0)
      orb.update()
    }
    frameRef.current = frameBall(layout.radius)
    nodeMeshesRef.current = meshes
    edgeLinesRef.current = lines

    // Déplacement : un nœud seul, ou une famille entière par son halo.
    //
    // Une SEULE instance pour les deux, et non deux superposées : le halo
    // englobe ses billes, donc deux jeux de poignées se déclencheraient
    // ensemble et déplacer un nœud emmènerait toute sa famille. Ici la poignée
    // la plus proche gagne, c'est-à-dire la bille quand il y en a une.
    dragRef.current?.dispose()
    if (domRef.current && cameraRef.current) {
      const byCluster = new Map<string, THREE.Mesh[]>()
      for (const m of meshes) {
        const key = m.userData.cluster as string | undefined
        if (!key) continue
        const bucket = byCluster.get(key)
        if (bucket) bucket.push(m)
        else byCluster.set(key, [m])
      }

      const dc = new DragControls([...meshes, ...shells], cameraRef.current, domRef.current)
      let last: THREE.Vector3 | null = null

      dc.addEventListener('dragstart', (e) => {
        if (orbitRef.current) {
          orbitRef.current.enableRotate = false
          // La rotation lente doit cesser aussi : sinon la scene tourne sous la
          // bille que l'on essaie de poser.
          orbitRef.current.autoRotate = false
        }
        lastTouchRef.current = performance.now()
        last = (e.object as THREE.Mesh).position.clone()
      })

      dc.addEventListener('drag', (e) => {
        lastTouchRef.current = performance.now()
        const object = e.object as THREE.Mesh
        const key = object.userData.cluster as string | undefined
        // Un nœud se déplace seul ; un halo emmène les siens, sans quoi la
        // famille resterait sur place dans une bulle vide.
        if (!key || !shells.includes(object)) { last = object.position.clone(); return }
        if (!last) { last = object.position.clone(); return }

        const delta = object.position.clone().sub(last)
        last = object.position.clone()
        for (const m of byCluster.get(key) ?? []) m.position.add(delta)
        const caption = object.userData.caption as THREE.Sprite | undefined
        if (caption) caption.position.add(delta)
      })

      dc.addEventListener('dragend', () => {
        last = null
        lastTouchRef.current = performance.now()
        if (orbitRef.current) orbitRef.current.enableRotate = true
      })
      dragRef.current = dc
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, light])

  // ── Bascule clair / sombre sans reconstruire la scene ──
  useEffect(() => {
    if (themedRef.current) applyTheme(themedRef.current, light)
  }, [light])

  // ── Déclenchement de la cascade de simulation ──
  useEffect(() => {
    if (!sim) { if (simRef.current) simRef.current.active = false; return }
    const pal = SIM_CONFIG[sim.action] ?? SIM_CONFIG.fail
    const affected = new Map<string, number>(Object.entries(sim.affected))
    const maxDepth = affected.size ? Math.max(...affected.values()) : 1
    simRef.current = {
      originId: sim.originId, affected, style: pal.style, maxDepth,
      startAt: performance.now(), active: true,
      originColor: new THREE.Color(pal.origin), waveHot: new THREE.Color(pal.hot),
      waveCold: new THREE.Color(pal.cold), edgeColor: new THREE.Color(pal.edge),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim?.nonce])

  // ── Mise en évidence : recherche (atténuation) + sélection (nœud + relations liées) ──
  useEffect(() => {
    if (simRef.current?.active) return // la simulation possède le rendu des matériaux
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, selectedId, sim?.nonce])

  return (
    <div className="absolute inset-0 z-10">
      {/*
        Le fond. Le rendu est transparent, donc c'est ce conteneur qui donne le
        ciel. Un aplat uni laissait la scene « posee sur une feuille » : un halo
        radial tres doux, plus clair au centre, recree la profondeur sans rien
        ajouter au rendu 3D.
      */}
      <div ref={mountRef} className="h-full w-full" style={{
        cursor: 'grab',
        background: light
          ? 'radial-gradient(ellipse at 50% 42%, #ffffff 0%, #f2f5f7 46%, #e4eaee 100%)'
          : 'radial-gradient(ellipse at 50% 42%, #0d1417 0%, #070b0d 52%, #04070880 100%)',
      }} />

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
          onClick={() => {
            const c = cameraRef.current, o = orbitRef.current
            if (!c || !o) return
            const frame = frameRef.current
              ?? { x: 0, y: 70, z: frameDistance(Math.max(1, nodes.length)) }
            c.position.set(frame.x, frame.y, frame.z)
            o.target.set(0, 0, 0); o.update()
          }}
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

      {/*
        Légende. Elle liste les familles PRÉSENTES, pas un catalogue théorique :
        une légende qui nomme des couleurs absentes de l'écran se lit comme une
        erreur. Le risque n'y a plus qu'une ligne, puisqu'il est passé dans
        l'auréole.
      */}
      <div className="pointer-events-none absolute bottom-4 left-4 z-20 flex max-w-[60%] flex-wrap items-center gap-x-3 gap-y-1 rounded-sm border px-2.5 py-1.5 backdrop-blur"
        style={{ background: 'color-mix(in srgb, var(--nx-panel) 92%, transparent)', borderColor: 'var(--nx-border)', fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--nx-text-muted)' }}>
        {families.map((f) => (
          <span key={f.type} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: familyColor(f.type, light) }} />
            {entityTypeLabel(f.type, t)}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full"
            style={{ background: 'transparent', boxShadow: `0 0 0 2px ${bandColor(90, light)}` }} />
          {t('auréole = criticité', 'halo = criticality')}
        </span>
      </div>
    </div>
  )
}
