/**
 * Génère src/lib/vendor-logos.ts à partir de simple-icons.
 *
 * Pourquoi générer plutôt qu'importer le paquet : simple-icons pèse 3 400 icônes,
 * dont quinze nous servent. Le fichier produit ne contient que celles-là, donc
 * rien à charger à l'exécution, aucun appel réseau, et l'application reste
 * utilisable hors ligne.
 *
 * Quatre marques ont demandé leur retrait de simple-icons (Microsoft, Amazon,
 * ServiceNow, Freshworks). Elles reçoivent un monogramme dans leur couleur : ce
 * n'est pas un oubli, c'est le respect de ce retrait.
 *
 *     node scripts/generer-logos.mjs
 */
import { writeFileSync } from 'node:fs'
import * as si from 'simple-icons'

/** Connecteur -> icône simple-icons (slug) ou monogramme de repli. */
const VENDORS = {
  entra: { fallback: 'MS', hex: '0078D4' },
  okta: { slug: 'okta' },
  'google-workspace': { slug: 'google' },
  azure: { fallback: 'AZ', hex: '0078D4' },
  aws: { fallback: 'AWS', hex: 'FF9900' },
  gcp: { slug: 'googlecloud' },
  servicenow: { fallback: 'SN', hex: '293E40' },
  freshservice: { fallback: 'FS', hex: '2C9E4B' },
  datadog: { slug: 'datadog' },
  dynatrace: { slug: 'dynatrace' },
  kubernetes: { slug: 'kubernetes' },
  atlassian: { slug: 'atlassian' },
  github: { slug: 'github' },
  gitlab: { slug: 'gitlab' },
  backstage: { slug: 'backstage' },
}

/**
 * Les marques reconnues DANS LE GRAPHE.
 *
 * Un actif nomme « GitHub » ou « Datadog » doit se reconnaitre a sa marque, pas
 * a une icone generique : c'est ce qui fait passer une carte de « ronds gris »
 * a « nos systemes ». Chaque entree donne les mots a chercher dans le nom.
 *
 * Les mots trop courants en francais ou en anglais (sage, square, vault,
 * spring, notion) sont volontairement absents : une fausse reconnaissance est
 * pire qu'une icone generique.
 */
const BRANDS = {
  // Retirees de simple-icons a la demande de leur proprietaire : monogramme.
  microsoft: { fallback: 'MS', hex: '0078D4', match: ['microsoft', 'm365', 'office 365', 'entra', 'active directory', 'sharepoint', 'teams', 'outlook', 'exchange'] },
  azure: { fallback: 'AZ', hex: '0078D4', match: ['azure'] },
  aws: { fallback: 'AWS', hex: 'FF9900', match: ['aws', 'amazon web services', 'amazon s3', 'ec2', 'rds'] },
  servicenow: { fallback: 'SN', hex: '293E40', match: ['servicenow', 'service now'] },
  freshservice: { fallback: 'FS', hex: '2C9E4B', match: ['freshservice', 'freshdesk', 'freshworks'] },
  oracle: { fallback: 'ORA', hex: 'C74634', match: ['oracle', 'ebs', 'peoplesoft'] },
  salesforce: { fallback: 'SF', hex: '00A1E0', match: ['salesforce', 'sfdc'] },
  slack: { fallback: 'SK', hex: '4A154B', match: ['slack'] },

  // Marques disponibles en trace libre.
  googlecloud: { slug: 'googlecloud', match: ['google cloud', 'gcp', 'bigquery'] },
  google: { slug: 'google', match: ['google', 'workspace', 'gmail'] },
  sap: { slug: 'sap', match: ['sap', 's/4hana', 'hana'] },
  okta: { slug: 'okta', match: ['okta'] },
  datadog: { slug: 'datadog', match: ['datadog'] },
  dynatrace: { slug: 'dynatrace', match: ['dynatrace'] },
  splunk: { slug: 'splunk', match: ['splunk'] },
  newrelic: { slug: 'newrelic', match: ['new relic', 'newrelic'] },
  grafana: { slug: 'grafana', match: ['grafana'] },
  prometheus: { slug: 'prometheus', match: ['prometheus'] },
  elastic: { slug: 'elastic', match: ['elastic', 'kibana', 'logstash'] },
  kubernetes: { slug: 'kubernetes', match: ['kubernetes', 'k8s', 'openshift'] },
  docker: { slug: 'docker', match: ['docker'] },
  vmware: { slug: 'vmware', match: ['vmware', 'vsphere', 'esxi'] },
  proxmox: { slug: 'proxmox', match: ['proxmox'] },
  openstack: { slug: 'openstack', match: ['openstack'] },
  nginx: { slug: 'nginx', match: ['nginx'] },
  linux: { slug: 'linux', match: ['linux', 'rhel', 'red hat'] },
  ubuntu: { slug: 'ubuntu', match: ['ubuntu', 'debian'] },
  postgresql: { slug: 'postgresql', match: ['postgres', 'postgresql'] },
  mysql: { slug: 'mysql', match: ['mysql'] },
  mariadb: { slug: 'mariadb', match: ['mariadb'] },
  mongodb: { slug: 'mongodb', match: ['mongo', 'mongodb'] },
  redis: { slug: 'redis', match: ['redis'] },
  neo4j: { slug: 'neo4j', match: ['neo4j'] },
  sqlite: { slug: 'sqlite', match: ['sqlite'] },
  clickhouse: { slug: 'clickhouse', match: ['clickhouse'] },
  influxdb: { slug: 'influxdb', match: ['influx', 'influxdb'] },
  snowflake: { slug: 'snowflake', match: ['snowflake'] },
  databricks: { slug: 'databricks', match: ['databricks'] },
  apachekafka: { slug: 'apachekafka', match: ['kafka'] },
  rabbitmq: { slug: 'rabbitmq', match: ['rabbitmq'] },
  github: { slug: 'github', match: ['github'] },
  gitlab: { slug: 'gitlab', match: ['gitlab'] },
  bitbucket: { slug: 'bitbucket', match: ['bitbucket'] },
  jira: { slug: 'jira', match: ['jira'] },
  confluence: { slug: 'confluence', match: ['confluence'] },
  atlassian: { slug: 'atlassian', match: ['atlassian'] },
  jenkins: { slug: 'jenkins', match: ['jenkins'] },
  terraform: { slug: 'terraform', match: ['terraform'] },
  ansible: { slug: 'ansible', match: ['ansible'] },
  cloudflare: { slug: 'cloudflare', match: ['cloudflare'] },
  stripe: { slug: 'stripe', match: ['stripe'] },
  paypal: { slug: 'paypal', match: ['paypal'] },
  visa: { slug: 'visa', match: ['visa'] },
  mastercard: { slug: 'mastercard', match: ['mastercard'] },
  adyen: { slug: 'adyen', match: ['adyen'] },
  quickbooks: { slug: 'quickbooks', match: ['quickbooks'] },
  odoo: { slug: 'odoo', match: ['odoo'] },
  zendesk: { slug: 'zendesk', match: ['zendesk'] },
  hubspot: { slug: 'hubspot', match: ['hubspot'] },
  shopify: { slug: 'shopify', match: ['shopify'] },
  wordpress: { slug: 'wordpress', match: ['wordpress'] },
  zoom: { slug: 'zoom', match: ['zoom'] },
  figma: { slug: 'figma', match: ['figma'] },
  cisco: { slug: 'cisco', match: ['cisco', 'meraki'] },
  fortinet: { slug: 'fortinet', match: ['fortinet', 'fortigate'] },
  paloaltonetworks: { slug: 'paloaltonetworks', match: ['palo alto'] },
  auth0: { slug: 'auth0', match: ['auth0'] },
  keycloak: { slug: 'keycloak', match: ['keycloak'] },
  pagerduty: { slug: 'pagerduty', match: ['pagerduty'] },
  opsgenie: { slug: 'opsgenie', match: ['opsgenie'] },
  sentry: { slug: 'sentry', match: ['sentry'] },
  firebase: { slug: 'firebase', match: ['firebase'] },
  digitalocean: { slug: 'digitalocean', match: ['digitalocean'] },
  vercel: { slug: 'vercel', match: ['vercel'] },
  netlify: { slug: 'netlify', match: ['netlify'] },
  backstage: { slug: 'backstage', match: ['backstage'] },
}

