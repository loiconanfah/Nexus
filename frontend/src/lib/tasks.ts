/**
 * Travaux longs : analyse d'un document, import d'un ou plusieurs jeux.
 *
 * Ils vivent hors des composants (voir notify.ts) pour deux raisons : on peut
 * quitter l'écran sans les interrompre, et ils parlent d'eux-mêmes (progression,
 * notification à la fin, erreur annoncée) au lieu d'attendre qu'on les regarde.
 */
import { api } from './api'
import { notify, startJob } from './notify'
import type { ChunkExtraction, DocumentAnalysis, ImportResult } from './types'

type Lang = 'fr' | 'en'
const T = (lang: Lang, fr: string, en: string) => (lang === 'en' ? en : fr)

// Dernière analyse documentaire : l'écran la retrouve en revenant, même si
// l'analyse s'est terminée pendant qu'on était ailleurs.
let lastDocument: { fileName: string; analysis: DocumentAnalysis } | null = null
export const getLastDocumentAnalysis = () => lastDocument
export const clearLastDocumentAnalysis = () => { lastDocument = null }

/** Analyse complète d'un document, en tâche de fond. */
export function startDocumentAnalysis(opts: { text: string; lang: Lang; fileName?: string; onDone?: (a: DocumentAnalysis) => void }): number {
  const { text, lang } = opts
  const label = opts.fileName ?? T(lang, 'Analyse du document', 'Document analysis')
  const ctrl = new AbortController()
  const job = startJob('document', label, 1, () => ctrl.abort())

  void (async () => {
    try {
      const plan = await api.planDocument(text)
      if (!plan.aiAvailable) {
        job.fail(T(lang, 'Aucun modèle IA disponible', 'No AI model available'))
        notify({
          kind: 'warning',
          title: T(lang, 'Aucun modèle IA n’est disponible', 'No AI model is available'),
          message: T(lang, 'L’analyse documentaire a besoin d’un modèle. Votre espace n’en a pas, et la clé partagée n’est pas active.',
            'Document analysis needs a model. Your workspace has none, and the shared key is not active.'),
          actions: [{ label: T(lang, 'Ouvrir les intégrations IA', 'Open AI integrations'), to: '/admin' }],
        })
        return
      }

      const n = plan.sections.length
      job.total(n * 2 + 1)
      const warnings: string[] = []
      if (plan.truncated) warnings.push(T(lang, `Document très long : les ${n} premières sections sur ${plan.total} sont analysées.`, `Very long document: the first ${n} sections of ${plan.total} are analyzed.`))

      // 1. Éléments et risques, section par section.
      const parts: ChunkExtraction[] = []
      const known: string[] = []
      for (const s of plan.sections) {
        if (ctrl.signal.aborted) { job.cancelled(); return }
        job.progress(s.index, T(lang, `Éléments et risques, section ${s.index + 1} sur ${n}`, `Elements and risks, section ${s.index + 1} of ${n}`))
        const r = await api.extractSection({ index: s.index, total: n, section: s.section, text: s.text, knownNames: known, lang }, ctrl.signal)
        if (!r.ok || !r.extraction) { warnings.push(T(lang, `Section ${s.index + 1} non analysée : ${r.message ?? ''}`, `Section ${s.index + 1} not analyzed: ${r.message ?? ''}`)); continue }
        parts.push(r.extraction)
        known.push(...r.extraction.entities.map((e) => e.name))
      }
      if (parts.length === 0) {
        job.fail(T(lang, 'Aucune section n’a pu être analysée', 'No section could be analyzed'))
        notify({ kind: 'error', title: T(lang, 'Analyse impossible', 'Analysis failed'), message: warnings.at(-1) })
        return
      }

      // 2. Liens, avec tous les éléments du document en main.
      const byName = new Map<string, { name: string; type: string; aliases: string[] }>()
      for (const e of parts.flatMap((p) => p.entities)) {
        const k = e.name.toLowerCase()
        const cur = byName.get(k)
        if (cur) { for (const a of e.aliases ?? []) if (!cur.aliases.includes(a)) cur.aliases.push(a) }
        else byName.set(k, { name: e.name, type: e.type, aliases: [...(e.aliases ?? [])] })
      }
      const entities = [...byName.values()]
      const linkParts: ChunkExtraction[] = []
      for (const s of plan.sections) {
        if (ctrl.signal.aborted) { job.cancelled(); return }
        job.progress(n + s.index, T(lang, `Liens entre éléments, section ${s.index + 1} sur ${n}`, `Links between elements, section ${s.index + 1} of ${n}`))
        const r = await api.linkSection({ index: s.index, section: s.section, text: s.text, entities, lang }, ctrl.signal)
        if (r.ok && r.relations.length) linkParts.push({ entities: [], relations: r.relations, risks: [] })
      }

      // 3. Fusion et recoupement avec le graphe.
      job.progress(n * 2, T(lang, 'Fusion des doublons et recoupement avec votre graphe', 'Merging duplicates and cross-referencing your graph'))
      const analysis = await api.consolidateDocument({ parts: [...parts, ...linkParts], sections: n, analyzed: parts.length, warnings, lang }, ctrl.signal)
      lastDocument = { fileName: opts.fileName ?? '', analysis }
      opts.onDone?.(analysis)

      const s = analysis.stats
      job.done(T(lang, `${s.entities} élément(s), ${s.relations} lien(s), ${s.risks} risque(s)`, `${s.entities} element(s), ${s.relations} link(s), ${s.risks} risk(s)`))
      notify({
        kind: 'success',
        title: T(lang, 'Analyse terminée', 'Analysis complete'),
        message: T(lang,
          `${s.entities} élément(s) et ${s.relations} lien(s) proposés, ${analysis.findings.length} constat(s), ${s.risks} risque(s) cité(s).`,
          `${s.entities} element(s) and ${s.relations} link(s) proposed, ${analysis.findings.length} finding(s), ${s.risks} risk(s) cited.`),
        actions: [{ label: T(lang, 'Voir le résultat', 'See the result'), to: '/documents' }],
      })
      if (analysis.findings.some((f) => f.severity === 'high')) {
        notify({
          kind: 'warning',
          title: T(lang, 'Fragilité repérée dans le document', 'Fragility found in the document'),
          message: analysis.findings.find((f) => f.severity === 'high')?.title,
          actions: [{ label: T(lang, 'Examiner', 'Review'), to: '/documents' }],
        })
      }
    } catch (e) {
      if (ctrl.signal.aborted) { job.cancelled(); return }
      const msg = e instanceof Error ? e.message.slice(0, 160) : ''
      job.fail(msg || T(lang, 'Erreur pendant l’analyse', 'Error during analysis'))
      notify({ kind: 'error', title: T(lang, 'L’analyse s’est interrompue', 'The analysis stopped'), message: msg })
    }
  })()

  return job.id
}

