// app/_layout.tsx - OPTIMIZED VERSION
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
import { notificationCache, NotificationCacheManager } from '@/utils/NotificationCacheManager'
import { notificationCoordinator } from '@/utils/NotificationOperationCoordinator'

const { width, height } = Dimensions.get('window');

// OPTIMIZATION 1: Consolidated notification handler configuration
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

// Ignore warnings configuration remains the same
LogBox.ignoreLogs([
  'Encountered two children with the same key',
  'Non-serializable values were found in the navigation state',
  'VirtualizedLists should never be nested inside plain ScrollViews with the same orientation - use another VirtualizedList-backed container instead.',
  'Text strings must be rendered within a <Text> component.',
  'Text strings must be rendered within a <Text> component',
  'Sending `onAnimatedValueUpdate` with no listeners registered.',
  'Animated: `useNativeDriver` was not specified',
  'shadowColor style may be ignored',
  'Animated: `useNativeDriver` is not supported',
  'ViewPropTypes will be removed from React Native',
  'componentWillReceiveProps has been renamed',
  'componentWillMount has been renamed',
  'AsyncStorage has been extracted from react-native',
  'Network request failed',
  'FontAwesome Icons',
  'EventEmitter.removeListener',
  'expo-linking requires a build-time setting `scheme` in your app config',
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

// DeepLinkQueue and DeepLinkHandler remain the same...
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
    
    if (this.queue.length > 0) {
      setTimeout(() => this.processNextIfReady(), 100);
    }
  }

  private processUrlCallback: ((url: string) => Promise<void>) | null = null;

  setProcessUrlCallback(callback: (url: string) => Promise<void>) {
    this.processUrlCallback = callback;
  }
}

const deepLinkQueue = new DeepLinkQueue();

