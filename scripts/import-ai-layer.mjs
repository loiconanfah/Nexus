// Injecte une COUCHE IA de démo dans le tenant Bell (modèles, agents, fournisseurs
// IA, datasets) reliée aux applications et processus Bell existants. Illustre
// « AI Dependency Intelligence » : ce qui dépend de l'IA, et de quoi l'IA dépend.
//   node scripts/import-ai-layer.mjs [API_URL]   (défaut http://localhost:5199)
const API = process.argv[2] ?? 'http://localhost:5199'

// [nom, type, criticité]
const ENTITIES = [
  ['OpenAI (GPT)', 'AiProvider', 82],
  ['Anthropic (Claude)', 'AiProvider', 80],
  ['Google Vertex AI', 'AiProvider', 72],
  ['GPT-4o — Copilote support', 'AiModel', 84],
  ['Claude — Analyse fraude', 'AiModel', 90],
  ['Modèle Churn (rétention)', 'AiModel', 80],
  ['Modèle NLP (routage tickets)', 'AiModel', 72],
  ['Endpoint LLM interne (passerelle)', 'ModelEndpoint', 88],
  ['Agent Copilote Support', 'AiAgent', 80],
  ['Agent Détection Fraude', 'AiAgent', 88],
  ['Agent Optimisation Réseau (RAN)', 'AiAgent', 85],
  ['Flux Résumé d’appel', 'AiWorkflow', 66],
  ['Flux Recommandation d’offre', 'AiWorkflow', 68],
  ['Dataset Historique CDR', 'Dataset', 76],
  ['Dataset Transcriptions support', 'Dataset', 60],
]

// [source, sourceType, target, targetType, relationType]  (« source dépend de target »)
const RELATIONS = [
  // Les applications/processus Bell UTILISENT des modèles IA
  ['CRM Entreprise', 'Application', 'GPT-4o — Copilote support', 'AiModel', 'USES_MODEL'],
  ['Self-Care Web', 'Application', 'GPT-4o — Copilote support', 'AiModel', 'USES_MODEL'],
  ['Application Mobile Client', 'Application', 'GPT-4o — Copilote support', 'AiModel', 'USES_MODEL'],
  ['Détection Fraude', 'Application', 'Claude — Analyse fraude', 'AiModel', 'USES_MODEL'],
  ['Recouvrement', 'BusinessProcess', 'Modèle Churn (rétention)', 'AiModel', 'USES_MODEL'],
  ['Assurance / Fault Mgmt', 'Application', 'Modèle NLP (routage tickets)', 'AiModel', 'USES_MODEL'],
  // Ce qui INVOQUE un agent / flux / endpoint (dépend de lui)
  ['Détection Fraude', 'Application', 'Agent Détection Fraude', 'AiAgent', 'INVOKES'],
  ['CRM Entreprise', 'Application', 'Agent Copilote Support', 'AiAgent', 'INVOKES'],
  ['Résolution d’incident réseau', 'BusinessProcess', 'Agent Optimisation Réseau (RAN)', 'AiAgent', 'INVOKES'],
  ['Order Management', 'Application', 'Flux Recommandation d’offre', 'AiWorkflow', 'INVOKES'],
  ['Activation nouvel abonné', 'BusinessProcess', 'Flux Résumé d’appel', 'AiWorkflow', 'INVOKES'],
  ['Agent Copilote Support', 'AiAgent', 'Endpoint LLM interne (passerelle)', 'ModelEndpoint', 'INVOKES'],
  ['Agent Optimisation Réseau (RAN)', 'AiAgent', 'Endpoint LLM interne (passerelle)', 'ModelEndpoint', 'INVOKES'],
  ['Agent Détection Fraude', 'AiAgent', 'Claude — Analyse fraude', 'AiModel', 'INVOKES'],
  // Les modèles/endpoints sont SERVIS PAR des fournisseurs IA (dépendent d'eux)
  ['GPT-4o — Copilote support', 'AiModel', 'OpenAI (GPT)', 'AiProvider', 'SERVED_BY'],
  ['Claude — Analyse fraude', 'AiModel', 'Anthropic (Claude)', 'AiProvider', 'SERVED_BY'],
  ['Modèle Churn (rétention)', 'AiModel', 'Google Vertex AI', 'AiProvider', 'SERVED_BY'],
  ['Modèle NLP (routage tickets)', 'AiModel', 'Google Vertex AI', 'AiProvider', 'SERVED_BY'],
  ['Endpoint LLM interne (passerelle)', 'ModelEndpoint', 'OpenAI (GPT)', 'AiProvider', 'SERVED_BY'],
  // Flux de DONNÉES (visibilité vie privée) et datasets d'entraînement
  ['Application Mobile Client', 'Application', 'GPT-4o — Copilote support', 'AiModel', 'SENDS_DATA_TO'],
  ['Détection Fraude', 'Application', 'Claude — Analyse fraude', 'AiModel', 'SENDS_DATA_TO'],
  ['Modèle Churn (rétention)', 'AiModel', 'Dataset Historique CDR', 'Dataset', 'SENDS_DATA_TO'],
  ['Agent Copilote Support', 'AiAgent', 'Dataset Transcriptions support', 'Dataset', 'SENDS_DATA_TO'],
  // Les flux ORCHESTRENT des agents (dépendent d'eux)
  ['Flux Résumé d’appel', 'AiWorkflow', 'Agent Copilote Support', 'AiAgent', 'ORCHESTRATES'],
  ['Flux Recommandation d’offre', 'AiWorkflow', 'Agent Copilote Support', 'AiAgent', 'ORCHESTRATES'],
]

