// (home)/(dealer)/_layout.tsx
import { Tabs, Stack } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/utils/ThemeContext'

export default function DealerLayout() {
	const { isDarkMode } = useTheme()

	return (
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
					name='AddEditListing'
					options={{
						animation: 'slide_from_right',
						headerShown: false,
						gestureEnabled: false
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
								<Stack.Screen
					name='EditProfile'
					options={{
						animation: 'slide_from_right',
						headerShown: false
					}}
				/>
												<Stack.Screen
					name='ChangePassword'
					options={{
						animation: 'slide_from_right',
						headerShown: false
					}}
				/>
				<Stack.Screen
					name='NumberPlatesManager'
					options={{
						animation: 'slide_from_right',
						headerShown: false
					}}
				/>
																<Stack.Screen
					name='terms-of-service'
					options={{
						animation: 'slide_from_right',
						headerShown: false
					}}
				/>
				<Stack.Screen
					name='privacy-policy'
					options={{
						animation: 'slide_from_right',
						headerShown: false
					}}
				/>
				<Stack.Screen
					name='conversations'
					options={{
						headerShown: false
					}}
				/>
			</Stack>
	)
}
