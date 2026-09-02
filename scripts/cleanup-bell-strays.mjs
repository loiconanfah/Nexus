// Supprime les entités de TEST parasites du tenant Bell en ligne (non liées à Bell).
// À lancer APRÈS déploiement de l'endpoint DELETE /api/v1/entities/{id}.
//   node scripts/cleanup-bell-strays.mjs [API_URL]
const API = process.argv[2] ?? 'https://nexus-api-rzh9.onrender.com'
const STRAYS = new Set(['SQL01', 'WEB01', 'AD01', 'ERP', 'CRM', 'Billing', 'Payroll'])

const login = await fetch(`${API}/api/v1/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'demo-bell@lenexus.demo', password: 'lenexus-demo-2026' }),
}).then((r) => r.json())
const auth = { Authorization: `Bearer ${login.token}` }

const ents = await fetch(`${API}/api/v1/entities?limit=500`, { headers: auth }).then((r) => r.json())
const items = Array.isArray(ents) ? ents : (ents.items ?? ents.entities ?? [])
const targets = items.filter((e) => STRAYS.has(e.name))
console.log(`${targets.length} parasite(s) à supprimer.`)

for (const e of targets) {
  const res = await fetch(`${API}/api/v1/entities/${e.id}`, { method: 'DELETE', headers: auth })
  console.log(`  ${res.status === 204 ? '✓' : '✗ ' + res.status}  ${e.entityType ?? e.type} :: ${e.name}`)
}
console.log('Terminé.')
