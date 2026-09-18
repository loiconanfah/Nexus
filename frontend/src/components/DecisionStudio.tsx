import { useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle, ArrowRight, ArrowUpRight, Bookmark, Building2, Check, CheckCircle2, ClipboardList, Cpu, DoorClosed, Info, Loader2,
  Minus, Plus, RefreshCw, Repeat, Sparkles, Trash2, Truck, UserMinus, UserPlus, Users, Wand2, Wrench, XCircle,
} from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import { entityTypeLabel } from '../lib/labels'
import { useMoney } from '../lib/money'
import type { DecisionCostLine, DecisionKind, DecisionReport, DecisionSpec, GraphEntityRecord, ToolSpec } from '../lib/types'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'

type T = (fr: string, en: string) => string

// ── Catalogue des types de décision ─────────────────────────────────────────

type Pool = 'people' | 'activities' | 'systems' | 'data' | 'suppliers' | 'locations' | 'any'
type FieldDef =
  | { k: 'subjectId'; pool: Pool; label: [string, string]; help: [string, string]; required?: boolean }
  | { k: 'serves' | 'uses'; pool: Pool; label: [string, string]; help: [string, string] }
  | { k: 'newName' | 'gainRationale' | 'title'; label: [string, string]; help: [string, string]; required?: boolean; placeholder?: [string, string] }
  | { k: 'newType'; label: [string, string]; help: [string, string]; options: string[] }
  | { k: 'annualSalary' | 'oneOffCost' | 'annualCost' | 'annualCostRemoved' | 'dayRate' | 'expectedAnnualGain'; money: true; label: [string, string]; help: [string, string] }
  | { k: 'headcount' | 'overlapMonths' | 'integrationDaysEach' | 'trainingHoursPerPerson' | 'cutoverHours' | 'hoursSavedPerMonth'; unit: [string, string]; label: [string, string]; help: [string, string] }
  | { k: 'external' | 'outsideCountry'; bool: true; label: [string, string]; help: [string, string] }
  | { k: 'tools'; label: [string, string]; help: [string, string] }

const F = {
  serves: { k: 'serves', pool: 'activities', label: ['Activités servies', 'Activities served'], help: ['Ce que la décision doit améliorer ou soutenir. Sert à mesurer son apport et les personnes concernées.', 'What the decision should improve or support. Used to measure its contribution and the people involved.'] },
  uses: { k: 'uses', pool: 'systems', label: ['Systèmes et données utilisés', 'Systems and data used'], help: ['Chaque système cité est une intégration à réaliser, et un accès à ouvrir.', 'Each system listed is an integration to build and an access to open.'] },
  gain: { k: 'expectedAnnualGain', money: true, label: ['Gain annuel attendu', 'Expected annual gain'], help: ['Revenus supplémentaires ou économies. Jamais inventé : sans ce montant, aucun retour sur investissement n’est calculé.', 'Extra revenue or savings. Never invented: without it, no payback is computed.'] },
  gainWhy: { k: 'gainRationale', label: ['D’où vient ce gain ?', 'Where does this gain come from?'], help: ['Une phrase : elle apparaîtra dans le rapport à côté du montant.', 'One sentence: it will appear in the report next to the amount.'], placeholder: ['ex. 2 % de défauts de paiement en moins sur 300 M', 'e.g. 2% fewer payment defaults on 300M'] },
  oneOff: { k: 'oneOffCost', money: true, label: ['Coût ponctuel', 'One-off cost'], help: ['Achat, installation, frais de mise en place (devis).', 'Purchase, installation, setup fees (quote).'] },
  annual: { k: 'annualCost', money: true, label: ['Coût annuel', 'Annual cost'], help: ['Abonnement, licences, maintenance.', 'Subscription, licences, maintenance.'] },
  removed: { k: 'annualCostRemoved', money: true, label: ['Coût annuel qui disparaît', 'Annual cost removed'], help: ['Ce que coûte aujourd’hui ce qui est remplacé ou arrêté : c’est l’économie.', 'What the replaced or stopped item costs today: that is the saving.'] },
  salary: { k: 'annualSalary', money: true, label: ['Salaire chargé annuel', 'Annual loaded salary'], help: ['Salaire + charges. Sinon, une estimation signalée est utilisée.', 'Salary + social charges. Otherwise, a flagged estimate is used.'] },
  overlap: { k: 'overlapMonths', unit: ['mois', 'months'], label: ['Recouvrement', 'Overlap'], help: ['Période pendant laquelle l’ancien et le nouveau coexistent : plus elle est longue, moins la transition est risquée.', 'Period during which old and new coexist: the longer, the safer the transition.'] },
  cutover: { k: 'cutoverHours', unit: ['h', 'h'], label: ['Interruption prévue à la bascule', 'Planned interruption at switch-over'], help: ['Sert à chiffrer le risque avec le moteur d’impact.', 'Used to price the risk with the impact engine.'] },
  days: { k: 'integrationDaysEach', unit: ['j', 'd'], label: ['Jours par intégration', 'Days per integration'], help: ['Par défaut 5 jours par système à connecter.', 'Default 5 days per system to connect.'] },
  rate: { k: 'dayRate', money: true, label: ['Tarif journalier', 'Day rate'], help: ['Prestataire ou équipe interne. Sinon, estimé à partir des salaires.', 'Provider or internal team. Otherwise estimated from salaries.'] },
  training: { k: 'trainingHoursPerPerson', unit: ['h / pers.', 'h / pers.'], label: ['Formation par personne', 'Training per person'], help: ['Le nombre de personnes vient du graphe.', 'The number of people comes from the graph.'] },
  external: { k: 'external', bool: true, label: ['Fourni par un prestataire externe (SaaS, cloud, API)', 'Provided by an external vendor (SaaS, cloud, API)'], help: ['Ajoute un fournisseur au graphe, avec ses exigences contractuelles.', 'Adds a supplier to the graph, with its contractual requirements.'] },
  abroad: { k: 'outsideCountry', bool: true, label: ['Données traitées hors du pays du siège', 'Data processed outside the head-office country'], help: ['Déclenche la vérification des règles de transfert de données.', 'Triggers the data-transfer rules check.'] },
  tools: { k: 'tools', label: ['Nouveaux outils nécessaires', 'New tools needed'], help: ['Un nouvel expert arrive rarement sans outils : licences, plateformes, services cloud. Chacun est chiffré et ajouté au graphe.', 'A new expert rarely comes without tools: licences, platforms, cloud services. Each is priced and added to the graph.'] },
} satisfies Record<string, FieldDef>

