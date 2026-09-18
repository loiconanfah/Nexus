import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, ArrowRight, Building2, Check, Coins, Compass, Database, FileText, Loader2, LogOut, PlugZap, ShieldCheck,
} from 'lucide-react'
import { LogoMark } from '../components/Logo'
import { deferGuidedTour } from '../components/GuidedTour'
import { api } from '../lib/api'
import { logout } from '../lib/auth'
import { useLang } from '../lib/i18n'
import { makeMoney } from '../lib/money'
import type { OrganizationInput } from '../lib/types'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'

export const SECTOR_LABELS: Record<string, [string, string]> = {
  microfinance: ['Microfinance', 'Microfinance'],
  banking: ['Banque', 'Banking'],
  insurance: ['Assurance', 'Insurance'],
  telecom: ['Télécommunications', 'Telecommunications'],
  health: ['Santé', 'Healthcare'],
  public: ['Secteur public', 'Public sector'],
  energy: ['Énergie & services publics', 'Energy & utilities'],
  manufacturing: ['Industrie', 'Manufacturing'],
  logistics: ['Transport & logistique', 'Transport & logistics'],
  retail: ['Commerce & distribution', 'Retail & distribution'],
  'it-services': ['Services informatiques', 'IT services'],
  education: ['Éducation', 'Education'],
  other: ['Autre', 'Other'],
}

const SIZE_LABELS: Record<string, [string, string]> = {
  '1-49': ['Moins de 50 personnes', 'Fewer than 50 people'],
  '50-199': ['50 à 199 personnes', '50 to 199 people'],
  '200-999': ['200 à 999 personnes', '200 to 999 people'],
  '1000-1999': ['1 000 à 1 999 personnes', '1,000 to 1,999 people'],
  '2000+': ['2 000 personnes et plus', '2,000 people or more'],
}

// Pays proposés, avec leur devise usuelle (même table que le serveur).
const COUNTRIES: { code: string; fr: string; en: string; currency: string }[] = [
  { code: 'CM', fr: 'Cameroun', en: 'Cameroon', currency: 'XAF' },
  { code: 'CA', fr: 'Canada', en: 'Canada', currency: 'CAD' },
  { code: 'FR', fr: 'France', en: 'France', currency: 'EUR' },
  { code: 'BE', fr: 'Belgique', en: 'Belgium', currency: 'EUR' },
  { code: 'CH', fr: 'Suisse', en: 'Switzerland', currency: 'CHF' },
  { code: 'SN', fr: 'Sénégal', en: 'Senegal', currency: 'XOF' },
  { code: 'CI', fr: 'Côte d’Ivoire', en: 'Côte d’Ivoire', currency: 'XOF' },
  { code: 'GA', fr: 'Gabon', en: 'Gabon', currency: 'XAF' },
  { code: 'CG', fr: 'Congo', en: 'Congo', currency: 'XAF' },
  { code: 'TD', fr: 'Tchad', en: 'Chad', currency: 'XAF' },
  { code: 'CF', fr: 'Centrafrique', en: 'Central African Republic', currency: 'XAF' },
  { code: 'GQ', fr: 'Guinée équatoriale', en: 'Equatorial Guinea', currency: 'XAF' },
  { code: 'BJ', fr: 'Bénin', en: 'Benin', currency: 'XOF' },
  { code: 'BF', fr: 'Burkina Faso', en: 'Burkina Faso', currency: 'XOF' },
  { code: 'ML', fr: 'Mali', en: 'Mali', currency: 'XOF' },
  { code: 'NE', fr: 'Niger', en: 'Niger', currency: 'XOF' },
  { code: 'TG', fr: 'Togo', en: 'Togo', currency: 'XOF' },
  { code: 'MA', fr: 'Maroc', en: 'Morocco', currency: 'MAD' },
  { code: 'US', fr: 'États-Unis', en: 'United States', currency: 'USD' },
  { code: 'GB', fr: 'Royaume-Uni', en: 'United Kingdom', currency: 'GBP' },
  { code: 'LU', fr: 'Luxembourg', en: 'Luxembourg', currency: 'EUR' },
  { code: 'ZZ', fr: 'Autre pays', en: 'Other country', currency: 'USD' },
]

