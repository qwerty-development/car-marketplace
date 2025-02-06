import React from 'react'
import { View, Text } from 'react-native'

interface SubscriptionBannerProps {
  isExpired: boolean
  daysUntilExpiration: number | null
  warningThreshold: number
}

export const SubscriptionBanner: React.FC<SubscriptionBannerProps> = ({
  isExpired,
  daysUntilExpiration,
  warningThreshold
}) => {
  if (isExpired) {
    return (
      <View className="bg-rose-700 p-4">
        <Text className="text-white text-center font-bold">
          Your subscription has expired. Please renew to continue.
        </Text>
      </View>
    )
  }

  const showWarning = daysUntilExpiration !== null && 
    daysUntilExpiration <= warningThreshold && 
    daysUntilExpiration > 0

  if (showWarning) {
    return (
      <View className="bg-yellow-500 p-4">
        <Text className="text-white text-center font-bold">
          Subscription expires in {daysUntilExpiration} days. Please renew soon.
        </Text>
      </View>
    )
  }

  return null
}