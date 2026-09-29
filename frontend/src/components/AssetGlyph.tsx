import { brandFor, familyColor } from '../lib/assetLook'
import { useTheme } from '../lib/theme'

/**
 * Le signe d'un actif : sa marque si on la reconnaît, sinon l'icône de sa
 * famille, dans la couleur de cette famille.
 *
 * Toutes les cartes du plan portaient la même icône grise : on lisait un
 * formulaire, pas une organisation. Un « Microsoft 365 » ou un « PostgreSQL »
 * doit se reconnaître avant d'être lu, et un actif sans marque doit au moins
 * annoncer sa famille par sa couleur.
 *
 * Le même choix qu'en 3D, par la même bibliothèque : une couleur ne peut pas
 * vouloir dire deux choses selon l'écran.
 */
export function AssetGlyph({ name, entityType, fallback, size = 14 }: {
  name: string
  entityType: string
  /** L'icône de famille, quand aucune marque n'est reconnue. */
  fallback: React.ReactNode
  size?: number
}) {
  const light = useTheme().theme !== 'dark'
  const brand = brandFor(name, entityType)

  if (brand?.path) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-hidden focusable="false">
        <path d={brand.path} fill={brand.hex} />
      </svg>
    )
  }

  if (brand?.initials) {
    return (
      <span aria-hidden style={{
        fontFamily: 'var(--font-mono)',
        fontSize: size * (brand.initials.length > 2 ? 0.6 : 0.78),
        fontWeight: 700,
        color: brand.hex,
        lineHeight: 1,
      }}>{brand.initials}</span>
    )
  }

  return <span aria-hidden style={{ color: familyColor(entityType, light), display: 'inline-flex' }}>{fallback}</span>
}
