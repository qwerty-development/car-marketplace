// app/(auth)/_layout.tsx
import { Redirect, Stack } from 'expo-router'
import { useAuth } from '@/utils/AuthContext'
import { useGuestUser } from '@/utils/GuestUserContext'
import { useSegments } from 'expo-router'

export default function UnAuthenticatedLayout() {
  const { isSignedIn } = useAuth()
  const { isGuest } = useGuestUser()
  const segments = useSegments()

  console.log('[AUTH LAYOUT] Current segments:', segments)
  console.log('[AUTH LAYOUT] Auth state:', { isSignedIn, isGuest })

  // BRUTE FORCE: Allow callback route to always render
  const isCallbackRoute = segments.includes('callback')
  
  if (isCallbackRoute) {
    console.log('[AUTH LAYOUT] Callback route detected, allowing through')
    // Let callback route handle its own logic - DO NOT REDIRECT
  } else if (isSignedIn || isGuest) {
    console.log('[AUTH LAYOUT] User authenticated, redirecting to home')
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
      <Stack.Screen 
        name='callback' 
        options={{ 
          headerShown: false,
          gestureEnabled: false, // Prevent swipe back
        }} 
      />
    </Stack>
  )
}