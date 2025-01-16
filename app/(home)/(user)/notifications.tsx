// app/(home)/(user)/notifications.tsx
import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
	View,
	Text,
	TouchableOpacity,
	ActivityIndicator,
	RefreshControl,
	Dimensions
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '@/utils/ThemeContext'
import { NotificationService } from '@/services/NotificationService'
import { useUser } from '@clerk/clerk-expo'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
	FadeInDown,
	FadeOutUp,
	SlideInRight,
	SlideOutRight
} from 'react-native-reanimated'
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler'
import { FlashList } from '@shopify/flash-list'
import { formatDistanceToNow } from 'date-fns'
import * as Haptics from 'expo-haptics'
import { useRouter, useNavigation } from 'expo-router'

interface Notification {
	id: string
	title: string
	message: string
	is_read: boolean
	created_at: string
	data?: {
		screen?: string
		params?: Record<string, any>
	}
}

const ITEMS_PER_PAGE = 20
const { width: SCREEN_WIDTH } = Dimensions.get('window')

export default function NotificationsScreen() {
	const { isDarkMode } = useTheme()
	const { user } = useUser()
	const router = useRouter()
	const navigation = useNavigation()
	const [notifications, setNotifications] = useState<Notification[]>([])
	const [loading, setLoading] = useState(true)
	const [refreshing, setRefreshing] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [page, setPage] = useState(1)
	const [hasMore, setHasMore] = useState(true)
	const swipeableRefs = useRef<{ [key: string]: Swipeable }>({})
	const mounted = useRef(true)
	const [notificationsScreenKey, setNotificationsScreenKey] = useState(0)

	// Force remount on blur/focus
	useEffect(() => {
		const unsubscribeFocus = navigation.addListener('focus', () => {
			setNotificationsScreenKey(prevKey => prevKey + 1)
		})

		const unsubscribeBlur = navigation.addListener('blur', () => {
			setNotificationsScreenKey(0) // Reset key to unmount
		})

		return () => {
			unsubscribeFocus()
			unsubscribeBlur()
		}
	}, [navigation])

	const fetchNotifications = useCallback(
		async (pageNum = 1, shouldRefresh = false) => {
			if (!user) return

			try {
				setError(null)
				const { notifications: newNotifications, hasMore: more } =
					await NotificationService.fetchNotifications(user.id, {
						page: pageNum,
						limit: ITEMS_PER_PAGE
					})

				if (mounted.current) {
					setNotifications(prev =>
						shouldRefresh ? newNotifications : [...prev, ...newNotifications]
					)
					setHasMore(more)
					setPage(pageNum)
				}
			} catch (error) {
				console.error('Error fetching notifications:', error)
				if (mounted.current) {
					setError('Failed to load notifications')
				}
			} finally {
				if (mounted.current) {
					setLoading(false)
					setRefreshing(false)
				}
			}
		},
		[user]
	)

	// Initial fetch
	useEffect(() => {
		fetchNotifications(1, true)
		return () => {
			mounted.current = false
		}
	}, [fetchNotifications])

	const onRefresh = useCallback(() => {
		setRefreshing(true)
		fetchNotifications(1, true)
	}, [fetchNotifications])

	const handleLoadMore = useCallback(() => {
		if (hasMore && !loading && !refreshing) {
			fetchNotifications(page + 1)
		}
	}, [hasMore, loading, refreshing, page, fetchNotifications])

	const handleMarkAsRead = useCallback(async (notificationId: string) => {
		try {
			await NotificationService.markAsRead(notificationId)
			setNotifications(prev =>
				prev.map(n => (n.id === notificationId ? { ...n, is_read: true } : n))
			)
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
		} catch (error) {
			console.error('Error marking notification as read:', error)
		}
	}, [])

	const handleMarkAllAsRead = useCallback(async () => {
		if (!user) return

		try {
			await NotificationService.markAllAsRead(user.id)
			setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
		} catch (error) {
			console.error('Error marking all as read:', error)
		}
	}, [user])

	const handleDelete = useCallback(async (notificationId: string) => {
		try {
			await NotificationService.deleteNotification(notificationId)
			setNotifications(prev => prev.filter(n => n.id !== notificationId))
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
		} catch (error) {
			console.error('Error deleting notification:', error)
		}
	}, [])

	const handleNotificationPress = useCallback(
		(notification: Notification) => {
			// Mark as read
			if (!notification.is_read) {
				handleMarkAsRead(notification.id)
			}

			// Navigate if there's a destination
			if (notification.data?.screen) {
				router.replace({
					// Use router.replace()
					pathname: notification.data.screen,
					params: notification.data.params
				})
			}
		},
		[handleMarkAsRead, router]
	)

	const renderNotification = useCallback(
		({ item: notification }: { item: Notification }) => {
			const renderRightActions = (progress: any, dragX: any) => {
				const trans = dragX.interpolate({
					inputRange: [-100, 0],
					outputRange: [1, 0]
				})

				return (
					<View className='flex-row'>
						{!notification.is_read && (
							<Animated.View entering={SlideInRight} exiting={SlideOutRight}>
								<TouchableOpacity
									className='bg-yellow-600 justify-center items-center px-4'
									onPress={() => {
										swipeableRefs.current[notification.id]?.close()
										handleMarkAsRead(notification.id)
									}}>
									<Ionicons
										name='checkmark-circle-outline'
										size={24}
										color='white'
									/>
								</TouchableOpacity>
							</Animated.View>
						)}
						<TouchableOpacity
							className='bg-red justify-center items-center px-4'
							onPress={() => handleDelete(notification.id)}>
							<Ionicons name='trash-outline' size={24} color='white' />
						</TouchableOpacity>
					</View>
				)
			}

			return (
				<Animated.View
					key={notification.id} // Use key for better list item management
					// Consider simplifying or removing these animations for testing:
					// entering={FadeInDown}
					// exiting={FadeOutUp}
					className='mx-4 mb-4'>
					<Swipeable
						ref={ref => ref && (swipeableRefs.current[notification.id] = ref)}
						renderRightActions={renderRightActions}
						overshootRight={false}>
						<TouchableOpacity
							onPress={() => handleNotificationPress(notification)}
							className='overflow-hidden'>
							{/* Consider conditional BlurView rendering */}
							<BlurView
								intensity={isDarkMode ? 40 : 60}
								tint={isDarkMode ? 'dark' : 'light'}
								className={`p-4 rounded-xl ${
									!notification.is_read ? 'border-l-4 border-red' : ''
								}`}>
								<View className='flex-row justify-between items-start'>
									<View className='flex-1 mr-2'>
										<Text
											className={`font-semibold text-base mb-1 ${
												isDarkMode ? 'text-white' : 'text-black'
											}`}>
											{notification.title}
										</Text>
										<Text
											className={`${isDarkMode ? 'text-gray' : 'text-gray'}`}>
											{notification.message}
										</Text>
										<Text className='text-red text-xs mt-2'>
											{formatDistanceToNow(new Date(notification.created_at), {
												addSuffix: true
											})}
										</Text>
									</View>
									{!notification.is_read && (
										<View className='w-3 h-3 rounded-full bg-rose-500' />
									)}
								</View>
							</BlurView>
						</TouchableOpacity>
					</Swipeable>
				</Animated.View>
			)
		},
		[isDarkMode, handleMarkAsRead, handleDelete, handleNotificationPress]
	)

	const ListHeader = useCallback(() => {
		const hasUnread = notifications.some(n => !n.is_read)

		return hasUnread ? (
			<Animated.View
				entering={FadeInDown}
				className='flex-row justify-end px-4 py-2'>
				<TouchableOpacity
					onPress={handleMarkAllAsRead}
					className='flex-row items-center bg-red px-4 py-2 rounded-full'>
					<Ionicons name='checkmark-done-outline' size={20} color='white' />
					<Text className='text-white ml-2 font-medium'>Mark all as read</Text>
				</TouchableOpacity>
			</Animated.View>
		) : null
	}, [notifications, handleMarkAllAsRead])

	const ListEmptyComponent = useCallback(() => {
		if (error) {
			return (
				<View className='flex-1 justify-center items-center py-20'>
					<Ionicons
						name='alert-circle-outline'
						size={48}
						color={isDarkMode ? '#666' : '#999'}
					/>
					<Text
						className={`mt-4 text-lg ${
							isDarkMode ? 'text-gray' : 'text-gray'
						}`}>
						{error}
					</Text>
					<TouchableOpacity
						className='mt-4 bg-rose-500 px-4 py-2 rounded-full'
						onPress={() => fetchNotifications(1, true)}>
						<Text className='text-white'>Try Again</Text>
					</TouchableOpacity>
				</View>
			)
		}

		if (loading && notifications.length === 0) {
			return null
		}

		return (
			<View className='flex-1 justify-center items-center py-20'>
				<Ionicons
					name='notifications-off-outline'
					size={48}
					color={isDarkMode ? '#666' : '#999'}
				/>
				<Text
					className={`mt-4 text-lg ${isDarkMode ? 'text-gray' : 'text-gray'}`}>
					No notifications yet
				</Text>
			</View>
		)
	}, [isDarkMode, loading, error, notifications.length, fetchNotifications])

	const showLoading = loading && notifications.length === 0

	return (
		<GestureHandlerRootView key={notificationsScreenKey} className='flex-1'>
			<SafeAreaView
				className={`flex-1 ${isDarkMode ? 'bg-black' : 'bg-white'}`}
				edges={['top']}>
				<View className='flex-row justify-between items-center px-4 py-2 border-b border-red'>
					<TouchableOpacity onPress={() => router.back()}>
						<Ionicons
							name='arrow-back'
							size={24}
							color={isDarkMode ? 'white' : 'black'}
						/>
					</TouchableOpacity>
					<Text
						className={`text-xl font-semibold ${
							isDarkMode ? 'text-white' : 'text-black'
						}`}>
						Notifications
					</Text>
					<View style={{ width: 24 }} />
				</View>

				<FlashList
					data={notifications}
					renderItem={renderNotification}
					estimatedItemSize={100}
					ListHeaderComponent={ListHeader}
					ListEmptyComponent={ListEmptyComponent}
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={onRefresh}
							tintColor={isDarkMode ? '#fff' : '#000'}
						/>
					}
					onEndReached={handleLoadMore}
					onEndReachedThreshold={0.5}
				/>

				{showLoading && (
					<View className='absolute inset-0 justify-center items-center bg-black/20'>
						<BlurView
							intensity={80}
							tint={isDarkMode ? 'dark' : 'light'}
							className='p-4 rounded-2xl'>
							<ActivityIndicator color='#D55004' size='large' />
						</BlurView>
					</View>
				)}
			</SafeAreaView>
		</GestureHandlerRootView>
	)
}
