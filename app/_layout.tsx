import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { AuthProvider, useAuth } from '@/utils/AuthContext'
import * as SplashScreen from 'expo-splash-screen'
import { FavoritesProvider } from '@/utils/useFavorites'
import { ThemeProvider } from '@/utils/ThemeContext'
import { QueryClient, QueryClientProvider } from 'react-query'
import { LogBox, View, Text, TouchableOpacity, Alert, Platform, Animated, StyleSheet, Dimensions, useColorScheme } from 'react-native'
import 'react-native-gesture-handler'
import 'react-native-get-random-values'
import { useNotifications } from '@/hooks/useNotifications'
import * as Notifications from 'expo-notifications'
import * as SecureStore from 'expo-secure-store'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import ErrorBoundary from 'react-native-error-boundary'
import CustomSplashScreen from './CustomSplashScreen'
import { GuestUserProvider, useGuestUser } from '@/utils/GuestUserContext'
import * as Linking from 'expo-linking'
import { supabase } from '@/utils/supabase'
import NetworkProvider from '@/utils/NetworkContext'
import { useCarDetails } from '@/hooks/useCarDetails';
import LogoLoader from '@/components/LogoLoader';
import { NotificationService } from '@/services/NotificationService'
import { isGlobalSigningOut } from '@/utils/AuthContext';


const { width, height } = Dimensions.get('window');

// Notification handler configuration
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Ignore specific warnings
LogBox.ignoreLogs([
  // Navigation warnings
  'Encountered two children with the same key',
  'Non-serializable values were found in the navigation state',
  
  // List warnings
  'VirtualizedLists should never be nested inside plain ScrollViews with the same orientation - use another VirtualizedList-backed container instead.',
  
  // Text rendering warnings
  'Text strings must be rendered within a <Text> component.',
  'Text strings must be rendered within a <Text> component',
  
  // Animation warnings
  'Sending `onAnimatedValueUpdate` with no listeners registered.',
  'Animated: `useNativeDriver` was not specified',
  
  // Shadow style warnings
  'shadowColor style may be ignored',
  
  // Reanimated warnings
  'Animated: `useNativeDriver` is not supported',
  'ViewPropTypes will be removed from React Native',
  
  // Lifecycle warnings
  'componentWillReceiveProps has been renamed',
  'componentWillMount has been renamed',
  
  // Deprecated API warnings
  'AsyncStorage has been extracted from react-native',
  
  // Network warnings 
  'Network request failed',
  
  // Expo warnings
  'FontAwesome Icons',
  'EventEmitter.removeListener',
  
  // Deep linking warnings
  'expo-linking requires a build-time setting `scheme` in your app config',
  
  // Performance warnings
  'Remote debugger is in a background tab',
  'Setting a timer for a long period of time'
])

LogBox.ignoreAllLogs();

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

// Global declaration for pending deep links
declare global {
  var pendingDeepLink: { type: string; id: string } | null;
}

/**
 * Simplified Deep Link Queue for managing multiple deep links
 */
class DeepLinkQueue {
  private queue: string[] = [];
  private processing = false;
  private readyToProcess = false;

  enqueue(url: string) {
    this.queue.push(url);
    this.processNextIfReady();
  }

  setReady() {
    this.readyToProcess = true;
    this.processNextIfReady();
  }

