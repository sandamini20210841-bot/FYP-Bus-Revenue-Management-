import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enJSON from '../assets/locales/en.json';
import taJSON from '../assets/locales/ta.json';
import siJSON from '../assets/locales/si.json';

const resources = {
  en: { translation: enJSON },
  ta: { translation: taJSON },
  si: { translation: siJSON },
};

i18n.use(initReactI18next).init({
  resources,
  lng: localStorage.getItem('language') || 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
