import React from 'react'
import { Stack } from 'expo-router'
import { Easing, View } from 'react-native'
import { useTheme } from '@/utils/ThemeContext'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

export default function RootLayout() {
	const { isDarkMode } = useTheme()

	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<View
				style={{ flex: 1, backgroundColor: isDarkMode ? 'black' : 'white' }}>
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
						name='CarsByBrand'
						options={{
							animation: 'slide_from_right',
							headerShown: false
						}}
					/>
					<Stack.Screen
						name='AllBrandsPage'
						options={{
							animation: 'slide_from_right',
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
						name='CarDetailModal'
						options={{
							animation: 'slide_from_bottom',
							headerShown: false
						}}
					/>

					<Stack.Screen
						name='CarDetailModalIOS'
						options={{
							headerShown: true
						}}
					/>

					<Stack.Screen
						name='CarDetails'
						options={{
							presentation: 'card',
							animation: 'slide_from_right',
							headerShown: false,
							contentStyle: {
								backgroundColor: 'transparent'
							},

							animationDuration: 200,
							gestureEnabled: true,
							gestureDirection: 'horizontal'
						}}
					/>
					<Stack.Screen
						name='notifications'
						options={{
							presentation: 'modal',
							animation: 'slide_from_bottom',
							headerShown: false
						}}
					/>
				</Stack>
			</View>
		</GestureHandlerRootView>
	)
}
