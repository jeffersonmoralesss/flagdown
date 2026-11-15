import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { translate } from './strings.js'

// The chosen language is shared with every screen through React "context": any component can call
// useT() to get the current language and a t() function, without passing props down by hand.
const LangContext = createContext({ lang: 'en', setLang: () => {}, t: (key) => key })

const STORAGE_KEY = 'flagdown.lang'

// First visit: follow the phone's language. After that: remember the rider's choice.
// Storage can be unavailable (private browsing), so every use is wrapped in try/catch.
function startingLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'es') return saved
  } catch {
    // no storage; fall through to the phone's language
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en'
}

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(startingLang)

  const setLang = useCallback((next) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // the choice still applies for this visit
    }
  }, [])

  // Tell the browser which language the page is in, so screen readers pronounce it correctly.
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const value = useMemo(() => ({ lang, setLang, t: (key, vars) => translate(lang, key, vars) }), [lang, setLang])
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export const useT = () => useContext(LangContext)
