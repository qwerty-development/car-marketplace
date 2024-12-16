import React from 'react'
import { View, SafeAreaView } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import ChatScreen from '@/components/ChatScreen'
import { useTheme } from '@/utils/ThemeContext'

export default function ChatRoute() {
	const { dealershipId, carId } = useLocalSearchParams()
	const { isDarkMode } = useTheme()

	return (
		<SafeAreaView className={`flex-1 ${isDarkMode ? 'bg-black' : 'bg-white'}`}>
			<ChatScreen
				dealershipId={dealershipId as string}
				carId={carId as string}
			/>
		</SafeAreaView>
	)
}
