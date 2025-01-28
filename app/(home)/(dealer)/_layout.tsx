// (home)/(dealer)/_layout.tsx
import { Tabs, Stack } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useColorScheme } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

export default function DealerLayout() {
	const colorScheme = useColorScheme()
	const isDarkMode = colorScheme === 'dark'

	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<Stack>
				<Stack.Screen name='(tabs)' options={{ headerShown: false }} />
				<Stack.Screen
					name='filter'
					options={{
						presentation: 'modal',
						animation: 'slide_from_bottom',
						headerShown: false
					}}
				/>
				<Stack.Screen
					name='CarDetailModal'
					options={{
						presentation: 'modal',
						animation: 'slide_from_bottom',
						headerShown: false
					}}
				/>
				<Stack.Screen
					name='CarDetailModalIOS'
					options={{
						presentation: 'modal',
						animation: 'slide_from_bottom',
						headerShown: false
					}}
				/>
				<Stack.Screen
					name='DealershipDetails'
					options={{
						animation: 'slide_from_right',
						headerShown: false
					}}
				/>
				<Stack.Screen
					name='analytics'
					options={{
						animation: 'slide_from_right',
						headerShown: false
					}}
				/>
				<Stack.Screen
					name='car-analytics/[id]'
					options={{
						animation: 'slide_from_right',
						headerShown: false
					}}
				/>
				<Stack.Screen
					name='CarDetails'
					options={{
						presentation: 'card',
						animation: 'slide_from_right',
						headerShown: false
					}}
				/>
			</Stack>
		</GestureHandlerRootView>
	)
}