  private async processNextIfReady() {
    if (!this.readyToProcess || this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    const url = this.queue.shift();
    
    if (url && this.processUrlCallback) {
      try {
        await this.processUrlCallback(url);
      } catch (error) {
        console.error('Error processing queued deep link:', error);
      }
    }
    
    this.processing = false;
    
    // Process next if available
    if (this.queue.length > 0) {
      setTimeout(() => this.processNextIfReady(), 100);
    }
  }

  private processUrlCallback: ((url: string) => Promise<void>) | null = null;

  setProcessUrlCallback(callback: (url: string) => Promise<void>) {
    this.processUrlCallback = callback;
  }
}

// Singleton instance
const deepLinkQueue = new DeepLinkQueue();

/**
 * DeepLinkHandler: Optimized component for handling all deep link scenarios
 */
const DeepLinkHandler = () => {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { isGuest } = useGuestUser();
  const { prefetchCarDetails } = useCarDetails();

  // Track processing state
  const [isProcessingDeepLink, setIsProcessingDeepLink] = useState(false);
  
  // Track initial URL separately for closed app scenarios
  const [initialUrl, setInitialUrl] = useState<string | null>(null);
  const initialUrlProcessed = useRef(false);
  
  // Track initialization state
  const [isInitialized, setIsInitialized] = useState(false);
  const initializationTimeoutRef = useRef<NodeJS.Timeout>();

  /**
   * Process deep link with comprehensive error handling
   */
  const processDeepLink = useCallback(async (url: string, isInitialLink = false) => {
    if (!url || isProcessingDeepLink) return;

    console.log(`Processing ${isInitialLink ? 'initial' : 'runtime'} deep link:`, url);
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
        return;
      }

      // Wait for auth to be loaded before handling navigation deep links
      if (!isLoaded) {
        console.log('Auth not loaded yet, queueing deep link');
        deepLinkQueue.enqueue(url);
        return;
      }

      // Enhanced path parsing logic
      if (path) {
        // Match multiple URL patterns for car details
        const carIdMatch =
          path.match(/^cars\/(\d+)$/) || // cars/123
          path.match(/^\/cars\/(\d+)$/) || // /cars/123
          path.match(/^car\/(\d+)$/); // car/123

        // Match multiple URL patterns for autoclip details
        const clipIdMatch =
          path.match(/^clips\/(\d+)$/) || // clips/123
          path.match(/^\/clips\/(\d+)$/) || // /clips/123
          path.match(/^clip\/(\d+)$/); // clip/123

        const carId = carIdMatch ? carIdMatch[1] : null;
        const clipId = clipIdMatch ? clipIdMatch[1] : null;

        // Check authentication status
        const isEffectivelySignedIn = isSignedIn || isGuest;

        // Handle car deep links
        if (carId && !isNaN(Number(carId))) {
          console.log(`Navigating to car details for ID: ${carId}`);

          if (!isEffectivelySignedIn) {
            console.log('User not signed in, redirecting to sign-in first');
            // Store the intended destination for after sign-in
            global.pendingDeepLink = { type: 'car', id: carId };
            router.replace('/(auth)/sign-in');
            return;
          }

          try {
            // Add small delay when app is launched from closed state to let UI stabilize
            if (isInitialLink) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
            
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
        
          // Add small delay when app is launched from closed state to let UI stabilize
          if (isInitialLink) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
          // Validate clip existence
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
                [{ text: 'OK', onPress: () => router.replace('/(home)/(user)' as any) }]
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
          } catch (error) {
            console.error('Error checking clip existence:', error);
            Alert.alert('Error', 'Unable to load the requested content.');
            router.replace('/(home)/(user)' as any);
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
      console.error("Deep link processing error:", err);
      Alert.alert('Error', 'Unable to process the link. Please try again.');
    } finally {
      setIsProcessingDeepLink(false);
    }
  }, [router, isLoaded, isSignedIn, isGuest, prefetchCarDetails]);

  /**
   * Handle initial app launch with deep link
   */
  useEffect(() => {
    Linking.getInitialURL().then(url => {
      if (url) {
        console.log('App opened with initial URL:', url);
        setInitialUrl(url);
      }
    }).catch(err => {
      console.error('Error getting initial URL:', err);
    });
  }, []);

  /**
   * Process initial URL when auth is loaded
   */
  useEffect(() => {
    if (initialUrl && isLoaded && !initialUrlProcessed.current) {
      initialUrlProcessed.current = true;
      console.log('Processing initial URL after auth loaded:', initialUrl);
      processDeepLink(initialUrl, true);
    }
  }, [initialUrl, isLoaded, processDeepLink]);

  /**
   * Set up deep link queue processor
   */
  useEffect(() => {
    deepLinkQueue.setProcessUrlCallback(processDeepLink);
  }, [processDeepLink]);

  /**
   * Mark initialization complete when app is ready
   */
  useEffect(() => {
    if (isLoaded) {
      // Add a small delay to ensure navigation tree is ready
      initializationTimeoutRef.current = setTimeout(() => {
        setIsInitialized(true);
        deepLinkQueue.setReady();
      }, 300);
    }

    return () => {
      if (initializationTimeoutRef.current) {
        clearTimeout(initializationTimeoutRef.current);
      }
    };
  }, [isLoaded]);

  /**
   * Set up the linking listener for when app is in the background
   */
  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (isInitialized) {
        processDeepLink(url);
      } else {
        console.log('App not initialized, queuing deep link');
        deepLinkQueue.enqueue(url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isInitialized, processDeepLink]);

  /**
   * Handle sign-in completion - check for pending deep links
   */
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
      else if (type === 'autoclip' && id) {
        console.log('Processing pending autoclip deep link after sign-in');
        router.push({
          pathname: "/(home)/(user)/(tabs)/autoclips",
          params: { clipId: id }
        });
      }

      // Clear the pending link
      global.pendingDeepLink = null;
    }
  }, [isSignedIn, router]);


  useEffect(() => {
    const clearBadge = async () => {
      try {
        await Notifications.setBadgeCountAsync(0);
        console.log('Badge cleared on app launch');
      } catch (err) {
        console.error('Failed to clear badge:', err);
      }
    };
  
    clearBadge();
  }, []);
  

  return null;
};

