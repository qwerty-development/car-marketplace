import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { AuthProvider, useAuth } from '@/utils/AuthContext'
import * as SplashScreen from 'expo-splash-screen'
import { FavoritesProvider } from '@/utils/useFavorites'
import { ThemeProvider } from '@/utils/ThemeContext'
import { QueryClient, QueryClientProvider } from 'react-query'
import { LogBox, View, Text, TouchableOpacity, Alert, Platform, Animated, StyleSheet, Dimensions, useColorScheme, AppState } from 'react-native'
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
import { TextInput } from 'react-native';
import * as Updates from 'expo-updates';
import StatusBarManager from '@/components/StatusBarManager'


const { width, height } = Dimensions.get('window');

// Notification handler configuration
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    priority: Notifications.AndroidNotificationPriority.MAX,
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
  const { 
    unreadCount, 
    isPermissionGranted, 
    registerForPushNotifications, 
    diagnosticInfo 
  } = useNotifications();
  const { user, isSignedIn } = useAuth();
  const { isGuest } = useGuestUser();
  const [initAttempted, setInitAttempted] = useState(false);
  const [initError, setInitError] = useState<Error | null>(null);
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Enhanced initialization with better error handling and staged approach
  useEffect(() => {
    const initializeNotifications = async () => {
      if (!user?.id || isGuest || !isSignedIn || initAttempted) return;
      
      console.log('[NotificationsProvider] Initializing notifications for user:', user.id);
      setInitAttempted(true);
      
      try {
        // 1. First clear badge as a separate operation
        try {
          await Notifications.setBadgeCountAsync(0);
          console.log('[NotificationsProvider] Badge cleared successfully');
        } catch (badgeError) {
          console.warn('[NotificationsProvider] Non-critical: Failed to clear badge:', badgeError);
          // Continue initialization even if badge clearing fails
        }
        
        // 2. Set up notification channels for Android
        if (Platform.OS === 'android') {
          try {
            await Notifications.setNotificationChannelAsync('default', {
              name: 'Default',
              importance: Notifications.AndroidImportance.MAX,
              vibrationPattern: [0, 250, 250, 250],
              lightColor: '#D55004',
              sound: 'notification.wav',
              enableVibrate: true,
              enableLights: true,
              // Added for better visibility
              showBadge: true,
              lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC
            });
            console.log('[NotificationsProvider] Android notification channel configured');
          } catch (channelError) {
            console.warn('[NotificationsProvider] Error setting up notification channel:', channelError);
            // Continue as this is not critical for token registration
          }
        }
        
        // 3. Request permission and register for push notifications with forced flag
        const permissionStatus = await Notifications.getPermissionsAsync();
        
        if (permissionStatus.status !== 'granted') {
          console.log('[NotificationsProvider] Requesting notification permissions');
          const newStatus = await Notifications.requestPermissionsAsync();
          
          if (newStatus.status !== 'granted') {
            console.log('[NotificationsProvider] Permission denied by user');
            return;
          }
        }
        
        console.log('[NotificationsProvider] Registering for push notifications (forced)');
        await registerForPushNotifications(true);
        
        // 4. Schedule delayed verification to ensure registration was successful
        initTimeoutRef.current = setTimeout(async () => {
          try {
            // Verify token was properly registered
            const token = await SecureStore.getItemAsync('expoPushToken');
            
            if (token) {
              console.log('[NotificationsProvider] Token verification successful:', 
                token.substring(0, 10) + '...' + token.substring(token.length - 5));
            } else {
              console.warn('[NotificationsProvider] No token found in storage after registration');
              // Attempt one more registration as final recovery
              await registerForPushNotifications(true);
            }
          } catch (verifyError) {
            console.error('[NotificationsProvider] Verification error:', verifyError);
          }
        }, 5000);
        
      } catch (error) {
        console.error('[NotificationsProvider] Error initializing notifications:', error);
        setInitError(error instanceof Error ? error : new Error(String(error)));
        
        // Retry with exponential backoff
        const retryDelay = initError ? 10000 : 5000; // Longer delay on second attempt
        
        // Schedule retry
        initTimeoutRef.current = setTimeout(() => {
          console.log('[NotificationsProvider] Retrying notification initialization');
          setInitAttempted(false); // Reset to allow retry
        }, retryDelay);
      }
    };
    
    initializeNotifications();
    
    // Cleanup
    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
    };
  }, [user?.id, isSignedIn, isGuest, registerForPushNotifications, initAttempted, initError]);
  
  // Enhanced foreground notification handling
  useEffect(() => {
    if (!user?.id || isGuest) return;
    
    // Listen for app state changes to verify notification setup
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('[NotificationsProvider] App returned to foreground, verifying notifications');
        
        try {
          // Clear badges when coming to foreground
          await Notifications.setBadgeCountAsync(0);
          
          // Verify token exists locally
          const token = await SecureStore.getItemAsync('expoPushToken');
          
          if (!token) {
            console.warn('[NotificationsProvider] No token found when returning to foreground');
            // Retry registration if token is missing
            registerForPushNotifications(true).catch(e => 
              console.error('[NotificationsProvider] Foreground registration failed:', e)
            );
          }
        } catch (error) {
          console.error('[NotificationsProvider] Error handling foreground state:', error);
        }
      }
    });
    
    return () => {
      subscription.remove();
    };
  }, [user?.id, isGuest, registerForPushNotifications]);

  // Log diagnostic information in development
  useEffect(() => {
    if (__DEV__ && diagnosticInfo) {
      console.log('[NotificationsProvider] Diagnostic info:', diagnosticInfo);
    }
  }, [diagnosticInfo]);

  // Return existing EnvironmentVariablesCheck
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

  useEffect(() => {
    const prepareSplashScreen = async () => {
      try {
        // Keep native splash screen visible while custom splash loads
        await SplashScreen.preventAutoHideAsync();
        
        // On Android, set a timeout to force hide if something goes wrong
        if (Platform.OS === 'android') {
          setTimeout(() => {
            SplashScreen.hideAsync().catch(() => {
              // Silent catch in case it's already hidden
            });
          }, 3000); // Failsafe timeout
        }
      } catch (e) {
        console.warn('Error setting up splash screen:', e);
      }
    };
  
    prepareSplashScreen();
  }, []);


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
  ]).start(async () => {
    // When animation completes, hide the native splash screen
    try {
      await SplashScreen.hideAsync();
    } catch (e) {
      // Already hidden, ignore error
    }
  });
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
// Update this inside the first useEffect in RootLayout
useEffect(() => {
  const prepareSplashScreen = async () => {
    try {
      // Keep native splash screen visible while custom splash loads
      await SplashScreen.preventAutoHideAsync();
      
      // Configure notifications early
      try {
        // Ensure permissions are pre-checked to speed up later operations
        const permissionStatus = await Notifications.getPermissionsAsync();
        console.log('Initial notification permission status:', permissionStatus.status);
      } catch (notifError) {
        console.warn('Non-critical: Failed to check notification permissions:', notifError);
      }
      
      // On Android, set a timeout to force hide if something goes wrong
      if (Platform.OS === 'android') {
        setTimeout(() => {
          SplashScreen.hideAsync().catch(() => {
            // Silent catch in case it's already hidden
          });
        }, 3000); // Failsafe timeout
      }
    } catch (e) {
      console.warn('Error setting up splash screen:', e);
    }
  };
  
  prepareSplashScreen();
}, []);

  useEffect(() => {
    if (Text.defaultProps == null) Text.defaultProps = {};
    if (TextInput.defaultProps == null) TextInput.defaultProps = {};
    
    Text.defaultProps.allowFontScaling = false;
    TextInput.defaultProps.allowFontScaling = false;
  }, []);

  // Add this inside the export default function RootLayout()
useEffect(() => {
  // Clear badge count on every app launch
  const resetBadgeCount = async () => {
    try {
      await Notifications.setBadgeCountAsync(0);
      console.log('Badge count reset on app launch');
    } catch (error) {
      console.error('Failed to reset badge count:', error);
    }
  };
  
  resetBadgeCount();
}, []);

  // Check for OTA updates when the app starts
  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          console.log('Update available, downloading...');
          // Download the update
          const result = await Updates.fetchUpdateAsync();
          
          // If successful, reload the app to apply the update
          if (result.isNew) {
            Alert.alert(
              'Update Available',
              'A new version has been downloaded. The app will now restart to apply the update.',
              [
                {
                  text: 'OK',
                  onPress: async () => {
                    await Updates.reloadAsync();
                  }
                }
              ]
            );
          }
        } else {
          console.log('No updates available');
        }
      } catch (error) {
        // Handle error but don't crash the app
        console.error('Error checking for updates:', error);
      }
    };

    // Check for updates when the app starts
    checkForUpdates();
  }, []);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <NetworkProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <GuestUserProvider>
            <AuthProvider>
              <DeepLinkHandler />
              <QueryClientProvider client={queryClient}>
                <ThemeProvider>
                <StatusBarManager /> 
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