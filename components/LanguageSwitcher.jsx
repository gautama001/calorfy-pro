'use client';

import { useI18n } from './I18nProvider';

const languages = [['es', 'ES', 'spanish'], ['en', 'EN', 'english'], ['pt', 'PT', 'portuguese']];

export default function LanguageSwitcher({ dark = false }) {
  const { language, setLanguage, t } = useI18n();
  return <div className={`language-switcher${dark ? ' dark' : ''}`} role="group" aria-label={t('language')}>
    {languages.map(([code, label, name]) => <button aria-label={t(name)} aria-pressed={language === code} className={language === code ? 'active' : ''} key={code} onClick={() => setLanguage(code)} type="button">{label}</button>)}
  </div>;
}
