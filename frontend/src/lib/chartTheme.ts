/**
 * L'habillage commun des graphiques.
 *
 * Deux écrans dessinaient leurs axes, leur grille et leur infobulle chacun dans
 * son coin : mêmes intentions, réglages différents, donc deux graphiques qui ne
 * se ressemblaient pas dans le même produit. Tout est ici, et en un seul
 * endroit, si bien qu'une correction de lisibilité profite aux deux.
 *
 * Le parti pris tient en une phrase : le moins d'encre possible autour de la
 * donnée. Pas de trait d'axe, une grille horizontale à peine visible, et des
 * chiffres en chasse fixe pour qu'ils s'alignent et se comparent d'un coup d'œil.
 */

const mono = 'var(--font-mono)'

/** Ticks d'un axe : lisibles, discrets, sans trait ni graduation. */
export const AXIS = {
  tick: { fill: 'var(--nx-text-muted)', fontSize: 11, fontFamily: mono },
  axisLine: false as const,
  tickLine: false as const,
}

/** Grille horizontale seule : les verticales n'aident jamais à lire une valeur. */
export const GRID = {
  strokeDasharray: '2 7',
  stroke: 'var(--nx-border)',
  vertical: false as const,
}

/** Infobulle : un panneau du produit, pas une boîte de navigateur. */
export const TOOLTIP = {
  contentStyle: {
    background: 'var(--nx-panel)',
    border: '1px solid var(--nx-border)',
    borderRadius: 6,
    boxShadow: '0 10px 28px rgba(0,0,0,0.18)',
    fontFamily: mono,
    fontSize: 12,
    padding: '8px 10px',
  },
  labelStyle: { color: 'var(--nx-text)', marginBottom: 4, fontSize: 11.5 },
  itemStyle: { padding: 0, color: 'var(--nx-text)' },
  cursor: { fill: 'color-mix(in srgb, var(--nx-cyan) 7%, transparent)' },
}

/** Curseur d'un graphique en lignes : un trait, pas un pavé. */
export const LINE_CURSOR = {
  stroke: 'var(--nx-outline)',
  strokeWidth: 1,
  strokeDasharray: '3 3',
}

/**
 * Les couleurs des séries, dans l'ordre.
 *
 * Elles viennent des jetons de catégorie du thème, donc elles restent lisibles
 * en clair comme en sombre, et un daltonien distingue les deux premières, qui
 * sont les seules à être systématiquement comparées.
 */
export const SERIES = ['var(--nx-cat-1)', 'var(--nx-cat-3)', 'var(--nx-cat-2)', 'var(--nx-cat-4)']
