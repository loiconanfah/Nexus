/*
  IndexNow : prévient Bing (et les moteurs qui partagent le protocole) qu'une
  page a été publiée ou mise à jour, au lieu d'attendre leur prochain passage.

  La clé est publiée à la racine du site (fichier <clé>.txt), ce qui prouve que
  le domaine nous appartient.

  Utilisation, après un déploiement en production :
      node scripts/indexnow.mjs            toutes les adresses du sitemap
      node scripts/indexnow.mjs /blog      seulement ces adresses

  Ce script contacte un service externe : il n'est jamais lancé automatiquement
  par le build.
*/
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const HOST = 'lenexux.com'
const ENDPOINT = 'https://api.indexnow.org/IndexNow'

const key = readdirSync(join(root, 'public')).find((f) => /^[0-9a-f]{32}\.txt$/.test(f))?.replace('.txt', '')
if (!key) { console.error('Aucune clé IndexNow dans public/ (fichier <clé>.txt).'); process.exit(1) }

function sitemapUrls() {
  const xml = readFileSync(join(root, 'dist/sitemap.xml'), 'utf8')
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
}

const args = process.argv.slice(2)
const urlList = args.length ? args.map((a) => (a.startsWith('http') ? a : `https://${HOST}${a}`)) : sitemapUrls()

const body = { host: HOST, key, keyLocation: `https://${HOST}/${key}.txt`, urlList }
const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
})
console.log(`IndexNow : ${res.status} ${res.statusText} pour ${urlList.length} adresse(s)`)
if (res.status >= 400) console.log(await res.text())
