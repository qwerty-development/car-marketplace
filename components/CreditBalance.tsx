// components/CreditBalance.tsx
// Credit balance display widget

import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCredits } from '@/utils/CreditContext';

interface CreditBalanceProps {
  isDarkMode: boolean;
  onPurchasePress: () => void;
  isRTL?: boolean;
  showPurchaseButton?: boolean;
}

export const CreditBalance: React.FC<CreditBalanceProps> = ({
  isDarkMode,
  onPurchasePress,
  isRTL = false,
  showPurchaseButton = true,
}) => {
  const { creditBalance, isLoading } = useCredits();

  return (
    <View
      className={`${isDarkMode ? 'bg-neutral-800' : 'bg-white'}
        p-4 rounded-xl mb-2 shadow-sm flex-row ${isRTL ? 'flex-row-reverse' : ''} items-center justify-between`}
    >
      <View className={`flex-row ${isRTL ? 'flex-row-reverse' : ''} items-center flex-1`}>
        <View className="bg-green-500/10 p-3 rounded-xl">
          <Ionicons name="wallet-outline" size={24} color="#10b981" />
        </View>
        <View className={`${isRTL ? 'mr-4' : 'ml-4'}`}>
          <Text className={`${isDarkMode ? 'text-white' : 'text-black'} font-semibold`}>
            Credit Balance
          </Text>
          {isLoading ? (
            <ActivityIndicator size="small" color="#10b981" />
          ) : (
            <Text className="text-green-500 text-lg font-bold">
              {creditBalance.toFixed(0)} Credits
            </Text>
          )}
          <Text className={`${isDarkMode ? 'text-white/60' : 'text-gray-500'} text-xs`}>
            1 credit = $1 USD
          </Text>
        </View>
      </View>
      {showPurchaseButton && (
        <TouchableOpacity
          className="bg-green-600 px-4 py-2 rounded-lg"
          onPress={onPurchasePress}
        >
          <Text className="text-white font-medium text-sm">Buy</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};
