import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { disposeObject, makeLabelSprite } from '../lib/holoThree'
import { useLang } from '../lib/i18n'
import type { GraphData, RiskRow } from '../lib/types'

/**
 * « L'entreprise en un coup d'œil » — la vue d'ouverture du tableau de bord.
 *
 * Ce n'est VOLONTAIREMENT pas un graphe de dépendances : la plateforme en
 * comporte déjà deux (Graphe, Dépendances), et en remettre un ici n'apprendrait
 * rien de neuf. Celle-ci montre l'ENTREPRISE : ses activités réelles, debout,
 * chacune nommée.
 *
 *   hauteur du pilier  = ce qui le soutient (actifs mobilisés, en profondeur)
 *   couleur du pilier  = son niveau de risque
 *   socle extérieur    = les ancrages externes — sites et fournisseurs
 *
 * On y lit en une seconde ce qu'aucun graphe ne donne : quelles activités
 * pèsent le plus, et lesquelles sont en rouge.
 */

const CYAN = '#00e5ff'

/**
 * Couleur d'une activité : combien de POINTS UNIQUES DE DÉFAILLANCE sa chaîne
 * traverse. C'est la mesure juste pour une activité métier — son score de risque
 * propre, lui, est toujours bas (personne ne dépend d'elle, elle est en bout de
 * chaîne), si bien que le colorer peignait tout en vert, ce qui était faux.
 */
function exposureColor(spof: number): string {
  if (spof >= 6) return '#e05a52'
  if (spof >= 3) return '#e08a3c'
  if (spof >= 1) return '#d9c04a'
  return '#4bb884'
}

/** Santé globale de l'organisation : un score, pas un décompte. */
function healthColor(score: number): string {
  if (score >= 75) return '#4bb884'
  if (score >= 50) return '#d9c04a'
  if (score >= 30) return '#e08a3c'
  return '#e05a52'
}

const BUSINESS_TYPES = ['BusinessService', 'BusinessProcess', 'Process']
const APP_TYPES = ['Application', 'Service', 'System']
const SITE_TYPES = ['Location']
const SUPPLIER_TYPES = ['Supplier']

type Pillar = { id: string; name: string; supports: number; spof: number; color: string }
type Anchor = { id: string; name: string; kind: 'site' | 'supplier' }