function EnvironmentVariablesCheck() {
  // EnvironmentVariablesCheck implementation remains the same
  return null;
}

function NotificationsProvider() {
  const { unreadCount, isPermissionGranted, registerForPushNotifications } = useNotifications();
  const { user, isSignedIn } = useAuth();
  const { isGuest } = useGuestUser();
  const [isInitializing, setIsInitializing] = useState(false);
  const initializationRef = useRef(false);


useEffect(() => {
  const initializeNotifications = async () => {
    // Prevent multiple initializations
    if (initializationRef.current || isInitializing) return;
    
    // Skip if user is not authenticated or is guest
    if (!isSignedIn || isGuest || !user?.id) return;

    // Skip during sign-out
    if (isGlobalSigningOut) {
      console.log('Skipping notification initialization during sign-out');
      return;
    }

    try {
      setIsInitializing(true);
      initializationRef.current = true;

      console.log('Initializing notification system on app startup');

      // Verify token status on app startup
      const localToken = await SecureStore.getItemAsync('expoPushToken');
      
      if (localToken && !isGlobalSigningOut) {
        // Use enhanced verification method instead of direct query
        const verification = await NotificationService.forceTokenVerification(user.id);

        if (!verification.isValid) {
          console.log('Token verification failed during startup, initiating registration');
          if (!isGlobalSigningOut) {
            await registerForPushNotifications(true);
          }
        } else if (verification.signedIn === false) {
          console.log('Token exists but signed_in is false during startup, updating');
          await NotificationService.markTokenAsSignedIn(user.id, verification.token);
        }
      } else if (!isGlobalSigningOut) {
        console.log('No local token found during startup, initiating registration');
        await registerForPushNotifications(true);
      }
    } catch (error) {
      console.error('Error initializing notifications on startup:', error);
    } finally {
      setIsInitializing(false);
    }
  };

  if (!isGlobalSigningOut) {
    initializeNotifications();
  }
}, [isSignedIn, isGuest, user?.id, registerForPushNotifications]);

  useEffect(() => {
    console.log('Notification state:', { unreadCount, isPermissionGranted });
  }, [unreadCount, isPermissionGranted]);

  return <EnvironmentVariablesCheck />;
}

function RootLayoutNav() {
  const { isLoaded, isSignedIn, isSigningOut, isSigningIn } = useAuth();
  const { isGuest } = useGuestUser();
  const segments = useSegments();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  
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
    { 
      backgroundColor: isDarkMode ? '#000000' : '#FFFFFF',
      transform: [{ translateX: curtainPosition }] 
    }
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