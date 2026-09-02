// Parcours de démo AUTO-PILOTÉ COMPLET pour Lenexus (~4-5 min, public investisseurs).
// Ouvre une fenêtre Chrome VISIBLE, se connecte à la démo Bell, et parcourt TOUTES
// les fonctionnalités. Enregistre ton écran (OBS/Loom) pendant qu'il tourne.
// Sans dépendance (CDP via Node).
//
//   node scripts/demo-drive-full.mjs            (local : Vite 5173 + API 5199)
//   node scripts/demo-drive-full.mjs --deployed (site en ligne Render)
//
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const DEPLOYED = process.argv.includes('--deployed')
const WEB = DEPLOYED ? 'https://nexus-web-xxxx.onrender.com' : 'http://localhost:5173'
const API = DEPLOYED ? 'https://nexus-api-rzh9.onrender.com' : 'http://localhost:5199'
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 9334, W = 1600, H = 900

let _id = 0
function send(ws, method, params = {}) {
  const id = ++_id
  return new Promise((resolve, reject) => {
    const on = (e) => { const m = JSON.parse(e.data); if (m.id === id) { ws.removeEventListener('message', on); m.error ? reject(new Error(m.error.message)) : resolve(m.result) } }
    ws.addEventListener('message', on)
    ws.send(JSON.stringify({ id, method, params }))
  })
}
const evalJs = (ws, expr) => send(ws, 'Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }).then((r) => r.result?.value)
const CLICK_TEXT = (sel, text) => `(() => { const el=[...document.querySelectorAll('${sel}')].find(e=>e.textContent.trim().includes(${JSON.stringify(text)})); if(el){el.click();return true} return false })()`
const CLICK_SEL = (sel) => `(() => { const el=document.querySelector('${sel}'); if(el){el.click();return true} return false })()`
const SCROLL = (y) => `window.scrollTo({top:${y},behavior:'smooth'})`

async function main() {
  const login = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo-bell@lenexus.demo', password: 'lenexus-demo-2026' }),
  }).then((r) => r.json())
  if (!login.token) throw new Error('Connexion démo échouée (API lancée ?)')
  const { token, tenantId } = login

  const profile = mkdtempSync(join(tmpdir(), 'lenexus-demo-'))
  const chrome = spawn(CHROME, [
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    `--window-size=${W},${H}`, '--window-position=60,40', '--no-first-run', '--no-default-browser-check',
    '--disable-features=Translate,InfobarUI', WEB + '/welcome',
  ], { stdio: 'ignore' })

  try {
    for (let i = 0; i < 40; i++) { try { await fetch(`http://localhost:${PORT}/json/version`).then((r) => r.json()); break } catch { await sleep(300) } }
    const targets = await fetch(`http://localhost:${PORT}/json/list`).then((r) => r.json())
    const page = targets.find((t) => t.type === 'page') ?? targets[0]
    const ws = new WebSocket(page.webSocketDebuggerUrl)
    await new Promise((res) => (ws.onopen = res))
    await send(ws, 'Page.enable'); await send(ws, 'Runtime.enable')
    await send(ws, 'Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem('nexus.jwt', ${JSON.stringify(token)});localStorage.setItem('nexus.tenantId', ${JSON.stringify(tenantId)});}catch(e){}` })

    const nav = async (path) => { await send(ws, 'Page.navigate', { url: WEB + path }) }
    const scene = (n, t) => console.log(`  ▸ [${n}] ${t}`)

    // 1 — Accroche
    scene('0:00', 'Vitrine — le problème')
    await nav('/welcome'); await sleep(12000)

    // 2 — Le graphe vivant
    scene('0:12', 'Graphe de dépendances')
    await nav('/graph'); await sleep(16000)

    // 3 — Impact transversal (langage naturel → cascade chiffrée)
    scene('0:28', 'Impact transversal')
    await nav('/impact'); await sleep(2600)
    await evalJs(ws, CLICK_TEXT('button', 'perdons le fournisseur Ericsson'))
    await sleep(10000)                 // narratif IA + KPIs
    await evalJs(ws, SCROLL(520)); await sleep(11000)  // éléments critiques + SPOF + mitigations
    await evalJs(ws, SCROLL(0)); await sleep(1500)

    // 4 — Simulation holographique (le "wow")
    scene('0:53', 'Simulation — Faire tomber')
    await nav('/simulations'); await sleep(4800)
    await evalJs(ws, CLICK_SEL('button[aria-label*="tomber"]'))
    await sleep(12000)                 // cascade + panneau d'impact
    await evalJs(ws, `(() => { const b=[...document.querySelectorAll('button')].find(e=>/T\\+/.test(e.textContent)); b&&b.click() })()`)
    await sleep(7000)                  // détail d'un élément
    scene('1:16', 'Simulation — Cyberattaque (impact logique différent)')
    await evalJs(ws, CLICK_SEL('button[aria-label*="Cyberattaque"]'))
    await sleep(10000)

    // 5 — Dépendances inférées (le moat)
    scene('1:36', 'Dépendances inférées (moat)')
    await nav('/inference'); await sleep(2500)
    await evalJs(ws, CLICK_TEXT('button', 'Analyser mon graphe'))
    await sleep(27000)                 // l'IA analyse 97 nœuds → propositions (latence LLM)

    // 6 — Modèle d'entreprise + décision
    scene('1:51', "Modèle d'entreprise")
    await nav('/enterprise'); await sleep(13000)
    scene('2:04', 'Décision & simulation')
    await nav('/decision'); await sleep(11000)

    // 7 — Risques & résilience
    scene('2:15', 'Risques & SPOF')
    await nav('/risks'); await sleep(11000)
    scene('2:26', 'Fournisseurs')
    await nav('/suppliers'); await sleep(9000)
    scene('2:35', 'Dépendances humaines')
    await nav('/human'); await sleep(9000)

    // 8 — Connaissance / IA
    scene('2:44', 'Analyste IA')
    await nav('/ai'); await sleep(10000)
    scene('2:54', 'Rapports')
    await nav('/reports'); await sleep(9000)

    // 9 — Import & connecteurs (la couche au-dessus des silos)
    scene('3:03', 'Import & intégration')
    await nav('/onboarding'); await sleep(10000)
    scene('3:13', 'Connecteurs')
    await nav('/integrations'); await sleep(10000)

    // 10 — Clôture
    scene('3:23', "Vue d'ensemble")
    await nav('/'); await sleep(7000)
    scene('3:30', 'Clôture (vitrine)')
    await nav('/welcome'); await sleep(6000)

    console.log('\nDémo complète terminée (~3 min 40 – 4 min). Arrête ton enregistrement.')
    ws.close()
  } finally {
    await sleep(1000)
    chrome.kill()
  }
}
main().catch((e) => { console.error('ERREUR:', e.message); process.exit(1) })
