// app/(auth)/_layout.tsx
import { Redirect, Stack } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'

export default function UnAuthenticatedLayout() {
	const { isSignedIn } = useAuth()

	if (isSignedIn) {
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
