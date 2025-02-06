import React from 'react'
import { View, Text, Image, TouchableOpacity, ActivityIndicator } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import ThemeSwitch from '@/components/ThemeSwitch'
import { NotificationBell } from '@/components/NotificationBell'

interface ProfileHeaderProps {
  isDarkMode: boolean
  formData: {
    name: string
    location: string
    logo: string
  }
  isUploading: boolean
  onPickImage: () => Promise<void>
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  isDarkMode,
  formData,
  isUploading,
  onPickImage
}) => {
  return (
    <View className="relative">
      <LinearGradient
        colors={isDarkMode ? ['#D55004', '#1a1a1a'] : ['#D55004', '#ff8c00']}
        className="pt-12 pb-24 rounded-b-[40px]"
      >
        <View className="flex-row justify-between px-6">
          <ThemeSwitch />
          <NotificationBell />
        </View>

        <View className="items-center mt-6">
          <View className="relative">
            <Image
              source={{
                uri: formData.logo || 'https://via.placeholder.com/150'
              }}
              className="w-32 h-32 rounded-full border-4 border-white/20"
            />
            <TouchableOpacity
              onPress={onPickImage}
              disabled={isUploading}
              className="absolute bottom-0 right-0 bg-white/90 p-2 rounded-full shadow-lg"
            >
              {isUploading ? (
                <ActivityIndicator color="#D55004" size="small" />
              ) : (
                <Ionicons name="camera" size={20} color="#D55004" />
              )}
            </TouchableOpacity>
          </View>

          <Text className="text-white text-xl font-semibold mt-4">
            {formData.name}
          </Text>
          <Text className="text-white/80 text-sm">{formData.location}</Text>
        </View>
      </LinearGradient>
    </View>
  )
}