// OPTIMIZATION 2: DeepLinkHandler - Remove redundant badge clearing
const DeepLinkHandler = () => {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { isGuest } = useGuestUser();
  const { prefetchCarDetails } = useCarDetails();

  const [isProcessingDeepLink, setIsProcessingDeepLink] = useState(false);
  const [initialUrl, setInitialUrl] = useState<string | null>(null);
  const initialUrlProcessed = useRef(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const initializationTimeoutRef = useRef<NodeJS.Timeout>();

  const processDeepLink = useCallback(async (url: string, isInitialLink = false) => {
    if (!url || isProcessingDeepLink) return;

    console.log(`Processing ${isInitialLink ? 'initial' : 'runtime'} deep link:`, url);
    setIsProcessingDeepLink(true);

    try {
      const parsedUrl = Linking.parse(url);
      const { path, queryParams } = parsedUrl;

      console.log('Parsed URL:', { path, queryParams });

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

      if (!isLoaded) {
        console.log('Auth not loaded yet, queueing deep link');
        deepLinkQueue.enqueue(url);
        return;
      }

      if (path) {
        const carIdMatch =
          path.match(/^cars\/(\d+)$/) ||
          path.match(/^\/cars\/(\d+)$/) ||
          path.match(/^car\/(\d+)$/);

        const clipIdMatch =
          path.match(/^clips\/(\d+)$/) ||
          path.match(/^\/clips\/(\d+)$/) ||
          path.match(/^clip\/(\d+)$/);

        const carId = carIdMatch ? carIdMatch[1] : null;
        const clipId = clipIdMatch ? clipIdMatch[1] : null;

        const isEffectivelySignedIn = isSignedIn || isGuest;

        if (carId && !isNaN(Number(carId))) {
          console.log(`Navigating to car details for ID: ${carId}`);

          if (!isEffectivelySignedIn) {
            console.log('User not signed in, redirecting to sign-in first');
            global.pendingDeepLink = { type: 'car', id: carId };
            router.replace('/(auth)/sign-in');
            return;
          }

          try {
            if (isInitialLink) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            const prefetchedData = await prefetchCarDetails(carId);

            router.push({
              pathname: "/(home)/(user)/CarDetails",
              params: {
                carId,
                isDealerView: 'false',
                prefetchedData: prefetchedData ? JSON.stringify(prefetchedData) : undefined,
                fromDeepLink: 'true'
              }
            });
          } catch (error) {
            console.error('Error prefetching car details:', error);

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
        else if (clipId && !isNaN(Number(clipId))) {
          console.log(`Navigating to autoclip details for ID: ${clipId}`);
        
          if (!isEffectivelySignedIn) {
            global.pendingDeepLink = { type: 'autoclip', id: clipId };
            router.replace('/(auth)/sign-in');
            return;
          }
        
          if (isInitialLink) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
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

  useEffect(() => {
    if (initialUrl && isLoaded && !initialUrlProcessed.current) {
      initialUrlProcessed.current = true;
      console.log('Processing initial URL after auth loaded:', initialUrl);
      processDeepLink(initialUrl, true);
    }
  }, [initialUrl, isLoaded, processDeepLink]);

  useEffect(() => {
    deepLinkQueue.setProcessUrlCallback(processDeepLink);
  }, [processDeepLink]);

  useEffect(() => {
    if (isLoaded) {
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

      global.pendingDeepLink = null;
    }
  }, [isSignedIn, router]);

  // REMOVED: Redundant badge clearing - handled centrally in RootLayout
  return null;
};

function EnvironmentVariablesCheck() {
  return null;
}

// OPTIMIZATION 3: Enhanced NotificationsProvider with cache and coordination
function NotificationsProvider() {
  const { 
    unreadCount, 
    isPermissionGranted, 
    registerForPushNotifications, 
    diagnosticInfo 
  } = useNotifications();
  const { user, isSignedIn } = useAuth();
  const { isGuest } = useGuestUser();
  const [initializationState, setInitializationState] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const initRetryCount = useRef(0);
  const MAX_INIT_RETRIES = 2;
  
  // RULE 1: Use operation coordinator for initialization
  const operationKey = useMemo(() => 
    user?.id ? `notification_init_${user.id}` : null,
    [user?.id]
  );

  // RULE 2: Coordinated initialization with better state management
  useEffect(() => {
    const initializeNotifications = async () => {
      if (!user?.id || isGuest || !isSignedIn || !operationKey) return;
      
      // Check if already initialized or running
      if (initializationState === 'completed' || initializationState === 'running') {
        console.log('[NotificationsProvider] Initialization already completed or in progress');
        return;
      }
      
      try {
        await notificationCoordinator.executeExclusive(operationKey, async (signal) => {
          console.log('[NotificationsProvider] Starting coordinated initialization');
          setInitializationState('running');
          
          // Check for cancellation
          notificationCoordinator.checkAborted(signal);
          
          // RULE 3: Set up Android channel once
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
                showBadge: true,
                lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC
              });
              console.log('[NotificationsProvider] Android channel configured');
            } catch (channelError) {
              console.warn('[NotificationsProvider] Channel setup error (non-critical):', channelError);
            }
          }
          
          // RULE 4: Check cached permissions first
          let cachedPermissions = notificationCache.get<Notifications.NotificationPermissionsStatus>(
            NotificationCacheManager.keys.permissions()
          );
          
          if (!cachedPermissions) {
            cachedPermissions = await Notifications.getPermissionsAsync();
            if (cachedPermissions) {
              notificationCache.set(
                NotificationCacheManager.keys.permissions(),
                cachedPermissions,
                10 * 60 * 1000 // 10 minutes
              );
            }
          }
          
          if (cachedPermissions?.status !== 'granted') {
            console.log('[NotificationsProvider] Requesting permissions');
            const newPermissions = await Notifications.requestPermissionsAsync();
            
            if (newPermissions?.status !== 'granted') {
              console.log('[NotificationsProvider] Permission denied');
              setInitializationState('failed');
              return;
            }
            
            // Update cache
            notificationCache.set(
              NotificationCacheManager.keys.permissions(),
              newPermissions,
              10 * 60 * 1000
            );
          }
          
          // RULE 5: Register with force flag
          console.log('[NotificationsProvider] Registering for push notifications');
          await registerForPushNotifications(true);
          
          setInitializationState('completed');
          initRetryCount.current = 0;
          
          // RULE 6: Verify after delay
          setTimeout(async () => {
            if (signal.aborted) return;
            
            const token = await SecureStore.getItemAsync('expoPushToken');
            if (!token) {
              console.warn('[NotificationsProvider] No token after registration, retrying');
              if (initRetryCount.current < MAX_INIT_RETRIES) {
                initRetryCount.current++;
                setInitializationState('idle'); // Reset to trigger retry
              }
            }
          }, 5000);
        });
      } catch (error: any) {
        if (error.message !== 'Operation cancelled') {
          console.error('[NotificationsProvider] Initialization error:', error);
          setInitializationState('failed');
          
          // Schedule retry if under limit
          if (initRetryCount.current < MAX_INIT_RETRIES) {
            initRetryCount.current++;
            setTimeout(() => {
              setInitializationState('idle');
            }, 5000 * Math.pow(2, initRetryCount.current));
          }
        }
      }
    };
    
    initializeNotifications();
  }, [user?.id, isSignedIn, isGuest, registerForPushNotifications, operationKey, initializationState]);
  
  // RULE 7: Optimized foreground handling
  useEffect(() => {
    if (!user?.id || isGuest) return;
    
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active' && initializationState === 'completed') {
        console.log('[NotificationsProvider] App active, checking token status');
        
        // Use cached verification
        const cachedVerification = notificationCache.getCachedTokenVerification(user.id);
        
        if (!cachedVerification || !cachedVerification.isValid) {
          const token = await SecureStore.getItemAsync('expoPushToken');
          if (!token) {
            console.warn('[NotificationsProvider] No token on foreground');
            setInitializationState('idle'); // Trigger re-initialization
          }
        }
      }
    });
    
    return () => {
      subscription.remove();
    };
  }, [user?.id, isGuest, initializationState]);

  // RULE 8: Development diagnostics
  useEffect(() => {
    if (__DEV__ && diagnosticInfo) {
      console.log('[NotificationsProvider] Diagnostic info:', diagnosticInfo);
    }
  }, [diagnosticInfo]);

  return <EnvironmentVariablesCheck />;
}

// RootLayoutNav remains mostly the same...
function RootLayoutNav() {
  const { isLoaded, isSignedIn, isSigningOut, isSigningIn } = useAuth();
  const { isGuest } = useGuestUser();
  const segments = useSegments();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  
  const [splashAnimationComplete, setSplashAnimationComplete] = useState(false);
  const curtainPosition = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  
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
        await SplashScreen.preventAutoHideAsync();
        
        if (Platform.OS === 'android') {
          setTimeout(() => {
            SplashScreen.hideAsync().catch(() => {});
          }, 3000);
        }
      } catch (e) {
        console.warn('Error setting up splash screen:', e);
      }
    };
  
    prepareSplashScreen();
  }, []);

  useEffect(() => {
    if (!isLoaded || isSigningOut || isSigningIn) return;
    
    if (isEffectivelySignedIn && inAuthGroup) {
      (router as any).replace('/(home)');
    } else if (!isEffectivelySignedIn && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    }
  }, [isLoaded, isEffectivelySignedIn, inAuthGroup, router, isSigningOut, isSigningIn]);

  const handleSplashComplete = useCallback(() => {
    setSplashAnimationComplete(true);
    
    Animated.sequence([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 0,
        useNativeDriver: true,
      }),
      Animated.timing(curtainPosition, {
        toValue: -width,
        duration: 600,
        useNativeDriver: true,
      })
    ]).start(async () => {
      try {
        await SplashScreen.hideAsync();
      } catch (e) {}
    });
  }, [curtainPosition, contentOpacity]);

  if (!isLoaded || isSigningOut || isSigningIn) {
    return <LogoLoader />;
  }

  return (
    <View style={{ flex: 1 }}>
      <Animated.View 
        style={[
          styles.contentContainer,
          { opacity: contentOpacity }
        ]}
      >
        <Slot />
      </Animated.View>
      
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
        />
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
    backgroundColor: 'white',
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

// OPTIMIZATION 4: Main RootLayout with consolidated initialization
export default function RootLayout() {
  // RULE 1: Single badge clearing operation on app launch
  const badgeClearingRef = useRef(false);
  
  // RULE 2: Consolidated app initialization
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Keep splash screen visible
        await SplashScreen.preventAutoHideAsync();
        
        // RULE 3: Single badge clear operation
        if (!badgeClearingRef.current) {
          badgeClearingRef.current = true;
          try {
            await Notifications.setBadgeCountAsync(0);
            console.log('[RootLayout] Badge cleared on app launch');
          } catch (badgeError) {
            console.warn('[RootLayout] Non-critical: Badge clear failed:', badgeError);
          }
        }
        
        // RULE 4: Cache initial permission status
        try {
          const permissionStatus = await Notifications.getPermissionsAsync();
          console.log('[RootLayout] Initial permission status:', permissionStatus.status);
          
          // Cache the result
          notificationCache.set(
            NotificationCacheManager.keys.permissions(),
            permissionStatus,
            10 * 60 * 1000 // 10 minutes
          );
        } catch (notifError) {
          console.warn('[RootLayout] Non-critical: Permission check failed:', notifError);
        }
        
        // Android failsafe
        if (Platform.OS === 'android') {
          setTimeout(() => {
            SplashScreen.hideAsync().catch(() => {});
          }, 3000);
        }
      } catch (e) {
        console.warn('[RootLayout] Initialization error:', e);
      }
    };
    
    initializeApp();
  }, []);

  // RULE 5: Text scaling settings
  useEffect(() => {
    if (Text.defaultProps == null) Text.defaultProps = {};
    if (TextInput.defaultProps == null) TextInput.defaultProps = {};
    
    Text.defaultProps.allowFontScaling = false;
    TextInput.defaultProps.allowFontScaling = false;
  }, []);

  // RULE 6: OTA updates check
  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          console.log('[RootLayout] Update available, downloading...');
          const result = await Updates.fetchUpdateAsync();
          
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
          console.log('[RootLayout] No updates available');
        }
      } catch (error) {
        console.error('[RootLayout] Update check error:', error);
      }
    };

    checkForUpdates();
  }, []);

  // RULE 7: Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up notification resources on app unmount
      notificationCoordinator.cleanup();
      // Note: Don't destroy cache here as it's a singleton
    };
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