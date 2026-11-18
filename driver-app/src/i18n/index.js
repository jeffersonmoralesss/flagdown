// The chosen language, shared with every screen through React context. Any component calls useT()
// to get `t` (look up text), `lang` and `setLang`. Same idea as the rider app.
import { getLocales } from 'expo-localization';
import { createContext, createElement, useCallback, useContext, useMemo, useState } from 'react';
import { translate } from './strings';

const LangContext = createContext({ lang: 'en', setLang: () => {}, t: (key) => key });
const STORAGE_KEY = 'flagdown.lang';

// First time: follow the phone's language. After that: remember the driver's choice.
function startingLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'es') return saved;
  } catch {
    // no storage; fall through
  }
  try {
    return getLocales()[0]?.languageCode === 'es' ? 'es' : 'en';
  } catch {
    return 'en';
  }
}

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(startingLang);
  const setLang = useCallback((next) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // still applies for this session
    }
  }, []);
  const value = useMemo(() => ({ lang, setLang, t: (key, vars) => translate(lang, key, vars) }), [lang, setLang]);
  // createElement instead of JSX keeps this a plain .js file that the tests can also import.
  return createElement(LangContext.Provider, { value }, children);
}

export const useT = () => useContext(LangContext);