type DataPath = 'import' | 'connect' | 'documents' | 'explore'
const DATA_PATHS: { key: DataPath; route: string; icon: typeof Database; fr: [string, string]; en: [string, string] }[] = [
  { key: 'import', route: '/onboarding', icon: Database,
    fr: ['J’ai des fichiers', 'Tableur Excel ou CSV, export de CMDB, inventaire. Le plus rapide pour démarrer.'],
    en: ['I have files', 'Excel or CSV spreadsheet, CMDB export, inventory. The fastest way to start.'] },
  { key: 'connect', route: '/integrations', icon: PlugZap,
    fr: ['Je veux brancher un outil', 'API d’un outil existant, ou sonde installée dans votre réseau (aucun port ouvert).'],
    en: ['I want to connect a tool', 'An existing tool’s API, or a probe installed in your network (no open port).'] },
  { key: 'documents', route: '/documents', icon: FileText,
    fr: ['J’ai surtout des documents', 'Plan de continuité, contrats, procédures : l’IA en extrait les dépendances, vous validez.'],
    en: ['I mostly have documents', 'Continuity plan, contracts, procedures: AI extracts dependencies, you validate.'] },
  { key: 'explore', route: '/', icon: Compass,
    fr: ['Je découvre d’abord', 'Visite guidée de la plateforme ; vous ajouterez vos données ensuite.'],
    en: ['Let me look around first', 'Guided tour of the platform; you’ll add your data afterwards.'] },
]

const EMPTY: OrganizationInput = {
  name: '', sector: '', country: '', currency: '', sizeBand: '', annualRevenue: 0, headcount: 0, operatingMode: 'business',
}

/** Chiffres saisis avec séparateurs : on ne garde que les chiffres. */
const digits = (s: string) => Number(s.replace(/[^\d]/g, '')) || 0

/**
 * Assistant de démarrage : passage obligé d'un espace neuf avant l'Accueil.
 * Chaque champ explique à quoi il sert — l'utilisateur sait pourquoi on le lui
 * demande, et voit tout de suite ce que ses chiffres impliquent.
 */
