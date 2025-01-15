// app/_layout.tsx
import { useState, useEffect, useCallback } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { ClerkProvider, useAuth } from '@clerk/clerk-expo'
import { tokenCache } from '@/cache'
import * as SplashScreen from 'expo-splash-screen'
import { FavoritesProvider } from '@/utils/useFavorites'
import { ThemeProvider } from '@/utils/ThemeContext'
import { QueryClient, QueryClientProvider } from 'react-query'
import { LogBox, View, Text, TouchableOpacity } from 'react-native'
import 'react-native-gesture-handler'
import 'react-native-get-random-values'
import { useNotifications } from '@/hooks/useNotifications'
import * as Notifications from 'expo-notifications'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import ErrorBoundary from 'react-native-error-boundary'
import CustomSplashScreen from './CustomSplashScreen'

// Configure notifications

LogBox.ignoreLogs([
	'Encountered two children with the same key',
	'Non-serializable values were found in the navigation state' // Ignore navigation state warnings
])

// Prevent auto-hiding splash screen
SplashScreen.preventAutoHideAsync()

// Create a persistent QueryClient instance
const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: 2,
			staleTime: 5 * 60 * 1000, // 5 minutes
			cacheTime: 10 * 60 * 1000, // 10 minutes
			refetchOnWindowFocus: false,
			refetchOnMount: false
		}
	}
})

function NotificationsProvider() {
	const { unreadCount, isPermissionGranted } = useNotifications()

	useEffect(() => {
		// You can use these values to update UI elements that depend on notification state
		console.log('Notification state:', { unreadCount, isPermissionGranted })
	}, [unreadCount, isPermissionGranted])

	return null
}

function RootLayoutNav() {
	const { isLoaded, isSignedIn } = useAuth()
	const segments = useSegments()
	const router = useRouter()
	const [showSplash, setShowSplash] = useState(true)
	const [isReady, setIsReady] = useState(false)

	const handleNavigationStateChange = useCallback(() => {
		if (!isReady) return

		const inAuthGroup = segments[0] === '(auth)'

		if (isSignedIn && inAuthGroup) {
			router.replace('/(home)')
		} else if (!isSignedIn && !inAuthGroup) {
			router.replace('/(auth)/sign-in')
		}
	}, [isReady, isSignedIn, segments, router])

	useEffect(() => {
		if (isLoaded && !showSplash) {
			setIsReady(true)
		}
	}, [isLoaded, showSplash])

	useEffect(() => {
		handleNavigationStateChange()
	}, [handleNavigationStateChange])

	if (!isReady) {
		return (
			<CustomSplashScreen onAnimationComplete={() => setShowSplash(false)} />
		)
	}

	return <Slot />
}

function ErrorFallback({ error, resetError }: any) {
	return (
		<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
			<Text>Something went wrong!</Text>
			<Text>{error.toString()}</Text>
			<TouchableOpacity onPress={resetError}>
				<Text>Try again</Text>
			</TouchableOpacity>
		</View>
	)
}

export default function RootLayout() {
	useEffect(() => {
		SplashScreen.hideAsync()
	}, [])

	return (
		<ErrorBoundary FallbackComponent={ErrorFallback}>
			<GestureHandlerRootView style={{ flex: 1 }}>
				<ClerkProvider
					tokenCache={tokenCache}
					publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}>
					<QueryClientProvider client={queryClient}>
						<ThemeProvider>
							<FavoritesProvider>
								<NotificationsProvider />
								<RootLayoutNav />
							</FavoritesProvider>
						</ThemeProvider>
					</QueryClientProvider>
				</ClerkProvider>
			</GestureHandlerRootView>
		</ErrorBoundary>
	)
}
