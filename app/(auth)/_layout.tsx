// app/(auth)/_layout.tsx
import { Stack } from 'expo-router'
import { View, ActivityIndicator, Text, useColorScheme } from 'react-native'
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
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  // Get guest user state
  const { isGuest } = useGuestUser()

  // Wait until auth is fully initialized
  if (!isLoaded) {
    return null
  }

  // Signed-in / guest users: show a branded loading spinner while
  // RootLayoutNav navigates away via its deferred safeReplace().
  // Previously this returned null which caused a blank white/black
  // screen for 20-30 seconds during profile loading after OAuth.
  if (isSignedIn || isGuest) {
    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: isDark ? '#0D0D0D' : '#FFFFFF',
      }}>
        <ActivityIndicator size="large" color="#D55004" />
        <Text style={{
          marginTop: 16,
          fontSize: 16,
          color: isDark ? '#9CA3AF' : '#6B7280',
        }}>
          Signing you in…
        </Text>
      </View>
    )
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