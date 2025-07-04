
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { AuthProvider, useAuth } from "@/utils/AuthContext";
import * as SplashScreen from "expo-splash-screen";
import { FavoritesProvider } from "@/utils/useFavorites";
import { ThemeProvider, useTheme } from "@/utils/ThemeContext";
import { QueryClient, QueryClientProvider } from "react-query";
import {
  LogBox,
  View,
  Text,
  TouchableOpacity,
  Alert,
  Platform,
  Animated,
  StyleSheet,
  Dimensions,
  useColorScheme,
  AppState,
  ActivityIndicator,
} from "react-native";
import "react-native-gesture-handler";
import "react-native-get-random-values";
import { useNotifications } from "@/hooks/useNotifications";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import ErrorBoundary from "react-native-error-boundary";
import CustomSplashScreen from "./CustomSplashScreen";
import { GuestUserProvider, useGuestUser } from "@/utils/GuestUserContext";
import * as Linking from "expo-linking";
import { supabase } from "@/utils/supabase";
import NetworkProvider from "@/utils/NetworkContext";
import { useCarDetails } from "@/hooks/useCarDetails";
import LogoLoader from "@/components/LogoLoader";
import { NotificationService } from "@/services/NotificationService";
import { isGlobalSigningOut } from "@/utils/AuthContext";
import { TextInput } from "react-native";
import * as Updates from "expo-updates";
import StatusBarManager from "@/components/StatusBarManager";
import {
  notificationCache,
  NotificationCacheManager,
} from "@/utils/NotificationCacheManager";
import { notificationCoordinator } from "@/utils/NotificationOperationCoordinator";
import ModernUpdateAlert from "./update-alert";

const { width, height } = Dimensions.get("window");

// CRITICAL SYSTEM: Notification handler configuration
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

// SYSTEM CONFIGURATION: Ignore warnings
LogBox.ignoreLogs([
  "Encountered two children with the same key",
  "Non-serializable values were found in the navigation state",
  "VirtualizedLists should never be nested inside plain ScrollViews with the same orientation - use another VirtualizedList-backed container instead.",
  "Text strings must be rendered within a <Text> component.",
  "Text strings must be rendered within a <Text> component",
  "Sending `onAnimatedValueUpdate` with no listeners registered.",
  "Animated: `useNativeDriver` was not specified",
  "shadowColor style may be ignored",
  "Animated: `useNativeDriver` is not supported",
  "ViewPropTypes will be removed from React Native",
  "componentWillReceiveProps has been renamed",
  "componentWillMount has been renamed",
  "AsyncStorage has been extracted from react-native",
  "Network request failed",
  "FontAwesome Icons",
  "EventEmitter.removeListener",
  "expo-linking requires a build-time setting `scheme` in your app config",
  "Remote debugger is in a background tab",
  "Setting a timer for a long period of time",
]);

LogBox.ignoreAllLogs();

// CRITICAL SYSTEM: Prevent auto-hiding splash screen
SplashScreen.preventAutoHideAsync();

// PERSISTENT CONFIGURATION: QueryClient setup
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    },
  },
});

// GLOBAL SYSTEM: Deep link state management
declare global {
  var pendingDeepLink: { type: string; id: string } | null;
}

// CRITICAL SYSTEM: Initialization state management
interface InitializationState {
  auth: boolean;
  notifications: boolean;
  splash: boolean;
  deepLinks: boolean;
  permissions: boolean;
}

// TIMEOUT CONSTANTS: Prevent infinite loading
const INITIALIZATION_TIMEOUT = 15000; // 15 seconds maximum wait
const SPLASH_MIN_DURATION = 1000; // Minimum 1 second splash

// CRITICAL CLASS: InitializationManager
class InitializationManager {
  private state: InitializationState = {
    auth: false,
    notifications: false,
    splash: false,
    deepLinks: false,
    permissions: false,
  };
  
  private callbacks: Set<() => void> = new Set();
  private timeoutId: NodeJS.Timeout | null = null;
  private startTime: number = Date.now();

