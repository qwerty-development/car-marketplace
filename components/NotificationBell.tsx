// components/NotificationBell.tsx
import { NotificationService } from '@/services/NotificationService'
import { supabase } from '@/utils/supabase'
import { useTheme } from '@/utils/ThemeContext'
import { useUser } from '@clerk/clerk-expo'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useState, useEffect, useCallback, useRef } from 'react'
import { TouchableOpacity, View, Text } from 'react-native'
import { RealtimeChannel } from '@supabase/supabase-js'
import * as Haptics from 'expo-haptics'
import Animated, {
	useAnimatedStyle,
	withSpring,
	withSequence,
	withDelay,
	FadeInDown,
	FadeOutUp
} from 'react-native-reanimated'

const AnimatedTouchableOpacity =
	Animated.createAnimatedComponent(TouchableOpacity)

export const NotificationBell = () => {
	const { isDarkMode } = useTheme()
	const [unreadCount, setUnreadCount] = useState(0)
	const { user } = useUser()
	const router = useRouter()
	const subscriptionRef = useRef<RealtimeChannel | null>(null)
	const lastCount = useRef(0)

	const animatedStyle = useAnimatedStyle(() => {
		if (unreadCount > lastCount.current) {
			return {
				transform: [
					{
						scale: withSequence(withSpring(1.2), withDelay(150, withSpring(1)))
					}
				]
			}
		}
		return { transform: [{ scale: 1 }] }
	})

	const fetchUnreadCount = useCallback(async () => {
		if (!user) return

		try {
			const { data, error } = await supabase
				.from('notifications')
				.select('id', { count: 'exact' })
				.eq('user_id', user.id)
				.eq('is_read', false)

			if (error) throw error

			const newCount = data?.length || 0
			if (newCount > lastCount.current) {
				Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
			}
			lastCount.current = newCount
			setUnreadCount(newCount)
		} catch (error) {
			console.error('Error fetching unread count:', error)
		}
	}, [user])

	useEffect(() => {
		if (!user) return

		fetchUnreadCount()

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

		const refreshInterval = setInterval(fetchUnreadCount, 60000) // Refresh every minute

		return () => {
			clearInterval(refreshInterval)
			if (subscriptionRef.current) {
				subscriptionRef.current.unsubscribe()
			}
		}
	}, [user, fetchUnreadCount])

	if (!user) return null

	return (
		<AnimatedTouchableOpacity
			style={animatedStyle}
			onPress={() => {
				Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
				router.push('/(home)/(user)/notifications')
			}}
			className='relative p-2'>
			<Ionicons
				name={unreadCount > 0 ? 'notifications' : 'notifications-outline'}
				size={24}
				color={isDarkMode ? '#FFFFFF' : '#000000'}
			/>
			{unreadCount > 0 && (
				<Animated.View
					entering={FadeInDown}
					exiting={FadeOutUp}
					className='absolute -top-1 -right-1 bg-red rounded-full min-w-[18px] h-[18px] items-center justify-center'>
					<Text className='text-white text-xs font-bold px-1'>
						{unreadCount > 99 ? '99+' : unreadCount}
					</Text>
				</Animated.View>
			)}
		</AnimatedTouchableOpacity>
	)
}