import React from 'react'
import { View, TouchableOpacity, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { MenuItem } from './_MenuItem'
import { SubscriptionStatus } from './_SubscriptionStatus'
import { ExpandableSupport } from './_ExpandableSupport'

interface ProfileMenuProps {
  isDarkMode: boolean
  onEditProfile: () => void
  onLocation: () => void
  onSecurity: () => void
  subscriptionExpired: boolean
  daysUntilExpiration: number | null
  onSignOut: () => void
}

export const ProfileMenu: React.FC<ProfileMenuProps> = ({
  isDarkMode,
  onEditProfile,
  onLocation,
  onSecurity,
  subscriptionExpired,
  daysUntilExpiration,
  onSignOut
}) => {
  const router = useRouter()

  return (
    <View className="space-y-4 px-6 -mt-12">
      {/* Edit Profile */}
      <MenuItem
        icon="business-outline"
        title="Edit Dealership Profile"
        subtitle="Update dealership information"
        onPress={onEditProfile}
        isDarkMode={isDarkMode}
        iconBgColor="bg-red/10"
      />

      {/* Location Settings */}
      <MenuItem
        icon="location-outline"
        title="Location Settings"
        subtitle="Update address and map location"
        onPress={onLocation}
        isDarkMode={isDarkMode}
        iconBgColor="bg-blue-500/10"
      />

      {/* Security Settings */}
      <MenuItem
        icon="shield-outline"
        title="Security Settings"
        subtitle="Update password and security options"
        onPress={onSecurity}
        isDarkMode={isDarkMode}
        iconBgColor="bg-purple-500/10"
      />

      {/* Analytics */}
      <MenuItem
        icon="bar-chart-outline"
        title="Analytics Dashboard"
        subtitle="View dealership performance"
        onPress={() => router.push('/analytics')}
        isDarkMode={isDarkMode}
        iconBgColor="bg-green-500/10"
      />

      {/* Subscription Status */}
      <SubscriptionStatus
  isDarkMode={isDarkMode}
  subscriptionExpired={subscriptionExpired}
  daysUntilExpiration={daysUntilExpiration}
/>

      {/* Support */}
      <ExpandableSupport isDarkMode={isDarkMode} />

      {/* Sign Out */}
      <TouchableOpacity 
        onPress={onSignOut}
        className="mt-4 mb-24 bg-red/10 p-4 rounded-xl flex-row items-center justify-center"
      >
        <Ionicons name="log-out-outline" size={24} color="#D55004" />
        <Text className="ml-2 text-red font-semibold">
          Sign Out
        </Text>
      </TouchableOpacity>
    </View>
  )
}