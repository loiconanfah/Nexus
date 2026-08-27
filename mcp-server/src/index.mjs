#!/usr/bin/env node
// Serveur MCP NEXUS — expose le graphe de dépendances opérationnelles comme
// outils MCP. Tout client MCP (Claude Desktop, Claude Code…) peut alors
// interroger NEXUS : « qu'est-ce qui casse si Entra ID tombe ? ».
//
// Configuration (variables d'environnement) :
//   NEXUS_API_URL   défaut http://localhost:5199/api/v1
//   NEXUS_TENANT_ID défaut le tenant de démo CGI
//
// Le serveur appelle l'API REST NEXUS existante — aucune donnée n'est dupliquée.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const API = process.env.NEXUS_API_URL ?? 'http://localhost:5199/api/v1'
const TENANT = process.env.NEXUS_TENANT_ID ?? 'c6100000-cf1c-4000-8000-000000000001'

async function nx(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'X-Tenant-Id': TENANT, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
  if (!res.ok) throw new Error(`NEXUS ${res.status} ${res.statusText} sur ${path}`)
  return res.json()
}

// Résout une entité par nom (insensible à la casse) via le graphe.
async function resolveEntity(name) {
  const graph = await nx('/graph')
  const term = name.trim().toLowerCase()
  return (graph.nodes ?? []).find((n) => n.name.toLowerCase() === term)
    ?? (graph.nodes ?? []).find((n) => n.name.toLowerCase().includes(term))
    ?? null
}

const text = (obj) => ({ content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2) }] })

const server = new McpServer({ name: 'nexus', version: '0.1.0' })

server.tool('nexus_overview', "Synthèse de résilience de l'organisation : score de santé, comptes d'entités/relations, SPOF, actifs critiques, concentration fournisseurs, renseignement prioritaire.", {}, async () => {
  const o = await nx('/overview')
  return text({
    healthScore: o.organizationHealthScore, entities: o.entityCount, relations: o.relationCount,
    spofCount: o.spofCount, criticalSpofCount: o.criticalSpofCount, criticalAssets: o.criticalAssetCount,
    supplierConcentrationPercent: o.supplierConcentrationPercent,
    topSpofs: (o.topSpofs ?? []).map((s) => ({ name: s.name, type: s.entityType, dependents: s.directDependents, blastRadius: s.blastRadius })),
  })
})

server.tool('nexus_top_risks', 'Les entités les plus risquées (score de risque expliqué 0-100, dépendants, rayon d’impact, redondance).', { limit: z.number().int().min(1).max(50).default(10) }, async ({ limit }) => {
  const rows = await nx('/risks/entities')
  return text(rows.slice(0, limit).map((r) => ({ name: r.name, type: r.entityType, score: Math.round(r.score), band: r.band, dependents: r.directDependents, blastRadius: r.blastRadius, hasRedundancy: r.hasRedundancy })))
})

server.tool('nexus_suppliers', 'Intelligence fournisseurs : risque, services critiques soutenus, concentration, alternatives.', {}, async () => {
  const d = await nx('/suppliers')
  return text({ summary: d.summary, suppliers: (d.suppliers ?? []).map((s) => ({ name: s.name, risk: Math.round(s.riskScore), band: s.riskBand, criticalServices: s.criticalServices, dependencies: s.dependencies, alternatives: s.alternatives })) })
})

server.tool('nexus_human_dependencies', 'Dépendances humaines : concentration de savoir, détenteurs uniques, processus non documentés.', {}, async () => {
  const d = await nx('/human-dependencies')
  return text({ summary: d.summary, people: (d.people ?? []).map((p) => ({ name: p.name, riskLevel: p.riskLevel, soleKnowledge: p.soleKnowledgeSystems, knownSystems: p.knownSystems })) })
})

server.tool('nexus_find_entity', 'Recherche une entité (système, appli, serveur, fournisseur, personne…) par nom.', { name: z.string() }, async ({ name }) => {
  const graph = await nx('/graph')
  const term = name.trim().toLowerCase()
  const matches = (graph.nodes ?? []).filter((n) => n.name.toLowerCase().includes(term)).slice(0, 20)
  return text(matches.map((n) => ({ name: n.name, type: n.entityType, criticality: n.criticality })))
})

server.tool('nexus_entity_risk', 'Évaluation de risque détaillée et explicable d’une entité par son nom.', { name: z.string() }, async ({ name }) => {
  const e = await resolveEntity(name)
  if (!e) return text(`Aucune entité correspondant à « ${name} ».`)
  const r = await nx(`/entities/${e.id}/risk`)
  return text({ entity: e.name, type: e.entityType, score: Math.round(r.assessment.score), band: r.assessment.band, directDependents: r.directDependents, blastRadius: r.blastRadius, hasRedundancy: r.hasRedundancy, breakdown: r.assessment.breakdown })
})

server.tool('nexus_simulate', "Simule la défaillance d'une entité (what-if) et renvoie la cascade d'impact.", {
  name: z.string().describe('Nom de l’actif/nœud d’origine'),
  scenario: z.enum(['ServerFailure', 'DatabaseFailure', 'ApplicationFailure', 'NetworkFailure', 'SupplierFailure', 'EmployeeLoss', 'LocationFailure', 'CloudRegionFailure', 'CyberIncident', 'DataLoss', 'PowerOutage', 'CommunicationFailure']).default('CyberIncident'),
  maxDepth: z.number().int().min(1).max(15).default(10),
}, async ({ name, scenario, maxDepth }) => {
  const e = await resolveEntity(name)
  if (!e) return text(`Aucune entité correspondant à « ${name} ».`)
  const r = await nx('/simulations', { method: 'POST', body: JSON.stringify({ assetId: e.id, scenario, maxDepth }) })
  return text({ origin: e.name, scenario, affectedTotal: r.affectedTotal, estimatedOperationalImpact: r.estimatedOperationalImpact, affectedByType: r.affectedByType, maxDepth: r.maxDepth, affected: (r.affected ?? []).slice(0, 25).map((a) => ({ name: a.entity.name, type: a.entity.entityType, depth: a.depth })) })
})

server.tool('nexus_ask', "Pose une question en langage naturel à l'analyste NEXUS (réponse ancrée dans les moteurs, avec preuves et confiance).", { question: z.string() }, async ({ question }) => {
  const a = await nx('/ai/ask', { method: 'POST', body: JSON.stringify({ question }) })
  return text({ answer: a.answer, confidence: a.confidence, intent: a.intent, affectedAssets: a.affectedAssets, recommendedAction: a.recommendedAction })
})

const transport = new StdioServerTransport()
await server.connect(transport)
console.error(`[nexus-mcp] connecté · API=${API} · tenant=${TENANT}`)
