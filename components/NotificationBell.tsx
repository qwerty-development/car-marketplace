import { NotificationService } from '@/services/NotificationService'
import { supabase } from '@/utils/supabase'
import { useTheme } from '@/utils/ThemeContext'
import { useUser } from '@clerk/clerk-expo'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useState, useEffect, useCallback, useRef } from 'react'
import { TouchableOpacity, View, Text } from 'react-native'
import { RealtimeChannel } from '@supabase/supabase-js'

export const NotificationBell = () => {
	const { isDarkMode } = useTheme()
	const [unreadCount, setUnreadCount] = useState(0)
	const { user } = useUser()
	const router = useRouter()
	const subscriptionRef = useRef<RealtimeChannel | null>(null)

	const fetchUnreadCount = useCallback(async () => {
		if (!user) return

		try {
			const { data, error } = await supabase
				.from('notifications')
				.select('id', { count: 'exact' })
				.eq('user_id', user.id)
				.eq('is_read', false)

			if (error) throw error
			setUnreadCount(data?.length || 0)
		} catch (error) {
			console.error('Error fetching unread count:', error)
		}
	}, [user])

	useEffect(() => {
		if (!user) return

		// Initial fetch
		fetchUnreadCount()

		// Set up realtime subscription
		subscriptionRef.current = supabase
			.channel(`notifications:${user.id}`)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'notifications',
					filter: `user_id=eq.${user.id}`
				},
				() => {
					fetchUnreadCount()
				}
			)
			.subscribe()

		// Cleanup
		return () => {
			if (subscriptionRef.current) {
				subscriptionRef.current.unsubscribe()
			}
		}
	}, [user, fetchUnreadCount])

	if (!user) return null

	return (
		<TouchableOpacity
			onPress={() => router.push('/(home)/(user)/notifications')}
			className='relative p-2'>
			<Ionicons
				name='notifications'
				size={24}
				color={isDarkMode ? '#FFFFFF' : '#000000'}
			/>
			{unreadCount > 0 && (
				<View className='absolute -top-1 -right-1 bg-red rounded-full min-w-[18px] h-[18px] items-center justify-center'>
					<Text className='text-white text-xs font-bold'>
						{unreadCount > 99 ? '99+' : unreadCount}
					</Text>
				</View>
			)}
		</TouchableOpacity>
	)
}
