'use client';

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, localeFor, normalizeLanguage, translate } from '../lib/i18n';
import { supabase } from '../lib/supabase';

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(DEFAULT_LANGUAGE);

  useLayoutEffect(() => {
    const cached = normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY) || navigator.language);
    setLanguageState(cached);
    document.documentElement.lang = cached;

    supabase?.auth?.getSession().then(async ({ data }) => {
      const userId = data.session?.user?.id;
      if (!userId) return;
      const { data: profile } = await supabase.from('profiles').select('preferred_language').eq('id', userId).maybeSingle();
      if (!profile?.preferred_language) return;
      const remote = normalizeLanguage(profile.preferred_language);
      setLanguageState(remote);
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, remote);
      document.documentElement.lang = remote;
    });
  }, []);

  const setLanguage = useCallback(async (value) => {
    const next = normalizeLanguage(value);
    setLanguageState(next);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    document.documentElement.lang = next;
    const { data } = await supabase.auth.getSession();
    if (data.session?.user?.id) {
      await supabase.from('profiles').update({ preferred_language: next, updated_at: new Date().toISOString() }).eq('id', data.session.user.id);
    }
  }, []);

  const value = useMemo(() => ({
    language,
    locale: localeFor(language),
    setLanguage,
    t: (key, variables) => translate(language, key, variables),
  }), [language, setLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}
