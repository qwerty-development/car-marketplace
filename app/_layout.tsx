import { useState, useEffect } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { ClerkProvider, useAuth } from '@clerk/clerk-expo'
import { tokenCache } from '@/cache'
import * as SplashScreen from 'expo-splash-screen'
import { FavoritesProvider } from '@/utils/useFavorites'
import 'react-native-gesture-handler'
import CustomSplashScreen from './CustomSplashScreen'
import { ThemeProvider } from '@/utils/ThemeContext'
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

	const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!

	return (
		<ClerkProvider tokenCache={tokenCache} publishableKey={publishableKey}>
			<ThemeProvider>
				<FavoritesProvider>
					<RootLayoutNav />
				</FavoritesProvider>
			</ThemeProvider>
		</ClerkProvider>
	)
}
