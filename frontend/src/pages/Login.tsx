import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Building2, Check, Eye, EyeOff, KeyRound, Loader2, LogIn, Mail, MailCheck, ShieldCheck, UserPlus, X,
} from 'lucide-react'
import { LogoMark } from '../components/Logo'
import { AuthError, login, loginWithEntra, register, resendCode, verifyEmail, type SignupInput } from '../lib/auth'
import { getAuthConfig, signInWithMicrosoft } from '../lib/entra'
import { useLang } from '../lib/i18n'
import { COUNTRIES, SECTOR_LABELS, SIZE_LABELS } from '../lib/orgLists'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const MIN_PASSWORD = 10

type View = 'signin' | 'signup' | 'verify'
type T = (fr: string, en: string) => string

const EMPTY: SignupInput = {
  firstName: '', lastName: '', email: '', jobTitle: '', phone: '',
  organization: '', sector: '', country: '', sizeBand: '',
  password: '', confirmPassword: '', acceptTerms: false, marketingOptIn: false, lang: 'fr',
}

/** Messages lisibles pour chaque code renvoyé par le serveur. */
function authMessage(code: string, t: T): string {
  const m: Record<string, [string, string]> = {
    invalid_credentials: ['Adresse ou mot de passe incorrect.', 'Incorrect email or password.'],
    email_taken: ['Un compte existe déjà avec cette adresse. Connectez-vous plutôt.', 'An account already exists with this email. Sign in instead.'],
    invalid_email: ['Adresse courriel invalide.', 'Invalid email address.'],
    weak_password: [`Mot de passe trop faible : ${MIN_PASSWORD} caractères minimum, avec des lettres et au moins un chiffre ou symbole.`, `Password too weak: at least ${MIN_PASSWORD} characters, with letters and at least one digit or symbol.`],
    password_contains_email: ['Le mot de passe ne doit pas contenir votre adresse courriel.', 'The password must not contain your email address.'],
    password_mismatch: ['Les deux mots de passe ne correspondent pas.', 'The two passwords do not match.'],
    terms_required: ['Vous devez accepter les conditions pour créer un compte.', 'You must accept the terms to create an account.'],
    first_name_required: ['Indiquez votre prénom.', 'Enter your first name.'],
    last_name_required: ['Indiquez votre nom.', 'Enter your last name.'],
    organization_required: ['Indiquez le nom de votre organisation.', 'Enter your organisation name.'],
    sector_required: ['Choisissez un secteur.', 'Choose an industry.'],
    country_required: ['Choisissez un pays.', 'Choose a country.'],
    size_required: ['Choisissez une taille d’organisation.', 'Choose an organisation size.'],
    registration_disabled: ['La création de compte est momentanément fermée.', 'Account creation is temporarily closed.'],
    email_unavailable: ['La création de compte est momentanément indisponible : l’envoi des courriels de vérification n’est pas encore configuré.', 'Account creation is temporarily unavailable: verification emails are not configured yet.'],
    email_send_failed: ['Le courriel de vérification n’a pas pu partir. Réessayez dans un instant.', 'The verification email could not be sent. Please try again shortly.'],
    code_invalid: ['Code incorrect. Vérifiez le dernier courriel reçu.', 'Incorrect code. Check the latest email you received.'],
    code_expired: ['Ce code a expiré. Demandez-en un nouveau.', 'This code has expired. Request a new one.'],
    code_locked: ['Trop d’essais. Demandez un nouveau code.', 'Too many attempts. Request a new code.'],
    already_verified: ['Cette adresse est déjà vérifiée. Connectez-vous.', 'This address is already verified. Sign in.'],
  }
  const pair = m[code]
  return pair ? t(...pair) : t('Une erreur est survenue. Réessayez.', 'Something went wrong. Please try again.')
}

/** Robustesse du mot de passe, de 0 à 4. Indicatif : la règle qui compte est côté serveur. */
function strength(pw: string): number {
  if (!pw) return 0
  let s = 0
  if (pw.length >= MIN_PASSWORD) s++
  if (pw.length >= 14) s++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++
  return pw.length < MIN_PASSWORD ? Math.min(s, 1) : Math.max(1, s)
}

