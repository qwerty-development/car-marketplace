import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { I18nManager } from 'react-native';
import * as Updates from 'expo-updates';
import i18n from '@/utils/i18n';

type Language = 'en' | 'ar';

interface LanguageContextValue {
  language: Language;
  setLanguage: (lng: Language) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextValue>({ language: 'en', setLanguage: async () => {} });

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    (async () => {
      const current = (await SecureStore.getItemAsync('app_language')) as Language | null;
      if (current) {
        setLanguageState(current);
      }
    })();
  }, []);

  const setLanguage = useCallback(async (lng: Language) => {
    await SecureStore.setItemAsync('app_language', lng);
    await i18n.changeLanguage(lng);

    const shouldBeRTL = lng === 'ar';
    if (I18nManager.isRTL !== shouldBeRTL) {
      I18nManager.allowRTL(shouldBeRTL);
      I18nManager.forceRTL(shouldBeRTL);
      await Updates.reloadAsync();
      return;
    }
    setLanguageState(lng);
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);


