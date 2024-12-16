import React from 'react'
import { View, SafeAreaView } from 'react-native'
import ChatList from '@/components/ChatList'
import { useTheme } from '@/utils/ThemeContext'

export default function ChatsRoute() {
	const { isDarkMode } = useTheme()

	return (
		<SafeAreaView className={`flex-1 ${isDarkMode ? 'bg-black' : 'bg-white'}`}>
			<ChatList />
		</SafeAreaView>
	)
}
