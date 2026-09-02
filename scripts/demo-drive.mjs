// Parcours de démo AUTO-PILOTÉ pour Lenexus (pitch investisseurs ~75 s).
// Ouvre une fenêtre Chrome VISIBLE, se connecte à la démo Bell, et joue la démo
// tout seul (navigation + saisie + simulation). Enregistre ton écran (OBS/Loom)
// pendant qu'il tourne. Aucune dépendance (CDP via Node).
//
//   node scripts/demo-drive.mjs            (démo locale : Vite 5173 + API 5199)
//   node scripts/demo-drive.mjs --deployed (site en ligne Render)
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
const PORT = 9333, W = 1600, H = 900

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
const nav = async (ws, path) => { await send(ws, 'Page.navigate', { url: WEB + path }); }

// Helpers exécutés dans la page
const CLICK_TEXT = (sel, text) => `(() => { const el=[...document.querySelectorAll('${sel}')].find(e=>e.textContent.trim().includes(${JSON.stringify(text)})); if(el){el.click();return true} return false })()`
const CLICK_SEL = (sel) => `(() => { const el=document.querySelector('${sel}'); if(el){el.click();return true} return false })()`

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
    let ver
    for (let i = 0; i < 40; i++) { try { ver = await fetch(`http://localhost:${PORT}/json/version`).then((r) => r.json()); break } catch { await sleep(300) } }
    const targets = await fetch(`http://localhost:${PORT}/json/list`).then((r) => r.json())
    const page = targets.find((t) => t.type === 'page') ?? targets[0]
    const ws = new WebSocket(page.webSocketDebuggerUrl)
    await new Promise((res) => (ws.onopen = res))
    await send(ws, 'Page.enable'); await send(ws, 'Runtime.enable')
    await send(ws, 'Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem('nexus.jwt', ${JSON.stringify(token)});localStorage.setItem('nexus.tenantId', ${JSON.stringify(tenantId)});}catch(e){}` })

    const say = (t) => console.log(`  ▸ ${t}`)

    // Scène 1 — Accroche (vitrine)
    say('Scène 1 : accroche (vitrine)')
    await nav(ws, '/welcome'); await sleep(7000)

    // Scène 2 — Le graphe vivant
    say('Scène 2 : le graphe de dépendances')
    await nav(ws, '/graph'); await sleep(6500)

    // Scène 3 — Impact transversal (langage naturel → cascade chiffrée)
    say('Scène 3 : impact transversal')
    await nav(ws, '/impact'); await sleep(2500)
    // Clique l'exemple « perte du fournisseur Ericsson » (lance l'analyse)
    await evalJs(ws, CLICK_TEXT('button', 'perdons le fournisseur Ericsson'))
    await sleep(9000) // laisse voir la cascade + les 3,7 M$ + SPOF

    // Scène 4 — Simulation holographique (le moment "wow")
    say('Scène 4 : simulation holographique')
    await nav(ws, '/simulations'); await sleep(4500) // rendu WebGL
    await evalJs(ws, CLICK_SEL('button[aria-label*="tomber"]')) // « Faire tomber »
    await sleep(10000) // cascade animée + panneau d'impact
    // Ouvre le détail d'un élément impacté
    await evalJs(ws, `(() => { const b=[...document.querySelectorAll('button')].find(e=>/T\\+/.test(e.textContent)); b&&b.click() })()`)
    await sleep(6000)

    // Scène 5 — Différenciation (retour vue d'ensemble puis clôture)
    say('Scène 5 : clôture')
    await nav(ws, '/'); await sleep(3500)
    await nav(ws, '/welcome'); await sleep(3500)

    console.log('\nDémo terminée (~75 s). Arrête ton enregistrement.')
    ws.close()
  } finally {
    await sleep(1000)
    chrome.kill()
  }
}
main().catch((e) => { console.error('ERREUR:', e.message); process.exit(1) })
