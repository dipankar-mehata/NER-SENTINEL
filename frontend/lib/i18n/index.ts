import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en';
import hi from './locales/hi';
import as_ from './locales/as';
import bn from './locales/bn';

const resources = {
  en: { translation: en },
  hi: { translation: hi },
  as: { translation: as_ },
  bn: { translation: bn },
};

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng: 'en',
      supportedLngs: ['en', 'hi', 'as', 'bn'],
      interpolation: { escapeValue: false },
      detection: {
        order: ['localStorage', 'navigator'],
        caches: ['localStorage'],
        lookupLocalStorage: 'ner-sentinel-lang',
      },
    });
}

export default i18n;
export type LangKey = 'en' | 'hi' | 'as' | 'bn';

export const LANGUAGE_OPTIONS: { code: LangKey; label: string; nativeLabel: string }[] = [
  { code: 'en', label: 'English',  nativeLabel: 'EN' },
  { code: 'hi', label: 'Hindi',    nativeLabel: 'हि' },
  { code: 'as', label: 'Assamese', nativeLabel: 'অ' },
  { code: 'bn', label: 'Bengali',  nativeLabel: 'বা' },
];
