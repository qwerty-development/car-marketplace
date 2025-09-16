import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as SecureStore from 'expo-secure-store';
import { I18nManager, Platform } from 'react-native';

// Basic resources; extend as needed
import en from '@/locales/en.json';
import ar from '@/locales/ar.json';

export const LANGUAGE_KEY = 'app_language';

export async function getInitialLanguage(): Promise<'en' | 'ar'> {
  try {
    const stored = await SecureStore.getItemAsync(LANGUAGE_KEY);
    if (stored === 'ar' || stored === 'en') return stored;
  } catch {}
  return 'en';
}

export async function configureI18n() {
  const lng = await getInitialLanguage();

  if (!i18n.isInitialized) {
    await i18n
      .use(initReactI18next)
      .init({
        compatibilityJSON: 'v3',
        lng,
        fallbackLng: 'en',
        resources: { en: { translation: en }, ar: { translation: ar } },
        interpolation: { escapeValue: false },
      });
  } else {
    i18n.changeLanguage(lng);
  }

  // Apply RTL for Arabic
  const shouldBeRTL = lng === 'ar';
  if (I18nManager.isRTL !== shouldBeRTL) {
    try {
      I18nManager.allowRTL(shouldBeRTL);
      I18nManager.forceRTL(shouldBeRTL);
    } catch {}
  }
}

export default i18n;



