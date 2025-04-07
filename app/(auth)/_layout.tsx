// app/(auth)/_layout.tsx
import { Redirect, Stack } from 'expo-router'
import { useAuth } from '@/utils/AuthContext'
import { useGuestUser } from '@/utils/GuestUserContext'

/**
 * Authentication Layout
 *
 * This layout handles the routing logic for unauthenticated screens.
 * It prevents authenticated or guest users from accessing auth screens
 * by redirecting them to the home screen.
 */
export default function UnAuthenticatedLayout() {
  // Get authentication state from Supabase Auth context
  const { isSignedIn } = useAuth()

  // Get guest user state
  const { isGuest } = useGuestUser()

  // Redirect authenticated or guest users to home
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
      <Stack.Screen name='terms-of-service' options={{ headerShown: false }} />
      <Stack.Screen name='privacy-policy' options={{ headerShown: false }} />
    </Stack>
  )
}