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
					headerShown: false
				})}>
				<Tabs.Screen
					name='index'
					options={{
						tabBarIcon: ({ color }) => (
							<Ionicons name='car-outline' size={32} color={color} /> // Increased size to 32
						),
						headerTitle: 'My Cars'
					}}
				/>
				<Tabs.Screen
					name='sales-history'
					options={{
						tabBarIcon: ({ color }) => (
							<Ionicons name='wallet-outline' size={32} color={color} /> // Increased size to 32
						),
						headerTitle: 'Sales History'
					}}
				/>
				<Tabs.Screen
					name='browse'
					options={{
						tabBarIcon: ({ color }) => (
							<Ionicons name='search-outline' size={32} color={color} /> // Increased size to 32
						),
						headerTitle: 'Browse Cars'
					}}
				/>
				<Tabs.Screen
					name='profile'
					options={{
						tabBarIcon: ({ color }) => (
							<Ionicons name='person-outline' size={32} color={color} /> // Increased size to 32
						),
						headerTitle: 'Profile'
					}}
				/>
				<Tabs.Screen name='filter' options={{ tabBarButton: () => null }} />
				<Tabs.Screen
					name='CarDetailModal'
					options={{ tabBarButton: () => null }}
				/>
				<Tabs.Screen
					name='CarDetailModalIOS'
					options={{ tabBarButton: () => null }}
				/>
				<Tabs.Screen
					name='DealershipDetails'
					options={{ tabBarButton: () => null }}
				/>
				<Tabs.Screen name='analytics' options={{ tabBarButton: () => null }} />
				<Tabs.Screen
					name='car-analytics/[id]'
					options={{ tabBarButton: () => null }}
				/>
			</Tabs>
		</GestureHandlerRootView>
	)
}
