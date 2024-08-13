import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

export default function UserLayout() {
	return (
		<Tabs>
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
				name='dealerships'
				options={{
					title: 'Browse Dealerships',
					tabBarIcon: ({ color, size }) => (
						<Ionicons name='business' size={size} color={color} />
					)
				}}
			/>
			<Tabs.Screen
				name='favorites'
				options={{
					title: 'Favorites',
					tabBarIcon: ({ color, size }) => (
						<Ionicons name='heart' size={size} color={color} />
					)
				}}
			/>
			<Tabs.Screen
				name='ContactUsPage'
				options={{
					title: 'Contact Us',
					tabBarIcon: ({ color, size }) => (
						<Ionicons name='mail' size={size} color={color} />
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
				name='filter'
				options={{
					tabBarButton: () => null
				}}
			/>
		</Tabs>
	)
}