const TOOL_TYPES = ['Application', 'AiService', 'CloudResource', 'Service', 'Database', 'System']

const KINDS: { kind: DecisionKind; icon: typeof UserPlus; label: [string, string]; desc: [string, string]; fields: FieldDef[] }[] = [
  { kind: 'hire', icon: UserPlus, label: ['Recruter', 'Hire'], desc: ['Un rôle, une expertise, une équipe', 'A role, an expertise, a team'], fields: [
    { k: 'newName', label: ['Poste', 'Role'], help: ['Intitulé du poste recruté.', 'Title of the role.'], required: true, placeholder: ['ex. Expert IA, Contrôleur de gestion', 'e.g. AI expert, Financial controller'] },
    F.serves, F.uses, F.tools, F.salary, { k: 'headcount', unit: ['pers.', 'pers.'], label: ['Nombre de personnes', 'Number of people'], help: ['1 par défaut.', '1 by default.'] }, F.gain, F.gainWhy] },
  { kind: 'replace', icon: Repeat, label: ['Remplacer une personne', 'Replace a person'], desc: ['Départ avec successeur', 'Departure with successor'], fields: [
    { k: 'subjectId', pool: 'people', label: ['Personne ou rôle remplacé', 'Person or role replaced'], help: ['Le graphe dit quels systèmes elle est seule à maîtriser.', 'The graph shows which systems only they master.'], required: true },
    { k: 'newName', label: ['Remplaçant', 'Successor'], help: ['Nom ou intitulé du remplaçant (facultatif).', 'Successor name or title (optional).'] },
    F.overlap, F.salary, F.tools] },
  { kind: 'departure', icon: UserMinus, label: ['Départ', 'Departure'], desc: ['Sans remplaçant désigné', 'Without designated successor'], fields: [
    { k: 'subjectId', pool: 'people', label: ['Personne ou rôle qui part', 'Person or role leaving'], help: ['Retraite, démission, fin de contrat, réorganisation.', 'Retirement, resignation, contract end, reorganisation.'], required: true },
    F.salary] },
  { kind: 'new-tool', icon: Plus, label: ['Nouvel outil', 'New tool'], desc: ['Logiciel, plateforme, service', 'Software, platform, service'], fields: [
    { k: 'newName', label: ['Outil', 'Tool'], help: ['Nom de l’outil ou du service.', 'Name of the tool or service.'], required: true },
    { k: 'newType', label: ['Nature', 'Kind'], help: ['Détermine comment il se branche dans le graphe.', 'Determines how it plugs into the graph.'], options: TOOL_TYPES },
    F.serves, F.uses, F.external, F.abroad, F.oneOff, F.annual, F.days, F.rate, F.training, F.gain, F.gainWhy] },
  { kind: 'replace-tool', icon: RefreshCw, label: ['Remplacer un outil', 'Replace a tool'], desc: ['Migration vers un autre système', 'Migration to another system'], fields: [
    { k: 'subjectId', pool: 'systems', label: ['Outil remplacé', 'Tool replaced'], help: ['Tout ce qui s’y connecte devra être reconnecté.', 'Everything connected to it must be reconnected.'], required: true },
    { k: 'newName', label: ['Nouvel outil', 'New tool'], help: ['Nom du système de remplacement.', 'Name of the replacement system.'], required: true },
    F.external, F.abroad, F.oneOff, F.annual, F.removed, { ...F.overlap, label: ['Fonctionnement en parallèle', 'Parallel run'] }, F.cutover, F.days, F.rate, F.training] },
  { kind: 'upgrade', icon: Wrench, label: ['Mettre à jour', 'Upgrade'], desc: ['Nouvelle version d’un système', 'New version of a system'], fields: [
    { k: 'subjectId', pool: 'systems', label: ['Système mis à jour', 'System upgraded'], help: ['Ses liaisons seront à re-tester.', 'Its links will need re-testing.'], required: true },
    F.oneOff, F.annual, F.cutover, F.rate] },
  { kind: 'change-supplier', icon: Truck, label: ['Changer de fournisseur', 'Change supplier'], desc: ['Prestataire, éditeur, opérateur', 'Vendor, publisher, operator'], fields: [
    { k: 'subjectId', pool: 'suppliers', label: ['Fournisseur actuel', 'Current supplier'], help: ['Tout ce qu’il fournit passera chez le nouveau.', 'Everything it supplies moves to the new one.'], required: true },
    { k: 'newName', label: ['Nouveau fournisseur', 'New supplier'], help: ['S’il existe déjà dans le graphe, la concentration est mesurée.', 'If it already exists in the graph, concentration is measured.'], required: true },
    F.oneOff, F.annual, F.removed, F.overlap, F.cutover] },
  { kind: 'open-site', icon: Building2, label: ['Ouvrir un site', 'Open a site'], desc: ['Agence, bureau, point de vente, usine', 'Branch, office, outlet, plant'], fields: [
    { k: 'newName', label: ['Site', 'Site'], help: ['Nom ou ville du site.', 'Site name or city.'], required: true },
    { ...F.serves, help: ['Activités assurées sur ce site.', 'Activities delivered at this site.'] }, { ...F.uses, label: ['Systèmes centraux nécessaires', 'Central systems needed'] },
    { k: 'headcount', unit: ['pers.', 'pers.'], label: ['Effectif du site', 'Site headcount'], help: ['Chiffré avec le salaire indiqué ou estimé.', 'Priced with the entered or estimated salary.'] },
    F.salary, { ...F.oneOff, label: ['Aménagement et équipement', 'Fit-out and equipment'] }, { ...F.annual, label: ['Loyer, charges, connectivité', 'Rent, utilities, connectivity'] }, F.gain, F.gainWhy] },
  { kind: 'close-site', icon: DoorClosed, label: ['Fermer un site', 'Close a site'], desc: ['Regrouper, déménager', 'Consolidate, relocate'], fields: [
    { k: 'subjectId', pool: 'locations', label: ['Site fermé', 'Site closed'], help: ['Systèmes et personnes rattachés au site sont recensés.', 'Systems and people tied to the site are listed.'], required: true },
    { ...F.oneOff, label: ['Coûts de fermeture', 'Closing costs'] }, { ...F.removed, label: ['Coût annuel actuel du site', 'Current annual site cost'] }, F.cutover] },
  { kind: 'automate', icon: Cpu, label: ['Automatiser', 'Automate'], desc: ['Un processus, par IA ou logiciel', 'A process, via AI or software'], fields: [
    { k: 'subjectId', pool: 'activities', label: ['Processus automatisé', 'Process automated'], help: ['Les personnes qui le réalisent aujourd’hui sont identifiées.', 'People currently doing it are identified.'], required: true },
    { k: 'newName', label: ['Outil d’automatisation', 'Automation tool'], help: ['Facultatif.', 'Optional.'] },
    { k: 'newType', label: ['Nature', 'Kind'], help: ['IA, logiciel, robot…', 'AI, software, bot…'], options: TOOL_TYPES },
    { ...F.uses, label: ['Données et systèmes utilisés', 'Data and systems used'] }, F.external, F.abroad, F.oneOff, F.annual,
    { k: 'hoursSavedPerMonth', unit: ['h / mois', 'h / month'], label: ['Heures libérées', 'Hours freed'], help: ['C’est le gain, valorisé au coût horaire moyen.', 'This is the gain, valued at the average hourly cost.'] }] },
]