export function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { lang, setLang, t } = useLang()
  const [view, setView] = useState<View>(searchParams.get('signup') === '1' ? 'signup' : 'signin')
  const [entraEnabled, setEntraEnabled] = useState(false)
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean | null>(null)
  const [pending, setPending] = useState<{ email: string; resendAfter: number } | null>(null)
  const [signup, setSignup] = useState<SignupInput>(EMPTY)

  useEffect(() => {
    getAuthConfig()
      .then((c) => { setEntraEnabled(c.entraEnabled); setRegistrationEnabled(c.registrationEnabled) })
      .catch(() => setRegistrationEnabled(false))
  }, [])

  const toVerify = (email: string, resendAfter: number) => { setPending({ email, resendAfter }); setView('verify') }

  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row" style={{ background: 'var(--nx-bg)', color: 'var(--nx-text)', fontFamily: 'var(--font-inter)' }}>
      <BrandPanel view={view} t={t} />

      <div className="flex w-full justify-center px-5 py-10 sm:px-10 md:w-[55%] md:items-center lg:w-1/2" style={{ background: 'var(--nx-surface)' }}>
        <div className={`relative flex w-full flex-col gap-7 ${view === 'signup' ? 'max-w-xl' : 'max-w-md'}`}>
          <div className="flex items-center justify-between">
            <Link to="/welcome" className="flex items-center gap-1.5 transition-opacity hover:opacity-80" style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>
              <ArrowLeft size={14} /> {t('Retour au site', 'Back to site')}
            </Link>
            <div className="flex items-center rounded-sm border" style={{ borderColor: 'var(--nx-border)' }}>
              {(['fr', 'en'] as const).map((l) => (
                <button key={l} type="button" onClick={() => setLang(l)} className="px-2 py-1" style={{ fontFamily: mono, fontSize: 11, textTransform: 'uppercase', color: lang === l ? 'var(--nx-on-cyan)' : 'var(--nx-text-muted)', background: lang === l ? 'var(--nx-cyan)' : 'transparent' }}>{l}</button>
              ))}
            </div>
          </div>

          {view === 'signin' && (
            <SignIn t={t} entraEnabled={entraEnabled} registrationEnabled={registrationEnabled}
              onSignup={() => setView('signup')} onUnverified={toVerify} onDone={() => navigate('/')} />
          )}
          {view === 'signup' && (
            <SignUp t={t} lang={lang} value={signup} onChange={setSignup} registrationEnabled={registrationEnabled}
              onSignin={() => setView('signin')} onCreated={toVerify} />
          )}
          {view === 'verify' && pending && (
            <Verify t={t} lang={lang} email={pending.email} initialWait={pending.resendAfter}
              onChangeEmail={() => setView('signup')} onBack={() => setView('signin')} onDone={() => navigate('/')} />
          )}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────── Panneau de marque ─────────────────────────────── */

