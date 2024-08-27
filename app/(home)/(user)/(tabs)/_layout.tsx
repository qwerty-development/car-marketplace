import React, { useEffect, useRef } from 'react'
import { Tabs, useNavigation, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/utils/ThemeContext'
import { Dimensions, View } from 'react-native'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.7

const tabRoutes = ['', 'dealerships', 'favorites', 'profile']

export default function TabLayout() {
	const { isDarkMode } = useTheme()

	return (
		<Tabs
			screenOptions={({ route }) => ({
				tabBarStyle: {
					position: 'absolute',
					backgroundColor: isDarkMode ? 'black' : 'white',
					height: 60,
					paddingBottom: 20,
					borderWidth: 0,
					borderColor: '#D55004',
					shadowColor: '#000',
					shadowOffset: { width: 0, height: 5 },
					shadowOpacity: 0.3,
					shadowRadius: 5,
					borderTopWidth: 0,
					borderTopColor: '#D55004'
				},
				tabBarShowLabel: false,
				tabBarActiveTintColor: '#D55004',
				tabBarInactiveTintColor: isDarkMode ? 'white' : 'black',
				tabBarItemStyle: {
					paddingTop: 5
				},
				headerStyle: {
					backgroundColor: isDarkMode ? 'black' : 'white',
					borderBottomWidth: 0,
					borderBottomColor: '#D55004',
					borderTopWidth: 0,
					borderWidth: 0,
					borderColor: '#D55004'
				},
				headerTintColor: '#D55004',
				headerShown: route.name !== 'index'
			})}>
			<Tabs.Screen
				name='index'
				options={{
					tabBarIcon: ({ color, size }) => (
						<Ionicons name='home-outline' size={size} color={color} />
					),
					headerTitle: 'Home'
				}}
			/>
			<Tabs.Screen
				name='dealerships'
				options={{
					tabBarIcon: ({ color, size }) => (
						<Ionicons name='business-outline' size={size} color={color} />
					),
					headerTitle: 'Dealerships'
				}}
			/>
			<Tabs.Screen
				name='favorites'
				options={{
					tabBarIcon: ({ color, size }) => (
						<Ionicons name='heart-outline' size={size} color={color} />
					),
					headerTitle: 'Favorites'
				}}
			/>
			<Tabs.Screen
				name='profile'
				options={{
					tabBarIcon: ({ color, size }) => (
						<Ionicons name='person-outline' size={size} color={color} />
					),
					headerTitle: 'Profile',
					headerShown: false
				}}
			/>
		</Tabs>
	)
}
