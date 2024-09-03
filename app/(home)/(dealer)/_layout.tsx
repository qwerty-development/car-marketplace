import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useColorScheme } from 'react-native';

export default function DealerLayout() {
	const colorScheme = useColorScheme();
	const isDarkMode = colorScheme === 'dark';
  

	return (
	  <Tabs
		screenOptions={{
		  headerStyle: {
			backgroundColor: isDarkMode ? 'black' : 'white',
			borderBottomWidth: 0,
			borderTopWidth: 0,
			borderWidth: 0,
		  },
		  headerTintColor: '#D55004',
		  tabBarStyle: {
			backgroundColor: isDarkMode ? 'black' : 'white',
		  },
		  tabBarActiveTintColor: '#D55004',
		  tabBarInactiveTintColor: isDarkMode ? 'white' : 'black',
		}}
	  >
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
				name='analytics'
				options={{
					title: 'Analytics',
					tabBarIcon: ({ color, size }) => (
						<Ionicons name='bar-chart' size={size} color={color} />
					)
				}}
			/>
			<Tabs.Screen
				name='car-analytics/[id]'
				options={{
					tabBarButton: () => null
				}}
			/>
		</Tabs>
	)
}
