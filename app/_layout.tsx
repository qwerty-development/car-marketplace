import { useState, useEffect } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { ClerkProvider, useAuth } from '@clerk/clerk-expo'
import { tokenCache } from '@/cache'
import * as SplashScreen from 'expo-splash-screen'
import { FavoritesProvider } from '@/utils/useFavorites'
import 'react-native-gesture-handler'
import CustomSplashScreen from './CustomSplashScreen'

SplashScreen.preventAutoHideAsync()

function RootLayoutNav() {
	const { isLoaded, isSignedIn } = useAuth()
	const segments = useSegments()
	const router = useRouter()
	const [showSplash, setShowSplash] = useState(true)
	const [mounted, setMounted] = useState(false)

	useEffect(() => {
		setMounted(true)
	}, [])

	useEffect(() => {
		if (!isLoaded || !mounted || showSplash) return

		const inAuthGroup = segments[0] === '(auth)'

		if (isSignedIn && inAuthGroup) {
			router.replace('/(home)')
		} else if (!isSignedIn && !inAuthGroup) {
			router.replace('/(auth)/sign-in')
		}
	}, [isLoaded, isSignedIn, segments, showSplash, mounted])

	if (!mounted || showSplash) {
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
			<FavoritesProvider>
				<RootLayoutNav />
			</FavoritesProvider>
		</ClerkProvider>
	)
}