export function CompanyOverview3D({
  graph, risks, company, health, onPick,
}: {
  graph?: GraphData
  /** Scores du Centre de risques : la vue doit dire la MÊME chose que lui. */
  risks?: RiskRow[]
  company: string
  health: number
  onPick?: (id: string, name: string) => void
}) {
  const { t, lang } = useLang()
  const mountRef = useRef<HTMLDivElement>(null)
  const [spin, setSpin] = useState(true)
  const spinRef = useRef(spin)
  spinRef.current = spin
  const resetRef = useRef<(() => void) | null>(null)
  const [hover, setHover] = useState<Pillar | null>(null)

  const model = useMemo(() => {
    if (!graph) return null
    const nodes = graph.nodes
    const riskById = new Map((risks ?? []).map((r) => [r.id, r]))

    // Ce qui soutient une activité : on descend les dépendances sur quelques
    // niveaux. Un service métier qui mobilise 20 actifs pèse plus qu'un qui en
    // mobilise 2 — c'est cela, le poids opérationnel.
    const out = new Map<string, string[]>()
    for (const e of graph.edges) {
      const arr = out.get(e.source) ?? []
      arr.push(e.target)
      out.set(e.source, arr)
    }
    // Ce qu'une activité mobilise, sur trois niveaux de dépendance, et combien
    // de ces appuis sont des points uniques de défaillance — à risque élevé ET
    // sans solution de repli.
    function chain(rootId: string): { count: number; spof: number } {
      const seen = new Set<string>([rootId])
      let frontier = [rootId]
      let spof = 0
      for (let d = 0; d < 3; d++) {
        const next: string[] = []
        for (const id of frontier) {
          for (const to of out.get(id) ?? []) {
            if (seen.has(to)) continue
            seen.add(to)
            next.push(to)
            const r = riskById.get(to)
            if (r && r.score >= 60 && !r.hasRedundancy) spof++
          }
        }
        frontier = next
        if (!frontier.length) break
      }
      return { count: seen.size - 1, spof }
    }

    // Les activités de l'entreprise. À défaut de couche métier déclarée, on
    // prend les applications les plus critiques : mieux vaut une vue utile
    // qu'une scène vide.
    let heads = nodes.filter((n) => BUSINESS_TYPES.includes(n.entityType))
    if (heads.length === 0) heads = nodes.filter((n) => APP_TYPES.includes(n.entityType))

    const pillars: Pillar[] = heads
      .map((n) => {
        // Les scores et la redondance viennent du moteur — les mêmes que ceux du
        // Centre de risques. Deux écrans qui se contredisent ne sont plus crus
        // ni l'un ni l'autre.
        const { count, spof } = chain(n.id)
        return { id: n.id, name: n.name, supports: count, spof, color: exposureColor(spof) }
      })
      .sort((a, b) => b.supports - a.supports)
      .slice(0, 10)

    const anchors: Anchor[] = [
      ...nodes.filter((n) => SITE_TYPES.includes(n.entityType)).slice(0, 10)
        .map((n) => ({ id: n.id, name: n.name, kind: 'site' as const })),
      ...nodes.filter((n) => SUPPLIER_TYPES.includes(n.entityType)).slice(0, 14)
        .map((n) => ({ id: n.id, name: n.name, kind: 'supplier' as const })),
    ]

    return { pillars, anchors, maxSupports: Math.max(1, ...pillars.map((p) => p.supports)) }
  }, [graph, risks])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount || !model || model.pillars.length === 0) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, 1, 1, 1000)
    camera.position.set(0, 78, 205)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.enablePan = false
    controls.minDistance = 110
    controls.maxDistance = 360
    controls.maxPolarAngle = Math.PI * 0.49 // on ne passe pas sous le sol

    const world = new THREE.Group()
    scene.add(world)

    // ── Socle ──────────────────────────────────────────────────────────────
    const R_PILLARS = 64
    const R_ANCHORS = 96

    for (const [r, op] of [[R_PILLARS, 0.26], [R_ANCHORS, 0.16]] as const) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.18, 8, 160),
        new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: op }),
      )
      ring.rotation.x = Math.PI / 2
      world.add(ring)
    }

    // ── Cœur : l'entreprise elle-même ──────────────────────────────────────
    const healthCol = healthColor(100 - health)
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(9, 11, 3, 6),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(healthCol), transparent: true, opacity: 0.85 }),
    )
    core.position.y = 1.5
    world.add(core)

    const nameSprite = makeLabelSprite(company, 4.6)
    nameSprite.position.set(0, 11, 0)
    world.add(nameSprite)
    const scoreSprite = makeLabelSprite(
      lang === 'fr' ? `résilience ${health}/100` : `resilience ${health}/100`, 2.6,
    )
    scoreSprite.position.set(0, 6.5, 0)
    scoreSprite.material.opacity = 0.8
    world.add(scoreSprite)

    // ── Piliers : les activités ────────────────────────────────────────────
    const pillarMeshes: THREE.Mesh[] = []
    const n = model.pillars.length
    model.pillars.forEach((p, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2
      const x = Math.cos(a) * R_PILLARS
      const z = Math.sin(a) * R_PILLARS
      const h = 8 + (p.supports / model.maxSupports) * 40
      const col = new THREE.Color(p.color)

      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(4.2, 4.2, h, 20),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.82 }),
      )
      mesh.position.set(x, h / 2, z)
      mesh.userData = p
      world.add(mesh)
      pillarMeshes.push(mesh)

      // Liseré au sommet : marque la hauteur et donne du relief.
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(4.6, 4.6, 0.7, 20),
        new THREE.MeshBasicMaterial({ color: col }),
      )
      cap.position.set(x, h + 0.3, z)
      world.add(cap)

      // Trait de rappel jusqu'au cœur : l'activité appartient à l'entreprise.
      const g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(x, 0.4, z),
      ])
      world.add(new THREE.Line(g, new THREE.LineBasicMaterial({
        color: col, transparent: true, opacity: 0.3,
      })))

      // Le NOM, toujours lisible — c'est ce qu'on vient chercher.
      const label = makeLabelSprite(p.name, 3.0)
      label.position.set(x, h + 5.5, z)
      world.add(label)

      const sub = makeLabelSprite(
        lang === 'fr'
          ? `${p.supports} actifs · ${p.spof} sans repli`
          : `${p.supports} assets · ${p.spof} with no fallback`,
        2.1,
      )
      sub.position.set(x, h + 2.2, z)
      sub.material.opacity = 0.72
      world.add(sub)
    })

    // ── Ancrages externes : sites et fournisseurs ──────────────────────────
    const m = model.anchors.length
    model.anchors.forEach((an, i) => {
      const a = (i / Math.max(1, m)) * Math.PI * 2
      const x = Math.cos(a) * R_ANCHORS
      const z = Math.sin(a) * R_ANCHORS
      const isSite = an.kind === 'site'
      const col = new THREE.Color(isSite ? '#7fb4c4' : '#c9a227')

      const mesh = new THREE.Mesh(
        isSite
          ? new THREE.BoxGeometry(4.4, 4.4, 4.4)
          : new THREE.OctahedronGeometry(3),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.75 }),
      )
      mesh.position.set(x, 2.4, z)
      world.add(mesh)

      const label = makeLabelSprite(an.name, 2.2)
      label.position.set(x, 7.6, z)
      label.material.opacity = 0.8
      world.add(label)
    })

    // ── Survol & clic ──────────────────────────────────────────────────────
    const ray = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    let hovered: THREE.Mesh | null = null
    function pick(ev: PointerEvent): THREE.Mesh | null {
      const r = renderer.domElement.getBoundingClientRect()
      mouse.x = ((ev.clientX - r.left) / r.width) * 2 - 1
      mouse.y = -((ev.clientY - r.top) / r.height) * 2 + 1
      ray.setFromCamera(mouse, camera)
      return (ray.intersectObjects(pillarMeshes, false)[0]?.object as THREE.Mesh) ?? null
    }
    function onMove(ev: PointerEvent) {
      const hit = pick(ev)
      if (hit === hovered) return
      hovered = hit
      renderer.domElement.style.cursor = hit ? 'pointer' : 'grab'
      setHover(hit ? (hit.userData as Pillar) : null)
    }
    function onDown(ev: PointerEvent) {
      const hit = pick(ev)
      if (hit && onPick) onPick((hit.userData as Pillar).id, (hit.userData as Pillar).name)
    }
    renderer.domElement.addEventListener('pointermove', onMove)
    renderer.domElement.addEventListener('pointerdown', onDown)

    // ── Boucle ─────────────────────────────────────────────────────────────
    function resize() {
      const w = mount!.clientWidth
      const h = mount!.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(mount)

    resetRef.current = () => {
      camera.position.set(0, 78, 205)
      controls.target.set(0, 8, 0)
      world.rotation.y = 0
      controls.update()
    }
    controls.target.set(0, 8, 0)
    controls.update()

    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      if (spinRef.current) world.rotation.y += 0.0014
      controls.update()
      renderer.render(scene, camera)
    }
    loop()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      renderer.domElement.removeEventListener('pointermove', onMove)
      renderer.domElement.removeEventListener('pointerdown', onDown)
      controls.dispose()
      disposeObject(scene)
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
      resetRef.current = null
    }
  }, [model, company, health, lang, onPick])

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={mountRef} className="absolute inset-0" />

      <div className="absolute right-3 top-3 flex gap-1.5">
        <Ctl onClick={() => setSpin((s) => !s)} title={spin ? t('Arrêter la rotation', 'Stop rotation') : t('Reprendre la rotation', 'Resume rotation')}>
          {spin ? <Pause size={13} /> : <Play size={13} />}
        </Ctl>
        <Ctl onClick={() => resetRef.current?.()} title={t('Recadrer', 'Reset view')}><RotateCcw size={13} /></Ctl>
      </div>

      {/* Comment lire la scène */}
      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1.5"
        style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--nx-text-muted)' }}>
        <span>{t('hauteur = actifs mobilisés', 'height = assets involved')}</span>
        <span className="flex items-center gap-1.5">
          {t('couleur = points uniques de défaillance', 'colour = single points of failure')}
          {[['#4bb884', t('aucun', 'none')], ['#d9c04a', '1–2'], ['#e08a3c', '3–5'], ['#e05a52', '6+']].map(([c, l]) => (
            <span key={c} className="flex items-center gap-1">
              <span style={{ width: 8, height: 8, borderRadius: 2, background: c, display: 'inline-block' }} />{l}
            </span>
          ))}
        </span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span style={{ width: 8, height: 8, background: '#7fb4c4', display: 'inline-block' }} />{t('sites', 'sites')}
          </span>
          <span className="flex items-center gap-1">
            <span style={{ width: 8, height: 8, background: '#c9a227', transform: 'rotate(45deg)', display: 'inline-block' }} />{t('fournisseurs', 'suppliers')}
          </span>
        </span>
      </div>

      {hover && (
        <div className="pointer-events-none absolute bottom-3 right-3 rounded-sm border px-3 py-2"
          style={{ background: 'var(--nx-panel)', borderColor: hover.color, maxWidth: 280 }}>
          <div style={{ fontSize: 13, color: 'var(--nx-text)' }}>{hover.name}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--nx-text-muted)' }}>
            {hover.supports} {t('actifs mobilisés', 'assets involved')}
            {' · '}
            <span style={{ color: hover.color }}>
              {hover.spof === 0
                ? t('aucun point unique de défaillance', 'no single point of failure')
                : t(`${hover.spof} point(s) unique(s) de défaillance`, `${hover.spof} single point(s) of failure`)}
            </span>
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
