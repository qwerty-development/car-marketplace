import { useEffect } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { ClerkProvider, useAuth } from '@clerk/clerk-expo'
import { tokenCache } from '@/cache'
import * as SplashScreen from 'expo-splash-screen'
import { FavoritesProvider } from '@/utils/useFavorites'
import 'react-native-gesture-handler'
SplashScreen.preventAutoHideAsync()

function RootLayoutNav() {
	const { isLoaded, isSignedIn } = useAuth()
	const segments = useSegments()
	const router = useRouter()

	useEffect(() => {
		if (!isLoaded) return

		const inAuthGroup = segments[0] === '(auth)'

		if (isSignedIn && inAuthGroup) {
			router.replace('/(home)')
		} else if (!isSignedIn && !inAuthGroup) {
			router.replace('/(auth)/sign-in')
		}
	}, [isLoaded, isSignedIn, segments])

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






// import { useEffect, useState } from 'react'
// import { Slot, useRouter, useSegments } from 'expo-router'
// import { ClerkProvider, useAuth } from '@clerk/clerk-expo'
// import { tokenCache } from '@/cache'
// import * as ExpoSplashScreen from 'expo-splash-screen'
// import { FavoritesProvider } from '@/utils/useFavorites'
// import 'react-native-gesture-handler'
// import CustomSplashScreen from './CustomSplashScreen'
// import { View } from 'react-native'

// ExpoSplashScreen.preventAutoHideAsync()

// function NavigationHandler() {
//   const { isLoaded, isSignedIn } = useAuth()
//   const segments = useSegments()
//   const router = useRouter()

//   useEffect(() => {
//     if (!isLoaded) return

//     const inAuthGroup = segments[0] === '(auth)'

//     if (isSignedIn && inAuthGroup) {
//       router.replace('/(home)')
//     } else if (!isSignedIn && !inAuthGroup) {
//       router.replace('/(auth)/sign-in')
//     }
//   }, [isLoaded, isSignedIn, segments])

//   return null
// }

// function RootLayoutNav() {
//   const { isLoaded, isSignedIn } = useAuth()
//   const [showCustomSplash, setShowCustomSplash] = useState(true)
//   const [isNavigationReady, setIsNavigationReady] = useState(false)

//   useEffect(() => {
//     if (isLoaded) {
//       if (isSignedIn) {
//         setShowCustomSplash(false)
//         setIsNavigationReady(true)
//       } else {
//         // If not signed in, wait for splash screen to complete
//         setShowCustomSplash(true)
//       }
//     }
//   }, [isLoaded, isSignedIn])

//   if (!isLoaded) {
//     return <Slot />
//   }

//   return (
//     <View style={{ flex: 1 }}>
//       {showCustomSplash && !isSignedIn ? (
//         <CustomSplashScreen 
//           onAnimationComplete={() => {
//             setShowCustomSplash(false)
//             setIsNavigationReady(true)
//           }} 
//         />
//       ) : null}
//       {isNavigationReady && <NavigationHandler />}
//       <Slot />
//     </View>
//   )
// }

// export default function RootLayout() {
//   const [appIsReady, setAppIsReady] = useState(false)

//   useEffect(() => {
//     async function prepare() {
//       try {
//         // Perform any app initialization tasks here
//         await new Promise(resolve => setTimeout(resolve, 2000)) // Simulating some loading time
//       } catch (e) {
//         console.warn(e)
//       } finally {
//         setAppIsReady(true)
//       }
//     }

//     prepare()
//   }, [])

//   useEffect(() => {
//     if (appIsReady) {
//       ExpoSplashScreen.hideAsync()
//     }
//   }, [appIsReady])

//   const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!

//   if (!appIsReady) {
//     return null
//   }

//   return (
//     <ClerkProvider tokenCache={tokenCache} publishableKey={publishableKey}>
//       <FavoritesProvider>
//         <RootLayoutNav />
//       </FavoritesProvider>
//     </ClerkProvider>
//   )
// }



//