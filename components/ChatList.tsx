import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, FlatList, Image } from 'react-native'
import { useStreamChat } from '@/utils/useStreamChat'
import { useTheme } from '@/utils/ThemeContext'
import { Channel } from 'stream-chat'
import { useRouter } from 'expo-router'

export default function ChatList() {
	const { chatClient, loading } = useStreamChat()
	const [channels, setChannels] = useState<Channel[]>([])
	const { isDarkMode } = useTheme()
	const router = useRouter()

	useEffect(() => {
		if (!chatClient || loading) return

		const fetchChannels = async () => {
			const filter = {
				type: 'messaging',
				members: { $in: [chatClient.userID!] }
			}
			const sort = [{ last_message_at: -1 }]

			const channels = await chatClient.queryChannels(filter, sort)
			setChannels(channels)
		}

		fetchChannels()

		const subscription = chatClient.on('message.new', () => {
			fetchChannels()
		})

		return () => {
			subscription.unsubscribe()
		}
	}, [chatClient, loading])

	const renderChannelItem = ({ item: channel }: { item: Channel }) => {
		const dealershipId = channel.data?.dealership_id as string
		const carId = channel.data?.car_id as string | undefined
		const dealershipName = channel.data?.dealership_name
		const dealershipLogo = channel.data?.dealership_logo

		return (
			<TouchableOpacity
				onPress={() =>
					router.push({
						pathname: '/(home)/(user)/chat',
						params: { dealershipId, carId }
					})
				}
				style={{
					marginBottom: 16,
					borderRadius: 12,
					overflow: 'hidden',
					backgroundColor: isDarkMode ? '#333' : '#fff',
					padding: 16
				}}>
				<View style={{ flexDirection: 'row', alignItems: 'center' }}>
					{dealershipLogo ? (
						<Image
							source={{ uri: dealershipLogo }}
							style={{ width: 48, height: 48, borderRadius: 24 }}
						/>
					) : null}
					<View style={{ marginLeft: 16, flex: 1 }}>
						<Text
							style={{
								fontWeight: 'bold',
								color: isDarkMode ? '#fff' : '#000'
							}}>
							{dealershipName || 'Dealership'}
						</Text>
						<Text style={{ fontSize: 14, color: isDarkMode ? '#ccc' : '#666' }}>
							{channel.state.messages[channel.state.messages.length - 1]
								?.text || 'No messages yet'}
						</Text>
					</View>
				</View>
			</TouchableOpacity>
		)
	}

	return (
		<FlatList
			data={channels}
			renderItem={renderChannelItem}
			keyExtractor={channel => channel.cid || channel.id!}
			contentContainerStyle={{ padding: 16 }}
			ListEmptyComponent={
				!loading ? (
					<View style={{ alignItems: 'center', marginTop: 50 }}>
						<Text style={{ color: isDarkMode ? '#fff' : '#000' }}>
							No conversations yet
						</Text>
					</View>
				) : null
			}
		/>
	)
}
