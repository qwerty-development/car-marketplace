import React from 'react'
import { View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

interface SubscriptionStatusProps {
  isDarkMode: boolean
  subscriptionExpired: boolean
  daysUntilExpiration: number | null
}

export const SubscriptionStatus: React.FC<SubscriptionStatusProps> = ({
  isDarkMode,
  subscriptionExpired,
  daysUntilExpiration
}) => {
  return (
    <View
      className={`${isDarkMode ? 'bg-neutral-800' : 'bg-white'} 
        p-4 rounded-xl mb-2 shadow-sm flex-row items-center`}
    >
      <View className={`${subscriptionExpired ? 'bg-rose-500/10' : 'bg-yellow-500/10'} p-3 rounded-xl`}>
        <Ionicons 
          name="timer-outline" 
          size={24} 
          color={subscriptionExpired ? '#f43f5e' : '#D55004'} 
        />
      </View>
      <View className="ml-4 flex-1">
        <Text className={`${isDarkMode ? 'text-white' : 'text-black'} font-semibold`}>
          Subscription Status
        </Text>
        <Text 
          className={`${isDarkMode ? 'text-white/60' : 'text-gray-500'} text-sm mt-1 ${
            subscriptionExpired ? 'text-rose-500' : ''
          }`}
        >
          {subscriptionExpired 
            ? 'Subscription expired' 
            : `${daysUntilExpiration} days remaining`}
        </Text>
      </View>
    </View>
  )
}
