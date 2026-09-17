/**
 * Logo Lenexux — le monogramme L·X de la charte graphique.
 *
 * UN SEUL tracé pour toute l'application : l'en-tête, la vitrine, la connexion
 * et la documentation affichent exactement la même forme. Deux groupes, deux
 * couleurs : la structure (le L et le X) et les éléments cyan.
 *
 * Couleurs de la charte :
 *   - sur fond clair  : structure #0D0D0D, cyan #16B3CE (version principale)
 *   - sur fond sombre : structure #FFFFFF, cyan #22C9E4 (version inversée)
 * La variante « auto » suit le thème de l'application, avec les couleurs EXACTES
 * de la charte (jetons --nx-logo-* d'index.css) et non les teintes d'interface,
 * qui en sont proches sans être identiques.
 */

const INK_PATH = 'M295 660H408V1222H706L860 1000L688 754H538L481 660H728L907 917L1075 660H1197L973 1000L1197 1340H1068L907 1087L732 1340H295Z'
const ACCENT_PATH = 'M458 784H554L706 1000L572 1195H473L611 1000Z M590 784H674L824 1000L691 1195H608L741 1000Z M765 660H846L945 803L906 866Z M906 1139L945 1200L850 1340H766Z'

/** Proportion du monogramme (largeur / hauteur). */
export const LOGO_RATIO = 925 / 700

type Variant = 'auto' | 'light' | 'dark' | 'mono'

const COLORS: Record<Exclude<Variant, 'auto'>, { ink: string; accent: string }> = {
  light: { ink: '#0d0d0d', accent: '#16b3ce' },
  dark: { ink: '#ffffff', accent: '#22c9e4' },
  mono: { ink: 'currentColor', accent: 'currentColor' },
}

export function LogoMark({
  size = 28,
  variant = 'auto',
  title = 'Lenexux',
  className,
}: {
  /** Largeur en pixels ; la hauteur suit la proportion du monogramme. */
  size?: number
  variant?: Variant
  /** Nom accessible. Passer '' quand le mot « Lenexux » est déjà affiché à côté. */
  title?: string
  className?: string
}) {
  const c = variant === 'auto'
    ? { ink: 'var(--nx-logo-ink, #0d0d0d)', accent: 'var(--nx-logo-accent, #16b3ce)' }
    : COLORS[variant]
  const decorative = title === ''

  return (
    <svg
      className={className}
      width={size}
      height={Math.round(size / LOGO_RATIO)}
      viewBox="285 650 925 700"
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : title}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <path d={INK_PATH} style={{ fill: c.ink }} />
      <path d={ACCENT_PATH} style={{ fill: c.accent }} />
    </svg>
  )
}

/** Le monogramme accompagné du nom — là où la marque n'est pas encore connue. */
export function Logo({
  size = 28,
  variant = 'auto',
  wordSize,
  wordColor,
}: {
  size?: number
  variant?: Variant
  wordSize?: number
  wordColor?: string
}) {
  // Espacement repris de la composition « logo + nom » de la charte graphique
  // (22 px pour un monogramme de 78 px, soit environ 28 %).
  const gap = Math.max(6, Math.round(size * 0.28))
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap }}>
      <LogoMark size={size} variant={variant} title="" />
      <span
        style={{
          fontFamily: 'var(--font-geist)',
          fontWeight: 700,
          fontSize: wordSize ?? Math.round(size * 0.72),
          letterSpacing: '-0.035em',
          lineHeight: 1,
          color: wordColor ?? (variant === 'dark' ? '#ffffff' : variant === 'light' ? '#0d0d0d' : 'var(--nx-text)'),
        }}
      >
        Lenexux
      </span>
    </span>
  )
}
