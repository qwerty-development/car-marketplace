import React from 'react'
import { View, TouchableOpacity, Text, Alert } from 'react-native'
import * as Notifications from 'expo-notifications'
import { NotificationService } from '@/services/NotificationService'
import { SchedulableTriggerInputTypes } from 'expo-notifications'
import { BlurView } from 'expo-blur'
import { useTheme } from '@/utils/ThemeContext'

import { Ionicons } from '@expo/vector-icons'

export default function NotificationTester({userId}:any) {
	const { isDarkMode } = useTheme()


	const testImmediateNotification = async () => {
		try {
			await Notifications.scheduleNotificationAsync({
				content: {
					title: 'Test Notification 🚗',
					body: 'This is a test immediate notification!',
					data: { screen: '/(home)/(user)' }
				},
				trigger: null
			})
			Alert.alert('Success', 'Test notification sent!')
		} catch (error) {
			Alert.alert('Error', 'Failed to send test notification')
		}
	}

	const testScheduledNotification = async () => {
		try {
			await Notifications.scheduleNotificationAsync({
				content: {
					title: 'Scheduled Test 🕒',
					body: 'This notification was scheduled for 5 seconds later!',
					data: { screen: '/(home)/(user)' }
				},
				trigger: {
					type: SchedulableTriggerInputTypes.TIME_INTERVAL,
					seconds: 5,
					repeats: false
				}
			})
			Alert.alert('Success', 'Notification scheduled for 5 seconds from now')
		} catch (error) {
			Alert.alert('Error', 'Failed to schedule notification')
		}
	}

	const testDailyNotifications = async () => {
		try {
			await NotificationService.scheduleDailyNotifications()
			Alert.alert('Success', 'Daily notifications scheduled!')
		} catch (error) {
			Alert.alert('Error', 'Failed to schedule daily notifications')
		}
	}

	const testViewMilestoneNotification = async () => {
		if (!userId) {
			Alert.alert('Error', 'User not logged in')
			return
		}
		try {
			await NotificationService.checkViewsMilestones(userId)
			Alert.alert('Success', 'View milestones check triggered!')
		} catch (error) {
			Alert.alert('Error', 'Failed to check view milestones')
		}
	}

	const testSoldCarNotification = async () => {
		if (!userId) {
			Alert.alert('Error', 'User not logged in')
			return
		}
		try {
			await NotificationService.checkSoldFavorites(userId)
			Alert.alert('Success', 'Sold cars check triggered!')
		} catch (error) {
			Alert.alert('Error', 'Failed to check sold cars')
		}
	}

	const checkScheduledNotifications = async () => {
		try {
			const scheduledNotifications =
				await Notifications.getAllScheduledNotificationsAsync()

			if (scheduledNotifications.length === 0) {
				Alert.alert(
					'No Scheduled Notifications',
					'You have no notifications scheduled.'
				)
				return
			}

			const notificationDetails = scheduledNotifications
				.map((n, i) => {
					const trigger = n.trigger as any
					let triggerInfo = ''

					if (trigger.type === 'daily') {
						triggerInfo = `Daily at ${trigger.hour}:${trigger.minute
							.toString()
							.padStart(2, '0')}`
					} else if (trigger.type === 'timeInterval') {
						triggerInfo = `In ${trigger.seconds} seconds`
					} else {
						triggerInfo = JSON.stringify(trigger)
					}

					return `${i + 1}. ${n.content.title}\n   ${triggerInfo}`
				})
				.join('\n\n')

			Alert.alert(
				'Scheduled Notifications',
				`You have ${scheduledNotifications.length} notifications scheduled:\n\n${notificationDetails}`
			)
		} catch (error) {
			Alert.alert('Error', 'Failed to fetch scheduled notifications')
		}
	}

	const checkPermissions = async () => {
		try {
			const { status } = await Notifications.getPermissionsAsync()
			Alert.alert(
				'Permissions Status',
				`Current notification permission status: ${status}`
			)
		} catch (error) {
			Alert.alert('Error', 'Failed to check permissions')
		}
	}

	const cancelAllNotifications = async () => {
		try {
			await NotificationService.cancelAllNotifications()
			Alert.alert('Success', 'All scheduled notifications cancelled')
		} catch (error) {
			Alert.alert('Error', 'Failed to cancel notifications')
		}
	}

	const resetBadgeCount = async () => {
		try {
			await NotificationService.setBadgeCount(0)
			Alert.alert('Success', 'Badge count reset to 0')
		} catch (error) {
			Alert.alert('Error', 'Failed to reset badge count')
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
					onPress={testDailyNotifications}
					className='bg-green-500 p-3 rounded-xl flex-row justify-between items-center'>
					<Text className='text-white font-semibold'>Schedule Daily</Text>
					<Ionicons name='calendar' size={24} color='white' />
				</TouchableOpacity>

				<TouchableOpacity
					onPress={testViewMilestoneNotification}
					className='bg-amber-500 p-3 rounded-xl flex-row justify-between items-center'>
					<Text className='text-white font-semibold'>Test View Milestone</Text>
					<Ionicons name='trending-up' size={24} color='white' />
				</TouchableOpacity>

				<TouchableOpacity
					onPress={testSoldCarNotification}
					className='bg-indigo-500 p-3 rounded-xl flex-row justify-between items-center'>
					<Text className='text-white font-semibold'>Test Sold Car</Text>
					<Ionicons name='car-sport' size={24} color='white' />
				</TouchableOpacity>

				<TouchableOpacity
					onPress={checkScheduledNotifications}
					className='bg-purple-500 p-3 rounded-xl flex-row justify-between items-center'>
					<Text className='text-white font-semibold'>Check Scheduled</Text>
					<Ionicons name='list' size={24} color='white' />
				</TouchableOpacity>

				<TouchableOpacity
					onPress={checkPermissions}
					className='bg-yellow-500 p-3 rounded-xl flex-row justify-between items-center'>
					<Text className='text-white font-semibold'>Check Permissions</Text>
					<Ionicons name='shield-checkmark' size={24} color='white' />
				</TouchableOpacity>

				<TouchableOpacity
					onPress={resetBadgeCount}
					className='bg-teal-500 p-3 rounded-xl flex-row justify-between items-center'>
					<Text className='text-white font-semibold'>Reset Badge Count</Text>
					<Ionicons name='notifications-off' size={24} color='white' />
				</TouchableOpacity>

				<TouchableOpacity
					onPress={cancelAllNotifications}
					className='bg-rose-500 p-3 rounded-xl flex-row justify-between items-center'>
					<Text className='text-white font-semibold'>Cancel All</Text>
					<Ionicons name='trash' size={24} color='white' />
				</TouchableOpacity>
			</View>
		</BlurView>
	)
}
