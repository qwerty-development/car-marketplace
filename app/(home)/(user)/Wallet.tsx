import React from 'react';
import { View, Text, TouchableOpacity, I18nManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/utils/ThemeContext';
import WalletView from '@/components/WalletView';

/** User wallet (US-08, US-09): track items + buy extra from the profile. */
export default function UserWallet() {
  const { isDarkMode } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const isRTL = I18nManager.isRTL;

  return (
    <SafeAreaView className={`flex-1 ${isDarkMode ? 'bg-black' : 'bg-white'}`} edges={['top']}>
      <View
        className="items-center justify-between px-4 py-3"
        style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={isRTL ? 'arrow-forward' : 'arrow-back'}
            size={24}
            color={isDarkMode ? '#fff' : '#000'}
          />
        </TouchableOpacity>
        <Text className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>
          {t('wallet.title')}
        </Text>
        <View style={{ width: 24 }} />
      </View>
      <WalletView role="user" />
    </SafeAreaView>
  );
}
