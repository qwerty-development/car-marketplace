// app/_layout.tsx
import { useState, useEffect, useCallback } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { ClerkProvider, useAuth } from '@clerk/clerk-expo'
import { tokenCache } from '@/cache'
import * as SplashScreen from 'expo-splash-screen'
import { FavoritesProvider } from '@/utils/useFavorites'
import { ThemeProvider } from '@/utils/ThemeContext'
import { QueryClient, QueryClientProvider } from 'react-query'
import { LogBox, View, Text, TouchableOpacity } from 'react-native'
import 'react-native-gesture-handler'
import 'react-native-get-random-values'
import { useNotifications } from '@/hooks/useNotifications'
import * as Notifications from 'expo-notifications'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import ErrorBoundary from 'react-native-error-boundary'
import CustomSplashScreen from './CustomSplashScreen'

// IMPORTANT: Configure notifications handler at app startup
// This must be outside of any component to work properly
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

LogBox.ignoreLogs([
  'Encountered two children with the same key',
  'Non-serializable values were found in the navigation state',
  'VirtualizedLists should never be nested inside plain ScrollViews with the same orientation - use another VirtualizedList-backed container instead.',
  'Text strings must be rendered within a <Text> component.',
])

// Prevent auto-hiding splash screen
SplashScreen.preventAutoHideAsync()

// Create a persistent QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      refetchOnMount: false
    }
  }
})

// Check if environment variables are set correctly
function EnvironmentVariablesCheck() {
  useEffect(() => {
    const projectId = process.env.EXPO_PUBLIC_PROJECT_ID;

    if (!projectId) {
      console.error('⚠️ EXPO_PUBLIC_PROJECT_ID is missing from environment variables!');
      console.error('Push notifications will not work without this value.');
      console.error('Please add it to your .env file and app.config.js or app.json.');
    } else {
      console.log('✅ EXPO_PUBLIC_PROJECT_ID is configured:', projectId);
    }
  }, []);

  return null;
}

function NotificationsProvider() {
  const { unreadCount, isPermissionGranted } = useNotifications()

  useEffect(() => {
    console.log('Notification state:', { unreadCount, isPermissionGranted })
  }, [unreadCount, isPermissionGranted])

  return (
    <>
      <EnvironmentVariablesCheck />
    </>
  )
}

function RootLayoutNav() {
  const { isLoaded, isSignedIn } = useAuth()
  const segments = useSegments()
  const router = useRouter()
  const [showSplash, setShowSplash] = useState(true)
  const [isReady, setIsReady] = useState(false)

  const handleNavigationStateChange = useCallback(() => {
    if (!isReady) return

    const inAuthGroup = segments[0] === '(auth)'

    if (isSignedIn && inAuthGroup) {
      router.replace('/(home)')
    } else if (!isSignedIn && !inAuthGroup) {
      router.replace('/(auth)/sign-in')
    }
  }, [isReady, isSignedIn, segments, router])

  useEffect(() => {
    if (isLoaded && !showSplash) {
      setIsReady(true)
    }
  }, [isLoaded, showSplash])

  useEffect(() => {
    handleNavigationStateChange()
  }, [handleNavigationStateChange])

  if (!isReady) {
    return (
      <CustomSplashScreen onAnimationComplete={() => setShowSplash(false)} />
    )
  }

  return <Slot />
}

function ErrorFallback({ error, resetError }: any) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Something went wrong!</Text>
      <Text>{error.toString()}</Text>
      <TouchableOpacity onPress={resetError}>
        <Text>Try again</Text>
      </TouchableOpacity>
    </View>
  )
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync()
  }, [])

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ClerkProvider
          tokenCache={tokenCache}
          publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <FavoritesProvider>
                <NotificationsProvider />
                <RootLayoutNav />
              </FavoritesProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </ClerkProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  )
}