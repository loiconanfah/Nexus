// Libellés d'ontologie traduits par correspondance. La donnée stockée reste le
// code technique (Server, DependsOn…) ; seul l'affichage change avec la langue.

type T = (fr: string, en: string) => string

const ENTITY_TYPE: Record<string, [string, string]> = {
  Server: ['Serveur', 'Server'],
  Database: ['Base de données', 'Database'],
  Application: ['Application', 'Application'],
  Service: ['Service', 'Service'],
  System: ['Système', 'System'],
  BusinessProcess: ['Processus métier', 'Business Process'],
  BusinessService: ['Service métier', 'Business Service'],
  Process: ['Processus', 'Process'],
  Supplier: ['Fournisseur', 'Supplier'],
  Contract: ['Contrat', 'Contract'],
  Person: ['Personne', 'Person'],
  Role: ['Rôle', 'Role'],
  Team: ['Équipe', 'Team'],
  Network: ['Réseau', 'Network'],
  Device: ['Équipement', 'Device'],
  CloudResource: ['Ressource cloud', 'Cloud Resource'],
  DataStore: ['Magasin de données', 'Data Store'],
  Infrastructure: ['Infrastructure', 'Infrastructure'],
  Asset: ['Actif', 'Asset'],
  Control: ['Contrôle', 'Control'],
  Document: ['Document', 'Document'],
  Incident: ['Incident', 'Incident'],
  Risk: ['Risque', 'Risk'],
  Location: ['Site', 'Location'],
  Organization: ['Organisation', 'Organization'],
  BusinessUnit: ['Direction', 'Business Unit'],
  Identity: ['Identité', 'Identity'],
  Credential: ['Identifiant d’accès', 'Credential'],
  Policy: ['Politique', 'Policy'],
  Vulnerability: ['Vulnérabilité', 'Vulnerability'],
  Change: ['Changement', 'Change'],
  Event: ['Événement', 'Event'],
  // Couche IA
  AiModel: ['Modèle IA', 'AI Model'],
  AiAgent: ['Agent IA', 'AI Agent'],
  AiService: ['Service IA', 'AI Service'],
  ModelEndpoint: ['Endpoint modèle', 'Model Endpoint'],
  AiWorkflow: ['Flux IA', 'AI Workflow'],
  AiProvider: ['Fournisseur IA', 'AI Provider'],
  Dataset: ['Jeu de données', 'Dataset'],
}

const RELATION_TYPE: Record<string, [string, string]> = {
  DEPENDS_ON: ['dépend de', 'depends on'],
  DependsOn: ['dépend de', 'depends on'],
  RUNS_ON: ['s’exécute sur', 'runs on'],
  RunsOn: ['s’exécute sur', 'runs on'],
  HOSTS: ['héberge', 'hosts'],
  USES: ['utilise', 'uses'],
  Uses: ['utilise', 'uses'],
  SUPPLIED_BY: ['fourni par', 'supplied by'],
  SuppliedBy: ['fourni par', 'supplied by'],
  AUTHENTICATES: ['authentifie', 'authenticates'],
  Authenticates: ['authentifie', 'authenticates'],
  KNOWS: ['connaît', 'knows'],
  Knows: ['connaît', 'knows'],
  MAINTAINS: ['maintient', 'maintains'],
  PROTECTS: ['protège', 'protects'],
  Protects: ['protège', 'protects'],
  USES_MODEL: ['utilise le modèle', 'uses model'],
  INVOKES: ['invoque', 'invokes'],
  SERVED_BY: ['servi par', 'served by'],
  CAN_ACT_ON: ['peut agir sur', 'can act on'],
  SENDS_DATA_TO: ['envoie des données à', 'sends data to'],
  ORCHESTRATES: ['orchestre', 'orchestrates'],
  CONNECTS_TO: ['se connecte à', 'connects to'],
  COMMUNICATES_WITH: ['communique avec', 'communicates with'],
  CONNECTED_TO: ['relié à', 'connected to'],
  SUPPORTS: ['soutient', 'supports'],
  REQUIRES: ['requiert', 'requires'],
  STORES: ['stocke', 'stores'],
  PROCESSES: ['traite', 'processes'],
  OWNED_BY: ['appartient à', 'owned by'],
  MANAGED_BY: ['géré par', 'managed by'],
  OPERATED_BY: ['exploité par', 'operated by'],
  CONTRACTED_BY: ['sous contrat avec', 'contracted by'],
  LOCATED_IN: ['situé à', 'located in'],
  PART_OF: ['fait partie de', 'part of'],
  AFFECTS: ['affecte', 'affects'],
  IMPACTS: ['a touché', 'impacts'],
  TRIGGERS: ['déclenche', 'triggers'],
  BLOCKS: ['bloque', 'blocks'],
  REPLACED_BY: ['remplacé par', 'replaced by'],
  BACKED_UP_BY: ['secouru par', 'backed up by'],
  RECOVERS_WITH: ['se rétablit avec', 'recovers with'],
  HAS_ACCESS_TO: ['a accès à', 'has access to'],
  RESPONSIBLE_FOR: ['responsable de', 'responsible for'],
  DOCUMENTED_BY: ['documenté par', 'documented by'],
  RELATED_TO: ['lié à', 'related to'],
}

