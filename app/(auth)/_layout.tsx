// app/(auth)/_layout.tsx
import { Stack } from 'expo-router'
import { useAuth } from '@/utils/AuthContext'
import { useGuestUser } from '@/utils/GuestUserContext'

/**
 * Authentication Layout
 *
 * This layout handles the routing logic for unauthenticated screens.
 * It prevents authenticated or guest users from seeing auth screens
 * by returning null. Actual navigation away from (auth) is handled
 * by RootLayoutNav's routing effect — using <Redirect> here caused
 * a synchronous navigation during render that triggered Maximum
 * update depth errors and a double-splash remount.
 */
export default function UnAuthenticatedLayout() {
  // Get authentication state from Supabase Auth context
  const { isSignedIn, isLoaded } = useAuth()

  // Get guest user state
  const { isGuest } = useGuestUser()

  // Wait until auth is fully initialized
  if (!isLoaded) {
    return null
  }

  // Signed-in / guest users: render nothing while RootLayoutNav
  // navigates away via its deferred safeReplace(). Using <Redirect>
  // here caused a synchronous navigator state update during the React
  // commit phase, which cascaded into Maximum update depth and forced
  // the entire tree to remount (double splash).
  if (isSignedIn || isGuest) {
    return null
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