const csv = (rows) => rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n') + '\n'

async function importCsv(token, text, filename, profile) {
  const fd = new FormData()
  fd.append('file', new Blob([text], { type: 'text/csv' }), filename)
  fd.append('profile', JSON.stringify(profile))
  const r = await fetch(`${API}/api/v1/imports/csv`, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd })
  return { status: r.status, body: (await r.text()).slice(0, 200) }
}

const login = await fetch(`${API}/api/v1/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'demo-bell@lenexus.demo', password: 'lenexus-demo-2026' }),
}).then((r) => r.json())
if (!login.token) throw new Error('Connexion démo Bell échouée.')
console.log('Connecté demo-bell, tenant', login.tenantId.slice(0, 8))

// Entités
const ents = csv([['name', 'type', 'criticality'], ...ENTITIES.map((e) => [e[0], e[1], e[2]])])
const eProfile = { sourceSystem: 'AI Layer', entities: [{ dataset: 'ai', entityType: 'AiModel', nameColumn: 'name', entityTypeColumn: 'type', criticalityColumn: 'criticality' }], relations: [] }
console.log('[ENTITÉS IA]', (await importCsv(login.token, ents, 'ai_entities.csv', eProfile)).body)

// Relations par type
const byType = {}
for (const r of RELATIONS) (byType[r[4]] ??= []).push(r)
for (const [rel, rows] of Object.entries(byType)) {
  const text = csv([['source', 'source_type', 'target', 'target_type', 'confidence'], ...rows.map((r) => [r[0], r[1], r[2], r[3], 0.9])])
  const p = { sourceSystem: 'AI Layer', entities: [], relations: [{ dataset: 'ai', relationType: rel, sourceEntityType: 'Application', sourceNameColumn: 'source', targetEntityType: 'AiModel', targetNameColumn: 'target', sourceTypeColumn: 'source_type', targetTypeColumn: 'target_type', confidenceColumn: 'confidence' }] }
  console.log(`[${rel}] (${rows.length})`, (await importCsv(login.token, text, `ai_${rel}.csv`, p)).body)
}
console.log('Couche IA importée.')
