// app/_layout.tsx
import React, { useState, useEffect, useCallback } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { AuthProvider, useAuth } from '@/utils/AuthContext'
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
import { GuestUserProvider, useGuestUser } from '@/utils/GuestUserContext'
import * as Linking from 'expo-linking'
import { supabase } from '@/utils/supabase'
import NetworkProvider from '@/utils/NetworkContext'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
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

// Handle deep links for Supabase Auth
const DeepLinkHandler = () => {
  useEffect(() => {
    const handleDeepLink = async ({ url }: { url: string }) => {
      if (!url) return;
    
      try {
        const parsedUrl = Linking.parse(url);
        const { path, queryParams } = parsedUrl;
    
        // Handle Supabase Auth redirects
        if (url.includes("auth/callback") || url.includes("reset-password")) {
          const accessToken = queryParams?.access_token;
          const refreshToken = queryParams?.refresh_token;
    
          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken as string,
              refresh_token: refreshToken as string,
            });
    
            if (error) {
              console.error("Error setting session:", error);
            }
          }
        }
    
        // 🔥 Handle car deep links
        if (path?.startsWith("cars/")) {
          const carId = path.split("/")[1];
          if (carId) {
            // Use router after a short timeout to ensure navigation stack is ready
            setTimeout(() => {
              router.push({
                pathname: "/(home)/(user)/CarDetailModal",
                params: { carId },
              });
            }, 300);
          }
        }
    
      } catch (err) {
        console.error("Deep link error:", err);
      }
    };
    

    // Set up the linking listener
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Check for initial URLs
    Linking.getInitialURL().then(url => {
      if (url) handleDeepLink({ url });
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return null;
};

// Check if environment variables are set correctly
function EnvironmentVariablesCheck() {
  useEffect(() => {
    const projectId = process.env.EXPO_PUBLIC_PROJECT_ID;
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    if (!projectId) {
      console.error('⚠️ EXPO_PUBLIC_PROJECT_ID is missing from environment variables!');
      console.error('Push notifications will not work without this value.');
    }

    if (!supabaseUrl || !supabaseKey) {
      console.error('⚠️ Supabase configuration missing! Check your environment variables.');
      console.error('Authentication will not work correctly without these values.');
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
  const { isLoaded, isSignedIn } = useAuth();
  const { isGuest } = useGuestUser();
  const segments = useSegments();
  const router = useRouter();
  const [showSplash, setShowSplash] = useState(true);
  const [isReady, setIsReady] = useState(false);

  const handleNavigationStateChange = useCallback(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isEffectivelySignedIn = isSignedIn || isGuest;

    if (isEffectivelySignedIn && inAuthGroup) {
      router.replace('/(home)');
    } else if (!isEffectivelySignedIn && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    }
  }, [isReady, isSignedIn, isGuest, segments, router]);

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
        <NetworkProvider>
            <GuestUserProvider>
              <AuthProvider>
                <DeepLinkHandler />
                <QueryClientProvider client={queryClient}>
                  <ThemeProvider>
                    <FavoritesProvider>
                      <NotificationsProvider />
                      <RootLayoutNav />
                    </FavoritesProvider>
                  </ThemeProvider>
                </QueryClientProvider>
              </AuthProvider>
            </GuestUserProvider>
        </NetworkProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  )
}