import { useState, useEffect } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { ClerkProvider, useAuth } from '@clerk/clerk-expo'
import { tokenCache } from '@/cache'
import * as SplashScreen from 'expo-splash-screen'
import { FavoritesProvider } from '@/utils/useFavorites'
import 'react-native-gesture-handler'
import CustomSplashScreen from './CustomSplashScreen'
import { ThemeProvider } from '@/utils/ThemeContext'
import { QueryClient, QueryClientProvider } from 'react-query'
import { LogBox } from 'react-native'
import 'react-native-get-random-values'

LogBox.ignoreLogs([
	'Encountered two children with the same key' // This will ignore the specific warning about duplicate keys
])

SplashScreen.preventAutoHideAsync()

function RootLayoutNav() {
	const { isLoaded, isSignedIn } = useAuth()
	const segments = useSegments()
	const router = useRouter()
	const [showSplash, setShowSplash] = useState(true)
	const [isReady, setIsReady] = useState(false)

	useEffect(() => {
		if (isLoaded && !showSplash) {
			setIsReady(true)
		}
	}, [isLoaded, showSplash])

	useEffect(() => {
		if (!isReady) return

		const inAuthGroup = segments[0] === '(auth)'

		if (isSignedIn && inAuthGroup) {
			router.replace('/(home)')
		} else if (!isSignedIn && !inAuthGroup) {
			router.replace('/(auth)/sign-in')
		}
	}, [isReady, isSignedIn, segments])

	if (!isReady) {
		return (
			<CustomSplashScreen onAnimationComplete={() => setShowSplash(false)} />
		)
	}

	return <Slot />
}

export default function RootLayout() {
	useEffect(() => {
		SplashScreen.hideAsync()
	}, [])
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: 2,
				staleTime: 5 * 60 * 1000 // 5 minutes
			}
		}
	})

	const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!

	return (
		<ClerkProvider tokenCache={tokenCache} publishableKey={publishableKey}>
			<QueryClientProvider client={queryClient}>
				<ThemeProvider>
					<FavoritesProvider>
						<RootLayoutNav />
					</FavoritesProvider>
				</ThemeProvider>
			</QueryClientProvider>
		</ClerkProvider>
	)
}