  constructor() {
    // MANDATORY TIMEOUT: Prevent infinite loading
    this.timeoutId = setTimeout(() => {
      console.warn('[InitManager] TIMEOUT: Forcing completion after 15 seconds');
      this.forceComplete();
    }, INITIALIZATION_TIMEOUT);
  }

  // METHOD: Set component ready state
  setReady(component: keyof InitializationState): void {
    console.log(`[InitManager] Component ready: ${component}`);
    this.state[component] = true;
    this.checkComplete();
  }

  // PRIVATE METHOD: Check if all components ready
  private checkComplete(): void {
    const allReady = Object.values(this.state).every(ready => ready);
    const minTimeElapsed = Date.now() - this.startTime >= SPLASH_MIN_DURATION;
    
    if (allReady && minTimeElapsed) {
      this.complete();
    } else if (allReady && !minTimeElapsed) {
      // RULE: Wait for minimum splash duration
      setTimeout(() => {
        this.complete();
      }, SPLASH_MIN_DURATION - (Date.now() - this.startTime));
    }
  }

  // PRIVATE METHOD: Complete initialization
  private complete(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    
    console.log('[InitManager] Initialization complete - App ready');
    this.callbacks.forEach(callback => callback());
    this.callbacks.clear();
  }

  // PRIVATE METHOD: Force completion on timeout
  private forceComplete(): void {
    // CRITICAL: Force all states to complete
    Object.keys(this.state).forEach(key => {
      this.state[key as keyof InitializationState] = true;
    });
    this.complete();
  }

  // METHOD: Register completion callback
  onComplete(callback: () => void): void {
    this.callbacks.add(callback);
  }

  // METHOD: Get initialization status
  getStatus(): InitializationState {
    return { ...this.state };
  }
}

// GLOBAL INSTANCE: Initialization manager
const initManager = new InitializationManager();

// CRITICAL CLASS: DeepLinkQueue with timeout protection
class DeepLinkQueue {
  private queue: string[] = [];
  private processing = false;
  private readyToProcess = false;
  private processTimeout: NodeJS.Timeout | null = null;

  // METHOD: Add URL to queue
  enqueue(url: string) {
    this.queue.push(url);
    this.processNextIfReady();
  }

  // METHOD: Mark queue as ready
  setReady() {
    this.readyToProcess = true;
    initManager.setReady('deepLinks');
    this.processNextIfReady();
  }

  // PRIVATE METHOD: Process next URL if ready
  private async processNextIfReady() {
    if (!this.readyToProcess || this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    const url = this.queue.shift();

    if (url && this.processUrlCallback) {
      try {
        // TIMEOUT PROTECTION: 5 second limit for deep link processing
        this.processTimeout = setTimeout(() => {
          console.warn('[DeepLinkQueue] TIMEOUT: Processing timeout, skipping URL:', url);
          this.processing = false;
          this.processNextIfReady();
        }, 5000);

        await this.processUrlCallback(url);
        
        if (this.processTimeout) {
          clearTimeout(this.processTimeout);
          this.processTimeout = null;
        }
      } catch (error) {
        console.error("Error processing queued deep link:", error);
      }
    }

    this.processing = false;

    if (this.queue.length > 0) {
      setTimeout(() => this.processNextIfReady(), 100);
    }
  }

  private processUrlCallback: ((url: string) => Promise<void>) | null = null;

  // METHOD: Set URL processing callback
  setProcessUrlCallback(callback: (url: string) => Promise<void>) {
    this.processUrlCallback = callback;
  }
}

// GLOBAL INSTANCE: Deep link queue
const deepLinkQueue = new DeepLinkQueue();

// Optimized DeepLinkHandler component for app/_layout.tsx
// This version prevents 404 flash and improves Android performance

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
  
  // Add state to track if we're handling a deep link to prevent 404
  const [isHandlingDeepLink, setIsHandlingDeepLink] = useState(false);

