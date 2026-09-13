import { useMemo } from 'react'
import { useLang } from '../lib/i18n'

/**
 * Graphe « un centre, ce qui en dépend ».
 *
 * Remplace la disposition radiale qu'employaient Fournisseurs et Dépendances
 * humaines : avec des noms réels (« Data Center Montréal », « Politique Loi 25 /
 * Vie privée »), un anneau superpose les étiquettes et devient illisible. Une
 * disposition en éventail — le centre à gauche, ce qui en dépend empilé à
 * droite, reliés par des courbes — lit les noms ENTIERS et se tient quel que
 * soit leur nombre.
 *
 * Le viewBox est en pixels (et non en pourcentages) : le texte garde une taille
 * réelle au lieu d'être étiré avec le conteneur.
 */

const mono = 'var(--font-mono)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'

export type Spoke = { name: string; critical?: boolean; note?: string }

const W = 820
const HUB_X = 40
const HUB_W = 230
const SPOKE_X = 430
const SPOKE_W = 350
const ROW_H = 38
const ROW_GAP = 10
const PAD_Y = 34

/** Tronque au nombre de caractères qui tient dans la largeur donnée. */
function fit(text: string, px: number, charPx: number): string {
  const max = Math.floor(px / charPx)
  return text.length <= max ? text : `${text.slice(0, Math.max(1, max - 1))}…`
}

export function HubSpoke({
  hub, hubNote, spokes, onSpoke, emptyLabel, accent = CYAN, icon,
}: {
  hub: string
  hubNote?: string
  spokes: Spoke[]
  onSpoke?: (name: string) => void
  emptyLabel?: string
  /** Couleur du centre — distingue une personne d'un fournisseur. */
  accent?: string
  icon?: 'person' | 'supplier'
}) {
  const { t } = useLang()
  const rows = spokes.slice(0, 10)
  const H = Math.max(260, PAD_Y * 2 + rows.length * (ROW_H + ROW_GAP) - ROW_GAP)
  const hubY = H / 2

  const laid = useMemo(
    () => rows.map((s, i) => ({ ...s, y: PAD_Y + i * (ROW_H + ROW_GAP) + ROW_H / 2 })),
    [rows],
  )

  if (rows.length === 0) {
    return (
      <div className="flex h-full min-h-[260px] items-center justify-center px-6 text-center"
        style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>
        {emptyLabel ?? t('Rien ne dépend de cet élément pour l’instant.', 'Nothing depends on this element yet.')}
      </div>
    )
  }

  const hubLines = wrap(hub, 24, 2)
  const hubH = 34 + hubLines.length * 17 + (hubNote ? 16 : 0)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
      className="block h-full w-full" style={{ minHeight: 260 }}>
      <defs>
        <linearGradient id="hs-link" x1="0" x2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.55" />
          <stop offset="100%" stopColor={accent} stopOpacity="0.16" />
        </linearGradient>
        <linearGradient id="hs-link-crit" x1="0" x2="1">
          <stop offset="0%" stopColor="#ffb4ab" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#ffb4ab" stopOpacity="0.2" />
        </linearGradient>
      </defs>

      {/* Liens — courbes, pour ne jamais croiser les étiquettes */}
      {laid.map((s) => {
        const x1 = HUB_X + HUB_W
        const mid = (x1 + SPOKE_X) / 2
        return (
          <path key={`k-${s.name}`}
            d={`M ${x1} ${hubY} C ${mid} ${hubY}, ${mid} ${s.y}, ${SPOKE_X} ${s.y}`}
            fill="none" strokeWidth={s.critical ? 2 : 1.4}
            stroke={s.critical ? 'url(#hs-link-crit)' : 'url(#hs-link)'} />
        )
      })}

      {/* Centre */}
      <g>
        <rect x={HUB_X} y={hubY - hubH / 2} width={HUB_W} height={hubH} rx={4}
          fill="var(--nx-surface-container)" stroke={accent} strokeWidth={1.4} />
        <circle cx={HUB_X + 24} cy={hubY - hubH / 2 + 20} r={9} fill={accent} opacity={0.16} />
        {icon === 'person' ? (
          <>
            <circle cx={HUB_X + 24} cy={hubY - hubH / 2 + 17.5} r={3} fill={accent} />
            <path d={`M ${HUB_X + 19} ${hubY - hubH / 2 + 25} q 5 -4.5 10 0`} fill="none" stroke={accent} strokeWidth={1.6} strokeLinecap="round" />
          </>
        ) : (
          <rect x={HUB_X + 19.5} y={hubY - hubH / 2 + 15.5} width={9} height={9} rx={1.5} fill="none" stroke={accent} strokeWidth={1.6} />
        )}
        <text x={HUB_X + 40} y={hubY - hubH / 2 + 24} fill="var(--nx-text-muted)"
          fontFamily={mono} fontSize={9.5} letterSpacing="1.2">
          {(icon === 'person' ? t('PERSONNE', 'PERSON') : t('FOURNISSEUR', 'SUPPLIER'))}
        </text>
        {hubLines.map((line, k) => (
          <text key={line + k} x={HUB_X + 16} y={hubY - hubH / 2 + 44 + k * 17}
            fill="var(--nx-text)" fontSize={14} fontWeight={600}>{line}</text>
        ))}
        {hubNote && (
          <text x={HUB_X + 16} y={hubY - hubH / 2 + 44 + hubLines.length * 17 + 2}
            fill="var(--nx-text-muted)" fontFamily={mono} fontSize={10.5}>{hubNote}</text>
        )}
      </g>

      {/* Ce qui en dépend */}
      {laid.map((s) => {
        const col = s.critical ? '#ffb4ab' : 'var(--nx-border)'
        return (
          <g key={s.name} onClick={() => onSpoke?.(s.name)} style={{ cursor: onSpoke ? 'pointer' : 'default' }}>
            <rect x={SPOKE_X} y={s.y - ROW_H / 2} width={SPOKE_W} height={ROW_H} rx={3}
              fill="var(--nx-surface)" stroke={col} strokeWidth={s.critical ? 1.2 : 1} />
            <rect x={SPOKE_X} y={s.y - ROW_H / 2} width={3} height={ROW_H}
              fill={s.critical ? '#ffb4ab' : accent} opacity={s.critical ? 1 : 0.5} />
            <text x={SPOKE_X + 16} y={s.note ? s.y - 2 : s.y + 4.5} fill="var(--nx-text)" fontSize={13}>
              {fit(s.name, SPOKE_W - 110, 7.1)}
            </text>
            {s.note && (
              <text x={SPOKE_X + 16} y={s.y + 12} fill="var(--nx-text-muted)" fontFamily={mono} fontSize={10}>
                {fit(s.note, SPOKE_W - 110, 6)}
              </text>
            )}
            {s.critical && (
              <text x={SPOKE_X + SPOKE_W - 14} y={s.y + 4} textAnchor="end"
                fill="#ffb4ab" fontFamily={mono} fontSize={9.5} letterSpacing="1">
                {t('CRITIQUE', 'CRITICAL')}
              </text>
            )}
          </g>
        )
      })}

      {spokes.length > rows.length && (
        <text x={SPOKE_X + 16} y={H - 10} fill="var(--nx-text-muted)" fontFamily={mono} fontSize={10.5}>
          + {spokes.length - rows.length} {t('autres', 'more')}
        </text>
      )}
    </svg>
  )
}

