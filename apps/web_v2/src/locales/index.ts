import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en'
import zh from './zh'

const resources = {
  en,
  zh,
}

i18n.use(initReactI18next).init({
  resources,
  lng: navigator.language.startsWith('zh') ? 'zh' : 'en',
  fallbackLng: 'zh',
  interpolation: {
    escapeValue: false,
  },
})

export default i18n
