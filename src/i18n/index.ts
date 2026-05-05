// i18next init. Called once during composition before the HUD mounts.
//
// Locales live in src/locales/*.json. Add a language by dropping a new JSON
// file with the same shape and importing it below.

import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from '@/locales/en.json';

export type SupportedLanguage = 'en';

export const SUPPORTED_LANGUAGES: Array<{ id: SupportedLanguage; label: string }> = [{ id: 'en', label: 'English' }];

export async function initI18n(): Promise<void> {
  await i18next.use(LanguageDetector).init({
    resources: {
      en: { translation: en },
    },
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.id),
    interpolation: { escapeValue: false },
    detection: {
      order: ['querystring', 'localStorage', 'navigator'],
      lookupQuerystring: 'lang',
      lookupLocalStorage: 'slotplate:lang',
      caches: ['localStorage'],
    },
  });
}

export { i18next as i18n };