export type SheetImport = { dataset: string; profile: object }

/**
 * Import d'un ou plusieurs jeux (feuilles d'un classeur, ou fichier unique),
 * l'un après l'autre, en tâche de fond.
 */
export function startImport(opts: {
  file: File
  sheets: SheetImport[]
  lang: Lang
  excel: boolean
  onDone?: (results: { dataset: string; result: ImportResult }[]) => void
}): number {
  const { file, sheets, lang } = opts
  const many = sheets.length > 1
  const label = many
    ? T(lang, `Import de ${sheets.length} feuilles`, `Importing ${sheets.length} sheets`)
    : T(lang, `Import de ${sheets[0]?.dataset ?? file.name}`, `Importing ${sheets[0]?.dataset ?? file.name}`)
  const job = startJob('import', label, sheets.length)

  void (async () => {
    const results: { dataset: string; result: ImportResult }[] = []
    let entities = 0, relations = 0, failed = 0
    for (const [i, sheet] of sheets.entries()) {
      job.progress(i, T(lang, `Feuille « ${sheet.dataset} » (${i + 1}/${sheets.length})`, `Sheet “${sheet.dataset}” (${i + 1}/${sheets.length})`))
      try {
        const result = opts.excel
          ? await api.importExcel(file, file.name, JSON.stringify(sheet.profile))
          : await api.importCsv(file, file.name, JSON.stringify(sheet.profile))
        results.push({ dataset: sheet.dataset, result })
        entities += result.entitiesCreated
        relations += result.relationsCreated
      } catch {
        failed++
      }
    }
    opts.onDone?.(results)

    if (results.length === 0) {
      job.fail(T(lang, 'Aucune feuille n’a pu être importée', 'No sheet could be imported'))
      notify({ kind: 'error', title: T(lang, 'Import impossible', 'Import failed'), message: T(lang, 'Vérifiez le format du fichier et les colonnes choisies.', 'Check the file format and the chosen columns.') })
      return
    }

    job.done(T(lang, `${entities} élément(s), ${relations} lien(s)`, `${entities} element(s), ${relations} link(s)`))
    notify({
      kind: 'success',
      title: T(lang, 'Import terminé', 'Import complete'),
      message: T(lang,
        `${entities} élément(s) et ${relations} lien(s) ajoutés${failed ? `, ${failed} feuille(s) en échec` : ''}. Étape suivante : faire proposer les dépendances manquantes, puis les valider.`,
        `${entities} element(s) and ${relations} link(s) added${failed ? `, ${failed} sheet(s) failed` : ''}. Next: have the missing dependencies proposed, then validate them.`),
      duration: 0,
      actions: [
        { label: T(lang, 'Dépendances inférées', 'Inferred dependencies'), to: '/inference' },
        { label: T(lang, 'Confiance & audit', 'Confidence & Audit'), to: '/audit' },
      ],
    })
    if (relations === 0 && entities > 0) {
      notify({
        kind: 'info',
        title: T(lang, 'Des éléments, mais aucun lien', 'Elements, but no links'),
        message: T(lang, 'Sans dépendances, aucune cascade ni point unique de défaillance ne peut être calculé. Importez la feuille des relations, ou laissez Lenexux les proposer.',
          'Without dependencies, no cascade or single point of failure can be computed. Import the relations sheet, or let Lenexux propose them.'),
        actions: [{ label: T(lang, 'Proposer les dépendances', 'Propose dependencies'), to: '/inference' }],
      })
    }
  })()

  return job.id
}
