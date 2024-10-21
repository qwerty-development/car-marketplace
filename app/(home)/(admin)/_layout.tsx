import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/utils/ThemeContext'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

export default function AdminLayout() {
	const { isDarkMode } = useTheme()
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
							<Ionicons name='home-outline' size={32} color={color} />
						),
						headerTitle: 'Home'
					}}
				/>
				<Tabs.Screen
					name='users'
					options={{
						tabBarIcon: ({ color }) => (
							<Ionicons name='people-outline' size={32} color={color} />
						),
						headerTitle: 'Users'
					}}
				/>
				<Tabs.Screen
					name='dealership'
					options={{
						tabBarIcon: ({ color }) => (
							<Ionicons name='business-outline' size={32} color={color} />
						),
						headerTitle: 'Dealerships'
					}}
				/>
				<Tabs.Screen
					name='admin-analytics'
					options={{
						tabBarIcon: ({ color }) => (
							<Ionicons name='stats-chart-outline' size={32} color={color} />
						),
						headerTitle: 'Analytics'
					}}
				/>
				<Tabs.Screen
					name='profile'
					options={{
						tabBarIcon: ({ color }) => (
							<Ionicons name='person-outline' size={32} color={color} />
						),
						headerTitle: 'Profile'
					}}
				/>
			</Tabs>
		</GestureHandlerRootView>
	)
}
