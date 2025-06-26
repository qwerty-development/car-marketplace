
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
import { ThemeProvider } from "@/utils/ThemeContext";
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

// Enhanced DeepLinkHandler with Android-specific fixes
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

  // NEW: Add route validation helper
  const validateRoute = useCallback((pathname: string): boolean => {
    try {
      // Check if the route exists by attempting to resolve it
      const segments = pathname.split('/').filter(Boolean);
      
      // Validate autoclips route specifically
      if (pathname.includes('autoclips')) {
        return segments.includes('(home)') && 
               segments.includes('(user)') && 
               segments.includes('(tabs)') && 
               segments.includes('autoclips');
      }
      
      return true;
    } catch (error) {
      console.error('[RouteValidation] Error validating route:', error);
      return false;
    }
  }, []);

  // NEW: Enhanced navigation with Android-specific handling
  const navigateToAutoclip = useCallback(async (clipId: string, isInitialLink = false) => {
    console.log(`[DeepLink] Starting autoclip navigation for ID: ${clipId}`);
    
    try {
      // ANDROID FIX: Add extra delay for route resolution
      if (Platform.OS === 'android') {
        await new Promise(resolve => setTimeout(resolve, isInitialLink ? 1000 : 500));
      }
      
      // Validate clip exists first
      const { data: clipExists, error } = await supabase
        .from("auto_clips")
        .select("id, status")
        .eq("id", clipId)
        .eq("status", "published")
        .single();

      if (error || !clipExists) {
        console.warn('[DeepLink] Clip not found or not published:', clipId);
        Alert.alert(
          "Content Not Available",
          "This video is no longer available or has been removed.",
          [
            {
              text: "OK",
              onPress: () => {
                // ANDROID FIX: Use replace instead of push for fallback
                if (Platform.OS === 'android') {
                  router.replace("/(home)/(user)/(tabs)" as any);
                } else {
                  router.replace("/(home)/(user)" as any);
                }
              },
            },
          ]
        );
        return false;
      }

      // ANDROID FIX: Validate route before navigation
      const targetRoute = "/(home)/(user)/(tabs)/autoclips";
      if (!validateRoute(targetRoute)) {
        console.error('[DeepLink] Route validation failed for:', targetRoute);
        
        // Fallback to tab navigation
        router.replace("/(home)/(user)/(tabs)" as any);
        
        // Try again after a delay
        setTimeout(() => {
          router.push({
            pathname: targetRoute as any,
            params: { clipId, fromDeepLink: "true" }
          });
        }, 1000);
        return false;
      }

      // ANDROID FIX: Use different navigation strategy
      if (Platform.OS === 'android') {
        // For Android, navigate to tabs first, then to autoclips
        console.log('[DeepLink] Android: Navigating to tabs first');
        router.replace("/(home)/(user)/(tabs)" as any);
        
        // Small delay before navigating to specific tab
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      console.log('[DeepLink] Navigating to autoclips with params:', { clipId, fromDeepLink: "true" });
      
      // Navigate to autoclips
      router.push({
        pathname: "/(home)/(user)/(tabs)/autoclips" as any,
        params: {
          clipId,
          fromDeepLink: "true",
        },
      });

      return true;
    } catch (error) {
      console.error("[DeepLink] Error in autoclip navigation:", error);
      
      // ANDROID FIX: Better error handling with fallback
      Alert.alert(
        "Navigation Error", 
        Platform.OS === 'android' 
          ? "Unable to load the requested content. Redirecting to home."
          : "Unable to load the requested content.",
        [
          {
            text: "OK",
            onPress: () => {
              if (Platform.OS === 'android') {
                router.replace("/(home)/(user)/(tabs)" as any);
              } else {
                router.replace("/(home)/(user)" as any);
              }
            },
          },
        ]
      );
      return false;
    }
  }, [router, validateRoute]);

  // METHOD: Process deep link with enhanced Android support
  const processDeepLink = useCallback(
    async (url: string, isInitialLink = false) => {
      if (!url || isProcessingDeepLink) return;

      console.log(
        `[DeepLink] Processing ${isInitialLink ? "initial" : "runtime"} link:`,
        url
      );
      setIsProcessingDeepLink(true);

      try {
        const parsedUrl = Linking.parse(url);
        const { path, queryParams } = parsedUrl;

        console.log("[DeepLink] Parsed URL:", { path, queryParams });

        // RULE: Handle auth callbacks
        if (url.includes("auth/callback") || url.includes("reset-password")) {
          console.log("[DeepLink] Handling auth callback");
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

        // RULE: Wait for auth to be loaded
        if (!isLoaded) {
          console.log("[DeepLink] Auth not loaded, queueing deep link");
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

          // RULE: Handle car deep links
          if (carId && !isNaN(Number(carId))) {
            console.log(`[DeepLink] Navigating to car details for ID: ${carId}`);

            if (!isEffectivelySignedIn) {
              console.log("[DeepLink] User not signed in, redirecting to sign-in first");
              global.pendingDeepLink = { type: "car", id: carId };
              router.replace("/(auth)/sign-in");
              return;
            }

            try {
              if (isInitialLink) {
                await new Promise((resolve) => setTimeout(resolve, 500));
              }

              const prefetchedData = await prefetchCarDetails(carId);

              router.push({
                pathname: "/(home)/(user)/CarDetailModal" as any, // FIXED: Use correct route name
                params: {
                  carId,
                  isDealerView: "false",
                  prefetchedData: prefetchedData
                    ? JSON.stringify(prefetchedData)
                    : undefined,
                  fromDeepLink: "true",
                },
              });
            } catch (error) {
              console.error("[DeepLink] Error prefetching car details:", error);

              router.push({
                pathname: "/(home)/(user)/CarDetailModal" as any, // FIXED: Use correct route name
                params: {
                  carId,
                  isDealerView: "false",
                  fromDeepLink: "true",
                },
              });
            }
          } 
          // ENHANCED: Handle clip deep links with Android-specific logic
          else if (clipId && !isNaN(Number(clipId))) {
            console.log(`[DeepLink] Processing autoclip deep link for ID: ${clipId}`);

            if (!isEffectivelySignedIn) {
              console.log("[DeepLink] User not signed in, storing pending deep link");
              global.pendingDeepLink = { type: "autoclip", id: clipId };
              router.replace("/(auth)/sign-in");
              return;
            }

            // Use the enhanced navigation function
            const success = await navigateToAutoclip(clipId, isInitialLink);
            if (!success) {
              console.warn('[DeepLink] Failed to navigate to autoclip:', clipId);
            }
          } 
          // RULE: Handle invalid deep links
          else if (
            path.startsWith("cars") ||
            path.startsWith("/cars") ||
            path.startsWith("car") ||
            path.startsWith("clips") ||
            path.startsWith("/clips") ||
            path.startsWith("clip")
          ) {
            console.warn("[DeepLink] Invalid ID in deep link:", path);
            Alert.alert(
              "Invalid Link",
              "The content you're looking for could not be found."
            );
          }
        }
      } catch (err) {
        console.error("[DeepLink] Processing error:", err);
        Alert.alert("Error", "Unable to process the link. Please try again.");
      } finally {
        setIsProcessingDeepLink(false);
      }
    },
    [router, isLoaded, isSignedIn, isGuest, prefetchCarDetails, navigateToAutoclip]
  );

  // EFFECT: Hide static splash screen
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

  // EFFECT: Get initial URL
  useEffect(() => {
    Linking.getInitialURL()
      .then((url) => {
        if (url) {
          console.log("[DeepLink] App opened with initial URL:", url);
          setInitialUrl(url);
        } else {
          initManager.setReady('deepLinks');
        }
      })
      .catch((err) => {
        console.error("[DeepLink] Error getting initial URL:", err);
        initManager.setReady('deepLinks');
      });
  }, []);

  // EFFECT: Process initial URL when auth loaded
  useEffect(() => {
    if (initialUrl && isLoaded && !initialUrlProcessed.current) {
      initialUrlProcessed.current = true;
      console.log("[DeepLink] Processing initial URL after auth loaded:", initialUrl);
      
      // ANDROID FIX: Add extra delay for initial URL processing
      const delay = Platform.OS === 'android' ? 1500 : 500;
      setTimeout(() => {
        processDeepLink(initialUrl, true);
      }, delay);
    }
  }, [initialUrl, isLoaded, processDeepLink]);

  // EFFECT: Set URL processing callback
  useEffect(() => {
    deepLinkQueue.setProcessUrlCallback(processDeepLink);
  }, [processDeepLink]);

  // EFFECT: Mark as initialized when auth loaded
  useEffect(() => {
    if (isLoaded) {
      // ANDROID FIX: Longer delay for Android initialization
      const delay = Platform.OS === 'android' ? 800 : 300;
      initializationTimeoutRef.current = setTimeout(() => {
        setIsInitialized(true);
        deepLinkQueue.setReady();
      }, delay);
    }

    return () => {
      if (initializationTimeoutRef.current) {
        clearTimeout(initializationTimeoutRef.current);
      }
    };
  }, [isLoaded]);

  // EFFECT: Listen for runtime deep links
  useEffect(() => {
    const subscription = Linking.addEventListener("url", ({ url }) => {
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

  // ENHANCED: Handle pending deep links after sign-in with Android support
  useEffect(() => {
    if (isSignedIn && global.pendingDeepLink) {
      const { type, id } = global.pendingDeepLink;

      if (type === "car" && id) {
        console.log("[DeepLink] Processing pending car deep link after sign-in");
        router.push({
          pathname: "/(home)/(user)/CarDetailModal" as any, // FIXED: Use correct route name
          params: { carId: id, isDealerView: "false" },
        });
      } else if (type === "autoclip" && id) {
        console.log("[DeepLink] Processing pending autoclip deep link after sign-in");
        
        // Use enhanced navigation for pending autoclip
        setTimeout(() => {
          navigateToAutoclip(id, false);
        }, Platform.OS === 'android' ? 1000 : 500);
      }

      global.pendingDeepLink = null;
    }
  }, [isSignedIn, router, navigateToAutoclip]);

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

  const [splashAnimationComplete, setSplashAnimationComplete] = useState(false);
  const contentOpacity = useRef(new Animated.Value(0)).current; // Content starts transparent

  // REMOVED: curtainPosition is no longer needed for a fade animation.
  // const curtainPosition = useRef(new Animated.Value(0)).current;

  // This effect correctly handles routing only when auth is loaded.
  useEffect(() => {
    // RULE: Only route when auth is loaded and no sign-in/out is in progress.
    if (!isLoaded || isSigningOut || isSigningIn) return;

    const isEffectivelySignedIn = isSignedIn || isGuest;
    const inAuthGroup = segments[0] === "(auth)";

    if (isEffectivelySignedIn && inAuthGroup) {
      router.replace("/(home)");
    } else if (!isEffectivelySignedIn && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
    }
  }, [isLoaded, isSignedIn, isGuest, segments, router, isSigningOut, isSigningIn]);


  // CHANGED: This function now handles a fade-in for the content.
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

  return (
    <View style={{ flex: 1 }}>
      {/* This View holds your main app content and will fade in */}
      <Animated.View
        style={[styles.contentContainer, { opacity: contentOpacity }]}
      >
        {/* Guard the Slot component until auth state is known */}
        {isLoaded ? <Slot /> : null}
      </Animated.View>

      {/* CHANGED: The curtain View is gone. We now render the splash screen or nothing. */}
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