function BrandPanel({ view, t }: { view: View; t: T }) {
  const points: [string, string, string, string][] = [
    ['Un espace de travail privé', 'A private workspace', 'Vos données sont isolées de celles des autres organisations.', 'Your data is isolated from every other organisation.'],
    ['Opérationnel en quelques minutes', 'Up and running in minutes', 'Un assistant vous guide de la première donnée à la première simulation.', 'A guided setup takes you from first data to first simulation.'],
    ['Des chiffres que vous pouvez défendre', 'Figures you can defend', 'Chaque montant indique sa source et sa base probante.', 'Every amount states its source and evidence base.'],
  ]
  return (
    <div className="relative hidden w-full flex-col justify-between overflow-hidden border-r p-12 md:flex md:min-h-screen md:w-[45%] lg:w-1/2 lg:p-16"
      style={{ background: 'var(--nx-panel)', borderColor: 'var(--nx-border)' }}>
      <div className="absolute inset-0 z-0" style={{ opacity: 0.35 }}>
        <div className="nx-grid absolute inset-0" />
        <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <line x1="20%" y1="30%" x2="40%" y2="50%" stroke="var(--nx-border)" />
          <line x1="40%" y1="50%" x2="70%" y2="40%" stroke="var(--nx-border)" />
          <line x1="70%" y1="40%" x2="85%" y2="70%" stroke="var(--nx-border)" />
          <line x1="40%" y1="50%" x2="30%" y2="80%" stroke="var(--nx-border)" />
          <line x1="70%" y1="40%" x2="60%" y2="85%" stroke="var(--nx-cyan)" strokeOpacity="0.5" strokeWidth="1.5" />
          <circle className="nx-node-pulse" cx="40%" cy="50%" r="4" fill="var(--nx-cyan)" />
          <circle cx="20%" cy="30%" r="3" fill="var(--nx-text-muted)" />
          <circle cx="70%" cy="40%" r="3" fill="var(--nx-text-muted)" />
          <circle className="nx-node-pulse" cx="60%" cy="85%" r="5" fill="var(--nx-cyan)" style={{ animationDelay: '1.5s' }} />
        </svg>
      </div>

      <div className="relative z-10 flex items-center gap-4">
        <LogoMark size={52} title="" />
        <span className="text-3xl font-bold" style={{ fontFamily: geist, letterSpacing: '-0.035em' }}>Lenexux</span>
      </div>

      <div className="relative z-10 flex max-w-md flex-col gap-8">
        <p className="text-3xl" style={{ fontFamily: geist, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
          {view === 'signin'
            ? t('Voyez ce qui peut arrêter votre organisation, avant que cela n’arrive.', 'See what could stop your organisation, before it happens.')
            : t('Créez votre espace et cartographiez vos dépendances dès aujourd’hui.', 'Create your workspace and map your dependencies today.')}
        </p>
        <ul className="flex flex-col gap-5">
          {points.map(([fr, en, dfr, den]) => (
            <li key={fr} className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ background: 'color-mix(in srgb, var(--nx-cyan) 16%, transparent)', color: 'var(--nx-cyan-text)' }}><Check size={14} /></span>
              <span className="flex flex-col gap-0.5">
                <span style={{ fontWeight: 600 }}>{t(fr, en)}</span>
                <span style={{ fontSize: 14, color: 'var(--nx-text-muted)', lineHeight: 1.5 }}>{t(dfr, den)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative z-10 flex items-center gap-2" style={{ fontSize: 12, color: 'var(--nx-outline)' }}>
        <ShieldCheck size={14} /> {t('Mots de passe chiffrés, sessions signées, conformité Loi 25 et RGPD.', 'Hashed passwords, signed sessions, Law 25 and GDPR compliant.')}
      </p>
    </div>
  )
}

/* ─────────────────────────────── Connexion ─────────────────────────────── */

function SignIn({ t, entraEnabled, registrationEnabled, onSignup, onUnverified, onDone }: {
  t: T; entraEnabled: boolean; registrationEnabled: boolean | null
  onSignup: () => void; onUnverified: (email: string, wait: number) => void; onDone: () => void
}) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (busy) return
    setError(null); setBusy(true)
    try {
      await login(email.trim(), password)
      onDone()
    } catch (e) {
      const code = e instanceof Error ? e.message : ''
      if (code === 'email_not_verified' && e instanceof AuthError) {
        onUnverified(String(e.data.email ?? email.trim()), Number(e.data.resendAfter ?? 60))
        return
      }
      setError(authMessage(code === 'invalid_credentials' ? code : 'unknown', t))
    } finally { setBusy(false) }
  }

  async function microsoft() {
    if (busy) return
    setError(null); setBusy(true)
    try {
      await loginWithEntra(await signInWithMicrosoft())
      onDone()
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (!msg.includes('cancel')) setError(t('Connexion Microsoft impossible.', 'Microsoft sign-in failed.'))
    } finally { setBusy(false) }
  }

  return (
    <>
      <Header title={t('Connexion', 'Sign in')} sub={t('Accédez à votre espace de travail Lenexux.', 'Access your Lenexux workspace.')} />
      {error && <Alert>{error}</Alert>}

      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void submit() }}>
        <Field label={t('Adresse courriel', 'Email address')} htmlFor="si-email">
          <input id="si-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder={t('prenom@entreprise.com', 'name@company.com')} className="nx-field" />
        </Field>
        <Field label={t('Mot de passe', 'Password')} htmlFor="si-pw">
          <PasswordInput id="si-pw" value={password} onChange={setPassword} show={show} onToggle={() => setShow(!show)} autoComplete="current-password" t={t} />
        </Field>
        <PrimaryButton busy={busy} icon={<LogIn size={17} />} label={t('Se connecter', 'Sign in')} busyLabel={t('Connexion…', 'Signing in…')} />
      </form>

      {entraEnabled && (
        <button type="button" onClick={microsoft} disabled={busy} className="flex w-full items-center justify-center gap-3 rounded-md border py-2.5 transition-colors disabled:opacity-60"
          style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface-high)', fontWeight: 500 }}>
          <svg className="h-4 w-4" viewBox="0 0 21 21" aria-hidden><rect x="1" y="1" width="9" height="9" fill="#f25022" /><rect x="11" y="1" width="9" height="9" fill="#7fba00" /><rect x="1" y="11" width="9" height="9" fill="#00a4ef" /><rect x="11" y="11" width="9" height="9" fill="#ffb900" /></svg>
          {t('Continuer avec Microsoft', 'Continue with Microsoft')}
        </button>
      )}

      <Divider label={t('Nouveau sur Lenexux ?', 'New to Lenexux?')} />

      <div className="flex flex-col gap-3">
        {registrationEnabled !== false ? (
          <button type="button" onClick={onSignup} disabled={registrationEnabled === null}
            className="flex w-full items-center justify-center gap-2 rounded-md border py-2.5 transition-colors disabled:opacity-60"
            style={{ borderColor: 'var(--nx-cyan)', color: 'var(--nx-cyan-text)', fontWeight: 600 }}>
            <UserPlus size={17} /> {t('Créer un compte', 'Create an account')}
          </button>
        ) : (
          <p className="rounded-md border px-3 py-2.5 text-center" style={{ borderColor: 'var(--nx-border)', fontSize: 13.5, color: 'var(--nx-text-muted)' }}>
            {t('La création de compte ouvre très bientôt. En attendant, ', 'Account creation opens very soon. Meanwhile, ')}
            <a href="mailto:yvanloic@lenexux.com?subject=Acc%C3%A8s%20Lenexux" style={{ color: 'var(--nx-cyan-text)' }}>{t('demandez un accès', 'request access')}</a>.
          </p>
        )}
        <button type="button" onClick={() => navigate('/demo')} className="flex w-full items-center justify-center gap-2 rounded-md py-2.5 transition-colors"
          style={{ background: 'var(--nx-surface-high)', color: 'var(--nx-text)', fontWeight: 500 }}>
          <Building2 size={17} /> {t('Explorer la démo sans compte', 'Explore the demo, no account')}
        </button>
      </div>
    </>
  )
}

