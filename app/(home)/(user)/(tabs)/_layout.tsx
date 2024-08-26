import React, { useEffect, useRef } from 'react'
import { Tabs, useNavigation, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/utils/ThemeContext'
import { Dimensions, View } from 'react-native'
import {
	PanGestureHandler,
	GestureHandlerRootView
} from 'react-native-gesture-handler'
import Animated, {
	useAnimatedGestureHandler,
	useAnimatedStyle,
	useSharedValue,
	withSpring,
	runOnJS,
	interpolate,
	Extrapolate
} from 'react-native-reanimated'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3

const tabRoutes = ['', 'dealerships', 'favorites', 'profile']

const SwipeableStack = ({ children }: any) => {
	const router = useRouter()
	const translateX = useSharedValue(0)
	const currentIndex = useSharedValue(0)

	const switchTab = (direction: number) => {
		const newIndex = Math.max(
			0,
			Math.min(tabRoutes.length - 1, currentIndex.value + direction)
		)
		if (newIndex !== currentIndex.value) {
			currentIndex.value = newIndex
			router.push(`/(tabs)/${tabRoutes[newIndex]}`)
		}
	}

	const gestureHandler = useAnimatedGestureHandler({
		onStart: (_, ctx) => {
			ctx.startX = translateX.value
		},
		onActive: (event, ctx: any) => {
			const newTranslateX = ctx.startX + event.translationX
			translateX.value = interpolate(
				newTranslateX,
				[-SCREEN_WIDTH, 0, SCREEN_WIDTH],
				[-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
				Extrapolate.CLAMP
			)
		},
		onEnd: event => {
			const direction = event.velocityX > 0 ? -1 : 1
			if (
				Math.abs(translateX.value) > SWIPE_THRESHOLD ||
				Math.abs(event.velocityX) > 500
			) {
				runOnJS(switchTab)(direction)
			}
			translateX.value = withSpring(0, { damping: 15, stiffness: 150 })
		}
	})

	const animatedStyle = useAnimatedStyle(() => {
		return {
			transform: [{ translateX: translateX.value }]
		}
	})
	return (
		<View style={{ flex: 1, backgroundColor: 'black' }}>
			<PanGestureHandler
				onGestureEvent={gestureHandler}
				activeOffsetX={[-10, 10]}>
				<Animated.View style={[{ flex: 1 }, animatedStyle]}>
					{children}
				</Animated.View>
			</PanGestureHandler>
		</View>
	)
}

export default function TabLayout() {
	const { isDarkMode } = useTheme()

	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<SwipeableStack>
				<Tabs
					screenOptions={({ route }) => ({
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
						headerTintColor: '#D55004',
						headerShown: route.name !== 'index'
					})}>
					<Tabs.Screen
						name='index'
						options={{
							tabBarIcon: ({ color, size }) => (
								<Ionicons name='home-outline' size={size} color={color} />
							),
							headerTitle: 'Home'
						}}
					/>
					<Tabs.Screen
						name='dealerships'
						options={{
							tabBarIcon: ({ color, size }) => (
								<Ionicons name='business-outline' size={size} color={color} />
							),
							headerTitle: 'Dealerships'
						}}
					/>
					<Tabs.Screen
						name='favorites'
						options={{
							tabBarIcon: ({ color, size }) => (
								<Ionicons name='heart-outline' size={size} color={color} />
							),
							headerTitle: 'Favorites'
						}}
					/>
					<Tabs.Screen
						name='profile'
						options={{
							tabBarIcon: ({ color, size }) => (
								<Ionicons name='person-outline' size={size} color={color} />
							),
							headerTitle: 'Profile',
							headerShown: false
						}}
					/>
				</Tabs>
			</SwipeableStack>
		</GestureHandlerRootView>
	)
}
