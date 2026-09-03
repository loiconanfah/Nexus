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
