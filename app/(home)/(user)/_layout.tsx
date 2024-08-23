import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { View } from 'react-native'
import { useTheme } from '@/utils/ThemeContext'

export default function UserLayout() {
	const { isDarkMode } = useTheme()
	return (
		<View style={{ flex: 1, backgroundColor: isDarkMode ? 'black' : 'white' }}>
			<Tabs
				screenOptions={{
					tabBarStyle: {
						position: 'absolute',
						backgroundColor: isDarkMode ? 'black' : 'white',
						height: 50,
						paddingBottom: 5,
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
						borderTopWidth: 0,
						borderWidth: 0
					},
					headerTintColor: '#D55004'
				}}>
				<Tabs.Screen
					name='index'
					options={{
						tabBarIcon: ({ color, size }) => (
							<Ionicons name='home-outline' size={size} color={color} />
						),
						headerTitle: 'Home', // Set the header title for this screen
						headerShown: false
					}}
				/>
				<Tabs.Screen
					name='dealerships'
					options={{
						tabBarIcon: ({ color, size }) => (
							<Ionicons name='business-outline' size={size} color={color} />
						),
						headerTitle: 'Dealerships' // Set the header title for this screen
					}}
				/>
				<Tabs.Screen
					name='favorites'
					options={{
						tabBarIcon: ({ color, size }) => (
							<Ionicons name='heart-outline' size={size} color={color} />
						),
						headerTitle: 'Favorites' // Set the header title for this screen
					}}
				/>
				<Tabs.Screen
					name='profile'
					options={{
						tabBarIcon: ({ color, size }) => (
							<Ionicons name='person-outline' size={size} color={color} />
						),
						headerTitle: 'Profile', // Set the header title for this screen
						headerShown: false
					}}
				/>
				<Tabs.Screen
					name='filter'
					options={{
						tabBarButton: () => null
					}}
				/>
				<Tabs.Screen
					name='CarsByBrand'
					options={{
						tabBarButton: () => null
					}}
				/>
				<Tabs.Screen
					name='AllBrandsPage'
					options={{
						tabBarButton: () => null
					}}
				/>
				<Tabs.Screen
					name='DealershipDetails'
					options={{
						tabBarButton: () => null
					}}
				/>
			</Tabs>
		</View>
	)
}