/** Découpe un titre en au plus `maxLines` lignes d'environ `perLine` caractères. */
function wrap(text: string, perLine: number, maxLines: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    if (!cur) { cur = w; continue }
    if ((cur + ' ' + w).length <= perLine) cur += ' ' + w
    else { lines.push(cur); cur = w; if (lines.length === maxLines) break }
  }
  if (lines.length < maxLines && cur) lines.push(cur)
  if (lines.length === maxLines) {
    const lastIdx = maxLines - 1
    const rest = text.slice(lines.slice(0, lastIdx).join(' ').length).trim()
    if (rest.length > perLine) lines[lastIdx] = `${rest.slice(0, perLine - 1)}…`
  }
  return lines.length ? lines : [text]
}

/** Liste de sélection verticale — remplace les rangées de boutons écrasées. */
export function PickerList<T extends { id: string; name: string }>({
  items, selectedId, onPick, meta, title,
}: {
  items: T[]
  selectedId?: string
  onPick: (id: string) => void
  /** Petit chiffre à droite (score, nombre de systèmes…). */
  meta?: (item: T) => { text: string; color?: string } | null
  title: string
}) {
  return (
    <div className="flex w-full shrink-0 flex-col border-b lg:w-[212px] lg:border-b-0 lg:border-r"
      style={{ borderColor: 'var(--nx-border)' }}>
      <div className="px-4 py-2.5" style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>
        {title}
      </div>
      <div className="flex max-h-[320px] flex-col overflow-y-auto">
        {items.map((it) => {
          const sel = it.id === selectedId
          const m = meta?.(it)
          return (
            <button key={it.id} onClick={() => onPick(it.id)}
              className="flex items-center gap-2 px-4 py-2.5 text-left transition-colors"
              style={{
                background: sel ? 'rgba(0,229,255,0.09)' : 'transparent',
                borderLeft: `2px solid ${sel ? CYAN : 'transparent'}`,
              }}>
              <span className="min-w-0 flex-1 truncate" style={{ fontSize: 13, color: sel ? CYAN_T : 'var(--nx-text)' }}>
                {it.name}
              </span>
              {m && (
                <span style={{ fontFamily: mono, fontSize: 11, color: m.color ?? 'var(--nx-text-muted)' }}>{m.text}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