/* ─────────────────────────────── Inscription ─────────────────────────────── */

function SignUp({ t, lang, value, onChange, registrationEnabled, onSignin, onCreated }: {
  t: T; lang: 'fr' | 'en'; value: SignupInput; onChange: (v: SignupInput) => void; registrationEnabled: boolean | null
  onSignin: () => void; onCreated: (email: string, wait: number) => void
}) {
  const [step, setStep] = useState<1 | 2>(1)
  const [show, setShow] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const v = value
  const set = <K extends keyof SignupInput>(k: K, x: SignupInput[K]) => onChange({ ...v, [k]: x })

  const local = v.email.split('@')[0] ?? ''
  const rules = [
    { ok: v.password.length >= MIN_PASSWORD, label: t(`${MIN_PASSWORD} caractères minimum`, `At least ${MIN_PASSWORD} characters`) },
    { ok: /[A-Za-z]/.test(v.password) && /[^A-Za-z]/.test(v.password), label: t('Des lettres et au moins un chiffre ou symbole', 'Letters and at least one digit or symbol') },
    { ok: v.password.length > 0 && !(local.length >= 4 && v.password.toLowerCase().includes(local.toLowerCase())), label: t('Ne contient pas votre adresse courriel', 'Does not contain your email address') },
  ]
  const passwordOk = rules.every((r) => r.ok)
  const matches = v.confirmPassword.length > 0 && v.confirmPassword === v.password

  // Erreurs par champ, affichées seulement une fois le champ touché ou l'étape soumise.
  const errors1 = useMemo(() => {
    const e: Record<string, string> = {}
    if (!v.firstName.trim()) e.firstName = t('Requis', 'Required')
    if (!v.lastName.trim()) e.lastName = t('Requis', 'Required')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v.email.trim())) e.email = t('Adresse invalide', 'Invalid address')
    if (!passwordOk) e.password = t('Ne respecte pas les règles ci-dessous', 'Does not meet the rules below')
    if (!matches) e.confirmPassword = v.confirmPassword ? t('Ne correspond pas', 'Does not match') : t('Requis', 'Required')
    return e
  }, [v, passwordOk, matches, t])
  const errors2 = useMemo(() => {
    const e: Record<string, string> = {}
    if (!v.organization.trim()) e.organization = t('Requis', 'Required')
    if (!v.sector) e.sector = t('Requis', 'Required')
    if (!v.country) e.country = t('Requis', 'Required')
    if (!v.sizeBand) e.sizeBand = t('Requis', 'Required')
    if (!v.acceptTerms) e.acceptTerms = t('Requis pour continuer', 'Required to continue')
    return e
  }, [v, t])
  const show1 = (k: string) => (touched[k] || touched.step1) ? errors1[k] : undefined
  const show2 = (k: string) => (touched[k] || touched.step2) ? errors2[k] : undefined
  const touch = (k: string) => setTouched((x) => ({ ...x, [k]: true }))

  function next() {
    setTouched((x) => ({ ...x, step1: true }))
    if (Object.keys(errors1).length === 0) { setError(null); setStep(2) }
  }

  async function submit() {
    setTouched((x) => ({ ...x, step2: true }))
    if (Object.keys(errors2).length > 0 || busy) return
    setError(null); setBusy(true)
    try {
      const r = await register({ ...v, email: v.email.trim(), lang })
      onCreated(r.email, r.resendAfter)
    } catch (e) {
      const code = e instanceof Error ? e.message : ''
      // Une erreur qui concerne l'étape 1 y ramène directement.
      if (['invalid_email', 'weak_password', 'password_contains_email', 'password_mismatch', 'email_taken', 'first_name_required', 'last_name_required'].includes(code)) setStep(1)
      setError(authMessage(code, t))
    } finally { setBusy(false) }
  }

  const s = strength(v.password)
  const sColors = ['var(--nx-border)', '#ef4444', '#f59e0b', '#22c55e', '#16a34a']
  const sLabels: [string, string][] = [['', ''], ['Faible', 'Weak'], ['Moyen', 'Fair'], ['Bon', 'Good'], ['Excellent', 'Strong']]

  return (
    <>
      <Header title={t('Créer votre compte', 'Create your account')}
        sub={t('Un espace de travail privé pour votre organisation. Deux minutes suffisent.', 'A private workspace for your organisation. It takes two minutes.')} />

      <Stepper step={step} labels={[t('Vous', 'You'), t('Votre organisation', 'Your organisation'), t('Vérification', 'Verification')]} />

      {registrationEnabled === false && <Alert>{authMessage('email_unavailable', t)}</Alert>}
      {error && <Alert>{error}{error === authMessage('email_taken', t) && <> <button type="button" onClick={onSignin} className="underline">{t('Se connecter', 'Sign in')}</button></>}</Alert>}

      {step === 1 ? (
        <form className="flex flex-col gap-4" noValidate onSubmit={(e) => { e.preventDefault(); next() }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('Prénom', 'First name')} htmlFor="su-fn" required error={show1('firstName')}>
              <input id="su-fn" autoComplete="given-name" value={v.firstName} onChange={(e) => set('firstName', e.target.value)} onBlur={() => touch('firstName')} className="nx-field" maxLength={80} />
            </Field>
            <Field label={t('Nom', 'Last name')} htmlFor="su-ln" required error={show1('lastName')}>
              <input id="su-ln" autoComplete="family-name" value={v.lastName} onChange={(e) => set('lastName', e.target.value)} onBlur={() => touch('lastName')} className="nx-field" maxLength={80} />
            </Field>
          </div>
          <Field label={t('Courriel professionnel', 'Work email')} htmlFor="su-em" required error={show1('email')}
            hint={t('Le code de vérification sera envoyé à cette adresse.', 'The verification code will be sent to this address.')}>
            <input id="su-em" type="email" autoComplete="email" value={v.email} onChange={(e) => set('email', e.target.value)} onBlur={() => touch('email')}
              placeholder={t('prenom@entreprise.com', 'name@company.com')} className="nx-field" maxLength={254} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('Fonction', 'Job title')} htmlFor="su-jt" optional={t('facultatif', 'optional')}>
              <input id="su-jt" list="su-jobs" autoComplete="organization-title" value={v.jobTitle} onChange={(e) => set('jobTitle', e.target.value)} className="nx-field" maxLength={120}
                placeholder={t('ex. DSI, RSSI', 'e.g. CIO, CISO')} />
              <datalist id="su-jobs">
                {[t('Direction générale', 'Chief executive'), t('DSI', 'CIO'), t('RSSI', 'CISO'), t('Responsable des risques', 'Risk manager'),
                  t('Responsable continuité d’activité', 'Business continuity manager'), t('Direction financière', 'CFO'), t('Direction des opérations', 'COO'),
                  t('Audit et conformité', 'Audit and compliance'), t('Consultant', 'Consultant')].map((j) => <option key={j} value={j} />)}
              </datalist>
            </Field>
            <Field label={t('Téléphone', 'Phone')} htmlFor="su-ph" optional={t('facultatif', 'optional')}>
              <input id="su-ph" type="tel" autoComplete="tel" value={v.phone} onChange={(e) => set('phone', e.target.value)} className="nx-field" maxLength={40} placeholder="+1 514 000 0000" />
            </Field>
          </div>

          <Field label={t('Mot de passe', 'Password')} htmlFor="su-pw" required error={show1('password')}>
            <PasswordInput id="su-pw" value={v.password} onChange={(x) => set('password', x)} show={show} onToggle={() => setShow(!show)} autoComplete="new-password" onBlur={() => touch('password')} t={t} />
            <div className="mt-2 flex items-center gap-3">
              <div className="flex flex-1 gap-1" aria-hidden>
                {[1, 2, 3, 4].map((i) => <span key={i} className="h-1 flex-1 rounded-full" style={{ background: i <= s ? sColors[s] : 'var(--nx-border)' }} />)}
              </div>
              <span style={{ fontFamily: mono, fontSize: 11, minWidth: 64, textAlign: 'right', color: s ? sColors[s] : 'var(--nx-outline)' }}>{t(...sLabels[s])}</span>
            </div>
            <ul className="mt-2 flex flex-col gap-1">
              {rules.map((r) => (
                <li key={r.label} className="flex items-center gap-2" style={{ fontSize: 12.5, color: r.ok ? 'var(--nx-success, #16a34a)' : 'var(--nx-text-muted)' }}>
                  {r.ok ? <Check size={13} /> : <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'currentColor', margin: '0 3px' }} />} {r.label}
                </li>
              ))}
            </ul>
          </Field>
          <Field label={t('Confirmer le mot de passe', 'Confirm password')} htmlFor="su-pw2" required error={show1('confirmPassword')}>
            <div className="relative">
              <input id="su-pw2" type={show ? 'text' : 'password'} autoComplete="new-password" value={v.confirmPassword} onChange={(e) => set('confirmPassword', e.target.value)}
                onBlur={() => touch('confirmPassword')} className="nx-field pr-10" />
              {v.confirmPassword && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: matches ? 'var(--nx-success, #16a34a)' : '#ef4444' }}
                  aria-label={matches ? t('Identiques', 'Matching') : t('Différents', 'Different')}>
                  {matches ? <Check size={16} /> : <X size={16} />}
                </span>
              )}
            </div>
          </Field>

          <PrimaryButton icon={<ArrowRight size={17} />} label={t('Continuer', 'Continue')} disabled={registrationEnabled === false} />
          <p className="text-center" style={{ fontSize: 13.5, color: 'var(--nx-text-muted)' }}>
            {t('Déjà un compte ?', 'Already have an account?')}{' '}
            <button type="button" onClick={onSignin} style={{ color: 'var(--nx-cyan-text)', fontWeight: 600 }}>{t('Se connecter', 'Sign in')}</button>
          </p>
        </form>
      ) : (
        <form className="flex flex-col gap-4" noValidate onSubmit={(e) => { e.preventDefault(); void submit() }}>
          <Field label={t('Nom de l’organisation', 'Organisation name')} htmlFor="su-org" required error={show2('organization')}>
            <input id="su-org" autoComplete="organization" value={v.organization} onChange={(e) => set('organization', e.target.value)} onBlur={() => touch('organization')} className="nx-field" maxLength={120} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('Secteur', 'Industry')} htmlFor="su-sec" required error={show2('sector')}>
              <select id="su-sec" value={v.sector} onChange={(e) => set('sector', e.target.value)} onBlur={() => touch('sector')} className="nx-field">
                <option value="">{t('Choisir…', 'Choose…')}</option>
                {Object.entries(SECTOR_LABELS).map(([k, l]) => <option key={k} value={k}>{t(...l)}</option>)}
              </select>
            </Field>
            <Field label={t('Pays', 'Country')} htmlFor="su-ctry" required error={show2('country')}
              hint={t('Détermine la devise de vos chiffrages.', 'Sets the currency of your figures.')}>
              <select id="su-ctry" value={v.country} onChange={(e) => set('country', e.target.value)} onBlur={() => touch('country')} className="nx-field">
                <option value="">{t('Choisir…', 'Choose…')}</option>
                {[...COUNTRIES].sort((a, b) => (lang === 'fr' ? a.fr : a.en).localeCompare(lang === 'fr' ? b.fr : b.en, lang)).map((c) => (
                  <option key={c.code} value={c.code}>{lang === 'fr' ? c.fr : c.en}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label={t('Taille de l’organisation', 'Organisation size')} htmlFor="su-size" required error={show2('sizeBand')}>
            <select id="su-size" value={v.sizeBand} onChange={(e) => set('sizeBand', e.target.value)} onBlur={() => touch('sizeBand')} className="nx-field">
              <option value="">{t('Choisir…', 'Choose…')}</option>
              {Object.entries(SIZE_LABELS).map(([k, l]) => <option key={k} value={k}>{t(...l)}</option>)}
            </select>
          </Field>

          <div className="flex flex-col gap-3 rounded-md border p-4" style={{ borderColor: show2('acceptTerms') ? '#ef4444' : 'var(--nx-border)', background: 'var(--nx-surface-high)' }}>
            <Check2 checked={v.acceptTerms} onChange={(x) => set('acceptTerms', x)} id="su-terms">
              {t('J’accepte les ', 'I accept the ')}
              <Link to="/legal" target="_blank" style={{ color: 'var(--nx-cyan-text)', textDecoration: 'underline' }}>{t('conditions d’utilisation et la politique de confidentialité', 'terms of use and privacy policy')}</Link>.
              <span style={{ color: '#ef4444' }}> *</span>
            </Check2>
            <Check2 checked={v.marketingOptIn} onChange={(x) => set('marketingOptIn', x)} id="su-news">
              {t('Je souhaite recevoir les nouveautés du produit par courriel.', 'Send me product news by email.')}
            </Check2>
          </div>
          {show2('acceptTerms') && (
            <span role="alert" style={{ fontSize: 12.5, color: '#ef4444', marginTop: -8 }}>
              {t('Acceptez les conditions d’utilisation pour créer votre compte.', 'Accept the terms of use to create your account.')}
            </span>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <button type="button" onClick={() => setStep(1)} className="flex items-center justify-center gap-2 rounded-md border px-5 py-2.5"
              style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text)', fontWeight: 500 }}>
              <ArrowLeft size={16} /> {t('Retour', 'Back')}
            </button>
            <div className="flex-1">
              <PrimaryButton busy={busy} icon={<UserPlus size={17} />} label={t('Créer mon compte', 'Create my account')} busyLabel={t('Création…', 'Creating…')} disabled={registrationEnabled === false} />
            </div>
          </div>
        </form>
      )}
    </>
  )
}