  const processDeepLink = useCallback(
    async (url: string, isInitialLink = false) => {
      if (!url || isProcessingDeepLink) return;

      console.log(
        `[DeepLink] Processing ${isInitialLink ? "initial" : "runtime"} link:`,
        url,
        `Platform: ${Platform.OS}`
      );
      
      // Set handling flag immediately to prevent 404
      setIsHandlingDeepLink(true);
      setIsProcessingDeepLink(true);

      try {
        const parsedUrl = Linking.parse(url);
        const { hostname, path, queryParams } = parsedUrl;

        console.log("[DeepLink] Parsed URL:", { hostname, path, queryParams });

        // Handle auth callbacks
        if (url.includes("auth/callback") || url.includes("reset-password")) {
          console.log("[DeepLink] Handling auth callback");
          setIsHandlingDeepLink(false);
          const accessToken = queryParams?.access_token;
          const refreshToken = queryParams?.refresh_token;

          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken as string,
              refresh_token: refreshToken as string,
            });

            if (error) {
              console.error("[DeepLink] Error setting session:", error);
            } else {
              console.log("[DeepLink] Auth session set successfully");
            }
          }
          return;
        }

        // Wait for auth to be loaded
        if (!isLoaded) {
          console.log("[DeepLink] Auth not loaded, queueing deep link");
          deepLinkQueue.enqueue(url);
          setIsHandlingDeepLink(false);
          return;
        }

        // Parse the path based on platform-specific URL formats
        let pathToProcess = '';
        
        if (Platform.OS === 'android') {
          // Android: Handle fleet://cars/123 format where hostname='cars' and path='123'
          if (hostname && !path?.includes(hostname)) {
            pathToProcess = hostname + (path ? '/' + path : '');
          } else {
            pathToProcess = path || hostname || '';
          }
        } else {
          // iOS: Standard path parsing
          pathToProcess = path || '';
        }

