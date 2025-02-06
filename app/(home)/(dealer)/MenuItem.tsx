import React from 'react'
import { TouchableOpacity, View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  subtitle: string
  onPress: () => void
  isDarkMode: boolean
  iconBgColor?: string
  iconColor?: string
}

export const MenuItem: React.FC<MenuItemProps> = ({
  icon,
  title,
  subtitle,
  onPress,
  isDarkMode,
  iconBgColor = 'bg-red/10',
  iconColor = '#D55004'
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`${isDarkMode ? 'bg-neutral-800' : 'bg-white'} 
        p-4 rounded-xl shadow-sm flex-row items-center`}
    >
      <View className={`${iconBgColor} p-3 rounded-xl`}>
        <Ionicons name={icon} size={24} color={iconColor} />
      </View>
      <View className="ml-4 flex-1">
        <Text className={`${isDarkMode ? 'text-white' : 'text-black'} font-semibold`}>
          {title}
        </Text>
        <Text className={`${isDarkMode ? 'text-white/60' : 'text-gray-500'} text-sm mt-1`}>
          {subtitle}
        </Text>
      </View>
      <Ionicons 
        name="chevron-forward" 
        size={24} 
        color={isDarkMode ? '#fff' : '#000'} 
      />
    </TouchableOpacity>
  )
}  