/* ─────────────────────────────── Vérification ─────────────────────────────── */

function Verify({ t, lang, email, initialWait, onChangeEmail, onBack, onDone }: {
  t: T; lang: 'fr' | 'en'; email: string; initialWait: number; onChangeEmail: () => void; onBack: () => void; onDone: () => void
}) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', ''])
  const [wait, setWait] = useState(initialWait)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const refs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => { refs.current[0]?.focus() }, [])
  useEffect(() => {
    if (wait <= 0) return
    const id = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(id)
  }, [wait])

  async function submit(code: string) {
    if (busy || code.length !== 6) return
    setError(null); setInfo(null); setBusy(true)
    try {
      await verifyEmail(email, code)
      onDone()
    } catch (e) {
      const c = e instanceof Error ? e.message : ''
      setError(authMessage(c, t))
      setDigits(['', '', '', '', '', ''])
      refs.current[0]?.focus()
    } finally { setBusy(false) }
  }

  function put(i: number, raw: string) {
    const chars = raw.replace(/\D/g, '')
    if (!chars) { const d = [...digits]; d[i] = ''; setDigits(d); return }
    const d = [...digits]
    for (let k = 0; k < chars.length && i + k < 6; k++) d[i + k] = chars[k]
    setDigits(d)
    const nextIndex = Math.min(i + chars.length, 5)
    refs.current[nextIndex]?.focus()
    const code = d.join('')
    if (code.length === 6) void submit(code)
  }

  async function resend() {
    setError(null); setInfo(null)
    try {
      setWait(await resendCode(email, lang))
      setInfo(t('Un nouveau code vient de partir.', 'A new code is on its way.'))
      setDigits(['', '', '', '', '', ''])
      refs.current[0]?.focus()
    } catch (e) {
      setError(authMessage(e instanceof Error ? e.message : '', t))
    }
  }

  return (
    <>
      <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'color-mix(in srgb, var(--nx-cyan) 16%, transparent)', color: 'var(--nx-cyan-text)' }}>
        <MailCheck size={24} />
      </div>
      <Header title={t('Vérifiez votre adresse', 'Verify your email')}
        sub={<>{t('Nous avons envoyé un code à six chiffres à ', 'We sent a six-digit code to ')}<strong style={{ color: 'var(--nx-text)' }}>{email}</strong>. {t('Il est valable 15 minutes.', 'It is valid for 15 minutes.')}</>} />

      <Stepper step={3} labels={[t('Vous', 'You'), t('Votre organisation', 'Your organisation'), t('Vérification', 'Verification')]} />

      {error && <Alert>{error}</Alert>}
      {info && <Alert tone="ok">{info}</Alert>}

      <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); void submit(digits.join('')) }}>
        <div className="flex justify-between gap-2" role="group" aria-label={t('Code de vérification', 'Verification code')}>
          {digits.map((d, i) => (
            <input key={i} ref={(el) => { refs.current[i] = el }} value={d} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'} maxLength={6}
              aria-label={t(`Chiffre ${i + 1}`, `Digit ${i + 1}`)}
              onChange={(e) => put(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus()
                if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus()
                if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus()
              }}
              onPaste={(e) => { e.preventDefault(); put(0, e.clipboardData.getData('text')) }}
              className="nx-field text-center"
              style={{ width: '100%', maxWidth: 56, height: 58, fontFamily: mono, fontSize: 24, fontWeight: 600, padding: 0 }} />
          ))}
        </div>
        <PrimaryButton busy={busy} icon={<ShieldCheck size={17} />} label={t('Vérifier et ouvrir mon espace', 'Verify and open my workspace')} busyLabel={t('Vérification…', 'Verifying…')}
          disabled={digits.join('').length !== 6} />
      </form>

      <div className="flex flex-col gap-2 rounded-md border p-4" style={{ borderColor: 'var(--nx-border)', fontSize: 13.5, color: 'var(--nx-text-muted)' }}>
        <span>{t('Rien reçu ? Vérifiez vos courriels indésirables, puis :', 'Nothing received? Check your spam folder, then:')}</span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <button type="button" onClick={resend} disabled={wait > 0} className="flex items-center gap-1.5 disabled:opacity-60" style={{ color: 'var(--nx-cyan-text)', fontWeight: 600 }}>
            <Mail size={14} /> {wait > 0 ? t(`Renvoyer le code dans ${wait} s`, `Resend code in ${wait}s`) : t('Renvoyer le code', 'Resend code')}
          </button>
          <button type="button" onClick={onChangeEmail} style={{ color: 'var(--nx-cyan-text)' }}>{t('Modifier l’adresse', 'Change email')}</button>
          <button type="button" onClick={onBack} style={{ color: 'var(--nx-text-muted)' }}>{t('Retour à la connexion', 'Back to sign in')}</button>
        </div>
      </div>
    </>
  )
}