const POOLS: Record<Pool, string[] | null> = {
  people: ['Person', 'Role', 'Team'],
  activities: ['BusinessProcess', 'BusinessService', 'Process'],
  systems: ['Application', 'Service', 'System', 'Database', 'DataStore', 'Server', 'Infrastructure', 'Network', 'CloudResource', 'Device', 'Asset', 'AiModel', 'AiAgent', 'AiService', 'ModelEndpoint', 'Dataset', 'AiWorkflow'],
  data: ['Database', 'DataStore', 'Dataset'],
  suppliers: ['Supplier', 'AiProvider'],
  locations: ['Location'],
  any: null,
}

// ── Composant ───────────────────────────────────────────────────────────────

export function DecisionStudio() {
  const { t, lang } = useLang()
  const money = useMoney()
  const qc = useQueryClient()
  const graph = useQuery({ queryKey: ['graph'], queryFn: api.graph, staleTime: 60_000 })
  const saved = useQuery({ queryKey: ['scenarios'], queryFn: api.listScenarios })
  const nodes = useMemo(() => (graph.data?.nodes ?? []).filter((n) => n.entityType !== 'Control'), [graph.data])

  const [spec, setSpec] = useState<DecisionSpec | null>(null)
  const [text, setText] = useState('')
  const [draftNote, setDraftNote] = useState<string | null>(null)
  const [report, setReport] = useState<DecisionReport | null>(null)
  const [busy, setBusy] = useState<'interpret' | 'analyze' | 'plan' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [planSent, setPlanSent] = useState(false)
  const [saveName, setSaveName] = useState('')

  const def = KINDS.find((k) => k.kind === spec?.kind)
  const set = (patch: Partial<DecisionSpec>) => setSpec((s) => (s ? { ...s, ...patch } : s))
  const missingRequired = def?.fields.filter((f) => 'required' in f && f.required && !spec?.[f.k as keyof DecisionSpec]) ?? []

  async function interpret() {
    if (!text.trim()) return
    setBusy('interpret'); setError(null); setReport(null)
    try {
      const d = await api.interpretDecision(text.trim(), lang)
      setSpec({ ...d.spec, serves: d.spec.serves ?? [], uses: d.spec.uses ?? [] })
      setDraftNote(d.note ?? (d.usedAi
        ? t('Brouillon préparé par l’IA à partir de votre phrase : vérifiez chaque champ avant d’analyser.', 'Draft prepared by AI from your sentence: check each field before analysing.')
        : t('Brouillon préparé à partir de votre phrase : vérifiez chaque champ avant d’analyser.', 'Draft prepared from your sentence: check each field before analysing.')))
    } catch (e) { setError((e as Error).message) } finally { setBusy(null) }
  }

  async function analyze() {
    if (!spec) return
    setBusy('analyze'); setError(null); setPlanSent(false)
    try { setReport(await api.analyzeDecision(spec, lang)) } catch (e) { setError((e as Error).message) } finally { setBusy(null) }
  }

  async function sendPlan() {
    if (!report) return
    setBusy('plan')
    try {
      for (const p of report.plan) {
        await api.createAction({
          title: `${report.headline} — ${p.title}`,
          detail: p.items.map((i) => `• ${i}`).join('\n'),
          priority: report.findings.some((f) => f.severity === 'danger') ? 'High' : 'Medium',
          kind: 'decision',
          targetId: report.subject?.id && !report.subject.id.startsWith('new:') ? report.subject.id : null,
        })
      }
      setPlanSent(true)
      await qc.invalidateQueries({ queryKey: ['notifications'] })
    } catch (e) { setError((e as Error).message) } finally { setBusy(null) }
  }

  async function save() {
    if (!spec || !saveName.trim()) return
    await api.saveScenario(saveName.trim(), JSON.stringify({ type: 'graph-decision', spec }))
    setSaveName(''); void saved.refetch()
  }

  const savedDecisions = (saved.data ?? []).filter((s) => s.payload.includes('"graph-decision"'))

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Choisir */}
      <section className="rounded-lg border p-5" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
        <StepTitle n={1} title={t('Quelle décision envisagez-vous ?', 'Which decision are you considering?')}
          sub={t('Décrivez-la en une phrase, ou choisissez son type. L’analyse s’appuie sur votre graphe : personnes, outils, fournisseurs et activités réels.',
            'Describe it in one sentence, or pick its type. The analysis relies on your graph: real people, tools, suppliers and activities.')} />
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void interpret() }}
            placeholder={t('ex. Recruter un expert IA pour le scoring, qui utilisera la base clients', 'e.g. Hire an AI expert for scoring, using the customer database')}
            className="nx-field flex-1" maxLength={1000} />
          <button onClick={() => void interpret()} disabled={!text.trim() || busy !== null} className="flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: CYAN, color: 'var(--nx-on-cyan)' }}>
            {busy === 'interpret' ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />} {t('Préparer', 'Prepare')}
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {KINDS.map(({ kind, icon: Icon, label, desc }) => {
            const active = spec?.kind === kind
            return (
              <button key={kind} onClick={() => { setSpec({ kind, serves: [], uses: [] }); setReport(null); setDraftNote(null) }}
                className="flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors"
                style={{ borderColor: active ? CYAN : 'var(--nx-border)', background: active ? 'color-mix(in srgb, var(--nx-cyan) 8%, transparent)' : 'var(--nx-surface-high)' }}>
                <Icon size={17} style={{ color: active ? CYAN : 'var(--nx-text-muted)' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--nx-text)' }}>{t(...label)}</span>
                <span className="text-xs" style={{ color: 'var(--nx-text-muted)', lineHeight: 1.4 }}>{t(...desc)}</span>
              </button>
            )
          })}
        </div>
        {savedDecisions.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span style={{ color: 'var(--nx-text-muted)' }}><Bookmark size={12} className="mr-1 inline" />{t('Décisions enregistrées :', 'Saved decisions:')}</span>
            {savedDecisions.map((s) => (
              <span key={s.id} className="flex items-center gap-1 rounded-full border px-2 py-0.5" style={{ borderColor: 'var(--nx-border)' }}>
                <button onClick={() => { try { const p = JSON.parse(s.payload) as { spec: DecisionSpec }; setSpec(p.spec); setReport(null) } catch { /* ignore */ } }} style={{ color: CYAN_T }}>{s.name}</button>
                <button onClick={async () => { await api.deleteScenario(s.id); void saved.refetch() }} aria-label={t('Supprimer', 'Delete')} style={{ color: 'var(--nx-text-muted)' }}><Trash2 size={11} /></button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* 2. Préciser */}
      {spec && def && (
        <section className="rounded-lg border p-5" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
          <StepTitle n={2} title={t(`Précisez : ${t(...def.label).toLowerCase()}`, `Details: ${t(...def.label).toLowerCase()}`)}
            sub={t('Seuls les champs marqués d’un astérisque sont obligatoires. Chaque champ laissé vide devient une hypothèse signalée dans le rapport — jamais un chiffre inventé en silence.',
              'Only fields marked with an asterisk are required. Every empty field becomes an assumption flagged in the report — never a silently invented figure.')} />
          {draftNote && <div className="mt-3 flex items-start gap-2 rounded-md p-3 text-sm" style={{ background: 'color-mix(in srgb, var(--nx-cyan) 8%, transparent)', color: 'var(--nx-text)' }}><Sparkles size={15} className="mt-0.5 shrink-0" style={{ color: CYAN }} />{draftNote}</div>}
          {nodes.length === 0 && !graph.isLoading && (
            <div className="mt-3 rounded-md p-3 text-sm" style={{ background: 'color-mix(in srgb, var(--nx-warning) 10%, transparent)', color: 'var(--nx-text)' }}>
              {t('Votre graphe est vide : l’analyse ne pourra rien mesurer. Importez d’abord vos activités, systèmes et personnes.', 'Your graph is empty: the analysis cannot measure anything. Import your activities, systems and people first.')}
            </div>
          )}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {def.fields.map((f) => (
              <FieldView key={f.k + ('label' in f ? f.label[0] : '')} f={f} spec={spec} set={set} nodes={nodes} t={t} currency={money.symbol} />
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t pt-4" style={{ borderColor: 'var(--nx-border)' }}>
            <button onClick={() => void analyze()} disabled={busy !== null || missingRequired.length > 0} className="flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
              style={{ background: CYAN, color: 'var(--nx-on-cyan)' }}>
              {busy === 'analyze' ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />} {t('Analyser la décision', 'Analyse the decision')}
            </button>
            {missingRequired.length > 0 && <span className="text-sm" style={{ color: 'var(--nx-text-muted)' }}>{t('À compléter : ', 'To complete: ')}{missingRequired.map((f) => t(...f.label)).join(', ')}</span>}
          </div>
        </section>
      )}

      {error && <div className="rounded-md border p-3 text-sm" style={{ borderColor: 'var(--nx-danger)', color: 'var(--nx-danger)' }}>{error}</div>}

      {/* 3. Rapport */}
      {report && (
        <Report report={report} t={t} money={money} busy={busy} planSent={planSent} onPlan={() => void sendPlan()}
          saveName={saveName} setSaveName={setSaveName} onSave={() => void save()} />
      )}
    </div>
  )
}

function StepTitle({ n, title, sub }: { n: number; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold" style={{ background: CYAN, color: 'var(--nx-on-cyan)' }}>{n}</span>
      <div>
        <h3 className="text-base font-semibold" style={{ fontFamily: geist, color: 'var(--nx-text)' }}>{title}</h3>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--nx-text-muted)', lineHeight: 1.55 }}>{sub}</p>
      </div>
    </div>
  )
}

// ── Champs ──────────────────────────────────────────────────────────────────

function FieldView({ f, spec, set, nodes, t, currency }: { f: FieldDef; spec: DecisionSpec; set: (p: Partial<DecisionSpec>) => void; nodes: GraphEntityRecord[]; t: T; currency: string }) {
  const required = 'required' in f && f.required
  const wide = f.k === 'serves' || f.k === 'uses' || f.k === 'tools' || f.k === 'gainRationale'
  const label = (
    <span className="flex items-center gap-1 text-sm font-medium" style={{ color: 'var(--nx-text)' }}>
      {t(...f.label)}{required && <span style={{ color: CYAN_T }}>*</span>}
    </span>
  )
  const help = <span className="text-xs" style={{ color: 'var(--nx-text-muted)', lineHeight: 1.45 }}>{t(...f.help)}</span>
  const pool = (p: Pool) => { const types = POOLS[p]; return types ? nodes.filter((n) => types.includes(n.entityType)) : nodes }

  let control: ReactNode
  if (f.k === 'subjectId' && 'pool' in f) {
    const opts = pool(f.pool)
    control = (
      <select className="nx-field" value={spec.subjectId ?? ''} onChange={(e) => set({ subjectId: e.target.value || null })}>
        <option value="">{opts.length ? t('Choisir dans votre graphe…', 'Choose from your graph…') : t('Aucun élément de ce type dans votre graphe', 'No element of this kind in your graph')}</option>
        {opts.map((n) => <option key={n.id} value={n.id}>{n.name} — {entityTypeLabel(n.entityType, t)}</option>)}
      </select>
    )
  } else if ((f.k === 'serves' || f.k === 'uses') && 'pool' in f) {
    control = <MultiPick options={pool(f.pool)} value={spec[f.k] ?? []} onChange={(v) => set({ [f.k]: v })} t={t} />
  } else if ('options' in f) {
    control = (
      <select className="nx-field" value={spec.newType ?? ''} onChange={(e) => set({ newType: e.target.value || null })}>
        <option value="">{t('Par défaut', 'Default')}</option>
        {f.options.map((o) => <option key={o} value={o}>{entityTypeLabel(o, t)}</option>)}
      </select>
    )
  } else if ('money' in f) {
    const v = spec[f.k] as number | null | undefined
    control = (
      <div className="nx-field flex items-center gap-2">
        <input inputMode="numeric" className="w-full bg-transparent outline-none" value={v ? v.toLocaleString() : ''} placeholder="—"
          onChange={(e) => { const n = Number(e.target.value.replace(/[^\d]/g, '')); set({ [f.k]: n > 0 ? n : null }) }} />
        <span className="text-xs" style={{ color: 'var(--nx-text-muted)', fontFamily: mono }}>{currency}</span>
      </div>
    )
  } else if ('unit' in f) {
    const v = spec[f.k] as number | null | undefined
    control = (
      <div className="nx-field flex items-center gap-2">
        <input inputMode="numeric" className="w-full bg-transparent outline-none" value={v ?? ''} placeholder="—"
          onChange={(e) => { const n = Number(e.target.value.replace(/[^\d]/g, '')); set({ [f.k]: e.target.value === '' ? null : n }) }} />
        <span className="shrink-0 text-xs" style={{ color: 'var(--nx-text-muted)' }}>{t(...f.unit)}</span>
      </div>
    )
  } else if ('bool' in f) {
    return (
      <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3" style={{ borderColor: 'var(--nx-border)' }}>
        <input type="checkbox" className="mt-1" checked={!!spec[f.k]} onChange={(e) => set({ [f.k]: e.target.checked })} />
        <span className="flex flex-col gap-0.5">{label}{help}</span>
      </label>
    )
  } else if (f.k === 'tools') {
    control = <ToolsEditor value={spec.tools ?? []} onChange={(v) => set({ tools: v })} t={t} currency={currency} />
  } else {
    const key = f.k as 'newName' | 'gainRationale' | 'title'
    control = <input className="nx-field" value={spec[key] ?? ''} maxLength={160} placeholder={'placeholder' in f && f.placeholder ? t(...f.placeholder) : ''} onChange={(e) => set({ [key]: e.target.value || null })} />
  }

  return <div className={`flex flex-col gap-1.5 ${wide ? 'md:col-span-2' : ''}`}>{label}{control}{help}</div>
}

function MultiPick({ options, value, onChange, t }: { options: GraphEntityRecord[]; value: string[]; onChange: (v: string[]) => void; t: T }) {
  const [q, setQ] = useState('')
  const chosen = options.filter((o) => value.includes(o.id))
  const rest = options.filter((o) => !value.includes(o.id) && o.name.toLowerCase().includes(q.toLowerCase())).slice(0, 12)
  return (
    <div className="rounded-md border p-2" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface-high)' }}>
      <div className="flex flex-wrap gap-1.5">
        {chosen.map((o) => (
          <span key={o.id} className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs" style={{ background: 'color-mix(in srgb, var(--nx-cyan) 14%, transparent)', color: 'var(--nx-text)' }}>
            {o.name}<button onClick={() => onChange(value.filter((v) => v !== o.id))} aria-label={t('Retirer', 'Remove')}><XCircle size={12} style={{ color: 'var(--nx-text-muted)' }} /></button>
          </span>
        ))}
        {chosen.length === 0 && <span className="text-xs" style={{ color: 'var(--nx-text-muted)' }}>{t('Aucun élément choisi', 'Nothing selected')}</span>}
      </div>
      {options.length > 0 && (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Filtrer…', 'Filter…')} className="mt-2 w-full rounded border bg-transparent px-2 py-1 text-xs outline-none" style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text)' }} />
          <div className="mt-1.5 flex flex-wrap gap-1">
            {rest.map((o) => (
              <button key={o.id} onClick={() => onChange([...value, o.id])} className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs" style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text-muted)' }}>
                <Plus size={11} />{o.name}
              </button>
            ))}
          </div>
        </>
      )}
      {options.length === 0 && <div className="mt-1 text-xs" style={{ color: 'var(--nx-text-muted)' }}>{t('Aucun élément de ce type dans votre graphe.', 'No element of this kind in your graph.')}</div>}
    </div>
  )
}

function ToolsEditor({ value, onChange, t, currency }: { value: ToolSpec[]; onChange: (v: ToolSpec[]) => void; t: T; currency: string }) {
  const upd = (i: number, p: Partial<ToolSpec>) => onChange(value.map((v, j) => (j === i ? { ...v, ...p } : v)))
  const num = (s: string) => { const n = Number(s.replace(/[^\d]/g, '')); return n > 0 ? n : null }
  return (
    <div className="flex flex-col gap-2">
      {value.map((tool, i) => (
        <div key={i} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto]" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface-high)' }}>
          <input className="nx-field" placeholder={t('Nom de l’outil', 'Tool name')} value={tool.name} onChange={(e) => upd(i, { name: e.target.value })} />
          <select className="nx-field" value={tool.type ?? ''} onChange={(e) => upd(i, { type: e.target.value || null })}>
            <option value="">{t('Nature…', 'Kind…')}</option>
            {TOOL_TYPES.map((o) => <option key={o} value={o}>{entityTypeLabel(o, t)}</option>)}
          </select>
          <input className="nx-field" inputMode="numeric" placeholder={`${t('Ponctuel', 'One-off')} (${currency})`} value={tool.oneOffCost ?? ''} onChange={(e) => upd(i, { oneOffCost: num(e.target.value) })} />
          <input className="nx-field" inputMode="numeric" placeholder={`${t('Annuel', 'Annual')} (${currency})`} value={tool.annualCost ?? ''} onChange={(e) => upd(i, { annualCost: num(e.target.value) })} />
          <button onClick={() => onChange(value.filter((_, j) => j !== i))} className="self-center p-1" aria-label={t('Retirer', 'Remove')}><Minus size={15} style={{ color: 'var(--nx-text-muted)' }} /></button>
          <label className="flex items-center gap-2 text-xs sm:col-span-2" style={{ color: 'var(--nx-text-muted)' }}><input type="checkbox" checked={!!tool.external} onChange={(e) => upd(i, { external: e.target.checked })} />{t('Prestataire externe', 'External vendor')}</label>
          {tool.external && <input className="nx-field sm:col-span-3" placeholder={t('Nom du fournisseur (s’il existe déjà dans le graphe, la concentration est mesurée)', 'Supplier name (if already in the graph, concentration is measured)')} value={tool.supplier ?? ''} onChange={(e) => upd(i, { supplier: e.target.value || null })} />}
          <label className="flex items-center gap-2 text-xs sm:col-span-3" style={{ color: 'var(--nx-text-muted)' }}><input type="checkbox" checked={!!tool.outsideCountry} onChange={(e) => upd(i, { outsideCountry: e.target.checked })} />{t('Données hors du pays du siège', 'Data outside head-office country')}</label>
        </div>
      ))}
      <button onClick={() => onChange([...value, { name: '' }])} className="flex w-fit items-center gap-1 rounded-md border px-3 py-1.5 text-xs" style={{ borderColor: 'var(--nx-border)', color: CYAN_T }}>
        <Plus size={13} /> {t('Ajouter un outil', 'Add a tool')}
      </button>
    </div>
  )
}

