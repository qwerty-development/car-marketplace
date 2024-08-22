import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { View } from 'react-native'

export default function UserLayout() {
	return (
		<View style={{ flex: 1, backgroundColor: 'black' }}>
			<Tabs
				screenOptions={{
					tabBarStyle: {
						position: 'absolute',
						backgroundColor: 'black',
						height: 50, // Reduced height to make it less thick
						paddingBottom: 5,
						borderWidth: 0,
						borderColor: '#D55004',
						shadowColor: '#000', // Add a subtle shadow for the floating effect
						shadowOffset: { width: 0, height: 5 },
						shadowOpacity: 0.3,
						shadowRadius: 5,
						borderTopWidth: 0,
						borderTopColor:'#D55004'
					},
					tabBarShowLabel: false, // Hide the tab labels
					tabBarActiveTintColor: '#D55004',
					tabBarInactiveTintColor: 'white',
					tabBarItemStyle: {
						paddingTop: 5,
					},
					headerStyle: {
						backgroundColor: 'black', // Set the header background color to black
						borderBottomWidth: 0, // Remove the border from the header
						borderTopWidth: 0, // Remove the border from the header
						borderWidth: 0, // Remove the border from the header

					},
					headerTintColor: '#D55004', // Set the header text color to orange
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
						headerTitle: 'Dealerships', // Set the header title for this screen
					}}
				/>
				<Tabs.Screen
					name='favorites'
					options={{
						tabBarIcon: ({ color, size }) => (
							<Ionicons name='heart-outline' size={size} color={color} />
						),
						headerTitle: 'Favorites', // Set the header title for this screen
						
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