/* ─────────────────────────────── Éléments communs ─────────────────────────────── */

function Header({ title, sub }: { title: string; sub: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-[1.7rem] font-semibold" style={{ fontFamily: geist, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{title}</h1>
      <p style={{ fontSize: 15, color: 'var(--nx-text-muted)', lineHeight: 1.55 }}>{sub}</p>
    </div>
  )
}

function Stepper({ step, labels }: { step: number; labels: string[] }) {
  return (
    <ol className="flex items-center gap-2" aria-label="progression">
      {labels.map((l, i) => {
        const n = i + 1
        const done = n < step
        const active = n === step
        return (
          <li key={l} className="flex flex-1 items-center gap-2" aria-current={active ? 'step' : undefined}>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
              style={{ fontFamily: mono, fontSize: 11, fontWeight: 600,
                background: done || active ? 'var(--nx-cyan)' : 'transparent', color: done || active ? 'var(--nx-on-cyan)' : 'var(--nx-text-muted)',
                border: done || active ? 'none' : '1px solid var(--nx-border)' }}>
              {done ? <Check size={13} /> : n}
            </span>
            <span className="hidden truncate sm:inline" style={{ fontSize: 12.5, fontWeight: active ? 600 : 400, color: active ? 'var(--nx-text)' : 'var(--nx-text-muted)' }}>{l}</span>
            {n < labels.length && <span className="h-px flex-1" style={{ background: done ? 'var(--nx-cyan)' : 'var(--nx-border)' }} />}
          </li>
        )
      })}
    </ol>
  )
}

