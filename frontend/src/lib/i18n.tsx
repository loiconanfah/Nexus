import { createContext, useContext, useState, type ReactNode } from 'react'

export type Lang = 'fr' | 'en'
const KEY = 'nexus.lang'

function initial(): Lang {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'fr' || v === 'en') return v
  } catch { /* stockage indisponible */ }
  return 'fr'
}

interface LangCtx {
  lang: Lang
  setLang: (l: Lang) => void
  /** Traduction colocalisée : t('français', 'english'). */
  t: (fr: string, en: string) => string
}

const Ctx = createContext<LangCtx | null>(null)

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial)
  const setLang = (l: Lang) => {
    setLangState(l)
    try { localStorage.setItem(KEY, l) } catch { /* ignore */ }
    try { document.documentElement.lang = l } catch { /* ignore */ }
  }
  const t = (fr: string, en: string) => (lang === 'fr' ? fr : en)
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>
}

export function useLang(): LangCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useLang must be used within LangProvider')
  return c
}
