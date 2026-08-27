// Catalogue de connecteurs NEXUS.
// Statuts HONNÊTES :
//  - active   : opérationnel aujourd'hui (moteur d'ingestion universel).
//  - assisted : mapping d'ontologie déjà défini ; il suffit de fournir l'export
//               du fournisseur (CSV/JSON) et NEXUS le normalise — fonctionne dès
//               maintenant, sans OAuth.
//  - key      : intégration IA réelle, activée en ajoutant une clé API.
//  - roadmap  : nécessite une synchro API/OAuth live (à venir).

export type Tier = 'active' | 'assisted' | 'key' | 'roadmap'

export interface Connector {
  id: string
  name: string
  category: string
  authType: 'none' | 'export' | 'apikey' | 'oauth'
  tier: Tier
  glyph: string
  descFr: string
  descEn: string
  bringsFr: string
  bringsEn: string
  docUrl: string
}

// Catégories (clé -> libellé fr/en).
export const CATEGORIES: { key: string; fr: string; en: string }[] = [
  { key: 'files', fr: 'Fichiers & universel', en: 'Files & universal' },
  { key: 'ai', fr: 'IA & MCP', en: 'AI & MCP' },
  { key: 'itsm', fr: 'ITSM & CMDB', en: 'ITSM & CMDB' },
  { key: 'cloud', fr: 'Cloud', en: 'Cloud' },
  { key: 'observability', fr: 'Observabilité & APM', en: 'Observability & APM' },
  { key: 'platform', fr: 'Plateforme & conteneurs', en: 'Platform & containers' },
  { key: 'identity', fr: 'Identité', en: 'Identity' },
  { key: 'data', fr: 'Bases de données', en: 'Databases' },
  { key: 'business', fr: 'ERP & métier', en: 'ERP & business' },
  { key: 'knowledge', fr: 'Collaboration & savoir', en: 'Collaboration & knowledge' },
  { key: 'network', fr: 'Réseau', en: 'Network' },
  { key: 'security', fr: 'Sécurité', en: 'Security' },
]