export function entityTypeLabel(type: string, t: T): string {
  const m = ENTITY_TYPE[type]
  return m ? t(m[0], m[1]) : type
}

export function relationTypeLabel(type: string, t: T): string {
  const m = RELATION_TYPE[type]
  return m ? t(m[0], m[1]) : type
}

const BAND: Record<string, [string, string]> = {
  Critical: ['Critique', 'Critical'],
  High: ['Élevé', 'High'],
  Elevated: ['Élevé', 'Elevated'],
  Moderate: ['Modéré', 'Moderate'],
  Low: ['Faible', 'Low'],
}
export function bandLabel(band: string, t: T): string {
  const m = BAND[band]
  return m ? t(m[0], m[1]) : band
}

/**
 * Statut de confiance d'une dépendance. Ces valeurs viennent de l'API sous
 * leur nom technique (Verified, AiSuggested…) : elles ne doivent jamais
 * apparaître telles quelles à l'écran.
 */
const CONFIDENCE_STATUS: Record<string, [string, string]> = {
  Verified: ['Vérifiée', 'Verified'],
  Imported: ['Importée', 'Imported'],
  Inferred: ['Déduite', 'Inferred'],
  AiSuggested: ['Proposée par l’IA', 'AI-proposed'],
  Unknown: ['Non confirmée', 'Unconfirmed'],
}
export function confidenceStatusLabel(status: string, t: T): string {
  const m = CONFIDENCE_STATUS[status]
  return m ? t(m[0], m[1]) : status
}

/** État d'une collecte confiée à une sonde. */
const JOB_STATUS: Record<string, [string, string]> = {
  pending: ['en attente', 'pending'],
  running: ['en cours', 'running'],
  done: ['terminée', 'done'],
  failed: ['échouée', 'failed'],
}
export function jobStatusLabel(status: string, t: T): string {
  const m = JOB_STATUS[status]
  return m ? t(m[0], m[1]) : status
}

/** Origine d'une preuve (Evidence Engine), en clair. */
const EVIDENCE_SOURCE: Record<string, [string, string]> = {
  HumanValidation: ['Validation humaine', 'Human validation'],
  Observation: ['Observation technique', 'Technical observation'],
  RestApi: ['API interrogée en direct', 'Live API'],
  DeterministicInference: ['Déduction du moteur', 'Engine deduction'],
  Import: ['Fichier importé', 'Imported file'],
  Declared: ['Saisie manuelle', 'Manually declared'],
  Document: ['Document', 'Document'],
  AiInference: ['Proposée par l’IA', 'AI-proposed'],
}
export function evidenceSourceLabel(source: string, t: T): string {
  const m = EVIDENCE_SOURCE[source]
  return m ? t(m[0], m[1]) : source
}

/**
 * Niveau de risque d'une dépendance humaine. L'API renvoie CRITICAL / HIGH /
 * MODERATE : ces codes ne doivent pas atteindre l'écran tels quels.
 */
const RISK_LEVEL: Record<string, [string, string]> = {
  CRITICAL: ['Critique', 'Critical'],
  HIGH: ['Élevé', 'High'],
  MODERATE: ['Modéré', 'Moderate'],
  LOW: ['Faible', 'Low'],
}
export function riskLevelLabel(level: string, t: T): string {
  const m = RISK_LEVEL[level]
  return m ? t(m[0], m[1]) : level
}

/** Rôle d'une personne. Les valeurs par défaut de l'API sont en anglais. */
const PERSON_ROLE: Record<string, [string, string]> = {
  'Knowledge Holder': ['Détenteur de savoir', 'Knowledge holder'],
  'Key Person': ['Personne clé', 'Key person'],
}
export function personRoleLabel(role: string, t: T): string {
  const m = PERSON_ROLE[role]
  return m ? t(m[0], m[1]) : role
}

/** Priorité d'une action du plan (valeurs API : High / Medium / Low). */
const PRIORITY: Record<string, [string, string]> = {
  High: ['Priorité haute', 'High priority'],
  Medium: ['Priorité moyenne', 'Medium priority'],
  Low: ['Priorité basse', 'Low priority'],
}
export function priorityLabel(priority: string, t: T): string {
  const m = PRIORITY[priority]
  return m ? t(m[0], m[1]) : priority
}

/** Nature d'une action : corriger un risque, ou préparer une solution de repli. */
const ACTION_KIND: Record<string, [string, string]> = {
  remediation: ['correction', 'remediation'],
  contingency: ['plan de repli', 'contingency'],
}
export function actionKindLabel(kind: string, t: T): string {
  const m = ACTION_KIND[kind]
  return m ? t(m[0], m[1]) : kind
}
