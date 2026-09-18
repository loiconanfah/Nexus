import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import { useLang } from './i18n'

/**
 * Affichage des montants dans la devise de l'espace (choisie à l'assistant de
 * démarrage). Tout montant de l'application passe par ici : une microfinance
 * camerounaise lit ses pertes en FCFA, sans décimales, pas en dollars canadiens.
 */
export interface CurrencyInfo {
  code: string
  name: string
  symbol: string
  decimals: number
}

const FALLBACK: CurrencyInfo = { code: 'CAD', name: 'Dollar canadien', symbol: '$', decimals: 2 }

// Les symboles courts se collent au suffixe (« 1,2 M$ », « 3 k€ ») ; les autres
// s'en détachent (« 1,2 Md FCFA »).
const TIGHT = new Set(['$', '€', '£'])

export function makeMoney(cur: CurrencyInfo, lang: 'fr' | 'en') {
  const locale = lang === 'fr' ? 'fr-CA' : 'en-CA'
  const sym = cur.symbol
  const join = (n: string, suffix: string) =>
    TIGHT.has(sym) ? `${n} ${suffix}${sym}` : `${n} ${suffix ? suffix + ' ' : ''}${sym}`
  const num = (v: number, digits: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(v)

  /** Montant arrondi à l'unité, avec la devise : « 25 000 $ », « 1 500 000 FCFA ». */
  const full = (v: number) => join(num(Math.round(v), 0), '')

  /** Montant compact : « 1,7 M$ », « 240 k$ », « 1,2 Md FCFA ». */
  const compact = (v: number) => {
    const a = Math.abs(v)
    if (a >= 1e9) return join(num(v / 1e9, a >= 1e11 ? 0 : 1), lang === 'fr' ? 'Md' : 'B')
    if (a >= 1e6) return join(num(v / 1e6, a >= 1e8 ? 0 : 1), 'M')
    if (a >= 1e4) return join(num(v / 1e3, 0), 'k')
    return full(v)
  }

  /** Nombre seul, sans devise (axes de graphiques, champs de saisie). */
  const plain = (v: number) => num(Math.round(v), 0)

  /** Unité pour un titre d'axe exprimé en millions : « M$ », « M FCFA ». */
  const millions = TIGHT.has(sym) ? `M${sym}` : `M ${sym}`

  return { code: cur.code, symbol: sym, currency: cur, full, compact, plain, millions }
}

export type Money = ReturnType<typeof makeMoney>

/** Profil de l'organisation (mis en cache : une seule requête pour toute l'application). */
export function useOrganization() {
  return useQuery({ queryKey: ['organization'], queryFn: api.organization, staleTime: 5 * 60_000, retry: 1 })
}

export function useMoney(): Money {
  const { lang } = useLang()
  const { data } = useOrganization()
  const cur = data?.currencies.find((c) => c.code === data.currency) ?? FALLBACK
  return makeMoney(cur, lang)
}
