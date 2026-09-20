/*
  Pré-rendu des pages publiques.

  Pourquoi : le site est une application monopage. Sans ce traitement, chaque
  adresse renvoie le même index.html, avec le titre de l'accueil et un contenu
  vide tant que le JavaScript n'a pas été exécuté. Google finit par l'exécuter,
  mais les robots des assistants IA (GPTBot, ClaudeBot, PerplexityBot), eux, ne
  l'exécutent pas : pour eux le site n'a aucun contenu.

  Ce script lance le site construit, ouvre chaque page publique dans un
  navigateur sans interface, et enregistre le HTML obtenu dans dist/<route>/index.html.
  Vercel sert ces fichiers en priorité ; l'application reprend la main dès que
  le JavaScript est chargé, sans que le visiteur voie de différence.

  Utilisation : node scripts/prerender.mjs (appelé par « npm run build »).
*/
import { spawn } from 'node:child_process'
import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const PORT = 4183

/** Adresses publiques à figer. Les écrans de l'application restent privés. */
function routes() {
  const list = ['/', '/welcome', '/demo', '/docs', '/legal', '/solutions', '/videos', '/blog']
  const blog = readFileSync(join(root, 'src/lib/blog.ts'), 'utf8')
  for (const m of blog.matchAll(/slug: '([^']+)'/g)) list.push(`/blog/${m[1]}`)
  return list
}

/*
  Le navigateur : celui de la machine s'il y en a un, sinon celui que puppeteer
  installe avec les dependances. Le second cas est celui du serveur de
  construction, ou aucun navigateur n'est fourni.
*/
async function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean)
  const local = candidates.find((p) => existsSync(p))
  if (local) return local

  try {
    const puppeteer = (await import('puppeteer')).default
    const p = await puppeteer.executablePath()
    if (existsSync(p)) return p
  } catch { /* puppeteer absent : traite plus bas */ }
  return undefined
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function serverReady(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url)
      if (res.ok) return true
    } catch { /* pas encore prêt */ }
    await wait(500)
  }
  return false
}

/** Sitemap construit à partir des pages réellement rendues. */
function writeSitemap(list) {
  const blog = readFileSync(join(root, 'src/lib/blog.ts'), 'utf8')
  const dates = Object.fromEntries(
    [...blog.matchAll(/slug: '([^']+)',\s+date: '([^']+)'/g)].map((m) => [`/blog/${m[1]}`, m[2]]))
  const today = new Date().toISOString().slice(0, 10)
  const priority = (r) => (r === '/' ? '1.0' : r.startsWith('/blog/') ? '0.6' : '0.8')
  const freq = (r) => (r === '/' || r === '/blog' ? 'weekly' : 'monthly')
  const urls = list
    // « /welcome » sert le même contenu que « / » : une seule adresse est indexée.
    .filter((r) => r !== '/welcome')
    .map((r) => [
      '  <url>',
      `    <loc>https://lenexux.com${r === '/' ? '/' : r}</loc>`,
      `    <lastmod>${dates[r] ?? today}</lastmod>`,
      `    <changefreq>${freq(r)}</changefreq>`,
      `    <priority>${priority(r)}</priority>`,
      '  </url>',
    ].join('\n'))
    .join('\n')
  const xml = ['<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', urls, '</urlset>', ''].join('\n')
  writeFileSync(join(dist, 'sitemap.xml'), xml, 'utf8')
  console.log(`[prerender] sitemap.xml : ${list.length - 1} adresses`)
}

async function main() {
  const chrome = await chromePath()
  if (!chrome) {
    const message = 'Aucun navigateur trouvé. Installez les dépendances (puppeteer en fournit un) ou renseignez CHROME_PATH.'
    // Sur un serveur de construction, se taire reviendrait à publier un site
    // sans une seule page lisible par un robot : mieux vaut arrêter là.
    if (process.env.CI || process.env.VERCEL) throw new Error(message)
    console.warn(`[prerender] ${message} Pré-rendu ignoré : le site reste fonctionnel, mais les robots sans JavaScript ne verront pas le contenu.`)
    return
  }
  console.log(`[prerender] navigateur : ${chrome}`)

  const server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['vite', 'preview', '--port', String(PORT), '--strictPort'],
    { cwd: root, stdio: 'ignore', shell: process.platform === 'win32' })

  try {
    const base = `http://localhost:${PORT}`
    if (!await serverReady(base)) throw new Error('le serveur local n’a pas démarré')

    const rendered = []
    for (const route of routes()) {
      const { stdout } = await run(chrome, [
        '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
        '--virtual-time-budget=9000', '--run-all-compositor-stages-before-draw',
        '--dump-dom', `${base}${route}`,
      ], { maxBuffer: 64 * 1024 * 1024, windowsHide: true })

      if (!stdout.includes('<div id="root">')) throw new Error(`page vide : ${route}`)
      const html = `<!doctype html>\n${stdout.trim()}\n`
      const out = route === '/' ? join(dist, 'index.html') : join(dist, route, 'index.html')
      mkdirSync(dirname(out), { recursive: true })
      writeFileSync(out, html, 'utf8')

      const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '(sans titre)'
      const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      rendered.push(route)
      console.log(`[prerender] ${route.padEnd(42)} ${String(Math.round(text.length / 1000)).padStart(3)} k caractères  ${title.slice(0, 60)}`)
    }
    writeSitemap(rendered)
  } finally {
    server.kill()
  }
}

main().catch((e) => { console.error('[prerender]', e.message); process.exit(1) })