export function Setup() {
  const { t, lang, setLang } = useLang()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const org = useQuery({ queryKey: ['organization'], queryFn: api.organization })

  const [step, setStep] = useState(0)
  const [form, setForm] = useState<OrganizationInput>(EMPTY)
  const [path, setPath] = useState<DataPath | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  // Préremplissage à partir d'un profil existant (assistant repris ou modifié).
  useEffect(() => {
    const p = org.data?.profile
    if (p) setForm({ name: p.name, sector: p.sector, country: p.country, currency: p.currency, sizeBand: p.sizeBand, annualRevenue: p.annualRevenue, headcount: p.headcount, operatingMode: p.operatingMode })
  }, [org.data?.profile])

  const set = <K extends keyof OrganizationInput>(k: K, v: OrganizationInput[K]) => setForm((f) => ({ ...f, [k]: v }))

  const currencies = org.data?.currencies ?? []
  const currency = currencies.find((c) => c.code === form.currency)
  const money = currency ? makeMoney(currency, lang) : null

  // Aperçu d'étalonnage (le serveur fait foi), avec un léger délai de frappe.
  const [debounced, setDebounced] = useState({ rev: 0, mode: 'business' })
  useEffect(() => {
    const id = setTimeout(() => setDebounced({ rev: form.annualRevenue, mode: form.operatingMode }), 350)
    return () => clearTimeout(id)
  }, [form.annualRevenue, form.operatingMode])
  const preview = useQuery({
    queryKey: ['calibration', debounced.rev, debounced.mode],
    queryFn: () => api.calibration(debounced.rev, debounced.mode),
    enabled: debounced.rev > 0,
  })

  const missing = useMemo(() => {
    const m: Record<number, string[]> = { 0: [], 1: [] }
    if (form.name.trim().length < 2) m[0].push('name')
    if (!form.sector) m[0].push('sector')
    if (!form.country) m[0].push('country')
    if (!form.sizeBand) m[0].push('sizeBand')
    if (!form.currency) m[1].push('currency')
    if (form.annualRevenue <= 0) m[1].push('annualRevenue')
    if (form.headcount <= 0) m[1].push('headcount')
    return m
  }, [form])

  const invalid = (k: string) => touched && (missing[step] ?? []).includes(k)

  async function next() {
    setTouched(true)
    setError(null)
    if ((missing[step] ?? []).length) return
    if (step === 1) {
      // Enregistré dès maintenant : si l'utilisateur quitte, il reprend ici.
      setBusy(true)
      try {
        await api.saveOrganization(form)
        await qc.invalidateQueries({ queryKey: ['organization'] })
      } catch (e) {
        setError(t('Enregistrement impossible : ', 'Could not save: ') + (e as Error).message)
        return
      } finally { setBusy(false) }
    }
    if (step === 2 && !path) { setError(t('Choisissez comment vous souhaitez commencer.', 'Choose how you want to start.')); return }
    setTouched(false)
    setStep((s) => s + 1)
  }

  async function finish() {
    setBusy(true)
    setError(null)
    try {
      await api.saveOrganization(form)
      await api.completeOrganization()
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['organization'] }),
        qc.invalidateQueries({ queryKey: ['setup-progress'] }),
        qc.invalidateQueries({ queryKey: ['notifications'] }),
      ])
      const target = DATA_PATHS.find((d) => d.key === path) ?? DATA_PATHS[3]
      // La visite guidée ne doit pas détourner quelqu'un qui a choisi d'importer.
      if (target.key !== 'explore') deferGuidedTour()
      navigate(target.route, { replace: true })
    } catch (e) {
      setError(t('La mise en place n’a pas pu être terminée : ', 'Setup could not be completed: ') + (e as Error).message)
    } finally { setBusy(false) }
  }

  const STEPS: [string, string][] = [
    ['Votre organisation', 'Your organisation'],
    ['Vos chiffres', 'Your figures'],
    ['Vos données', 'Your data'],
    ['C’est prêt', 'Ready'],
  ]

  if (org.isLoading) {
    return <Screen><div className="flex items-center gap-2" style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text-muted)' }}><Loader2 size={14} className="animate-spin" /> {t('Chargement…', 'Loading…')}</div></Screen>
  }

  if (org.data && !org.data.canEdit) {
    return (
      <Screen>
        <div className="max-w-md rounded-lg border p-6" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
          <ShieldCheck size={22} style={{ color: CYAN }} />
          <h2 className="mt-3 text-lg font-semibold" style={{ fontFamily: geist }}>{t('Mise en place réservée à l’administrateur', 'Setup is reserved for the administrator')}</h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--nx-text-muted)', lineHeight: 1.6 }}>
            {t('Le profil de l’organisation (nom, devise, chiffres de référence) est saisi par l’administrateur de votre espace. Vous pouvez déjà consulter la plateforme.',
              'The organisation profile (name, currency, reference figures) is entered by your workspace administrator. You can already browse the platform.')}
          </p>
          <button onClick={() => navigate('/')} className="mt-4 rounded px-4 py-2" style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontFamily: mono, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {t('Aller à l’Accueil', 'Go to Home')}
          </button>
        </div>
      </Screen>
    )
  }

  return (
    <div className="min-h-screen w-full" style={{ background: 'var(--nx-bg)', color: 'var(--nx-text)', fontFamily: 'var(--font-inter)' }}>
      {/* En-tête */}
      <header className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface)' }}>
        <div className="flex items-center gap-3">
          <LogoMark size={30} title="" />
          <span style={{ fontFamily: geist, fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em' }}>Lenexux</span>
          <span className="hidden sm:inline" style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>· {t('Mise en place', 'Setup')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-sm border" style={{ borderColor: 'var(--nx-border)' }}>
            {(['fr', 'en'] as const).map((l) => (
              <button key={l} type="button" onClick={() => setLang(l)} className="px-2 py-1" style={{ fontFamily: mono, fontSize: 11, textTransform: 'uppercase', color: lang === l ? 'var(--nx-on-cyan)' : 'var(--nx-text-muted)', background: lang === l ? CYAN : 'transparent' }}>{l}</button>
            ))}
          </div>
          <button onClick={() => { logout(); navigate('/login') }} className="flex items-center gap-1 rounded-sm border px-2 py-1" style={{ borderColor: 'var(--nx-border)', fontSize: 12, color: 'var(--nx-text-muted)' }} title={t('Se déconnecter', 'Sign out')}>
            <LogOut size={12} /> {t('Quitter', 'Sign out')}
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8 md:grid-cols-[240px_1fr] md:px-6 md:py-12">
        {/* Étapes */}
        <aside className="flex flex-col gap-6">
          <div>
            <h1 className="text-2xl font-semibold" style={{ fontFamily: geist, letterSpacing: '-0.02em' }}>{t('Bienvenue', 'Welcome')}</h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--nx-text-muted)', lineHeight: 1.6 }}>
              {t('4 étapes, environ 3 minutes. Sans ces informations, la plateforme ne peut ni afficher vos montants dans votre devise, ni chiffrer une panne à votre échelle.',
                '4 steps, about 3 minutes. Without this information, the platform can neither show amounts in your currency nor price an outage at your scale.')}
            </p>
          </div>
          <ol className="flex flex-row gap-2 md:flex-col md:gap-1">
            {STEPS.map((s, i) => {
              const done = i < step, current = i === step
              return (
                <li key={i} className="flex flex-1 items-center gap-3 rounded-md px-2 py-2 md:flex-none" style={{ background: current ? 'var(--nx-panel)' : 'transparent', border: `1px solid ${current ? 'var(--nx-border)' : 'transparent'}` }}>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: done ? CYAN : 'transparent', border: `1.5px solid ${done || current ? CYAN : 'var(--nx-border)'}`, color: done ? 'var(--nx-on-cyan)' : current ? CYAN_T : 'var(--nx-text-muted)', fontFamily: mono, fontSize: 12 }}>
                    {done ? <Check size={14} /> : i + 1}
                  </span>
                  <span className="hidden text-sm md:inline" style={{ color: current ? 'var(--nx-text)' : 'var(--nx-text-muted)', fontWeight: current ? 600 : 400 }}>{t(...s)}</span>
                </li>
              )
            })}
          </ol>
          <div className="hidden rounded-md border p-3 text-xs md:block" style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text-muted)', lineHeight: 1.6 }}>
            <ShieldCheck size={14} className="mb-1" style={{ color: CYAN }} />
            {t('Ces informations restent dans votre espace. Vous pourrez les modifier à tout moment depuis Admin & système.',
              'This information stays in your workspace. You can change it at any time from Admin & System.')}
          </div>
        </aside>

        {/* Contenu de l'étape */}
        <section className="rounded-lg border p-5 sm:p-7" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface)' }}>
          <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: CYAN_T }}>
            {t('Étape', 'Step')} {step + 1} / {STEPS.length}
          </div>

          {step === 0 && (
            <StepBody title={t('Présentez votre organisation', 'Tell us about your organisation')}
              intro={t('Le nom apparaît sur vos rapports ; le secteur adapte les exemples et les scénarios proposés.', 'The name appears on your reports; the sector tailors the examples and scenarios offered.')}>
              <Field label={t('Nom de l’organisation', 'Organisation name')} required invalid={invalid('name')} hint={t('Tel qu’il doit figurer sur les rapports.', 'As it should appear on reports.')}>
                <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder={t('ex. Caisse Mutuelle du Littoral', 'e.g. Coastal Credit Union')} className="nx-field" maxLength={120} autoFocus />
              </Field>
              <Field label={t('Secteur d’activité', 'Industry')} required invalid={invalid('sector')}>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(org.data?.sectors ?? Object.keys(SECTOR_LABELS)).map((s) => (
                    <Choice key={s} active={form.sector === s} onClick={() => set('sector', s)}>{t(...(SECTOR_LABELS[s] ?? [s, s]))}</Choice>
                  ))}
                </div>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('Pays du siège', 'Head-office country')} required invalid={invalid('country')} hint={t('Détermine la devise proposée.', 'Sets the suggested currency.')}>
                  <select value={form.country} onChange={(e) => {
                    const c = COUNTRIES.find((x) => x.code === e.target.value)
                    setForm((f) => ({ ...f, country: e.target.value, currency: f.currency && org.data?.profile ? f.currency : c?.currency ?? f.currency }))
                  }} className="nx-field">
                    <option value="">{t('Choisir…', 'Choose…')}</option>
                    {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{lang === 'fr' ? c.fr : c.en}</option>)}
                  </select>
                </Field>
                <Field label={t('Taille', 'Size')} required invalid={invalid('sizeBand')}>
                  <select value={form.sizeBand} onChange={(e) => set('sizeBand', e.target.value)} className="nx-field">
                    <option value="">{t('Choisir…', 'Choose…')}</option>
                    {(org.data?.sizeBands ?? Object.keys(SIZE_LABELS)).map((s) => <option key={s} value={s}>{t(...(SIZE_LABELS[s] ?? [s, s]))}</option>)}
                  </select>
                </Field>
              </div>
            </StepBody>
          )}

          {step === 1 && (
            <StepBody title={t('Vos chiffres de référence', 'Your reference figures')}
              intro={t('Ils servent à une seule chose : chiffrer ce que coûte une heure d’arrêt chez VOUS. Un ordre de grandeur suffit — personne d’autre ne les voit.',
                'They serve one purpose only: pricing what an hour of downtime costs YOU. A ballpark figure is enough — nobody else sees them.')}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('Devise', 'Currency')} required invalid={invalid('currency')} hint={t('Tous les montants s’afficheront dans cette devise.', 'All amounts will be shown in this currency.')}>
                  <select value={form.currency} onChange={(e) => set('currency', e.target.value)} className="nx-field">
                    <option value="">{t('Choisir…', 'Choose…')}</option>
                    {currencies.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.symbol})</option>)}
                  </select>
                </Field>
                <Field label={t('Effectif', 'Headcount')} required invalid={invalid('headcount')} hint={t('Nombre de personnes (employés et agents).', 'Number of people (staff and agents).')}>
                  <input inputMode="numeric" value={form.headcount ? form.headcount.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA') : ''} onChange={(e) => set('headcount', digits(e.target.value))} placeholder="120" className="nx-field" />
                </Field>
              </div>
              <Field label={t('Chiffre d’affaires annuel (ou produit net bancaire)', 'Annual revenue (or net banking income)')} required invalid={invalid('annualRevenue')}
                hint={t('Pour une microfinance : le produit net bancaire du dernier exercice.', 'For a microfinance institution: net banking income for the last fiscal year.')}>
                <div className="nx-field flex items-center gap-2">
                  <input inputMode="numeric" value={form.annualRevenue ? form.annualRevenue.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA') : ''} onChange={(e) => set('annualRevenue', digits(e.target.value))} placeholder={form.currency === 'XAF' || form.currency === 'XOF' ? '2 600 000 000' : '25 000 000'} className="w-full bg-transparent outline-none" />
                  <span style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text-muted)' }}>{currency?.symbol ?? ''}</span>
                </div>
              </Field>
              <Field label={t('Vos services fonctionnent…', 'Your services run…')} required>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Choice active={form.operatingMode === 'business'} onClick={() => set('operatingMode', 'business')}>
                    <b>{t('Aux heures d’ouverture', 'During business hours')}</b><br /><span style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>{t('≈ 2 600 h par an', '≈ 2,600 h a year')}</span>
                  </Choice>
                  <Choice active={form.operatingMode === '24x7'} onClick={() => set('operatingMode', '24x7')}>
                    <b>{t('En continu, 24 h/24', 'Around the clock, 24/7')}</b><br /><span style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>{t('Mobile money, guichets automatiques, en ligne', 'Mobile money, ATMs, online')}</span>
                  </Choice>
                </div>
              </Field>

              {/* Ce que ces chiffres impliquent */}
              <div className="rounded-md border p-4" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
                <div className="flex items-center gap-2" style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: CYAN_T }}>
                  <Coins size={14} /> {t('Ce que cela donne', 'What this means')}
                </div>
                {preview.data && money ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Figure value={money.compact(preview.data.hourlyRevenue)} label={t('de revenu par heure d’activité', 'of revenue per operating hour')} />
                    <Figure value={money.compact(preview.data.costVeryHigh)} label={t('coût horaire d’arrêt d’une activité très critique', 'hourly downtime cost of a very critical activity')} />
                    <p className="text-xs sm:col-span-2" style={{ color: 'var(--nx-text-muted)', lineHeight: 1.6 }}>
                      {t('Ces paliers sont une base de départ. Vous les affinerez activité par activité (« Impact transversal ») : un guichet et une plateforme mobile money ne pèsent pas pareil.',
                        'These tiers are a starting point. You will refine them activity by activity (“Cross-system Impact”): a branch counter and a mobile money platform do not weigh the same.')}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm" style={{ color: 'var(--nx-text-muted)' }}>{t('Saisissez la devise et le chiffre d’affaires pour voir l’estimation.', 'Enter the currency and revenue to see the estimate.')}</p>
                )}
              </div>
            </StepBody>
          )}

          {step === 2 && (
            <StepBody title={t('Comment voulez-vous commencer ?', 'How would you like to start?')}
              intro={t('Lenexux a besoin d’un minimum pour que les analyses aient un sens : au moins 1 activité métier, 3 systèmes et 5 dépendances. La barre de progression vous guidera jusque-là, quelle que soit la voie choisie.',
                'Lenexux needs a minimum for analyses to be meaningful: at least 1 business activity, 3 systems and 5 dependencies. The progress bar will guide you there, whichever path you choose.')}>
              <div className="grid gap-3 sm:grid-cols-2">
                {DATA_PATHS.map((d) => {
                  const Icon = d.icon
                  const [title, desc] = lang === 'fr' ? d.fr : d.en
                  const active = path === d.key
                  return (
                    <button key={d.key} type="button" onClick={() => { setPath(d.key); setError(null) }} className="flex flex-col items-start gap-2 rounded-md border p-4 text-left transition-colors"
                      style={{ borderColor: active ? CYAN : 'var(--nx-border)', background: active ? 'color-mix(in srgb, var(--nx-cyan) 8%, transparent)' : 'var(--nx-panel)' }}>
                      <Icon size={20} style={{ color: active ? CYAN : 'var(--nx-text-muted)' }} />
                      <span className="font-semibold" style={{ fontFamily: geist }}>{title}</span>
                      <span className="text-sm" style={{ color: 'var(--nx-text-muted)', lineHeight: 1.5 }}>{desc}</span>
                    </button>
                  )
                })}
              </div>
            </StepBody>
          )}

          {step === 3 && (
            <StepBody title={t('Votre espace est prêt', 'Your workspace is ready')}
              intro={t('Voici ce qui a été enregistré, et ce qui vous attend.', 'Here is what was saved, and what comes next.')}>
              <dl className="grid gap-x-6 gap-y-3 rounded-md border p-4 text-sm sm:grid-cols-2" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
                <Recap label={t('Organisation', 'Organisation')} value={form.name} />
                <Recap label={t('Secteur', 'Industry')} value={t(...(SECTOR_LABELS[form.sector] ?? [form.sector, form.sector]))} />
                <Recap label={t('Devise', 'Currency')} value={currency ? `${currency.name} (${currency.symbol})` : form.currency} />
                <Recap label={t('Chiffre d’affaires', 'Revenue')} value={money ? money.compact(form.annualRevenue) : String(form.annualRevenue)} />
              </dl>
              <div>
                <div className="mb-2 text-sm font-semibold">{t('Ensuite, dans l’application', 'Next, inside the app')}</div>
                <ul className="flex flex-col gap-2 text-sm" style={{ color: 'var(--nx-text-muted)', lineHeight: 1.5 }}>
                  <Bullet>{t('Une barre de progression en haut de l’écran indique ce qu’il reste à faire, étape par étape, et vous y mène en un clic.', 'A progress bar at the top of the screen shows what is left to do, step by step, and takes you there in one click.')}</Bullet>
                  <Bullet>{t('La cloche regroupe vos rappels et les opérations en cours (imports, collectes, validations en attente).', 'The bell gathers your reminders and ongoing operations (imports, collections, pending validations).')}</Bullet>
                  <Bullet>{t('Chaque étape est cochée automatiquement quand la donnée existe vraiment — pas quand on clique « terminé ».', 'Each step is ticked automatically when the data truly exists — not when someone clicks “done”.')}</Bullet>
                </ul>
              </div>
            </StepBody>
          )}

          {error && <div className="mt-4 rounded border px-3 py-2 text-sm" style={{ borderColor: 'var(--nx-danger)', color: 'var(--nx-danger)', background: 'rgba(239,68,68,0.08)' }}>{error}</div>}
          {touched && (missing[step] ?? []).length > 0 && (
            <div className="mt-4 text-sm" style={{ color: 'var(--nx-danger)' }}>{t('Les champs marqués d’un astérisque sont obligatoires.', 'Fields marked with an asterisk are required.')}</div>
          )}

          <div className="mt-6 flex items-center justify-between border-t pt-5" style={{ borderColor: 'var(--nx-border)' }}>
            <button type="button" onClick={() => { setError(null); setStep((s) => Math.max(0, s - 1)) }} disabled={step === 0 || busy}
              className="flex items-center gap-1 rounded px-3 py-2 text-sm disabled:opacity-0" style={{ color: 'var(--nx-text-muted)' }}>
              <ArrowLeft size={14} /> {t('Retour', 'Back')}
            </button>
            {step < 3 ? (
              <button type="button" onClick={() => void next()} disabled={busy} className="flex items-center gap-2 rounded px-5 py-2.5 disabled:opacity-60"
                style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontFamily: mono, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : null}{t('Continuer', 'Continue')} <ArrowRight size={14} />
              </button>
            ) : (
              <button type="button" onClick={() => void finish()} disabled={busy} className="flex items-center gap-2 rounded px-5 py-2.5 disabled:opacity-60"
                style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontFamily: mono, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Building2 size={14} />}{t('Entrer dans Lenexux', 'Enter Lenexux')}
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function Screen({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center p-6" style={{ background: 'var(--nx-bg)', color: 'var(--nx-text)' }}>{children}</div>
}

function StepBody({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <div className="mt-2 flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold" style={{ fontFamily: geist, letterSpacing: '-0.01em' }}>{title}</h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--nx-text-muted)', lineHeight: 1.6 }}>{intro}</p>
      </div>
      {children}
    </div>
  )
}

