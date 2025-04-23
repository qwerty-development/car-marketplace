import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { AuthProvider, useAuth } from '@/utils/AuthContext'
import * as SplashScreen from 'expo-splash-screen'
import { FavoritesProvider } from '@/utils/useFavorites'
import { ThemeProvider } from '@/utils/ThemeContext'
import { QueryClient, QueryClientProvider } from 'react-query'
import { LogBox, View, Text, TouchableOpacity, Alert, Platform, Animated, StyleSheet, Dimensions } from 'react-native'
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
import { useCarDetails } from '@/hooks/useCarDetails';
import LogoLoader from '@/components/LogoLoader';

const { width, height } = Dimensions.get('window');

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

const DeepLinkHandler = () => {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { isGuest } = useGuestUser();
  const { prefetchCarDetails } = useCarDetails();

  // Track if a deep link is currently being processed to prevent duplicates
  const [isProcessingDeepLink, setIsProcessingDeepLink] = useState(false);

  useEffect(() => {
    const handleDeepLink = async ({ url }: { url: string }) => {
      if (!url || isProcessingDeepLink) return;

      console.log('Deep link received:', url);
      setIsProcessingDeepLink(true);

      try {
        const parsedUrl = Linking.parse(url);
        const { path, queryParams } = parsedUrl;

        console.log('Parsed URL:', { path, queryParams });

        // Handle Supabase Auth redirects
        if (url.includes("auth/callback") || url.includes("reset-password")) {
          console.log('Handling auth callback');
          const accessToken = queryParams?.access_token;
          const refreshToken = queryParams?.refresh_token;

          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken as string,
              refresh_token: refreshToken as string,
            });

            if (error) {
              console.error("Error setting session:", error);
            } else {
              console.log('Auth session set successfully');
            }
          }
          setIsProcessingDeepLink(false);
          return;
        }

        // Wait for auth to be loaded before handling navigation deep links
        if (!isLoaded) {
          console.log('Auth not loaded yet, deferring deep link handling');
          setIsProcessingDeepLink(false);
          return;
        }

        // Enhanced path parsing logic
        if (path) {
          // Match multiple URL patterns for car details
          const carIdMatch =
            path.match(/^cars\/(\d+)$/) || // cars/123
            path.match(/^\/cars\/(\d+)$/) || // /cars/123
            path.match(/^car\/(\d+)$/); // car/123

          // NEW: Match multiple URL patterns for autoclip details
          const clipIdMatch =
            path.match(/^clips\/(\d+)$/) || // clips/123
            path.match(/^\/clips\/(\d+)$/) || // /clips/123
            path.match(/^clip\/(\d+)$/); // clip/123

          const carId = carIdMatch ? carIdMatch[1] : null;
          const clipId = clipIdMatch ? clipIdMatch[1] : null;

          // Check authentication status - we'll reuse this for both car and clip
          const isEffectivelySignedIn = isSignedIn || isGuest;

          // Handle car deep links
          if (carId && !isNaN(Number(carId))) {
            console.log(`Navigating to car details for ID: ${carId}`);

            if (!isEffectivelySignedIn) {
              console.log('User not signed in, redirecting to sign-in first');
              // Store the intended destination for after sign-in
              global.pendingDeepLink = { type: 'car', id: carId };
              router.replace('/(auth)/sign-in');
              setIsProcessingDeepLink(false);
              return;
            }

            try {
              // Prefetch car details
              const prefetchedData = await prefetchCarDetails(carId);

              // Navigate with prefetched data
              router.push({
                pathname: "/(home)/(user)/CarDetails",
                params: {
                  carId,
                  isDealerView: 'false', // Default to user view for deep links
                  prefetchedData: prefetchedData ? JSON.stringify(prefetchedData) : undefined,
                  fromDeepLink: 'true'
                }
              });
            } catch (error) {
              console.error('Error prefetching car details:', error);

              // Fallback navigation without prefetched data
              router.push({
                pathname: "/(home)/(user)/CarDetails",
                params: {
                  carId,
                  isDealerView: 'false',
                  fromDeepLink: 'true'
                }
              });
            }
          } 
          // Handle autoclip deep links
          else if (clipId && !isNaN(Number(clipId))) {
            console.log(`Navigating to autoclip details for ID: ${clipId}`);
          
            if (!isEffectivelySignedIn) {
              global.pendingDeepLink = { type: 'autoclip', id: clipId };
              router.replace('/(auth)/sign-in');
              return;
            }
          
            // NEW: Validate clip existence
            try {
              const { data: clipExists, error } = await supabase
                .from('auto_clips')
                .select('id, status')
                .eq('id', clipId)
                .eq('status', 'published')
                .single();
              
              if (error || !clipExists) {
                Alert.alert(
                  'Content Not Available',
                  'This video is no longer available or has been removed.',
                  [{ text: 'OK', onPress: () => router.replace('/(home)/(user)') }]
                );
                return;
              }
          
              router.push({
                pathname: "/(home)/(user)/(tabs)/autoclips",
                params: {
                  clipId,
                  fromDeepLink: 'true'
                }
              });

              // router.replace({
              //   pathname: "/(home)/(user)/autoclip/[id]",
              //   params: { id: clipId }
              // });
            
            } catch (error) {
              console.error('Error checking clip existence:', error);
              Alert.alert('Error', 'Unable to load the requested content.');
              router.replace('/(home)/(user)');
            }
          }
          // Handle invalid paths
          else if (
            (path.startsWith('cars') || path.startsWith('/cars') || path.startsWith('car')) ||
            (path.startsWith('clips') || path.startsWith('/clips') || path.startsWith('clip'))
          ) {
            console.warn('Invalid ID in deep link:', path);
            Alert.alert('Invalid Link', 'The content you\'re looking for could not be found.');
          }
        }
      } catch (err) {
        console.error("Deep link error:", err);
      } finally {
        setIsProcessingDeepLink(false);
      }
    };

    // Set up the linking listener
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Check for initial URLs when app is opened via a link
    Linking.getInitialURL().then(url => {
      if (url) {
        console.log('App opened with initial URL:', url);
        handleDeepLink({ url });
      }
    }).catch(err => {
      console.error('Error getting initial URL:', err);
    });

    return () => {
      subscription.remove();
    };
  }, [router, isLoaded, isSignedIn, isGuest, prefetchCarDetails, isProcessingDeepLink]);

  // Handle sign-in completion - check for pending deep links
  useEffect(() => {
    if (isSignedIn && global.pendingDeepLink) {
      const { type, id } = global.pendingDeepLink;

      if (type === 'car' && id) {
        console.log('Processing pending car deep link after sign-in');
        router.push({
          pathname: "/(home)/(user)/CarDetails",
          params: { carId: id, isDealerView: 'false' }
        });
      }
      // NEW: Handle pending autoclip deep links
      else if (type === 'autoclip' && id) {
        console.log('Processing pending autoclip deep link after sign-in');
        router.push({
          pathname: "/(home)/(user)/(tabs)/autoclips",
          params: { clipId: id }
        });

        // router.replace({
        //   pathname: "/(home)/(user)/autoclip/[id]",
        //   params: { id: clipId }
        // });
      }
      }

      // Clear the pending link
      global.pendingDeepLink = null;
    }
  }, [isSignedIn, router]);

  // DeepLinkHandler implementation remains the same
  // ... (code unchanged)
  return null;
};