const brandEntries = []
for (const [key, spec] of Object.entries(BRANDS)) {
  const match = JSON.stringify(spec.match)
  if (spec.slug) {
    const k = 'si' + spec.slug.charAt(0).toUpperCase() + spec.slug.slice(1)
    const icon = si[k]
    if (!icon) throw new Error(`Marque introuvable : ${spec.slug}`)
    brandEntries.push(`  { key: '${key}', hex: '#${icon.hex}', match: ${match}, path: ${JSON.stringify(icon.path)} },`)
  } else {
    brandEntries.push(`  { key: '${key}', hex: '#${spec.hex}', match: ${match}, initials: '${spec.fallback}' },`)
  }
}

const entries = []
for (const [id, spec] of Object.entries(VENDORS)) {
  if (spec.slug) {
    const key = 'si' + spec.slug.charAt(0).toUpperCase() + spec.slug.slice(1)
    const icon = si[key]
    if (!icon) throw new Error(`Icône introuvable dans simple-icons : ${spec.slug}`)
    entries.push(`  '${id}': { hex: '#${icon.hex}', title: ${JSON.stringify(icon.title)}, path: ${JSON.stringify(icon.path)} },`)
  } else {
    entries.push(`  '${id}': { hex: '#${spec.hex}', title: '', initials: '${spec.fallback}' },`)
  }
}

const file = `// Généré par scripts/generer-logos.mjs. Ne pas modifier à la main.
//
// Les marques appartiennent à leurs propriétaires ; elles ne sont utilisées ici
// que pour DÉSIGNER le système auquel Lenexux se branche. Quatre d'entre elles
// ont demandé leur retrait de simple-icons et reçoivent un monogramme.

export interface VendorLogo {
  /** Couleur officielle de la marque, pour le fond du carré. */
  hex: string
  title: string
  /** Tracé SVG (viewBox 24x24), absent pour un monogramme. */
  path?: string
  /** Monogramme de repli, quand la marque n'offre pas de tracé libre. */
  initials?: string
}

export const VENDOR_LOGOS: Record<string, VendorLogo> = {
${entries.join('\n')}
}

/** Une marque reconnaissable dans le nom d'un actif. */
export interface BrandMark extends Omit<VendorLogo, 'title'> {
  key: string
  /** Mots a chercher dans le nom, en minuscules. */
  match: string[]
}

/**
 * Les marques reconnues dans le graphe. L'ordre compte : la premiere
 * correspondance gagne, les libelles les plus precis sont donc places avant.
 */
export const BRAND_MARKS: BrandMark[] = [
${brandEntries.join('\n')}
]
`

writeFileSync(new URL('../src/lib/vendor-logos.ts', import.meta.url), file)
console.log(`${entries.length} logos de connecteurs, ${brandEntries.length} marques.`)