        if (pathToProcess) {
          // Normalize path for better matching
          const normalizedPath = pathToProcess.toLowerCase().replace(/^\/+/, '');
          console.log(`[DeepLink - ${Platform.OS}] Processing normalized path:`, normalizedPath);

          // Extract ID from various path formats
          let carId: string | null = null;
          let clipId: string | null = null;

          // Match patterns like: cars/123, car/123, /cars/123, etc.
          const carMatch = normalizedPath.match(/^(?:\/)?cars?\/(\d+)$/);
          const clipMatch = normalizedPath.match(/^(?:\/)?(?:clips?|autoclips?)\/(\d+)$/);

          if (carMatch) {
            carId = carMatch[1];
          } else if (clipMatch) {
            clipId = clipMatch[1];
          }

          const isEffectivelySignedIn = isSignedIn || isGuest;

          // Handle car deep links
          if (carId && !isNaN(Number(carId))) {
            console.log(`[DeepLink] Navigating to car details for ID: ${carId}`);

            if (!isEffectivelySignedIn) {
              console.log("[DeepLink] User not signed in, redirecting to sign-in first");
              global.pendingDeepLink = { type: "car", id: carId };
              router.replace("/(auth)/sign-in");
              setIsHandlingDeepLink(false);
              return;
            }

            try {
              // Optimized navigation for both platforms
              if (Platform.OS === 'android' && isInitialLink) {
                // Android: Faster navigation with reduced delays
                console.log("[DeepLink] Android: Optimized navigation sequence");
                
                // First, prefetch the data while setting up navigation
                const prefetchPromise = prefetchCarDetails(carId);
                
                // Navigate to base route quickly
                router.replace("/(home)/(user)");
                
                // Small delay for route to establish
                await new Promise((resolve) => setTimeout(resolve, 150));
                
                // Get prefetched data
                const prefetchedData = await prefetchPromise;
                
                // Navigate to specific car
                router.push({
                  pathname: "/(home)/(user)/CarDetails",
                  params: {
                    carId,
                    isDealerView: "false",
                    prefetchedData: prefetchedData
                      ? JSON.stringify(prefetchedData)
                      : undefined,
                    fromDeepLink: "true",
                  },
                });
              } else {
                // iOS: Direct navigation
                const prefetchedData = await prefetchCarDetails(carId);
                
                router.push({
                  pathname: "/(home)/(user)/CarDetails",
                  params: {
                    carId,
                    isDealerView: "false",
                    prefetchedData: prefetchedData
                      ? JSON.stringify(prefetchedData)
                      : undefined,
                    fromDeepLink: "true",
                  },
                });
              }
            } catch (error) {
              console.error("[DeepLink] Error navigating to car details:", error);
              
              // Fallback navigation
              router.push({
                pathname: "/(home)/(user)/CarDetails",
                params: {
                  carId,
                  isDealerView: "false",
                  fromDeepLink: "true",
                },
              });
            }
          } 
          // Handle clip deep links
          else if (clipId && !isNaN(Number(clipId))) {
            console.log(`[DeepLink] Navigating to autoclip details for ID: ${clipId}`);

            if (!isEffectivelySignedIn) {
              global.pendingDeepLink = { type: "autoclip", id: clipId };
              router.replace("/(auth)/sign-in");
              setIsHandlingDeepLink(false);
              return;
            }

            try {
              // Pre-validate clip existence while setting up navigation
              const clipCheckPromise = supabase
                .from("auto_clips")
                .select("id, status")
                .eq("id", clipId)
                .eq("status", "published")
                .single();

              // Optimized navigation for clips
              if (Platform.OS === 'android' && isInitialLink) {
                console.log("[DeepLink] Android clip: Optimized navigation");
                
                // Navigate to base immediately
                router.replace('/(home)/(user)');
                
                // Check clip while route establishes
                const { data: clipExists, error } = await clipCheckPromise;
                
                if (error || !clipExists) {
                  Alert.alert(
                    "Content Not Available",
                    "This video is no longer available or has been removed.",
                    [
                      {
                        text: "OK",
                        onPress: () => {
                          setIsHandlingDeepLink(false);
                          router.replace("/(home)/(user)");
                        },
                      },
                    ]
                  );
                  return;
                }
                
                // Minimal delay for route setup
                await new Promise(resolve => setTimeout(resolve, 150));
                
                // Navigate to autoclips with params
                router.push({
                  pathname: "/(home)/(user)/(tabs)/autoclips",
                  params: {
                    clipId: clipId,
                    fromDeepLink: "true",
                  },
                });
              } else {
                // iOS: Check and navigate
                const { data: clipExists, error } = await clipCheckPromise;
                
                if (error || !clipExists) {
                  Alert.alert(
                    "Content Not Available",
                    "This video is no longer available or has been removed.",
                    [
                      {
                        text: "OK",
                        onPress: () => {
                          setIsHandlingDeepLink(false);
                          router.replace("/(home)/(user)");
                        },
                      },
                    ]
                  );
                  return;
                }
                
                // iOS can navigate directly
                router.push({
                  pathname: "/(home)/(user)/(tabs)/autoclips",
                  params: {
                    clipId: clipId,
                    fromDeepLink: "true",
                  },
                });
              }
            } catch (error) {
              console.error("[DeepLink] Error checking clip existence:", error);
              setIsHandlingDeepLink(false);
              Alert.alert(
                "Error", 
                "Unable to load the requested content.",
                [
                  {
                    text: "Go to Home",
                    onPress: () => router.replace("/(home)/(user)"),
                  },
                ]
              );
            }
          }
          // Handle invalid deep links
          else {
            console.warn("[DeepLink] Unrecognized deep link pattern:", pathToProcess);
            setIsHandlingDeepLink(false);
            
            // Navigate to appropriate home screen
            if (isEffectivelySignedIn) {
              router.replace("/(home)/(user)");
            } else {
              router.replace("/(auth)/sign-in");
            }
          }
        } else {
          // No path to process - go to home
          console.log("[DeepLink] No specific path found, navigating to home");
          setIsHandlingDeepLink(false);
          const isEffectivelySignedIn = isSignedIn || isGuest;
          if (isEffectivelySignedIn) {
            router.replace("/(home)/(user)");
          } else {
            router.replace("/(auth)/sign-in");
          }
        }
      } catch (err) {
        console.error("[DeepLink] Processing error:", err);
        setIsHandlingDeepLink(false);
        
        // Error recovery
        const isEffectivelySignedIn = isSignedIn || isGuest;
        if (isEffectivelySignedIn) {
          router.replace("/(home)/(user)");
        } else {
          router.replace("/(auth)/sign-in");
        }
      } finally {
        // Clear processing flag with slight delay to ensure navigation completes
        setTimeout(() => {
          setIsProcessingDeepLink(false);
          setIsHandlingDeepLink(false);
        }, 300);
        
        // Mark deep links as ready after processing
        if (isInitialLink) {
          initManager.setReady('deepLinks');
        }
      }
    },
    [router, isLoaded, isSignedIn, isGuest, prefetchCarDetails]
  );

  // Export the handling state so it can be used by RootLayoutNav
  useEffect(() => {
    // Store in a global variable that RootLayoutNav can access
    (global as any).isHandlingDeepLink = isHandlingDeepLink;
  }, [isHandlingDeepLink]);

  // Hide splash screen
  useEffect(() => {
    const hideStaticSplash = async () => {
      try {
        await SplashScreen.hideAsync();
      } catch (e) {
        console.warn("Error hiding splash:", e);
      }
    };
    
    hideStaticSplash();
  }, []);

  // Get initial URL
  useEffect(() => {
    Linking.getInitialURL()
      .then((url) => {
        if (url) {
          console.log(`[DeepLink - ${Platform.OS}] App opened with initial URL:`, url);
          setInitialUrl(url);
        } else {
          console.log("[DeepLink] No initial URL found");
          initManager.setReady('deepLinks');
        }
      })
      .catch((err) => {
        console.error("[DeepLink] Error getting initial URL:", err);
        initManager.setReady('deepLinks');
      });
  }, []);

  // Process initial URL when auth loaded
  useEffect(() => {
    if (initialUrl && isLoaded && !initialUrlProcessed.current) {
      initialUrlProcessed.current = true;
      console.log(`[DeepLink - ${Platform.OS}] Processing initial URL after auth loaded:`, initialUrl);
      processDeepLink(initialUrl, true);
    } else if (!initialUrl && isLoaded && !initialUrlProcessed.current) {
      // No initial URL and auth is loaded - mark as ready
      initialUrlProcessed.current = true;
      initManager.setReady('deepLinks');
    }
  }, [initialUrl, isLoaded, processDeepLink]);

  // Set URL processing callback
  useEffect(() => {
    deepLinkQueue.setProcessUrlCallback(processDeepLink);
  }, [processDeepLink]);

  // Mark as initialized when auth loaded
  useEffect(() => {
    if (isLoaded) {
      initializationTimeoutRef.current = setTimeout(() => {
        setIsInitialized(true);
        deepLinkQueue.setReady();
      }, 200); // Reduced from 300ms
    }

    return () => {
      if (initializationTimeoutRef.current) {
        clearTimeout(initializationTimeoutRef.current);
      }
    };
  }, [isLoaded]);

  // Listen for runtime deep links
  useEffect(() => {
    const subscription = Linking.addEventListener("url", ({ url }) => {
      console.log(`[DeepLink - ${Platform.OS}] Runtime deep link received:`, url);
      
      if (isInitialized) {
        processDeepLink(url);
      } else {
        console.log("[DeepLink] App not initialized, queuing deep link");
        deepLinkQueue.enqueue(url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isInitialized, processDeepLink]);

  // Handle pending deep links after sign-in
  useEffect(() => {
    if (isSignedIn && global.pendingDeepLink) {
      const { type, id } = global.pendingDeepLink;
      console.log("[DeepLink] Processing pending deep link after sign-in:", type, id);

      if (type === "car" && id) {
        router.push({
          pathname: "/(home)/(user)/CarDetails",
          params: { carId: id, isDealerView: "false", fromDeepLink: "true" },
        });
      } else if (type === "autoclip" && id) {
        router.push({
          pathname: "/(home)/(user)/(tabs)/autoclips",
          params: { clipId: id, fromDeepLink: "true" },
        });
      }

      global.pendingDeepLink = null;
    }
  }, [isSignedIn, router]);

  return null;
};

// COMPONENT: Environment variables check
function EnvironmentVariablesCheck() {
  useEffect(() => {
    initManager.setReady('permissions');
  }, []);
  
  return null;
}

// COMPONENT: Timeout-protected NotificationsProvider
function NotificationsProvider() {
  const {
    unreadCount,
    isPermissionGranted,
    registerForPushNotifications,
    diagnosticInfo,
  } = useNotifications();
  const { user, isSignedIn } = useAuth();
  const { isGuest } = useGuestUser();
  const [initializationState, setInitializationState] = useState<
    "idle" | "running" | "completed" | "failed"
  >("idle");
  const initRetryCount = useRef(0);
  const MAX_INIT_RETRIES = 2;
  const initTimeoutRef = useRef<NodeJS.Timeout>();

  // COMPUTED: Operation key for coordination
  const operationKey = useMemo(
    () => (user?.id ? `notification_init_${user.id}` : null),
    [user?.id]
  );

  // EFFECT: Initialize notifications with timeout protection
  useEffect(() => {
    const initializeNotifications = async () => {
      // RULE: Skip if no user or guest
      if (!user?.id || isGuest || !isSignedIn || !operationKey) {
        setInitializationState("completed");
        initManager.setReady('notifications');
        return;
      }

      // RULE: Skip if already completed or running
      if (
        initializationState === "completed" ||
        initializationState === "running"
      ) {
        console.log(
          "[NotificationsProvider] Initialization already completed or in progress"
        );
        return;
      }

      try {
        // TIMEOUT PROTECTION: 8 second initialization timeout
        initTimeoutRef.current = setTimeout(() => {
          console.warn('[NotificationsProvider] TIMEOUT: Marking as completed after 8 seconds');
          setInitializationState("completed");
          initManager.setReady('notifications');
        }, 8000);

        await notificationCoordinator.executeExclusive(
          operationKey,
          async (signal) => {
            console.log(
              "[NotificationsProvider] Starting coordinated initialization"
            );
            setInitializationState("running");

            notificationCoordinator.checkAborted(signal);

            // RULE: Set up Android channel
            if (Platform.OS === "android") {
              try {
                await Notifications.setNotificationChannelAsync("default", {
                  name: "Default",
                  importance: Notifications.AndroidImportance.MAX,
                  vibrationPattern: [0, 250, 250, 250],
                  lightColor: "#D55004",
                  sound: "notification.wav",
                  enableVibrate: true,
                  enableLights: true,
                  showBadge: true,
                  lockscreenVisibility:
                    Notifications.AndroidNotificationVisibility.PUBLIC,
                });
                console.log(
                  "[NotificationsProvider] Android channel configured"
                );
              } catch (channelError) {
                console.warn(
                  "[NotificationsProvider] Channel setup error (non-critical):",
                  channelError
                );
              }
            }

            // RULE: Check cached permissions
            let cachedPermissions =
              notificationCache.get<Notifications.NotificationPermissionsStatus>(
                NotificationCacheManager.keys.permissions()
              );

            if (!cachedPermissions) {
              cachedPermissions = await Notifications.getPermissionsAsync();
              if (cachedPermissions) {
                notificationCache.set(
                  NotificationCacheManager.keys.permissions(),
                  cachedPermissions,
                  10 * 60 * 1000
                );
              }
            }

            // RULE: Request permissions if needed
            if (cachedPermissions?.status !== "granted") {
              console.log("[NotificationsProvider] Requesting permissions");
              const newPermissions =
                await Notifications.requestPermissionsAsync();

              if (newPermissions?.status !== "granted") {
                console.log("[NotificationsProvider] Permission denied");
                setInitializationState("completed");
                initManager.setReady('notifications');
                return;
              }

              notificationCache.set(
                NotificationCacheManager.keys.permissions(),
                newPermissions,
                10 * 60 * 1000
              );
            }

            console.log(
              "[NotificationsProvider] Registering for push notifications"
            );
            
            // RULE: Background registration - don't await
            registerForPushNotifications(true).catch(error => {
              console.warn('[NotificationsProvider] Background registration failed:', error);
            });

            setInitializationState("completed");
            initRetryCount.current = 0;
            
            if (initTimeoutRef.current) {
              clearTimeout(initTimeoutRef.current);
              initTimeoutRef.current = undefined;
            }
            
            initManager.setReady('notifications');
          }
        );
      } catch (error: any) {
        if (error.message !== "Operation cancelled") {
          console.error("[NotificationsProvider] Initialization error:", error);
          setInitializationState("completed");
          
          if (initTimeoutRef.current) {
            clearTimeout(initTimeoutRef.current);
            initTimeoutRef.current = undefined;
          }
          
          initManager.setReady('notifications');
        }
      }
    };

    initializeNotifications();

    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
    };
  }, [
    user?.id,
    isSignedIn,
    isGuest,
    registerForPushNotifications,
    operationKey,
    initializationState,
  ]);

  return <EnvironmentVariablesCheck />;
}


function RootLayoutNav() {
  const { isLoaded, isSignedIn, isSigningOut, isSigningIn } = useAuth();
  const { isGuest } = useGuestUser();
  const segments = useSegments();
  const router = useRouter();
  const colorScheme = useColorScheme(); // Use this if useTheme is not available
  const isDarkMode = colorScheme === 'dark';

  const [splashAnimationComplete, setSplashAnimationComplete] = useState(false);
  const contentOpacity = useRef(new Animated.Value(0)).current;
  
  // Add state to track if we're handling a deep link
  const [isHandlingDeepLink, setIsHandlingDeepLink] = useState(false);

  // Check for global deep link handling state
  useEffect(() => {
    const checkInterval = setInterval(() => {
      const globalHandling = (global as any).isHandlingDeepLink;
      if (globalHandling !== undefined && globalHandling !== isHandlingDeepLink) {
        setIsHandlingDeepLink(globalHandling);
      }
    }, 50);

    return () => clearInterval(checkInterval);
  }, [isHandlingDeepLink]);

  // This effect correctly handles routing only when auth is loaded.
  useEffect(() => {
    // RULE: Only route when auth is loaded and no sign-in/out is in progress.
    if (!isLoaded || isSigningOut || isSigningIn || isHandlingDeepLink) return;

    const isEffectivelySignedIn = isSignedIn || isGuest;
    const inAuthGroup = segments[0] === "(auth)";

    // Basic routing logic - OAuth scenarios are handled by AuthStateMonitor
    if (isEffectivelySignedIn && inAuthGroup) {
      router.replace("/(home)");
    } else if (!isEffectivelySignedIn && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
    }
  }, [isLoaded, isSignedIn, isGuest, segments, router, isSigningOut, isSigningIn, isHandlingDeepLink]);

  // This function now handles a fade-in for the content.
  const handleSplashComplete = useCallback(() => {
    // This is called after your splash animation/video finishes.
    // Now, we smoothly fade in the main app content.
    Animated.timing(contentOpacity, {
      toValue: 1,
      duration: 400, // A gentle fade-in duration
      useNativeDriver: true,
    }).start(() => {
      // After the content is fully visible, we can remove the splash component from the tree.
      setSplashAnimationComplete(true);
    });
  }, [contentOpacity]);

  // Show a loading state during deep link handling to prevent white screen/404
  if (isHandlingDeepLink) {
    return (
      <View style={{ 
        flex: 1, 
        backgroundColor: isDarkMode ? "#000000" : "#FFFFFF",
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <ActivityIndicator size="large" color="#D55004" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* This View holds your main app content and will fade in */}
      <Animated.View
        style={[styles.contentContainer, { opacity: contentOpacity }]}
      >
        {/* Guard the Slot component until auth state is known */}
        {isLoaded ? <Slot /> : null}
      </Animated.View>

      {/* The splash screen */}
      {!splashAnimationComplete ? (
        <CustomSplashScreen onAnimationComplete={handleSplashComplete} />
      ) : null}
    </View>
  );
}

// STYLES: Component styling
const styles = StyleSheet.create({
  contentContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  curtain: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "white",
    zIndex: 2,
  },
});

// COMPONENT: Error fallback
function ErrorFallback({ error, resetError }: any) {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Something went wrong!</Text>
      <Text>{error.toString()}</Text>
      <TouchableOpacity onPress={resetError}>
        <Text>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

// MAIN COMPONENT: Root Layout with initialization coordination
export default function RootLayout() {
  const badgeClearingRef = useRef(false);
  const [showUpdateAlert, setShowUpdateAlert] = useState(false);

  // EFFECT: Initialize app systems
  useEffect(() => {
    const initializeApp = async () => {
      try {
        await SplashScreen.preventAutoHideAsync();

        // RULE: Mark splash as ready immediately
        initManager.setReady('splash');

        // RULE: Clear badge once
        if (!badgeClearingRef.current) {
          badgeClearingRef.current = true;
          try {
            await Notifications.setBadgeCountAsync(0);
            console.log("[RootLayout] Badge cleared on app launch");
          } catch (badgeError) {
            console.warn(
              "[RootLayout] Non-critical: Badge clear failed:",
              badgeError
            );
          }
        }

        // RULE: Cache initial permissions
        try {
          const permissionStatus = await Notifications.getPermissionsAsync();
          console.log(
            "[RootLayout] Initial permission status:",
            permissionStatus.status
          );

          notificationCache.set(
            NotificationCacheManager.keys.permissions(),
            permissionStatus,
            10 * 60 * 1000
          );
        } catch (notifError) {
          console.warn(
            "[RootLayout] Non-critical: Permission check failed:",
            notifError
          );
        }

        // RULE: Mark auth as ready (will be overridden by AuthProvider)
        setTimeout(() => {
          initManager.setReady('auth');
        }, 100);

        // RULE: Android splash failsafe
        if (Platform.OS === "android") {
          setTimeout(() => {
            SplashScreen.hideAsync().catch(() => {});
          }, 3000);
        }
      } catch (e) {
        console.warn("[RootLayout] Initialization error:", e);
        // RULE: Force completion on error
        initManager.setReady('splash');
        initManager.setReady('auth');
        initManager.setReady('notifications');
        initManager.setReady('deepLinks');
        initManager.setReady('permissions');
      }
    };

    initializeApp();
  }, []);

  // EFFECT: Configure text scaling
  useEffect(() => {
    if (Text.defaultProps == null) Text.defaultProps = {};
    if (TextInput.defaultProps == null) TextInput.defaultProps = {};

    Text.defaultProps.allowFontScaling = false;
    TextInput.defaultProps.allowFontScaling = false;
  }, []);

  // EFFECT: Check for OTA updates
  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          console.log("[RootLayout] Update available, downloading...");
          const result = await Updates.fetchUpdateAsync();

          if (result.isNew) {
            setShowUpdateAlert(true);
          }
        } else {
          console.log("[RootLayout] No updates available");
        }
      } catch (error) {
        console.error("[RootLayout] Update check error:", error);
      }
    };

    checkForUpdates();
  }, []);

  // EFFECT: Cleanup on unmount
  useEffect(() => {
    return () => {
      notificationCoordinator.cleanup();
    };
  }, []);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
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
                    <ModernUpdateAlert 
                      isVisible={showUpdateAlert} 
                      onUpdate={async () => { await Updates.reloadAsync(); }} 
                      onClose={() => setShowUpdateAlert(false)} 
                    />
                  </FavoritesProvider>
                </ThemeProvider>
              </QueryClientProvider>
            </AuthProvider>
          </GuestUserProvider>
        </GestureHandlerRootView>

    </ErrorBoundary>
  );
}