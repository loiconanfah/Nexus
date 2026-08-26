import { api } from './api'
import type { ImportResult } from './types'

// Jeu de démonstration : une topologie révélant un SPOF (SQL01), une dépendance
// cachée (Billing → ERP → SQL01) et un alias (database-server-001).
const ASSETS_CSV = `name,type,criticality,alias
SQL01,Server,92,database-server-001
ERP,Application,88,
CRM,Application,70,
WEB01,Server,40,
Billing,BusinessProcess,95,
Payroll,BusinessProcess,80,
AD01,Server,85,
`

const DEPS_CSV = `source,source_type,target,target_type
ERP,Application,SQL01,Server
CRM,Application,SQL01,Server
WEB01,Server,SQL01,Server
Billing,BusinessProcess,ERP,Application
Payroll,BusinessProcess,ERP,Application
ERP,Application,AD01,Server
CRM,Application,AD01,Server
`

const ASSETS_PROFILE = JSON.stringify({
  sourceSystem: 'Jeu de démo',
  entities: [
    {
      dataset: 'assets',
      entityType: 'Asset',
      nameColumn: 'name',
      entityTypeColumn: 'type',
      criticalityColumn: 'criticality',
      aliasColumns: ['alias'],
    },
  ],
  relations: [],
})

const DEPS_PROFILE = JSON.stringify({
  sourceSystem: 'Jeu de démo',
  entities: [],
  relations: [
    {
      dataset: 'deps',
      relationType: 'DEPENDS_ON',
      sourceEntityType: 'Server',
      sourceNameColumn: 'source',
      targetEntityType: 'Server',
      targetNameColumn: 'target',
      sourceTypeColumn: 'source_type',
      targetTypeColumn: 'target_type',
    },
  ],
})

export async function importDemoData(): Promise<{ assets: ImportResult; deps: ImportResult }> {
  const assets = await api.importCsv(new Blob([ASSETS_CSV], { type: 'text/csv' }), 'assets.csv', ASSETS_PROFILE)
  const deps = await api.importCsv(new Blob([DEPS_CSV], { type: 'text/csv' }), 'deps.csv', DEPS_PROFILE)
  return { assets, deps }
}
