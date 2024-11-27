import React from 'react'
import { View, Text, StatusBar } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '@/utils/ThemeContext'
import { Ionicons } from '@expo/vector-icons'

export default function Chat() {
  const { isDarkMode } = useTheme()

  const CustomHeader = React.memo(({ title }: { title: string }) => {
    const { isDarkMode } = useTheme()
  
    return (
      <SafeAreaView
        className={`bg-${isDarkMode ? 'black' : 'white'} border-b border-red`}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <View className='flex-row items-center justify-center'>
          <Text className='text-xl font-semibold text-red'>{title}</Text>
        </View>
      </SafeAreaView>
    )
  })

  return (
    <View className={`flex-1 ${isDarkMode ? 'bg-black' : 'bg-white'}`}>
        {/* Header */}
<CustomHeader title='Chat'/>

        {/* Coming Soon Message */}
        <View className="flex-1 justify-center items-center px-6">
          <Ionicons 
            name="heart" 
            size={64} 
            color="#D55004" 
            className="mb-4"
          />
          <Text className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-black'}`}>
            Chat feature coming soon
          </Text>
          <Text className={`text-base text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            We're working hard to bring you new chat features. Stay tuned!
          </Text>
        </View>
    </View>
  )
}