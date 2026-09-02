// Capture des écrans de Lenexus pour la documentation (sans dépendance : pilote
// Chrome en headless via le protocole CDP). Requiert le backend sur :5199 et le
// front Vite sur :5173, et une démo (Bell) disponible.
//
//   node scripts/capture-docs.mjs
//
// Sorties : frontend/public/docs/*.png
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

const API = process.env.API ?? 'http://localhost:5199'
const WEB = process.env.WEB ?? 'http://localhost:5173'
const OUT = new URL('../frontend/public/docs/', import.meta.url)
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 9222
const W = 1600, H = 1000

// Écrans à capturer : [route, fichier, attente ms, publique?]
const SHOTS = [
  ['/welcome', 'landing.png', 1500, true],
  ['/demo', 'demo.png', 1200, true],
  ['/', 'dashboard.png', 2500, false],
  ['/graph', 'graph.png', 4000, false],
  ['/impact', 'impact.png', 2000, false],
  ['/simulations', 'simulation.png', 4500, false],
  ['/inference', 'inference.png', 1800, false],
  ['/dependencies', 'dependencies.png', 2500, false],
  ['/risks', 'risks.png', 2500, false],
  ['/enterprise', 'enterprise.png', 2500, false],
  ['/legal?doc=privacy', 'legal.png', 1200, true],
  // Écrans complémentaires
  ['/incidents', 'incidents.png', 2500, false],
  ['/change', 'change.png', 2500, false],
  ['/audit', 'audit.png', 2500, false],
  ['/suppliers', 'suppliers.png', 2500, false],
  ['/human', 'human.png', 2500, false],
  ['/actions', 'actions.png', 2500, false],
  ['/twin', 'twin.png', 3500, false],
  ['/decision', 'decision.png', 2500, false],
  ['/ai', 'ai.png', 2000, false],
  ['/documents', 'documents.png', 2000, false],
  ['/reports', 'reports.png', 2500, false],
  ['/onboarding', 'onboarding.png', 2000, false],
  ['/integrations', 'integrations.png', 2500, false],
  ['/admin', 'admin.png', 2000, false],
]

async function cdp(ws, method, params = {}) {
  const id = cdp._id = (cdp._id ?? 0) + 1
  return new Promise((resolve, reject) => {
    const onMsg = (e) => {
      const m = JSON.parse(e.data)
      if (m.id === id) { ws.removeEventListener('message', onMsg); m.error ? reject(new Error(m.error.message)) : resolve(m.result) }
    }
    ws.addEventListener('message', onMsg)
    ws.send(JSON.stringify({ id, method, params }))
  })
}

async function main() {
  mkdirSync(OUT, { recursive: true })

  // 1) Jeton de démo Bell
  const login = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo-bell@lenexus.demo', password: 'lenexus-demo-2026' }),
  }).then((r) => r.json())
  if (!login.token) throw new Error('Échec de connexion démo (backend 5199 lancé ?)')
  const { token, tenantId } = login
  console.log('✓ jeton obtenu, tenant', tenantId?.slice(0, 8))

  // 2) Chrome headless
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu=false', `--remote-debugging-port=${PORT}`,
    `--window-size=${W},${H}`, '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank',
  ], { stdio: 'ignore' })

  try {
    // Attendre l'endpoint de debug
    let ver
    for (let i = 0; i < 40; i++) {
      try { ver = await fetch(`http://localhost:${PORT}/json/version`).then((r) => r.json()); break } catch { await sleep(250) }
    }
    if (!ver) throw new Error('Chrome debug indisponible')

    const targets = await fetch(`http://localhost:${PORT}/json/list`).then((r) => r.json())
    const page = targets.find((t) => t.type === 'page') ?? targets[0]
    const ws = new WebSocket(page.webSocketDebuggerUrl)
    await new Promise((res) => (ws.onopen = res))

    await cdp(ws, 'Page.enable')
    await cdp(ws, 'Runtime.enable')
    // Injecte le jeton AVANT le chargement de l'app (localStorage) pour chaque doc.
    await cdp(ws, 'Page.addScriptToEvaluateOnNewDocument', {
      source: `try{localStorage.setItem('nexus.jwt', ${JSON.stringify(token)});localStorage.setItem('nexus.tenantId', ${JSON.stringify(tenantId)});}catch(e){}`,
    })

    for (const [route, file, wait] of SHOTS) {
      await cdp(ws, 'Page.navigate', { url: WEB + route })
      await sleep(wait)
      const { data } = await cdp(ws, 'Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W, height: H, scale: 1 } })
      writeFileSync(new URL(file, OUT), Buffer.from(data, 'base64'))
      console.log('✓', file)
    }
    ws.close()
  } finally {
    chrome.kill()
  }
  console.log('Terminé →', OUT.pathname)
}

main().catch((e) => { console.error('ERREUR:', e.message); process.exit(1) })
