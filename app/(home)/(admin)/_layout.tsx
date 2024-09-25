import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/utils/ThemeContext'

export default function AdminLayout() {
	const { isDarkMode } = useTheme()
	return (
		<Tabs
			screenOptions={{
				headerStyle: {
					backgroundColor: isDarkMode ? 'black' : 'white',
					borderBottomWidth: 0,
					borderTopWidth: 0,
					borderWidth: 0
				},
				headerTintColor: '#D55004',
				tabBarStyle: {
					backgroundColor: isDarkMode ? 'black' : 'white'
				},
				tabBarActiveTintColor: '#D55004',
				tabBarInactiveTintColor: isDarkMode ? 'white' : 'black',
				headerShown: false
			}}>
			<Tabs.Screen
				name='index'
				options={{
					title: 'Home',
					tabBarIcon: ({ color, size }) => (
						<Ionicons name='home' size={size} color={color} />
					)
				}}
			/>

			<Tabs.Screen
				name='users'
				options={{
					title: 'Users',
					tabBarIcon: ({ color, size }) => (
						<Ionicons name='people' size={size} color={color} />
					)
				}}
			/>
			<Tabs.Screen
				name='profile'
				options={{
					title: 'Profile',
					tabBarIcon: ({ color, size }) => (
						<Ionicons name='person' size={size} color={color} />
					)
				}}
			/>
			<Tabs.Screen
				name='dealership'
				options={{
					title: 'Dealerships',
					tabBarIcon: ({ color, size }) => (
						<Ionicons name='business' size={size} color={color} />
					)
				}}
			/>
			<Tabs.Screen
				name='admin-analytics'
				options={{
					title: 'Analytics',
					tabBarIcon: ({ color, size }) => (
						<Ionicons name='stats-chart' size={size} color={color} />
					)
				}}
			/>
		</Tabs>
	)
}
