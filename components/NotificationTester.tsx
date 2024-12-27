// components/NotificationTester.tsx
import React, { useState } from 'react'
import { View, TouchableOpacity, Text, Alert, TextInput } from 'react-native'
import * as Notifications from 'expo-notifications'
import { NotificationService } from '@/services/NotificationService'
import { SchedulableTriggerInputTypes } from 'expo-notifications'
import { BlurView } from 'expo-blur'
import { useTheme } from '@/utils/ThemeContext'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/utils/supabase'

export default function NotificationTester({ userId }: { userId: string }) {
	const { isDarkMode } = useTheme()
	const [customTitle, setCustomTitle] = useState('')
	const [customMessage, setCustomMessage] = useState('')

	const testImmediateNotification = async () => {
		try {
			// Create both database and push notification
			await NotificationService.createNotification({
				userId,
				type: 'car_like',
				title: 'Test Notification 🚗',
				message: 'This is a test immediate notification!',
				data: {
					screen: '/(home)/(user)',
					type: 'car_like'
				}
			})
			Alert.alert('Success', 'Test notification sent and stored!')
		} catch (error) {
			Alert.alert('Error', 'Failed to send test notification')
		}
	}

	const testCustomNotification = async () => {
		if (!customTitle || !customMessage) {
			Alert.alert('Error', 'Please enter both title and message')
			return
		}

		try {
			await NotificationService.createNotification({
				userId,
				type: 'car_like',
				title: customTitle,
				message: customMessage,
				data: {
					screen: '/(home)/(user)',
					type: 'car_like'
				}
			})
			Alert.alert('Success', 'Custom notification sent!')
			setCustomTitle('')
			setCustomMessage('')
		} catch (error) {
			Alert.alert('Error', 'Failed to send custom notification')
		}
	}

	const testScheduledNotification = async () => {
		try {
			const scheduledTime = new Date(Date.now() + 5000) // 5 seconds from now

			await NotificationService.createNotification({
				userId,
				type: 'daily_reminder',
				title: 'Scheduled Test 🕒',
				message: 'This notification was scheduled for 5 seconds later!',
				data: {
					screen: '/(home)/(user)',
					type: 'daily_reminder',
					scheduledFor: scheduledTime.toISOString()
				}
			})

			Alert.alert('Success', 'Notification scheduled for 5 seconds from now')
		} catch (error) {
			Alert.alert('Error', 'Failed to schedule notification')
		}
	}

	const testPriceDropNotification = async () => {
		try {
			await NotificationService.createNotification({
				userId,
				type: 'price_drop',
				title: '💰 Price Drop Alert!',
				message: 'A car in your favorites has dropped in price!',
				data: {
					screen: '/(home)/(user)/favorites',
					type: 'price_drop',
					carId: '123' // Example car ID
				}
			})
			Alert.alert('Success', 'Price drop notification sent!')
		} catch (error) {
			Alert.alert('Error', 'Failed to send price drop notification')
		}
	}

	const testSubscriptionNotification = async () => {
		try {
			await NotificationService.createNotification({
				userId,
				type: 'subscription',
				title: '⚠️ Subscription Ending Soon',
				message: 'Your dealership subscription will expire in 3 days.',
				data: {
					screen: '/(home)/(dealer)/subscription',
					type: 'subscription'
				}
			})
			Alert.alert('Success', 'Subscription notification sent!')
		} catch (error) {
			Alert.alert('Error', 'Failed to send subscription notification')
		}
	}

	const testViewMilestoneNotification = async () => {
		try {
			const { data: cars } = await supabase
				.from('cars')
				.select('id, make, model, year, views')
				.limit(1)
				.single()

			if (cars) {
				await NotificationService.createNotification({
					userId,
					type: 'view_milestone',
					title: '🎯 View Milestone Reached!',
					message: `Your ${cars.year} ${cars.make} ${cars.model} has reached ${cars.views} views!`,
					data: {
						screen: '/(home)/(user)/favorites',
						type: 'view_milestone',
						carId: cars.id
					}
				})
				Alert.alert('Success', 'View milestone notification sent!')
			}
		} catch (error) {
			Alert.alert('Error', 'Failed to send view milestone notification')
		}
	}

	const testSoldCarNotification = async () => {
		try {
			await NotificationService.createNotification({
				userId,
				type: 'car_sold',
				title: '💫 Car Sold Update',
				message: 'A car you liked has been sold!',
				data: {
					screen: '/(home)/(user)/favorites',
					type: 'car_sold'
				}
			})
			Alert.alert('Success', 'Car sold notification sent!')
		} catch (error) {
			Alert.alert('Error', 'Failed to send car sold notification')
		}
	}

	const clearAllNotifications = async () => {
		try {
			// Clear scheduled notifications
			await NotificationService.cancelAllNotifications()

			// Clear database notifications
			await supabase.from('notifications').delete().eq('user_id', userId)

			// Reset badge count
			await NotificationService.setBadgeCount(0)

			Alert.alert('Success', 'All notifications cleared!')
		} catch (error) {
			Alert.alert('Error', 'Failed to clear notifications')
		}
	}

	const checkNotificationStats = async () => {
		try {
			const [dbCount, unreadCount, scheduledNotifications, badgeCount] =
				await Promise.all([
					supabase
						.from('notifications')
						.select('*', { count: 'exact' })
						.eq('user_id', userId),
					NotificationService.getUnreadCount(userId),
					Notifications.getAllScheduledNotificationsAsync(),
					NotificationService.getBadgeCount()
				])

			Alert.alert(
				'Notification Stats',
				`Total Notifications: ${dbCount.count || 0}\n` +
					`Unread Count: ${unreadCount}\n` +
					`Scheduled Notifications: ${scheduledNotifications.length}\n` +
					`Badge Count: ${badgeCount}`
			)
		} catch (error) {
			Alert.alert('Error', 'Failed to fetch notification stats')
		}
	}

	return (
		<BlurView
			intensity={100}
			tint={isDarkMode ? 'dark' : 'light'}
			className='p-4 rounded-xl mb-4'>
			<Text
				className={`text-lg font-bold mb-4 ${
					isDarkMode ? 'text-white' : 'text-black'
				}`}>
				Notification Testing Panel
			</Text>

			{/* Custom Notification Input */}
			<View className='mb-4'>
				<TextInput
					placeholder='Notification Title'
					value={customTitle}
					onChangeText={setCustomTitle}
					className={`${
						isDarkMode ? 'bg-gray text-white' : 'bg-white text-black'
					} p-2 rounded-lg mb-2 border border-red`}
					placeholderTextColor={isDarkMode ? '#666' : '#999'}
				/>
				<TextInput
					placeholder='Notification Message'
					value={customMessage}
					onChangeText={setCustomMessage}
					className={`${
						isDarkMode ? 'bg-gray text-white' : 'bg-white text-black'
					} p-2 rounded-lg mb-2 border border-red`}
					placeholderTextColor={isDarkMode ? '#666' : '#999'}
				/>
				<TouchableOpacity
					onPress={testCustomNotification}
					className='bg-purple-500 p-3 rounded-xl flex-row justify-between items-center mb-4'>
					<Text className='text-white font-semibold'>
						Send Custom Notification
					</Text>
					<Ionicons name='send' size={24} color='white' />
				</TouchableOpacity>
			</View>

			<View className='space-y-2'>
				<TouchableOpacity
					onPress={testImmediateNotification}
					className='bg-red p-3 rounded-xl flex-row justify-between items-center'>
					<Text className='text-white font-semibold'>Test Immediate</Text>
					<Ionicons name='notifications' size={24} color='white' />
				</TouchableOpacity>

				<TouchableOpacity
					onPress={testScheduledNotification}
					className='bg-blue-500 p-3 rounded-xl flex-row justify-between items-center'>
					<Text className='text-white font-semibold'>Test 5s Delay</Text>
					<Ionicons name='time' size={24} color='white' />
				</TouchableOpacity>

				<TouchableOpacity
					onPress={testPriceDropNotification}
					className='bg-green-500 p-3 rounded-xl flex-row justify-between items-center'>
					<Text className='text-white font-semibold'>Test Price Drop</Text>
					<Ionicons name='pricetag' size={24} color='white' />
				</TouchableOpacity>

				<TouchableOpacity
					onPress={testSubscriptionNotification}
					className='bg-amber-500 p-3 rounded-xl flex-row justify-between items-center'>
					<Text className='text-white font-semibold'>Test Subscription</Text>
					<Ionicons name='alert-circle' size={24} color='white' />
				</TouchableOpacity>

				<TouchableOpacity
					onPress={testViewMilestoneNotification}
					className='bg-indigo-500 p-3 rounded-xl flex-row justify-between items-center'>
					<Text className='text-white font-semibold'>Test View Milestone</Text>
					<Ionicons name='trending-up' size={24} color='white' />
				</TouchableOpacity>

				<TouchableOpacity
					onPress={testSoldCarNotification}
					className='bg-teal-500 p-3 rounded-xl flex-row justify-between items-center'>
					<Text className='text-white font-semibold'>Test Sold Car</Text>
					<Ionicons name='car-sport' size={24} color='white' />
				</TouchableOpacity>

				<TouchableOpacity
					onPress={checkNotificationStats}
					className='bg-yellow-500 p-3 rounded-xl flex-row justify-between items-center'>
					<Text className='text-white font-semibold'>Check Stats</Text>
					<Ionicons name='stats-chart' size={24} color='white' />
				</TouchableOpacity>

				<TouchableOpacity
					onPress={clearAllNotifications}
					className='bg-rose-500 p-3 rounded-xl flex-row justify-between items-center'>
					<Text className='text-white font-semibold'>Clear All</Text>
					<Ionicons name='trash' size={24} color='white' />
				</TouchableOpacity>
			</View>
		</BlurView>
	)
}