// ── Rapport ─────────────────────────────────────────────────────────────────

const VERDICT: Record<DecisionReport['verdict'], { color: string; fr: string; en: string }> = {
  favorable: { color: 'var(--nx-success)', fr: 'Favorable', en: 'Favourable' },
  conditional: { color: 'var(--nx-warning)', fr: 'Sous conditions', en: 'Conditional' },
  unfavorable: { color: 'var(--nx-danger)', fr: 'Défavorable', en: 'Unfavourable' },
  insufficient: { color: 'var(--nx-outline)', fr: 'À compléter', en: 'Incomplete' },
}

const SEV = {
  danger: { color: 'var(--nx-danger)', icon: XCircle },
  warning: { color: 'var(--nx-orange)', icon: AlertTriangle },
  positive: { color: 'var(--nx-success)', icon: CheckCircle2 },
  info: { color: 'var(--nx-cyan-text)', icon: Info },
} as const

const SOURCE: Record<DecisionCostLine['source'], { fr: string; en: string; color: string; tip: [string, string] }> = {
  input: { fr: 'Saisi', en: 'Entered', color: 'var(--nx-cyan-text)', tip: ['Montant fourni par vous', 'Amount you provided'] },
  graph: { fr: 'Graphe', en: 'Graph', color: 'var(--nx-violet)', tip: ['Quantité comptée dans votre graphe', 'Quantity counted in your graph'] },
  engine: { fr: 'Moteur d’impact', en: 'Impact engine', color: 'var(--nx-info)', tip: ['Calculé par le moteur d’impact (coût d’arrêt × probabilité)', 'Computed by the impact engine (downtime cost × probability)'] },
  profile: { fr: 'Profil', en: 'Profile', color: 'var(--nx-teal)', tip: ['Issu du profil ou du modèle de l’organisation', 'From the organisation profile or model'] },
  assumption: { fr: 'Hypothèse', en: 'Assumption', color: 'var(--nx-warning)', tip: ['Estimation à confirmer', 'Estimate to confirm'] },
}

