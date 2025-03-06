// app/(auth)/_layout.tsx
import { Redirect, Stack } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import { useGuestUser } from '@/utils/GuestUserContext' // Add this import

export default function UnAuthenticatedLayout() {
	const { isSignedIn } = useAuth()
	const { isGuest } = useGuestUser() // Add this line to get guest status

	// Update this condition to check for both signed in users and guest users
	if (isSignedIn || isGuest) {
		return <Redirect href={'/'} />
	}

	return (
		<Stack
			screenOptions={{
				headerShown: false,
				animation: 'slide_from_right'
			}}>
			<Stack.Screen name='index' options={{ headerShown: false }} />
			<Stack.Screen name='forgot-password' options={{ headerShown: false }} />
			<Stack.Screen name='sign-in' options={{ headerShown: false }} />
			<Stack.Screen name='sign-up' options={{ headerShown: false }} />
		</Stack>
	)
}