function Field({ label, htmlFor, required, optional, error, hint, children }: {
  label: string; htmlFor: string; required?: boolean; optional?: string; error?: string; hint?: string; children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5" data-invalid={error ? '' : undefined}>
      <label htmlFor={htmlFor} className="flex items-baseline justify-between gap-2" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--nx-text)' }}>
        <span>{label}{required && <span style={{ color: '#ef4444' }}> *</span>}</span>
        {optional && <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--nx-outline)' }}>{optional}</span>}
      </label>
      {children}
      {error ? <span role="alert" style={{ fontSize: 12.5, color: '#ef4444' }}>{error}</span>
        : hint ? <span style={{ fontSize: 12.5, color: 'var(--nx-text-muted)' }}>{hint}</span> : null}
    </div>
  )
}

function PasswordInput({ id, value, onChange, show, onToggle, autoComplete, onBlur, t }: {
  id: string; value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; autoComplete: string; onBlur?: () => void; t: T
}) {
  return (
    <div className="relative">
      <KeyRound size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--nx-outline)' }} />
      <input id={id} type={show ? 'text' : 'password'} required autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur}
        className="nx-field" style={{ paddingLeft: 36, paddingRight: 40 }} maxLength={128} />
      <button type="button" onClick={onToggle} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5" style={{ color: 'var(--nx-text-muted)' }}
        aria-label={show ? t('Masquer le mot de passe', 'Hide password') : t('Afficher le mot de passe', 'Show password')}>
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}

