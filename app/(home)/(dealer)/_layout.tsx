import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useColorScheme } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

export default function DealerLayout() {
	const colorScheme = useColorScheme()
	const isDarkMode = colorScheme === 'dark'

	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
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
						title: 'My cars',
						tabBarIcon: ({ color, size }) => (
							<Ionicons name='car' size={size} color={color} />
						)
					}}
				/>
				<Tabs.Screen
					name='sales-history'
					options={{
						title: 'Sales History',
						tabBarIcon: ({ color, size }) => (
							<Ionicons name='wallet' size={size} color={color} />
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
					name='filter'
					options={{
						tabBarButton: () => null
					}}
				/>
				<Tabs.Screen
					name='CarDetailModal'
					options={{
						tabBarButton: () => null
					}}
				/>
				<Tabs.Screen
					name='analytics'
					options={{
						tabBarButton: () => null
					}}
				/>
				<Tabs.Screen
					name='car-analytics/[id]'
					options={{
						tabBarButton: () => null
					}}
				/>
			</Tabs>
		</GestureHandlerRootView>
	)
}