function Field({ label, hint, required, invalid, children }: { label: string; hint?: string; required?: boolean; invalid?: boolean; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5" data-invalid={invalid || undefined}>
      <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: invalid ? 'var(--nx-danger)' : 'var(--nx-text-muted)' }}>
        {label}{required && <span style={{ color: invalid ? 'var(--nx-danger)' : CYAN_T }}> *</span>}
      </span>
      {children}
      {hint && <span className="text-xs" style={{ color: 'var(--nx-text-muted)' }}>{hint}</span>}
    </label>
  )
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="rounded-md border px-3 py-2 text-left text-sm transition-colors"
      style={{ borderColor: active ? CYAN : 'var(--nx-border)', background: active ? 'color-mix(in srgb, var(--nx-cyan) 10%, transparent)' : 'var(--nx-panel)', color: 'var(--nx-text)' }}>
      {children}
    </button>
  )
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div style={{ fontFamily: geist, fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>{value}</div>
      <div className="text-xs" style={{ color: 'var(--nx-text-muted)' }}>{label}</div>
    </div>
  )
}

function Recap({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{label}</dt>
      <dd className="mt-0.5 font-medium">{value || '—'}</dd>
    </div>
  )
}

function Bullet({ children }: { children: ReactNode }) {
  return <li className="flex gap-2"><Check size={14} className="mt-1 shrink-0" style={{ color: CYAN }} /><span>{children}</span></li>
}

