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

// COMPONENT: Enhanced DeepLinkHandler with timeout protection
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

// Replace the processDeepLink function in your DeepLinkHandler component
// in app/_layout.tsx with this BRUTE FORCE version:

const processDeepLink = useCallback(
  async (url: string, isInitialLink = false) => {
    if (!url || isProcessingDeepLink) return;

    console.log(
      `[BRUTE FORCE DeepLink] Processing ${isInitialLink ? "initial" : "runtime"} link:`,
      url
    );
    setIsProcessingDeepLink(true);

    try {
      // BRUTE FORCE: Handle auth callbacks FIRST
      if (url.includes("auth/callback") || url.includes("/callback")) {
        console.log("[BRUTE FORCE DeepLink] Handling auth callback URL");
        
        // Extract tokens from URL
        let accessToken, refreshToken;
        
        try {
          if (url.includes('#')) {
            const hashPart = url.split('#')[1];
            const params = new URLSearchParams(hashPart);
            accessToken = params.get('access_token');
            refreshToken = params.get('refresh_token');
          } else if (url.includes('?')) {
            const queryPart = url.split('?')[1];
            const params = new URLSearchParams(queryPart);
            accessToken = params.get('access_token');
            refreshToken = params.get('refresh_token');
          }
          
          console.log('[BRUTE FORCE DeepLink] Tokens extracted:', { 
            hasAccess: !!accessToken, 
            hasRefresh: !!refreshToken 
          });

          if (accessToken && refreshToken) {
            console.log('[BRUTE FORCE DeepLink] Setting session directly');
            
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) {
              console.error('[BRUTE FORCE DeepLink] Session error:', error);
            } else {
              console.log('[BRUTE FORCE DeepLink] Session set, forcing redirect');
            }
            
            // BRUTE FORCE: Multiple redirect attempts
            router.replace('/(home)');
            
            setTimeout(() => {
              router.replace('/(home)');
            }, 500);
            
            setTimeout(() => {
              router.push('/(home)');
            }, 1000);
            
          } else {
            // If no tokens, navigate to callback route to handle it there
            console.log('[BRUTE FORCE DeepLink] No tokens found, navigating to callback route');
            router.push('/(auth)/callback' as any);
          }
        } catch (tokenError) {
          console.error('[BRUTE FORCE DeepLink] Token extraction error:', tokenError);
          router.push('/(auth)/callback' as any);
        }
        
        setIsProcessingDeepLink(false);
        return;
      }

      // BRUTE FORCE: Handle password reset
      if (url.includes("reset-password")) {
        console.log("[BRUTE FORCE DeepLink] Handling password reset link");
        
        const parsedUrl = Linking.parse(url);
        const { queryParams } = parsedUrl;
        
        const accessToken = queryParams?.access_token;
        const refreshToken = queryParams?.refresh_token;

        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken as string,
            refresh_token: refreshToken as string,
          });
        }
        setIsProcessingDeepLink(false);
        return;
      }

      if (!isLoaded) {
        console.log("[BRUTE FORCE DeepLink] Auth not loaded, queueing deep link");
        deepLinkQueue.enqueue(url);
        setIsProcessingDeepLink(false);
        return;
      }

      const parsedUrl = Linking.parse(url);
      const { path, queryParams } = parsedUrl;

      console.log("[BRUTE FORCE DeepLink] Parsed URL:", { path, queryParams });

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

        // Handle car deep links
        if (carId && !isNaN(Number(carId))) {
          console.log(`[BRUTE FORCE DeepLink] Navigating to car details for ID: ${carId}`);

          if (!isEffectivelySignedIn) {
            console.log("[BRUTE FORCE DeepLink] User not signed in, redirecting to sign-in first");
            global.pendingDeepLink = { type: "car", id: carId };
            router.replace("/(auth)/sign-in");
            setIsProcessingDeepLink(false);
            return;
          }

          try {
            if (isInitialLink) {
              await new Promise((resolve) => setTimeout(resolve, 500));
            }

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
          } catch (error) {
            console.error("[BRUTE FORCE DeepLink] Error prefetching car details:", error);

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
          console.log(`[BRUTE FORCE DeepLink] Navigating to autoclip details for ID: ${clipId}`);

          if (!isEffectivelySignedIn) {
            global.pendingDeepLink = { type: "autoclip", id: clipId };
            router.replace("/(auth)/sign-in");
            setIsProcessingDeepLink(false);
            return;
          }

          if (isInitialLink) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }

          try {
            const { data: clipExists, error } = await supabase
              .from("auto_clips")
              .select("id, status")
              .eq("id", clipId)
              .eq("status", "published")
              .single();

            if (error || !clipExists) {
              Alert.alert(
                "Content Not Available",
                "This video is no longer available or has been removed.",
                [
                  {
                    text: "OK",
                    onPress: () => router.replace("/(home)/(user)" as any),
                  },
                ]
              );
              setIsProcessingDeepLink(false);
              return;
            }

            router.push({
              pathname: "/(home)/(user)/(tabs)/autoclips",
              params: {
                clipId,
                fromDeepLink: "true",
              },
            });
          } catch (error) {
            console.error("[BRUTE FORCE DeepLink] Error checking clip existence:", error);
            Alert.alert("Error", "Unable to load the requested content.");
            router.replace("/(home)/(user)" as any);
          }
        } 
        // Handle invalid deep links
        else if (
          path.startsWith("cars") ||
          path.startsWith("/cars") ||
          path.startsWith("car") ||
          path.startsWith("clips") ||
          path.startsWith("/clips") ||
          path.startsWith("clip")
        ) {
          console.warn("[BRUTE FORCE DeepLink] Invalid ID in deep link:", path);
          Alert.alert(
            "Invalid Link",
            "The content you're looking for could not be found."
          );
        }
      }
    } catch (err) {
      console.error("[BRUTE FORCE DeepLink] Processing error:", err);
      Alert.alert("Error", "Unable to process the link. Please try again.");
    } finally {
      setIsProcessingDeepLink(false);
    }
  },
  [router, isLoaded, isSignedIn, isGuest, prefetchCarDetails]
);

    useEffect(() => {
    // Hide the static splash screen immediately when component mounts
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
      processDeepLink(initialUrl, true);
    }
  }, [initialUrl, isLoaded, processDeepLink]);

  // EFFECT: Set URL processing callback
  useEffect(() => {
    deepLinkQueue.setProcessUrlCallback(processDeepLink);
  }, [processDeepLink]);

  // EFFECT: Mark as initialized when auth loaded
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

  // EFFECT: Handle pending deep links after sign-in
  useEffect(() => {
    if (isSignedIn && global.pendingDeepLink) {
      const { type, id } = global.pendingDeepLink;

      if (type === "car" && id) {
        console.log("[DeepLink] Processing pending car deep link after sign-in");
        router.push({
          pathname: "/(home)/(user)/CarDetails",
          params: { carId: id, isDealerView: "false" },
        });
      } else if (type === "autoclip" && id) {
        console.log("[DeepLink] Processing pending autoclip deep link after sign-in");
        router.push({
          pathname: "/(home)/(user)/(tabs)/autoclips",
          params: { clipId: id },
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

  const [splashAnimationComplete, setSplashAnimationComplete] = useState(false);
  const contentOpacity = useRef(new Animated.Value(0)).current; // Content starts transparent

  // REMOVED: curtainPosition is no longer needed for a fade animation.
  // const curtainPosition = useRef(new Animated.Value(0)).current;

  // This effect correctly handles routing only when auth is loaded.
useEffect(() => {
  // BRUTE FORCE: Force redirect on auth state change
  if (!isLoaded || isSigningOut || isSigningIn) {
    console.log('[BRUTE FORCE Nav] Auth not ready, waiting...', { isLoaded, isSigningOut, isSigningIn });
    return;
  }

  const isEffectivelySignedIn = isSignedIn || isGuest;
  const inAuthGroup = segments[0] === "(auth)";
  
  console.log('[BRUTE FORCE Nav] Navigation check:', { 
    isEffectivelySignedIn, 
    inAuthGroup, 
    segments,
    isSignedIn,
    isGuest 
  });

  if (isEffectivelySignedIn && inAuthGroup) {
    console.log('[BRUTE FORCE Nav] User signed in but in auth group, redirecting to home');
    
    // BRUTE FORCE: Multiple redirect attempts
    router.replace("/(home)");
    
    setTimeout(() => {
      console.log('[BRUTE FORCE Nav] Backup redirect attempt 1');
      router.replace("/(home)");
    }, 100);
    
    setTimeout(() => {
      console.log('[BRUTE FORCE Nav] Backup redirect attempt 2');
      router.push("/(home)");
    }, 500);
    
    setTimeout(() => {
      console.log('[BRUTE FORCE Nav] Nuclear redirect attempt');
      try {
        router.dismissAll();
        router.replace("/(home)");
      } catch (e) {
        console.log('[BRUTE FORCE Nav] Nuclear failed, trying push');
        router.push("/(home)");
      }
    }, 1000);
    
  } else if (!isEffectivelySignedIn && !inAuthGroup) {
    console.log('[BRUTE FORCE Nav] User not signed in and not in auth group, redirecting to sign-in');
    router.replace("/(auth)/sign-in");
  } else {
    console.log('[BRUTE FORCE Nav] Navigation state is correct, no action needed');
  }
}, [isLoaded, isSignedIn, isGuest, segments, router, isSigningOut, isSigningIn]);

// BRUTE FORCE: Additional effect to catch auth state changes
useEffect(() => {
  if (isLoaded && isSignedIn) {
    console.log('[BRUTE FORCE Nav] User signed in detected, checking current route');
    
    // If we're on any auth route when signed in, force redirect
    if (segments[0] === "(auth)") {
      console.log('[BRUTE FORCE Nav] Signed in user on auth route, forcing redirect');
      
      router.replace("/(home)");
      
      // Backup redirects
      setTimeout(() => router.replace("/(home)"), 200);
      setTimeout(() => router.push("/(home)"), 500);
    }
  }
}, [isSignedIn, isLoaded, segments, router]);


// Add this NUCLEAR FAILSAFE at the end of your RootLayoutNav component:

// NUCLEAR OPTION: Failsafe navigation check every 2 seconds
useEffect(() => {
  const interval = setInterval(() => {
    if (!isLoaded) return;
    
    const isEffectivelySignedIn = isSignedIn || isGuest;
    const currentRoute = segments.join('/');
    
    console.log('[NUCLEAR FAILSAFE] Route check:', { 
      currentRoute, 
      isEffectivelySignedIn,
      segments 
    });
    
    // If signed in but on auth routes (except callback), force redirect
    if (isEffectivelySignedIn && segments[0] === "(auth)" && !segments.includes("callback")) {
      console.log('[NUCLEAR FAILSAFE] FORCING REDIRECT - Signed in user on auth route');
      router.replace("/(home)");
    }
    
    // If on +not-found and signed in, redirect home
    if (isEffectivelySignedIn && (currentRoute.includes('+not-found') || currentRoute === '')) {
      console.log('[NUCLEAR FAILSAFE] FORCING REDIRECT - 404 page detected');
      router.replace("/(home)");
    }
    
    // If not signed in and not on auth routes, redirect to sign in
    if (!isEffectivelySignedIn && segments[0] !== "(auth)") {
      console.log('[NUCLEAR FAILSAFE] FORCING REDIRECT - Not signed in, not on auth');
      router.replace("/(auth)/sign-in");
    }
  }, 2000);
  
  return () => clearInterval(interval);
}, [isLoaded, isSignedIn, isGuest, segments, router]);

// MEGA NUCLEAR: Check for 404 pages and fix them
useEffect(() => {
  const checkFor404 = () => {
    const currentPath = segments.join('/');
    
    if (currentPath.includes('+not-found') || 
        currentPath.includes('404') || 
        currentPath === '' ||
        (isSignedIn && segments[0] === "(auth)" && !segments.includes("callback"))) {
      
      console.log('[MEGA NUCLEAR] 404 OR ROUTING ISSUE DETECTED:', currentPath);
      

    }
  };
  
  // Check immediately
  checkFor404();
  
  // Check again after a delay
  const timeout = setTimeout(checkFor404, 1000);
  
  return () => clearTimeout(timeout);
}, [segments, isSignedIn, isGuest, router]);

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