function Report({ report: r, t, money, busy, planSent, onPlan, saveName, setSaveName, onSave }: {
  report: DecisionReport; t: T; money: ReturnType<typeof useMoney>; busy: string | null; planSent: boolean; onPlan: () => void
  saveName: string; setSaveName: (s: string) => void; onSave: () => void
}) {
  const v = VERDICT[r.verdict]
  const tot = r.totals
  const weeks = r.plan.reduce((a, p) => a + p.weeks, 0)
  return (
    <section className="flex flex-col gap-5">
      {/* Fiche décideur */}
      <div className="rounded-lg border p-5" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)', borderTop: `3px solid ${v.color}` }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase" style={{ color: 'var(--nx-text-muted)', letterSpacing: '0.06em' }}>{t('Fiche décideur', 'Decision brief')}</div>
            <h3 className="mt-1 text-xl font-semibold" style={{ fontFamily: geist, color: 'var(--nx-text)' }}>{r.headline}</h3>
            <p className="mt-1 max-w-3xl text-sm" style={{ color: 'var(--nx-text)' }}>{r.verdictText}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="rounded-full px-3 py-1 text-sm font-semibold" style={{ background: `color-mix(in srgb, ${v.color} 14%, transparent)`, color: v.color }}>{t(v.fr, v.en)}</span>
            <span className="text-xs" style={{ color: 'var(--nx-text-muted)' }} title={t('Baisse avec chaque hypothèse, chaque information manquante et la faiblesse des dépendances concernées.', 'Drops with each assumption, each missing input and weak dependencies involved.')}>
              {t('Confiance', 'Confidence')} {Math.round(r.confidence * 100)} %
            </span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi label={t('Coût 1re année', 'Year-1 cost')} value={money.compact(tot.year1Cost)} sub={tot.transitionRisk > 0 ? t(`dont risque ${money.compact(tot.transitionRisk)}`, `incl. risk ${money.compact(tot.transitionRisk)}`) : undefined} />
          <Kpi label={t('Coût récurrent / an', 'Recurring cost / yr')} value={money.compact(tot.recurringCost)} />
          <Kpi label={t('Gain / an', 'Gain / yr')} value={tot.recurringBenefit > 0 ? money.compact(tot.recurringBenefit) : '—'} sub={tot.recurringBenefit > 0 ? undefined : t('non renseigné', 'not entered')} />
          <Kpi label={t('Retour sur investissement', 'Payback')} value={tot.paybackMonths != null ? t(`${Math.round(tot.paybackMonths)} mois`, `${Math.round(tot.paybackMonths)} months`) : '—'} />
          <Kpi label={t('Résilience', 'Resilience')} value={`${r.before.score} → ${r.after.score}`}
            color={r.after.score > r.before.score ? 'var(--nx-success)' : r.after.score < r.before.score ? 'var(--nx-danger)' : undefined}
            sub={t(`points uniques ${r.before.singlePointsOfFailure} → ${r.after.singlePointsOfFailure} · pers. clés ${r.before.keyPeople} → ${r.after.keyPeople}`, `SPOFs ${r.before.singlePointsOfFailure} → ${r.after.singlePointsOfFailure} · key people ${r.before.keyPeople} → ${r.after.keyPeople}`)} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Diagnostic */}
        <Card title={t('Ce que votre graphe révèle', 'What your graph reveals')} icon={Info}>
          <ul className="flex flex-col gap-3">
            {r.findings.map((f, i) => {
              const s = SEV[f.severity]; const Icon = s.icon
              return (
                <li key={i} className="flex gap-2.5">
                  <Icon size={16} className="mt-0.5 shrink-0" style={{ color: s.color }} />
                  <div className="text-sm" style={{ color: 'var(--nx-text)', lineHeight: 1.55 }}>
                    {f.text}
                    {f.nodes.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {f.nodes.slice(0, 8).map((n) => <span key={n.id} className="rounded px-1.5 py-0.5 text-xs" style={{ background: 'var(--nx-surface-high)', color: 'var(--nx-text-muted)' }}>{n.name}</span>)}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
            {r.findings.length === 0 && <li className="text-sm" style={{ color: 'var(--nx-text-muted)' }}>{t('Rien de particulier à signaler.', 'Nothing specific to report.')}</li>}
          </ul>
        </Card>

        {/* Ce qui change */}
        <Card title={t('Ce qui change dans l’organisation', 'What changes in the organisation')} icon={ArrowUpRight}>
          <DiffView r={r} t={t} />
        </Card>
      </div>

      {/* Chiffrage */}
      <Card title={t('Chiffrage — chaque ligne dit d’où vient son montant', 'Costing — each line says where its amount comes from')} icon={ClipboardList}>
        <CostTable lines={r.costs} t={t} money={money} />
        {r.benefits.length > 0 && (
          <>
            <div className="mb-2 mt-5 text-sm font-semibold" style={{ color: 'var(--nx-success)' }}>{t('Gains', 'Gains')}</div>
            <CostTable lines={r.benefits} t={t} money={money} />
          </>
        )}
        <div className="mt-3 flex flex-wrap gap-3 text-xs" style={{ color: 'var(--nx-text-muted)' }}>
          {Object.values(SOURCE).map((s) => <span key={s.fr} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{t(s.fr, s.en)} : {t(...s.tip)}</span>)}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        {/* Plan */}
        <Card title={t(`Plan de transition — ~${weeks} semaine(s)`, `Transition plan — ~${weeks} week(s)`)} icon={Users}
          action={
            <button onClick={onPlan} disabled={busy !== null || planSent} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
              style={{ background: planSent ? 'var(--nx-surface-high)' : CYAN, color: planSent ? 'var(--nx-success)' : 'var(--nx-on-cyan)' }}>
              {busy === 'plan' ? <Loader2 size={13} className="animate-spin" /> : planSent ? <Check size={13} /> : <Plus size={13} />}
              {planSent ? t('Ajouté au plan d’action', 'Added to action plan') : t('Ajouter au plan d’action', 'Add to action plan')}
            </button>
          }>
          <ol className="flex flex-col gap-3">
            {r.plan.map((p, i) => (
              <li key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold" style={{ background: 'color-mix(in srgb, var(--nx-cyan) 15%, transparent)', color: CYAN_T }}>{i + 1}</span>
                  {i < r.plan.length - 1 && <span className="mt-1 w-px flex-1" style={{ background: 'var(--nx-border)' }} />}
                </div>
                <div className="pb-1">
                  <div className="text-sm font-semibold" style={{ color: 'var(--nx-text)' }}>{p.title} <span className="font-normal" style={{ color: 'var(--nx-text-muted)' }}>· {t(`${p.weeks} sem.`, `${p.weeks} wk`)}</span></div>
                  <ul className="mt-1 flex flex-col gap-0.5 text-sm" style={{ color: 'var(--nx-text-muted)' }}>{p.items.map((it, j) => <li key={j}>• {it}</li>)}</ul>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <div className="flex flex-col gap-5">
          <Card title={t('Ce que le décideur doit savoir', 'What the decision-maker must know')} icon={AlertTriangle}>
            <ul className="flex flex-col gap-2 text-sm" style={{ color: 'var(--nx-text)' }}>
              {r.mustKnow.map((m, i) => <li key={i} className="flex gap-2"><Check size={14} className="mt-1 shrink-0" style={{ color: CYAN }} />{m}</li>)}
              {r.mustKnow.length === 0 && <li style={{ color: 'var(--nx-text-muted)' }}>—</li>}
            </ul>
          </Card>
          {r.missingInputs.length > 0 && (
            <Card title={t('Pour fiabiliser l’analyse', 'To make the analysis more reliable')} icon={Info}>
              <ul className="flex flex-col gap-1.5 text-sm" style={{ color: 'var(--nx-text-muted)' }}>{r.missingInputs.map((m, i) => <li key={i}>• {m}</li>)}</ul>
            </Card>
          )}
          <Card title={t('Enregistrer cette décision', 'Save this decision')} icon={Bookmark}>
            <div className="flex gap-2">
              <input className="nx-field flex-1" value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder={t('Nom (ex. Option A — recrutement interne)', 'Name (e.g. Option A — internal hire)')} />
              <button onClick={onSave} disabled={!saveName.trim()} className="rounded-md px-3 text-sm font-medium disabled:opacity-50" style={{ background: CYAN, color: 'var(--nx-on-cyan)' }}>{t('Enregistrer', 'Save')}</button>
            </div>
            <p className="mt-2 text-xs" style={{ color: 'var(--nx-text-muted)' }}>{t('Enregistrez plusieurs options pour les comparer : chacune se recalcule sur l’état actuel du graphe.', 'Save several options to compare them: each one is recomputed on the current state of the graph.')}</p>
          </Card>
        </div>
      </div>
    </section>
  )
}

function Card({ title, icon: Icon, action, children }: { title: string; icon: typeof Info; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-lg border p-5" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--nx-text)' }}><Icon size={15} style={{ color: CYAN }} />{title}</h4>
        {action}
      </div>
      {children}
    </div>
  )
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-md p-3" style={{ background: 'var(--nx-surface-high)' }}>
      <div className="text-xs" style={{ color: 'var(--nx-text-muted)' }}>{label}</div>
      <div className="mt-0.5 text-lg font-semibold" style={{ fontFamily: geist, color: color ?? 'var(--nx-text)' }}>{value}</div>
      {sub && <div className="text-xs" style={{ color: 'var(--nx-text-muted)' }}>{sub}</div>}
    </div>
  )
}

function CostTable({ lines, t, money }: { lines: DecisionCostLine[]; t: T; money: ReturnType<typeof useMoney> }) {
  if (lines.length === 0) return <p className="text-sm" style={{ color: 'var(--nx-text-muted)' }}>{t('Aucune ligne.', 'No line.')}</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs" style={{ color: 'var(--nx-text-muted)' }}>
            <th className="pb-2 font-medium">{t('Poste', 'Item')}</th>
            <th className="pb-2 text-right font-medium">{t('1re année', 'Year 1')}</th>
            <th className="pb-2 text-right font-medium">{t('Par an ensuite', 'Per year after')}</th>
            <th className="pb-2 pl-3 font-medium">{t('Source', 'Source')}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => {
            const s = SOURCE[l.source] ?? SOURCE.assumption
            return (
              <tr key={l.key} className="border-t align-top" style={{ borderColor: 'var(--nx-border)' }}>
                <td className="py-2 pr-3">
                  <div style={{ color: 'var(--nx-text)' }}>{l.label}</div>
                  <div className="text-xs" style={{ color: 'var(--nx-text-muted)' }}>{l.basis}</div>
                </td>
                <td className="whitespace-nowrap py-2 text-right" style={{ color: 'var(--nx-text)' }}>{money.full(l.year1)}</td>
                <td className="whitespace-nowrap py-2 text-right" style={{ color: 'var(--nx-text-muted)' }}>{l.recurring ? money.full(l.recurring) : '—'}</td>
                <td className="py-2 pl-3"><span className="whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium" title={t(...s.tip)} style={{ background: `color-mix(in srgb, ${s.color} 14%, transparent)`, color: s.color }}>{t(s.fr, s.en)}</span></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function DiffView({ r, t }: { r: DecisionReport; t: T }) {
  const d = r.diff
  const Row = ({ color, sign, name, type }: { color: string; sign: string; name: string; type: string }) => (
    <li className="flex items-center gap-2 text-sm">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs font-bold" style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}>{sign}</span>
      <span style={{ color: 'var(--nx-text)' }}>{name}</span>
      <span className="text-xs" style={{ color: 'var(--nx-text-muted)' }}>{entityTypeLabel(type, t)}</span>
    </li>
  )
  const links = d.addedEdges.length
  return (
    <div className="flex flex-col gap-4">
      {(d.addedNodes.length > 0 || d.removedNodes.length > 0) ? (
        <ul className="flex flex-col gap-1.5">
          {d.addedNodes.map((n) => <Row key={n.id} color="var(--nx-success)" sign="+" name={n.name} type={n.type} />)}
          {d.removedNodes.map((n) => <Row key={n.id} color="var(--nx-danger)" sign="−" name={n.name} type={n.type} />)}
        </ul>
      ) : <p className="text-sm" style={{ color: 'var(--nx-text-muted)' }}>{t('Aucun élément ajouté ni retiré.', 'No element added or removed.')}</p>}
      {links > 0 && (
        <div>
          <div className="mb-1 text-xs font-semibold" style={{ color: 'var(--nx-text-muted)' }}>{t(`Nouvelles dépendances (${links})`, `New dependencies (${links})`)}</div>
          <ul className="flex flex-col gap-1 text-xs" style={{ color: 'var(--nx-text)' }}>
            {d.addedEdges.slice(0, 10).map((e, i) => <li key={i}>{e.sourceName} <span style={{ color: 'var(--nx-text-muted)' }}>→</span> {e.targetName}</li>)}
          </ul>
        </div>
      )}
      {d.impacted.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-semibold" style={{ color: 'var(--nx-text-muted)' }}>{t(`Éléments existants concernés (${d.impacted.length})`, `Existing elements involved (${d.impacted.length})`)}</div>
          <div className="flex flex-wrap gap-1">
            {d.impacted.slice(0, 16).map((n) => <span key={n.id} className="rounded px-1.5 py-0.5 text-xs" style={{ background: 'var(--nx-surface-high)', color: 'var(--nx-text-muted)' }}>{n.name}</span>)}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <ResBox label={t('Avant', 'Before')} r={r.before} t={t} />
        <ResBox label={t('Après', 'After')} r={r.after} t={t} />
      </div>
    </div>
  )
}

function ResBox({ label, r, t }: { label: string; r: DecisionReport['before']; t: T }) {
  return (
    <div className="rounded-md p-2.5" style={{ background: 'var(--nx-surface-high)' }}>
      <div className="font-semibold" style={{ color: 'var(--nx-text)' }}>{label} · {t('résilience', 'resilience')} {r.score}</div>
      <div style={{ color: 'var(--nx-text-muted)' }}>{t(`${r.singlePointsOfFailure} point(s) unique(s) de défaillance`, `${r.singlePointsOfFailure} single point(s) of failure`)}</div>
      <div style={{ color: 'var(--nx-text-muted)' }}>{t(`${r.keyPeople} personne(s) clé(s) · ${r.soleKnowledgeSystems} système(s) à détenteur unique`, `${r.keyPeople} key person(s) · ${r.soleKnowledgeSystems} solely held system(s)`)}</div>
      {r.mostConcentratedSupplier && <div style={{ color: 'var(--nx-text-muted)' }}>{t(`Fournisseur le plus concentré : ${r.mostConcentratedSupplier} (${Math.round(r.maxSupplierShare * 100)} %)`, `Most concentrated supplier: ${r.mostConcentratedSupplier} (${Math.round(r.maxSupplierShare * 100)}%)`)}</div>}
    </div>
  )
}
