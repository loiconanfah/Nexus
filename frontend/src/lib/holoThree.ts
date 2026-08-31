import { createElement, type ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as THREE from 'three'
import type { LucideProps } from 'lucide-react'

export type IconCmp = ComponentType<LucideProps>

/** Point réparti uniformément sur une sphère unité (spirale de Fibonacci). */
export function fibSpherePoint(k: number, total: number): THREE.Vector3 {
  const t = Math.max(1, total)
  const offset = 2 / t
  const inc = Math.PI * (3 - Math.sqrt(5))
  const y = k * offset - 1 + offset / 2
  const r = Math.sqrt(Math.max(0, 1 - y * y))
  const phi = k * inc
  return new THREE.Vector3(Math.cos(phi) * r, y, Math.sin(phi) * r)
}

/** Sprite texte (nom) sur canvas — panneau translucide sobre, face caméra. */
export function makeLabelSprite(text: string, worldHeight = 13): THREE.Sprite {
  const label = text.length > 26 ? text.slice(0, 25) + '…' : text
  const font = 30
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')!
  ctx.font = `500 ${font}px "JetBrains Mono", monospace`
  const w = Math.ceil(ctx.measureText(label).width)
  const padX = 14, padY = 9
  c.width = w + padX * 2
  c.height = font + padY * 2
  const g = c.getContext('2d')!
  g.font = `500 ${font}px "JetBrains Mono", monospace`
  const rr = 7, inset = 1.5
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

function iconDataUrl(Icon: IconCmp, color: string): string {
  const markup = renderToStaticMarkup(createElement(Icon, { size: 96, color, strokeWidth: 1.9 }))
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup)
}

/** Sprite icône vectorielle (lucide) — teinte neutre pro, face caméra. */
export function makeIconSprite(Icon: IconCmp, worldSize: number, color = '#d3dcde'): THREE.Sprite {
  const s = 128
  const c = document.createElement('canvas')
  c.width = c.height = s
  const tex = new THREE.CanvasTexture(c)
  tex.minFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }))
  spr.scale.set(worldSize, worldSize, 1)
  spr.renderOrder = 21
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

/** Libère géométries + matériaux + textures d'un objet et de ses enfants. */
export function disposeObject(o: THREE.Object3D) {
  o.traverse((n) => {
    const m = n as THREE.Mesh
    if (m.geometry) m.geometry.dispose()
    const mat = (m as THREE.Mesh).material
    const mats = Array.isArray(mat) ? mat : mat ? [mat] : []
    mats.forEach((x) => {
      const map = (x as THREE.SpriteMaterial).map
      if (map) map.dispose()
      x.dispose()
    })
  })
}