export const CONNECTORS: Connector[] = [
  // ---- Fichiers & universel (actifs) ----
  { id: 'csv', name: 'CSV / Excel', category: 'files', authType: 'export', tier: 'active', glyph: 'CSV', descFr: 'Importez n’importe quel tableur d’actifs ou de dépendances.', descEn: 'Import any spreadsheet of assets or dependencies.', bringsFr: 'Entités, relations, criticité', bringsEn: 'Entities, relations, criticality', docUrl: 'https://www.rfc-editor.org/rfc/rfc4180' },
  { id: 'json', name: 'JSON / API générique', category: 'files', authType: 'export', tier: 'active', glyph: '{}', descFr: 'Déposez un JSON exporté ou pointez une URL renvoyant du JSON.', descEn: 'Drop an exported JSON or point to a URL returning JSON.', bringsFr: 'Entités & relations structurées', bringsEn: 'Structured entities & relations', docUrl: 'https://www.json.org/' },
  { id: 'ai-import', name: 'Import assisté par IA', category: 'files', authType: 'apikey', tier: 'active', glyph: 'AI', descFr: 'Collez des données brutes désordonnées — Claude déduit le mapping vers l’ontologie.', descEn: 'Paste messy raw data — Claude infers the mapping to the ontology.', bringsFr: 'Toute source tabulaire ou texte', bringsEn: 'Any tabular or text source', docUrl: 'https://docs.anthropic.com/' },
  { id: 'webhook', name: 'Webhook entrant', category: 'files', authType: 'apikey', tier: 'assisted', glyph: 'WH', descFr: 'Recevez des événements poussés (création/mise à jour d’actifs).', descEn: 'Receive pushed events (asset create/update).', bringsFr: 'Mises à jour incrémentales', bringsEn: 'Incremental updates', docUrl: 'https://www.rfc-editor.org/rfc/rfc8935' },

  // ---- IA & MCP ----
  { id: 'mcp-server', name: 'Serveur MCP NEXUS', category: 'ai', authType: 'apikey', tier: 'active', glyph: 'MCP', descFr: 'Exposez NEXUS comme serveur MCP : Claude interroge le graphe et lance des simulations.', descEn: 'Expose NEXUS as an MCP server: Claude queries the graph and runs simulations.', bringsFr: 'Requêtes graphe, risques, what-if', bringsEn: 'Graph queries, risks, what-if', docUrl: 'https://modelcontextprotocol.io/' },
  { id: 'claude', name: 'Claude (Anthropic)', category: 'ai', authType: 'apikey', tier: 'key', glyph: 'CL', descFr: 'Moteur d’analyse en langage naturel et de mapping automatique. Ajoutez une clé pour l’activer.', descEn: 'Natural-language analysis and auto-mapping engine. Add a key to enable.', bringsFr: 'Raisonnement, extraction, naturalisation', bringsEn: 'Reasoning, extraction, naturalization', docUrl: 'https://docs.anthropic.com/en/api/getting-started' },
  { id: 'openai', name: 'OpenAI', category: 'ai', authType: 'apikey', tier: 'key', glyph: 'AI', descFr: 'Fournisseur LLM alternatif pour l’analyse et le mapping. Activable par clé.', descEn: 'Alternative LLM provider for analysis and mapping. Enable by key.', bringsFr: 'Raisonnement, extraction', bringsEn: 'Reasoning, extraction', docUrl: 'https://platform.openai.com/docs' },
  { id: 'azure-openai', name: 'Azure OpenAI', category: 'ai', authType: 'apikey', tier: 'key', glyph: 'AZ', descFr: 'LLM hébergé Azure pour les déploiements souverains. Activable par clé.', descEn: 'Azure-hosted LLM for sovereign deployments. Enable by key.', bringsFr: 'Raisonnement, extraction', bringsEn: 'Reasoning, extraction', docUrl: 'https://learn.microsoft.com/azure/ai-services/openai/' },
  { id: 'mcp-client', name: 'Client MCP externe', category: 'ai', authType: 'oauth', tier: 'roadmap', glyph: 'MC', descFr: 'Ingérez le contexte d’autres serveurs MCP (dépôts, tickets, docs).', descEn: 'Ingest context from other MCP servers (repos, tickets, docs).', bringsFr: 'Contexte applicatif divers', bringsEn: 'Varied application context', docUrl: 'https://modelcontextprotocol.io/clients' },

  // ---- ITSM & CMDB ----
  { id: 'servicenow', name: 'ServiceNow CMDB', category: 'itsm', authType: 'export', tier: 'assisted', glyph: 'SN', descFr: 'Éléments de configuration (CI) et relations de la CMDB.', descEn: 'Configuration items (CIs) and relationships from the CMDB.', bringsFr: 'CI, relations, services', bringsEn: 'CIs, relationships, services', docUrl: 'https://docs.servicenow.com/bundle/washingtondc-servicenow-platform/page/product/configuration-management/concept/c_ITILConfigurationManagement.html' },
  { id: 'bmc-helix', name: 'BMC Helix / Remedy', category: 'itsm', authType: 'export', tier: 'assisted', glyph: 'BMC', descFr: 'CMDB Atrium : CI et dépendances de service.', descEn: 'Atrium CMDB: CIs and service dependencies.', bringsFr: 'CI, dépendances de service', bringsEn: 'CIs, service dependencies', docUrl: 'https://docs.bmc.com/docs/ac2402/' },
  { id: 'ivanti', name: 'Ivanti Neurons', category: 'itsm', authType: 'export', tier: 'assisted', glyph: 'IV', descFr: 'Inventaire d’actifs et cartographie de service.', descEn: 'Asset inventory and service mapping.', bringsFr: 'Actifs, services', bringsEn: 'Assets, services', docUrl: 'https://www.ivanti.com/products/ivanti-neurons' },
  { id: 'jira-sm', name: 'Jira Service Management', category: 'itsm', authType: 'export', tier: 'assisted', glyph: 'JSM', descFr: 'Assets (Insight) : objets et schémas de dépendances.', descEn: 'Assets (Insight): objects and dependency schemas.', bringsFr: 'Objets, dépendances', bringsEn: 'Objects, dependencies', docUrl: 'https://support.atlassian.com/jira-service-management-cloud/docs/what-is-assets/' },
  { id: 'freshservice', name: 'Freshservice', category: 'itsm', authType: 'export', tier: 'assisted', glyph: 'FS', descFr: 'CMDB et relations d’actifs.', descEn: 'CMDB and asset relationships.', bringsFr: 'Actifs, relations', bringsEn: 'Assets, relationships', docUrl: 'https://api.freshservice.com/' },

  // ---- Cloud ----
  { id: 'aws-config', name: 'AWS Config', category: 'cloud', authType: 'export', tier: 'assisted', glyph: 'AWS', descFr: 'Inventaire des ressources et relations de configuration.', descEn: 'Resource inventory and configuration relationships.', bringsFr: 'Ressources, relations', bringsEn: 'Resources, relationships', docUrl: 'https://docs.aws.amazon.com/config/latest/developerguide/resource-config-reference.html' },
  { id: 'azure-rg', name: 'Azure Resource Graph', category: 'cloud', authType: 'export', tier: 'assisted', glyph: 'AZ', descFr: 'Ressources Azure, régions et liens de service.', descEn: 'Azure resources, regions and service links.', bringsFr: 'Ressources, régions', bringsEn: 'Resources, regions', docUrl: 'https://learn.microsoft.com/azure/governance/resource-graph/overview' },
  { id: 'gcp-cai', name: 'Google Cloud Asset Inventory', category: 'cloud', authType: 'export', tier: 'assisted', glyph: 'GCP', descFr: 'Inventaire des actifs GCP et relations IAM.', descEn: 'GCP asset inventory and IAM relationships.', bringsFr: 'Actifs, IAM', bringsEn: 'Assets, IAM', docUrl: 'https://cloud.google.com/asset-inventory/docs/overview' },
  { id: 'oci', name: 'Oracle Cloud (OCI)', category: 'cloud', authType: 'export', tier: 'assisted', glyph: 'OCI', descFr: 'Ressources OCI et dépendances de compartiment.', descEn: 'OCI resources and compartment dependencies.', bringsFr: 'Ressources, compartiments', bringsEn: 'Resources, compartments', docUrl: 'https://docs.oracle.com/en-us/iaas/Content/ResourceManager/home.htm' },
  { id: 'ibm-cloud', name: 'IBM Cloud', category: 'cloud', authType: 'oauth', tier: 'roadmap', glyph: 'IBM', descFr: 'Inventaire des services IBM Cloud.', descEn: 'IBM Cloud service inventory.', bringsFr: 'Services, ressources', bringsEn: 'Services, resources', docUrl: 'https://cloud.ibm.com/docs' },

  // ---- Observabilité & APM ----
  { id: 'datadog', name: 'Datadog', category: 'observability', authType: 'export', tier: 'assisted', glyph: 'DD', descFr: 'Carte de services et dépendances inférées des traces.', descEn: 'Service map and dependencies inferred from traces.', bringsFr: 'Services, dépendances runtime', bringsEn: 'Services, runtime dependencies', docUrl: 'https://docs.datadoghq.com/tracing/services/services_map/' },
  { id: 'dynatrace', name: 'Dynatrace', category: 'observability', authType: 'export', tier: 'assisted', glyph: 'DT', descFr: 'Smartscape : topologie applicative découverte automatiquement.', descEn: 'Smartscape: auto-discovered application topology.', bringsFr: 'Topologie, dépendances', bringsEn: 'Topology, dependencies', docUrl: 'https://docs.dynatrace.com/docs/observe/smartscape' },
  { id: 'newrelic', name: 'New Relic', category: 'observability', authType: 'export', tier: 'assisted', glyph: 'NR', descFr: 'Cartes de service et entités observées.', descEn: 'Service maps and observed entities.', bringsFr: 'Entités, relations', bringsEn: 'Entities, relations', docUrl: 'https://docs.newrelic.com/docs/service-architecture-intelligence/' },
  { id: 'splunk', name: 'Splunk', category: 'observability', authType: 'export', tier: 'assisted', glyph: 'SP', descFr: 'Inventaire et relations extraits des index/ITSI.', descEn: 'Inventory and relations extracted from indexes/ITSI.', bringsFr: 'Services, entités', bringsEn: 'Services, entities', docUrl: 'https://docs.splunk.com/Documentation/ITSI' },
  { id: 'elastic', name: 'Elastic Observability', category: 'observability', authType: 'export', tier: 'assisted', glyph: 'EL', descFr: 'Cartes de service APM et entités.', descEn: 'APM service maps and entities.', bringsFr: 'Services, dépendances', bringsEn: 'Services, dependencies', docUrl: 'https://www.elastic.co/guide/en/observability/current/apm-service-maps.html' },
  { id: 'prometheus', name: 'Prometheus', category: 'observability', authType: 'export', tier: 'assisted', glyph: 'PR', descFr: 'Cibles et labels comme entités et liens.', descEn: 'Targets and labels as entities and links.', bringsFr: 'Cibles, labels', bringsEn: 'Targets, labels', docUrl: 'https://prometheus.io/docs/prometheus/latest/querying/api/' },
  { id: 'appdynamics', name: 'AppDynamics', category: 'observability', authType: 'oauth', tier: 'roadmap', glyph: 'AD', descFr: 'Flow maps applicatifs et niveaux.', descEn: 'Application flow maps and tiers.', bringsFr: 'Applications, tiers', bringsEn: 'Applications, tiers', docUrl: 'https://docs.appdynamics.com/' },

  // ---- Plateforme & conteneurs ----
  { id: 'kubernetes', name: 'Kubernetes', category: 'platform', authType: 'export', tier: 'assisted', glyph: 'K8s', descFr: 'Charges, services et namespaces comme entités du graphe.', descEn: 'Workloads, services and namespaces as graph entities.', bringsFr: 'Workloads, services', bringsEn: 'Workloads, services', docUrl: 'https://kubernetes.io/docs/reference/kubectl/' },
  { id: 'openshift', name: 'Red Hat OpenShift', category: 'platform', authType: 'export', tier: 'assisted', glyph: 'OS', descFr: 'Projets, déploiements et routes.', descEn: 'Projects, deployments and routes.', bringsFr: 'Déploiements, routes', bringsEn: 'Deployments, routes', docUrl: 'https://docs.openshift.com/' },
  { id: 'vmware', name: 'VMware vSphere', category: 'platform', authType: 'export', tier: 'assisted', glyph: 'VM', descFr: 'VM, hôtes et datastores.', descEn: 'VMs, hosts and datastores.', bringsFr: 'VM, hôtes, datastores', bringsEn: 'VMs, hosts, datastores', docUrl: 'https://developer.vmware.com/apis/vsphere-automation/latest/' },
  { id: 'consul', name: 'HashiCorp Consul', category: 'platform', authType: 'export', tier: 'assisted', glyph: 'HC', descFr: 'Catalogue de services et intentions (service mesh).', descEn: 'Service catalog and intentions (service mesh).', bringsFr: 'Services, liens mesh', bringsEn: 'Services, mesh links', docUrl: 'https://developer.hashicorp.com/consul/api-docs/catalog' },
  { id: 'terraform', name: 'Terraform (state)', category: 'platform', authType: 'export', tier: 'assisted', glyph: 'TF', descFr: 'Ressources et dépendances déclarées dans le state.', descEn: 'Resources and dependencies declared in state.', bringsFr: 'Ressources, dépendances', bringsEn: 'Resources, dependencies', docUrl: 'https://developer.hashicorp.com/terraform/language/state' },

  // ---- Identité ----
  { id: 'entra', name: 'Microsoft Entra ID / AD', category: 'identity', authType: 'export', tier: 'assisted', glyph: 'AAD', descFr: 'Personnes, rôles, groupes et dépendances d’authentification.', descEn: 'People, roles, groups and authentication dependencies.', bringsFr: 'Personnes, rôles, auth', bringsEn: 'People, roles, auth', docUrl: 'https://learn.microsoft.com/graph/api/resources/users' },
  { id: 'okta', name: 'Okta', category: 'identity', authType: 'export', tier: 'assisted', glyph: 'OK', descFr: 'Utilisateurs, apps et affectations.', descEn: 'Users, apps and assignments.', bringsFr: 'Utilisateurs, apps', bringsEn: 'Users, apps', docUrl: 'https://developer.okta.com/docs/reference/' },
  { id: 'ping', name: 'Ping Identity', category: 'identity', authType: 'oauth', tier: 'roadmap', glyph: 'PI', descFr: 'Fédération et applications connectées.', descEn: 'Federation and connected applications.', bringsFr: 'Apps, fédération', bringsEn: 'Apps, federation', docUrl: 'https://docs.pingidentity.com/' },
  { id: 'cyberark', name: 'CyberArk', category: 'identity', authType: 'oauth', tier: 'roadmap', glyph: 'CA', descFr: 'Comptes à privilèges et accès critiques.', descEn: 'Privileged accounts and critical access.', bringsFr: 'Comptes, accès', bringsEn: 'Accounts, access', docUrl: 'https://docs.cyberark.com/' },

  // ---- Bases de données ----
  { id: 'oracle-db', name: 'Oracle Database', category: 'data', authType: 'export', tier: 'assisted', glyph: 'ORA', descFr: 'Instances, schémas et liens (DB links).', descEn: 'Instances, schemas and database links.', bringsFr: 'Instances, schémas', bringsEn: 'Instances, schemas', docUrl: 'https://docs.oracle.com/en/database/' },
  { id: 'sqlserver', name: 'Microsoft SQL Server', category: 'data', authType: 'export', tier: 'assisted', glyph: 'MS', descFr: 'Bases, serveurs liés et dépendances.', descEn: 'Databases, linked servers and dependencies.', bringsFr: 'Bases, serveurs liés', bringsEn: 'Databases, linked servers', docUrl: 'https://learn.microsoft.com/sql/relational-databases/system-catalog-views/catalog-views-transact-sql' },
  { id: 'postgres', name: 'PostgreSQL', category: 'data', authType: 'export', tier: 'assisted', glyph: 'PG', descFr: 'Bases, schémas et dépendances (catalog).', descEn: 'Databases, schemas and dependencies (catalog).', bringsFr: 'Bases, schémas', bringsEn: 'Databases, schemas', docUrl: 'https://www.postgresql.org/docs/current/catalogs.html' },
  { id: 'mongodb', name: 'MongoDB', category: 'data', authType: 'export', tier: 'assisted', glyph: 'MG', descFr: 'Clusters, bases et collections.', descEn: 'Clusters, databases and collections.', bringsFr: 'Clusters, bases', bringsEn: 'Clusters, databases', docUrl: 'https://www.mongodb.com/docs/manual/reference/command/listDatabases/' },
  { id: 'mysql', name: 'MySQL / MariaDB', category: 'data', authType: 'export', tier: 'assisted', glyph: 'MY', descFr: 'Instances et schémas.', descEn: 'Instances and schemas.', bringsFr: 'Instances, schémas', bringsEn: 'Instances, schemas', docUrl: 'https://dev.mysql.com/doc/refman/8.4/en/information-schema.html' },

  // ---- ERP & métier ----
  { id: 'sap', name: 'SAP S/4HANA', category: 'business', authType: 'export', tier: 'assisted', glyph: 'SAP', descFr: 'Modules, interfaces et dépendances applicatives.', descEn: 'Modules, interfaces and application dependencies.', bringsFr: 'Modules, interfaces', bringsEn: 'Modules, interfaces', docUrl: 'https://api.sap.com/' },
  { id: 'oracle-ebs', name: 'Oracle E-Business Suite', category: 'business', authType: 'export', tier: 'assisted', glyph: 'EBS', descFr: 'Modules et intégrations métier.', descEn: 'Modules and business integrations.', bringsFr: 'Modules, intégrations', bringsEn: 'Modules, integrations', docUrl: 'https://docs.oracle.com/cd/E26401_01/index.htm' },
  { id: 'workday', name: 'Workday', category: 'business', authType: 'export', tier: 'assisted', glyph: 'WD', descFr: 'Personnes, rôles et processus RH/Finance.', descEn: 'People, roles and HR/Finance processes.', bringsFr: 'Personnes, processus', bringsEn: 'People, processes', docUrl: 'https://community.workday.com/sites/default/files/file-hosting/restapi/index.html' },
  { id: 'salesforce', name: 'Salesforce', category: 'business', authType: 'export', tier: 'assisted', glyph: 'SF', descFr: 'Objets, intégrations et flux critiques.', descEn: 'Objects, integrations and critical flows.', bringsFr: 'Objets, intégrations', bringsEn: 'Objects, integrations', docUrl: 'https://developer.salesforce.com/docs/apis' },
  { id: 'dynamics', name: 'Microsoft Dynamics 365', category: 'business', authType: 'export', tier: 'assisted', glyph: 'D365', descFr: 'Applications métier et connexions Dataverse.', descEn: 'Business apps and Dataverse connections.', bringsFr: 'Apps, connexions', bringsEn: 'Apps, connections', docUrl: 'https://learn.microsoft.com/dynamics365/' },

  // ---- Collaboration & savoir ----
  { id: 'confluence', name: 'Jira / Confluence', category: 'knowledge', authType: 'export', tier: 'assisted', glyph: 'CF', descFr: 'Extraction des dépendances humaines et processus non documentés.', descEn: 'Extract human dependencies and undocumented processes.', bringsFr: 'Savoir, propriétaires', bringsEn: 'Knowledge, owners', docUrl: 'https://developer.atlassian.com/cloud/confluence/rest/v2/' },
  { id: 'sharepoint', name: 'SharePoint', category: 'knowledge', authType: 'export', tier: 'assisted', glyph: 'SPO', descFr: 'Runbooks et documentation à analyser.', descEn: 'Runbooks and documentation to analyze.', bringsFr: 'Documents, runbooks', bringsEn: 'Documents, runbooks', docUrl: 'https://learn.microsoft.com/sharepoint/dev/apis/sharepoint-rest-graph' },
  { id: 'slack', name: 'Slack', category: 'knowledge', authType: 'oauth', tier: 'roadmap', glyph: 'SL', descFr: 'Signaux de propriété et de savoir informels.', descEn: 'Informal ownership and knowledge signals.', bringsFr: 'Propriétaires, savoir', bringsEn: 'Owners, knowledge', docUrl: 'https://api.slack.com/' },
  { id: 'm365', name: 'Microsoft 365', category: 'knowledge', authType: 'export', tier: 'assisted', glyph: 'M365', descFr: 'Annuaire, groupes et applications.', descEn: 'Directory, groups and applications.', bringsFr: 'Annuaire, apps', bringsEn: 'Directory, apps', docUrl: 'https://learn.microsoft.com/graph/overview' },

  // ---- Réseau ----
  { id: 'cisco', name: 'Cisco DNA / Meraki', category: 'network', authType: 'export', tier: 'assisted', glyph: 'CIS', descFr: 'Périphériques réseau et topologie.', descEn: 'Network devices and topology.', bringsFr: 'Équipements, topologie', bringsEn: 'Devices, topology', docUrl: 'https://developer.cisco.com/docs/dna-center/' },
  { id: 'solarwinds', name: 'SolarWinds', category: 'network', authType: 'export', tier: 'assisted', glyph: 'SW', descFr: 'Cartographie réseau et dépendances.', descEn: 'Network mapping and dependencies.', bringsFr: 'Nœuds, liens', bringsEn: 'Nodes, links', docUrl: 'https://documentation.solarwinds.com/en/success_center/orionplatform/content/core-orion-sdk.htm' },
  { id: 'infoblox', name: 'Infoblox', category: 'network', authType: 'oauth', tier: 'roadmap', glyph: 'IB', descFr: 'DNS/DHCP/IPAM et dépendances associées.', descEn: 'DNS/DHCP/IPAM and associated dependencies.', bringsFr: 'DNS, IPAM', bringsEn: 'DNS, IPAM', docUrl: 'https://www.infoblox.com/products/nios/' },

  // ---- Sécurité ----
  { id: 'qualys', name: 'Qualys', category: 'security', authType: 'export', tier: 'assisted', glyph: 'QU', descFr: 'Actifs et vulnérabilités comme facteurs de risque.', descEn: 'Assets and vulnerabilities as risk factors.', bringsFr: 'Actifs, vulnérabilités', bringsEn: 'Assets, vulnerabilities', docUrl: 'https://docs.qualys.com/en/vm/api/' },
  { id: 'tenable', name: 'Tenable', category: 'security', authType: 'export', tier: 'assisted', glyph: 'TN', descFr: 'Inventaire et exposition des actifs.', descEn: 'Asset inventory and exposure.', bringsFr: 'Actifs, exposition', bringsEn: 'Assets, exposure', docUrl: 'https://developer.tenable.com/' },
  { id: 'crowdstrike', name: 'CrowdStrike', category: 'security', authType: 'oauth', tier: 'roadmap', glyph: 'CS', descFr: 'Actifs endpoints et criticité.', descEn: 'Endpoint assets and criticality.', bringsFr: 'Endpoints, criticité', bringsEn: 'Endpoints, criticality', docUrl: 'https://developer.crowdstrike.com/' },
  { id: 'defender', name: 'Microsoft Defender', category: 'security', authType: 'export', tier: 'assisted', glyph: 'DEF', descFr: 'Inventaire des appareils et recommandations.', descEn: 'Device inventory and recommendations.', bringsFr: 'Appareils, risques', bringsEn: 'Devices, risks', docUrl: 'https://learn.microsoft.com/defender-endpoint/api/exposed-apis-list' },
]

export const TIER_META: Record<Tier, { fr: string; en: string; color: string }> = {
  active: { fr: 'Actif', en: 'Live', color: '#4ade80' },
  assisted: { fr: 'Assisté', en: 'Assisted', color: '#00e5ff' },
  key: { fr: 'Prêt (clé)', en: 'Key-ready', color: '#c084fc' },
  roadmap: { fr: 'Roadmap', en: 'Planned', color: '#849396' },
}