function EnvironmentVariablesCheck() {
  // EnvironmentVariablesCheck implementation remains the same
  // ... (code unchanged)
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
  const { isLoaded, isSignedIn, isSigningOut, isSigningIn } = useAuth();
  const { isGuest } = useGuestUser();
  const segments = useSegments();
  const router = useRouter();
  
  // Animation values for the curtain effect
  const [splashAnimationComplete, setSplashAnimationComplete] = useState(false);
  const curtainPosition = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  
  // Pre-compute authentication state only once per change
  const isEffectivelySignedIn = useMemo(() => 
    isSignedIn || isGuest, 
    [isSignedIn, isGuest]
  );
  
  const inAuthGroup = useMemo(() => 
    segments[0] === '(auth)', 
    [segments]
  );

  // Handle navigation state changes - but don't navigate during sign-out
  useEffect(() => {
    if (!isLoaded || isSigningOut || isSigningIn) return;
    
    if (isEffectivelySignedIn && inAuthGroup) {
      // Use the `any` type to bypass TypeScript strictness here
      // This is necessary because the router path is correct but TypeScript doesn't recognize it
      (router as any).replace('/(home)');
    } else if (!isEffectivelySignedIn && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    }
  }, [isLoaded, isEffectivelySignedIn, inAuthGroup, router, isSigningOut, isSigningIn]);

  // Handle the curtain animation when splash screen completes
  const handleSplashComplete = useCallback(() => {
    // Mark splash animation as complete
    setSplashAnimationComplete(true);
    
    // Start the curtain animation
    Animated.sequence([
      // First make sure content under the curtain is visible but with 0 opacity
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 0,
        useNativeDriver: true,
      }),
      // Then slide the curtain out to reveal content underneath
      Animated.timing(curtainPosition, {
        toValue: -width,
        duration: 600,
        useNativeDriver: true,
      })
    ]).start();
  }, [curtainPosition, contentOpacity]);

  // Show loader during authentication transitions
  if (!isLoaded || isSigningOut || isSigningIn) {
    return <LogoLoader />;
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Main content (visible when curtain slides away) */}
      <Animated.View 
        style={[
          styles.contentContainer,
          { opacity: contentOpacity }
        ]}
      >
        <Slot />
      </Animated.View>
      
      {/* Splash screen that acts as a curtain */}
      {!splashAnimationComplete ? (
        <CustomSplashScreen onAnimationComplete={handleSplashComplete} />
      ) : (
        <Animated.View
          style={[
            styles.curtain,
            { transform: [{ translateX: curtainPosition }] }
          ]}
        >
          {/* This is an empty view that slides out, revealing content underneath */}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  curtain: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'white', // or whatever color your splash screen ends with
    zIndex: 2,
  }
});

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
      <NetworkProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        
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
        
      </GestureHandlerRootView>
      </NetworkProvider>
    </ErrorBoundary>
  )
}