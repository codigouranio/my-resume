import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translations
import enCommon from './locales/en/common.json';
import esCommon from './locales/es/common.json';
import ptCommon from './locales/pt/common.json';
import arCommon from './locales/ar/common.json';
import cnCommon from './locales/cn/common.json';

i18n
  .use(LanguageDetector) // Detect user language
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: enCommon },
      es: { common: esCommon },
      pt: { common: ptCommon },
      ar: { common: arCommon },
      cn: { common: cnCommon },
    },
    fallbackLng: 'en',
    defaultNS: 'common',
    lng: 'en', // Default language
    debug: true, // Enable debug mode to see what's happening
    interpolation: {
      escapeValue: false, // React already escapes
    },
    react: {
      useSuspense: false, // Disable suspense for immediate rendering
    },
  });

export default i18n;