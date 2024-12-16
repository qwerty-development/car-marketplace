import React, { useEffect, useState } from 'react'
import { View, ActivityIndicator, SafeAreaView } from 'react-native'
import {
	Channel,
	MessageList,
	MessageInput,
	OverlayProvider,
	Chat
} from 'stream-chat-expo'
import { useStreamChat } from '@/utils/useStreamChat'
import { useTheme } from '@/utils/ThemeContext'
import { useLocalSearchParams } from 'expo-router'

export default function ChatScreen() {
	const { dealershipId, carId } = useLocalSearchParams<{
		dealershipId: string
		carId?: string
	}>()

	const { chatClient, loading, startDealershipChat } = useStreamChat()
	const [channel, setChannel] = useState<any>(null)
	const { isDarkMode } = useTheme()

	useEffect(() => {
		const initChannel = async () => {
			if (!dealershipId) return
			try {
				const newChannel = await startDealershipChat(dealershipId, carId)
				setChannel(newChannel)
			} catch (err) {
				console.error('Error starting dealership chat:', err)
			}
		}

		if (!loading && chatClient) {
			initChannel()
		}
	}, [chatClient, loading, dealershipId, carId])

	if (loading) {
		return (
			<SafeAreaView
				style={{
					flex: 1,
					justifyContent: 'center',
					alignItems: 'center',
					backgroundColor: isDarkMode ? '#000' : '#fff'
				}}>
				<ActivityIndicator />
			</SafeAreaView>
		)
	}

	if (!channel) {
		return (
			<SafeAreaView
				style={{
					flex: 1,
					backgroundColor: isDarkMode ? '#000' : '#fff'
				}}></SafeAreaView>
		)
	}

	return (
		<OverlayProvider>
			<Chat client={chatClient}>
				<Channel channel={channel} keyboardVerticalOffset={0}>
					<View style={{ flex: 1 }}>
						<MessageList />
						<MessageInput />
					</View>
				</Channel>
			</Chat>
		</OverlayProvider>
	)
}
