import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Building2, KeyRound, LogIn, Mail, Share2, ShieldCheck } from 'lucide-react'
import { login, loginWithEntra, register } from '../lib/auth'
import { getAuthConfig, signInWithMicrosoft } from '../lib/entra'
import { useLang } from '../lib/i18n'

export function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { lang, setLang, t } = useLang()
  const [mode, setMode] = useState<'signin' | 'signup'>(searchParams.get('signup') === '1' ? 'signup' : 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [entraEnabled, setEntraEnabled] = useState(false)
  const [registrationEnabled, setRegistrationEnabled] = useState(false)

  useEffect(() => {
    getAuthConfig()
      .then((c) => {
        setEntraEnabled(c.entraEnabled)
        setRegistrationEnabled(c.registrationEnabled)
      })
      .catch(() => {})
  }, [])

  function registerError(code: string): string {
    switch (code) {
      case 'email_taken':
        return t('Cet e-mail a déjà un compte.', 'This email already has an account.')
      case 'weak_password':
        return t('Mot de passe trop court (8 caractères minimum).', 'Password too short (8 characters minimum).')
      case 'invalid_email':
        return t('Adresse e-mail invalide.', 'Invalid email address.')
      case 'registration_disabled':
        return t('L’inscription est désactivée.', 'Registration is disabled.')
      default:
        return t('Création de compte impossible. Réessayez.', 'Could not create account. Please retry.')
    }
  }

  async function authenticateEntra() {
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      const msToken = await signInWithMicrosoft()
      await loginWithEntra(msToken)
      navigate('/')
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg === 'user_cancelled' || msg.includes('cancel')) {
        // fermeture volontaire de la fenêtre : pas d'erreur affichée
      } else {
        setError(t('Connexion Microsoft impossible.', 'Microsoft sign-in failed.'))
      }
    } finally {
      setBusy(false)
    }
  }

  async function authenticate(user = email, pass = password) {
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      if (mode === 'signup') {
        await register(user, pass)
      } else {
        await login(user, pass)
      }
      navigate('/')
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (mode === 'signup') {
        setError(registerError(msg))
      } else {
        setError(
          msg === 'invalid_credentials'
            ? t('Identifiants invalides.', 'Invalid credentials.')
            : t('Connexion impossible. Réessayez.', 'Sign-in failed. Please retry.'),
        )
      }
    } finally {
      setBusy(false)
    }
  }

  async function fillDemo() {
    if (busy) return
    setMode('signin')
    setEmail('admin@cgi.demo')
    setPassword('nexus-demo-2026')
    setError(null)
    setBusy(true)
    try {
      await login('admin@cgi.demo', 'nexus-demo-2026')
      navigate('/')
    } catch {
      setError(t('Connexion démo impossible.', 'Demo sign-in failed.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="flex min-h-screen w-full flex-col md:flex-row"
      style={{ background: 'var(--nx-bg)', color: 'var(--nx-text)', fontFamily: 'var(--font-inter)' }}
    >
      {/* ===== Panneau gauche : branding + visualisation ===== */}
      <div
        className="relative flex min-h-[360px] w-full flex-col justify-between overflow-hidden border-b p-8 md:min-h-screen md:w-[45%] md:border-b-0 md:border-r md:p-12 lg:w-1/2 lg:p-16"
        style={{ background: 'var(--nx-panel)', borderColor: 'var(--nx-border)' }}
      >
        {/* Fond graphe abstrait */}
        <div className="absolute inset-0 z-0" style={{ opacity: 0.4 }}>
          <div className="nx-grid absolute inset-0" />
          <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="cyan-glow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#3b494c" stopOpacity="0.1" />
              </linearGradient>
            </defs>
            <line x1="20%" y1="30%" x2="40%" y2="50%" stroke="#3b494c" strokeWidth="1" />
            <line x1="40%" y1="50%" x2="70%" y2="40%" stroke="#3b494c" strokeWidth="1" />
            <line x1="70%" y1="40%" x2="85%" y2="70%" stroke="#3b494c" strokeWidth="1" />
            <line x1="40%" y1="50%" x2="30%" y2="80%" stroke="#3b494c" strokeWidth="1" />
            <line x1="70%" y1="40%" x2="60%" y2="85%" stroke="url(#cyan-glow)" strokeWidth="1.5" />
            <line x1="30%" y1="80%" x2="60%" y2="85%" stroke="#3b494c" strokeWidth="1" />
            <circle className="nx-node-pulse" cx="20%" cy="30%" r="3" fill="#849396" style={{ animationDelay: '0s' }} />
            <circle className="nx-node-pulse" cx="40%" cy="50%" r="4" fill="#00e5ff" style={{ animationDelay: '1s' }} />
            <circle className="nx-node-pulse" cx="70%" cy="40%" r="3" fill="#849396" style={{ animationDelay: '.5s' }} />
            <circle cx="85%" cy="70%" r="2" fill="#3b494c" />
            <circle cx="30%" cy="80%" r="3" fill="#849396" />
            <circle className="nx-node-pulse" cx="60%" cy="85%" r="5" fill="#00e5ff" style={{ animationDelay: '1.5s' }} />
            <text x="42%" y="49%" fill="#00e5ff" fontFamily="JetBrains Mono" fontSize="10" opacity="0.7">ROOT_NODE_A</text>
            <text x="62%" y="84%" fill="#00e5ff" fontFamily="JetBrains Mono" fontSize="10" opacity="0.7">SEC_CLUSTER_7</text>
          </svg>
        </div>

        {/* Branding */}
        <div className="relative z-10 flex flex-col items-start gap-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-sm"
              style={{ background: 'var(--nx-cyan)', boxShadow: '0 0 15px rgba(0,229,255,0.25)' }}
            >
              <Share2 size={20} strokeWidth={2.4} style={{ color: 'var(--nx-on-cyan)' }} />
            </div>
            <h1
              className="text-4xl font-semibold tracking-tighter"
              style={{ fontFamily: 'var(--font-geist)', color: 'var(--nx-text)' }}
            >
              NEXUS
            </h1>
          </div>
          <p
            className="mt-2 max-w-sm text-2xl"
            style={{ fontFamily: 'var(--font-geist)', color: 'var(--nx-text-muted)', lineHeight: 1.3, letterSpacing: '-0.01em' }}
          >
            {t('Intelligence opérationnelle des dépendances', 'Operational Dependency Intelligence')}
          </p>
        </div>

        {/* Statut bas */}
        <div
          className="relative z-10 mt-auto hidden items-center gap-2 md:flex"
          style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.05em', color: 'var(--nx-outline)' }}
        >
          <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: 'var(--nx-cyan)' }} />
          SYS_SECURE // V.4.2.0-STABLE
        </div>
      </div>

      {/* ===== Panneau droit : formulaire ===== */}
      <div className="flex w-full items-center justify-center p-6 sm:p-12 md:w-[55%] lg:w-1/2" style={{ background: 'var(--nx-surface)' }}>
        <div className="relative flex w-full max-w-md flex-col gap-8">
          {/* Bascule langue */}
          <div className="absolute right-0 top-0 flex items-center rounded-sm border" style={{ borderColor: 'var(--nx-border)' }}>
            {(['fr', 'en'] as const).map((l) => (
              <button key={l} type="button" onClick={() => setLang(l)} className="px-2 py-1" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', color: lang === l ? 'var(--nx-on-cyan)' : 'var(--nx-text-muted)', background: lang === l ? 'var(--nx-cyan)' : 'transparent' }}>{l}</button>
            ))}
          </div>
          {/* En-tête */}
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-medium" style={{ fontFamily: 'var(--font-geist)', color: 'var(--nx-text)', letterSpacing: '-0.01em' }}>
              {mode === 'signup' ? t('Créer un compte NEXUS', 'Create your NEXUS account') : t('Connexion à NEXUS', 'Sign in to NEXUS')}
            </h2>
            <div className="flex items-center gap-2" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.05em', color: 'var(--nx-cyan-text)' }}>
              <ShieldCheck size={16} />
              <span>{mode === 'signup' ? t('Espace de travail vierge à la création', 'Fresh workspace on sign-up') : t('Connexion compatible MFA', 'MFA-ready connection')}</span>
            </div>
          </div>

          {/* Message d'erreur */}
          {error && (
            <div
              className="rounded border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--nx-danger, #ef4444)', color: 'var(--nx-danger, #ef4444)', background: 'rgba(239,68,68,0.08)' }}
            >
              {error}
            </div>
          )}

          {/* Formulaire */}
          <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); void authenticate() }}>
            <Field label={t('Adresse e-mail', 'Email Address')}>
              <InputRow icon={<Mail size={18} />}>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="commander@nexus.gov"
                  className="w-full bg-transparent p-2 outline-none"
                  style={{ color: 'var(--nx-text)', fontFamily: 'var(--font-inter)' }}
                />
              </InputRow>
            </Field>

            <Field label={t('Mot de passe', 'Password')} aside={mode === 'signin' ? <a href="#" onClick={(e) => e.preventDefault()} className="transition-colors" style={{ fontSize: 13, color: 'var(--nx-cyan-text)' }}>{t('Mot de passe oublié ?', 'Forgot password?')}</a> : <span style={{ fontSize: 13, color: 'var(--nx-outline)' }}>{t('8 caractères min.', '8 chars min.')}</span>}>
              <InputRow icon={<KeyRound size={18} />}>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-transparent p-2 outline-none"
                  style={{ color: 'var(--nx-text)', fontFamily: 'var(--font-inter)' }}
                />
              </InputRow>
            </Field>

            {/* Action de connexion (primaire) */}
            <button
              type="submit"
              disabled={busy}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded py-3 transition-colors disabled:opacity-60"
              style={{
                background: 'var(--nx-cyan)', color: 'var(--nx-on-cyan)',
                fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase',
                boxShadow: '0 0 10px rgba(0,229,255,0.15)',
              }}
            >
              <span>
                {busy
                  ? mode === 'signup' ? t('Création…', 'Creating…') : t('Connexion…', 'Signing in…')
                  : mode === 'signup' ? t('Créer le compte', 'Create account') : t('S’authentifier', 'Authenticate')}
              </span>
              <LogIn size={18} />
            </button>

            {/* Bascule connexion / inscription */}
            {registrationEnabled && (
              <button
                type="button"
                onClick={() => { setError(null); setMode(mode === 'signin' ? 'signup' : 'signin') }}
                className="text-center transition-colors"
                style={{ fontSize: 13, color: 'var(--nx-cyan-text)', fontFamily: 'var(--font-inter)' }}
              >
                {mode === 'signin'
                  ? t('Pas de compte ? Créer un compte', 'No account? Create one')
                  : t('Déjà un compte ? Se connecter', 'Already have an account? Sign in')}
              </button>
            )}
          </form>

          {/* Séparateur */}
          <div className="my-2 flex items-center gap-4">
            <div className="h-px flex-1" style={{ background: 'var(--nx-border)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.05em', color: 'var(--nx-outline)' }}>{t('OU', 'OR')}</span>
            <div className="h-px flex-1" style={{ background: 'var(--nx-border)' }} />
          </div>

          {/* SSO Entra ID (visible seulement si configuré côté serveur) */}
          {entraEnabled && (
            <button
              type="button"
              onClick={authenticateEntra}
              disabled={busy}
              className="flex w-full items-center justify-center gap-3 rounded py-3 transition-all active:scale-[0.99] disabled:opacity-60"
              style={{
                background: 'var(--nx-cyan)', color: 'var(--nx-on-cyan)',
                fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase',
                boxShadow: '0 0 10px rgba(0,229,255,0.15)',
              }}
            >
              <svg className="h-5 w-5 fill-current" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="1" width="9" height="9" />
                <rect x="11" y="1" width="9" height="9" />
                <rect x="1" y="11" width="9" height="9" />
                <rect x="11" y="11" width="9" height="9" />
              </svg>
              <span>{t('Se connecter avec Microsoft', 'Sign in with Microsoft')}</span>
            </button>
          )}

          {/* Accès démo CGI (identifiants pré-remplis, authentification réelle) */}
          <button
            type="button"
            onClick={fillDemo}
            disabled={busy}
            className="flex w-full items-center justify-center gap-3 rounded py-3 transition-all active:scale-[0.99] disabled:opacity-60"
            style={{
              background: 'var(--nx-surface-highest)', border: '1px solid var(--nx-border)', color: 'var(--nx-text)',
              fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase',
            }}
          >
            <Building2 size={18} />
            <span>{t('Accès démo (CGI Inc.)', 'Demo access (CGI Inc.)')}</span>
          </button>

          {/* Pied */}
          <div className="mt-4 flex flex-col items-center gap-4 border-t pt-6" style={{ borderColor: 'rgba(59,73,76,0.5)' }}>
            <a href="#" onClick={(e) => e.preventDefault()} className="flex items-center gap-1 transition-colors" style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>
              <Building2 size={14} />
              {t('Identifiant d’organisation', 'Organization Identifier')}
            </a>
            <p className="flex items-center gap-1" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--nx-outline)' }}>
              <ShieldCheck size={12} />
              {t('Environnement d’entreprise protégé', 'Protected enterprise environment')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, aside, children }: { label: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-end justify-between">
        <label style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>
          {label}
        </label>
        {aside}
      </div>
      {children}
    </div>
  )
}

function InputRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className="nx-input relative flex items-center rounded transition-all"
      style={{ background: 'var(--nx-surface-high)', border: '1px solid var(--nx-border)' }}
    >
      <span className="pl-3" style={{ color: 'var(--nx-outline)' }}>{icon}</span>
      {children}
    </div>
  )
}
