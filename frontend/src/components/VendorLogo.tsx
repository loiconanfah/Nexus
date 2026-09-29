import { VENDOR_LOGOS } from '../lib/vendor-logos'

/**
 * La marque du système auquel on se branche.
 *
 * Un logo n'est pas décoratif ici : sur un écran qui propose quinze sources, il
 * est ce qui permet de retrouver la sienne d'un coup d'œil, avant même de lire.
 *
 * Deux précautions. Les marques très sombres (GitHub) disparaîtraient sur fond
 * sombre : leur glyphe reprend alors la couleur du texte. Et quatre éditeurs ont
 * demandé le retrait de leur icône des bibliothèques libres : ils reçoivent un
 * monogramme dans leur couleur, ce qui respecte ce retrait sans casser la grille.
 */
export function VendorLogo({ id, size = 36 }: { id: string; size?: number }) {
  const logo = VENDOR_LOGOS[id]
  const inner = Math.round(size * 0.55)

  if (!logo) {
    return (
      <span aria-hidden className="flex shrink-0 items-center justify-center rounded-sm"
        style={{ width: size, height: size, border: '1px solid var(--nx-border)', background: 'var(--nx-panel)' }} />
    )
  }

  const dark = luminance(logo.hex) < 0.22
  const tint = `color-mix(in srgb, ${logo.hex} 14%, transparent)`
  const glyph = dark ? 'var(--nx-text)' : logo.hex

  return (
    <span aria-hidden className="flex shrink-0 items-center justify-center rounded-sm"
      style={{
        width: size,
        height: size,
        background: dark ? 'var(--nx-panel)' : tint,
        border: `1px solid color-mix(in srgb, ${logo.hex} 30%, var(--nx-border))`,
      }}>
      {logo.path ? (
        <svg width={inner} height={inner} viewBox="0 0 24 24" role="img" focusable="false">
          <path d={logo.path} fill={glyph} />
        </svg>
      ) : (
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: logo.initials && logo.initials.length > 2 ? size * 0.28 : size * 0.34,
          fontWeight: 600,
          color: glyph,
          letterSpacing: '-0.02em',
        }}>
          {logo.initials}
        </span>
      )}
    </span>
  )
}

/** Luminance perçue, pour savoir si une marque disparaîtrait sur fond sombre. */
function luminance(hex: string) {
  const value = hex.replace('#', '')
  const r = parseInt(value.slice(0, 2), 16) / 255
  const g = parseInt(value.slice(2, 4), 16) / 255
  const b = parseInt(value.slice(4, 6), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