/** Case à cocher dessinée : la case native paraissait pleine même décochée selon le thème. */
function Check2({ id, checked, onChange, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3" style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--nx-text)' }}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] peer-focus-visible:ring-2"
        style={{ border: `1.5px solid ${checked ? 'var(--nx-cyan)' : 'var(--nx-outline)'}`, background: checked ? 'var(--nx-cyan)' : 'var(--nx-surface)', color: 'var(--nx-on-cyan)' }}>
        {checked && <Check size={13} strokeWidth={3} />}
      </span>
      <span>{children}</span>
    </label>
  )
}

function PrimaryButton({ label, busyLabel, icon, busy, disabled }: { label: string; busyLabel?: string; icon: ReactNode; busy?: boolean; disabled?: boolean }) {
  return (
    <button type="submit" disabled={busy || disabled}
      className="flex w-full items-center justify-center gap-2 rounded-md py-2.5 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      style={{ background: 'var(--nx-cyan)', color: 'var(--nx-on-cyan)', fontWeight: 600, fontSize: 15 }}>
      {busy ? <Loader2 size={17} className="animate-spin" /> : icon}
      {busy && busyLabel ? busyLabel : label}
    </button>
  )
}

function Alert({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'ok' }) {
  const c = tone === 'ok' ? '#16a34a' : '#ef4444'
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className="rounded-md border px-3 py-2.5"
      style={{ fontSize: 13.5, lineHeight: 1.5, borderColor: `color-mix(in srgb, ${c} 45%, transparent)`, color: c, background: `color-mix(in srgb, ${c} 8%, transparent)` }}>
      {children}
    </div>
  )
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1" style={{ background: 'var(--nx-border)' }} />
      <span style={{ fontSize: 12.5, color: 'var(--nx-text-muted)' }}>{label}</span>
      <div className="h-px flex-1" style={{ background: 'var(--nx-border)' }} />
    </div>
  )
}
