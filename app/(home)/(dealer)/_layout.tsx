import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

export default function DealerLayout() {
	return (
		<Tabs>
			<Tabs.Screen
				name='index'
				options={{
					title: 'Dashboard',
					tabBarIcon: ({ color, size }) => (
						<Ionicons name='home' size={size} color={color} />
					)
				}}
			/>
			<Tabs.Screen
				name='listings'
				options={{
					title: 'Listings',
					tabBarIcon: ({ color, size }) => (
						<Ionicons name='list' size={size} color={color} />
					)
				}}
			/>
			<Tabs.Screen
				name='sales-history'
				options={{
					title: 'Sales History',
					tabBarIcon: ({ color, size }) => (
						<Ionicons name='time' size={size} color={color} />
					)
				}}
			/>{' '}
			<Tabs.Screen
				name='browse'
				options={{
					title: 'Browse Cars',
					tabBarIcon: ({ color, size }) => (
						<Ionicons name='search' size={size} color={color} />
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
				name='analytics'
				options={{
					title: 'Analytics',
					tabBarIcon: ({ color, size }) => (
						<Ionicons name='bar-chart' size={size} color={color} />
					)
				}}
			/>
		</Tabs>
	)
}
