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
import Toast from "react-native-toast-message";
import StatusBarManager from "@/components/StatusBarManager";
import {
  notificationCache,
  NotificationCacheManager,
} from "@/utils/NotificationCacheManager";
import { notificationCoordinator } from "@/utils/NotificationOperationCoordinator";

import { useSlowConnectionToast } from "@/utils/useSlowConnectionToast";
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://785ae89de27dd58c218eb6dd0544d7a7@o4509672135065600.ingest.de.sentry.io/4509689676693584',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

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

// PERSISTENT CONFIGURATION: QueryClient setup - OPTIMIZED
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 2 * 60 * 1000,
      cacheTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    },
  },
});

// GLOBAL SYSTEM: Deep link state management
declare global {
  var pendingDeepLink: { type: string; id: string } | null;
}

// SIMPLIFIED SYSTEM: Initialization state management
interface InitializationState {
  auth: boolean;
  splash: boolean;
  deepLinks: boolean;
}

// BALANCED TIMEOUT CONSTANTS: Fast but reliable
const INITIALIZATION_TIMEOUT = 10000; // 10 seconds for safety
const SPLASH_MIN_DURATION = 500;

// SIMPLIFIED CLASS: InitializationManager
class InitializationManager {
  private state: InitializationState = {
    auth: false,
    splash: false,
    deepLinks: false,
  };

  private callbacks: Set<() => void> = new Set();
  private timeoutId: NodeJS.Timeout | null = null;
  private startTime: number = Date.now();

  constructor() {
    // MANDATORY TIMEOUT: Prevent infinite loading
    this.timeoutId = setTimeout(() => {
      console.warn(
        "[InitManager] TIMEOUT: Forcing completion after 10 seconds"
      );
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
    const allReady = Object.values(this.state).every((ready) => ready);
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

    console.log("[InitManager] Initialization complete - App ready");
    this.callbacks.forEach((callback) => callback());
    this.callbacks.clear();
  }

  // PRIVATE METHOD: Force completion on timeout
  private forceComplete(): void {
    // CRITICAL: Force all states to complete
    Object.keys(this.state).forEach((key) => {
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
    initManager.setReady("deepLinks");
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
        this.processTimeout = setTimeout(() => {
          console.warn(
            "[DeepLinkQueue] TIMEOUT: Processing timeout, skipping URL:",
            url
          );
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

const DeepLinkHandler = () => {
  const router = useRouter();
  const segments = useSegments();
  const { isLoaded, isSignedIn } = useAuth();
  const { isGuest } = useGuestUser();
  const { prefetchCarDetails } = useCarDetails();

  const [isProcessingDeepLink, setIsProcessingDeepLink] = useState(false);
  const [initialUrl, setInitialUrl] = useState<string | null>(null);
  const initialUrlProcessed = useRef(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const initializationTimeoutRef = useRef<NodeJS.Timeout>();
  const [isNavigationReady, setIsNavigationReady] = useState(false);

  // FIXED: Enhanced navigation with better stack management
  const navigateToDeepLink = useCallback(
    async (type: "car" | "clip", id: string, isInitialLink: boolean) => {
      console.log(
        `[DeepLink] Navigating to ${type} with ID: ${id}, initial: ${isInitialLink}`
      );

      const isEffectivelySignedIn = isSignedIn || isGuest;

    const currentPath = segments.join("/");
    const isAlreadyOnCarDetails =
      currentPath.includes("CarDetails") && type === "car";
    const isAlreadyOnAutoclips =
      currentPath.includes("autoclips") && type === "clip";

    if (isAlreadyOnCarDetails || isAlreadyOnAutoclips) {
      console.log("[DeepLink] Already on target page, navigating to new instance");

      // FIXED: Use replace navigation to force a reload with new params
      if (type === "car") {
        // Force navigation to the same route with new params
        router.replace({
          pathname: "/(home)/(user)/CarDetails",
          params: {
            carId: id,
            isDealerView: "false",
            fromDeepLink: "true",
          },
        });
      } else {
        // Force navigation to the same route with new params
        router.replace({
          pathname: "/(home)/(user)/(tabs)/autoclips",
          params: {
            clipId: id,
            fromDeepLink: "true",
          },
        });
      }
      return;
    }

      // FIXED: Unified navigation approach for both platforms and states
      try {
        if (type === "car") {
          // For car deep links
          if (Platform.OS === "android") {
            // Android: Always establish proper stack
            if (isInitialLink || !segments.includes("(home)")) {
              // Need to establish full stack
              await new Promise((resolve) => setTimeout(resolve, 300));
              router.replace("/(home)/(user)");
              await new Promise((resolve) => setTimeout(resolve, 200));
            }

            // Navigate to car details
            router.push({
              pathname: "/(home)/(user)/CarDetails",
              params: {
                carId: id,
                isDealerView: "false",
                fromDeepLink: "true",
              },
            });
          } else {
            // iOS: Direct navigation if stack exists, otherwise build it
            if (!segments.includes("(home)") && isInitialLink) {
              // Build stack for iOS initial link
              router.replace("/(home)/(user)");
              // Wait for navigation to settle
              setTimeout(() => {
                router.push({
                  pathname: "/(home)/(user)/CarDetails",
                  params: {
                    carId: id,
                    isDealerView: "false",
                    fromDeepLink: "true",
                  },
                });
              }, 300);
            } else {
              // Direct navigation for runtime links
              router.push({
                pathname: "/(home)/(user)/CarDetails",
                params: {
                  carId: id,
                  isDealerView: "false",
                  fromDeepLink: "true",
                },
              });
            }
          }
        } else if (type === "clip") {
          // For clip deep links
          if (Platform.OS === "android") {
            // Android: Always establish proper stack
            if (isInitialLink || !segments.includes("(home)")) {
              await new Promise((resolve) => setTimeout(resolve, 300));
              router.replace("/(home)/(user)");
              await new Promise((resolve) => setTimeout(resolve, 200));
            }

            // Navigate to autoclips
            router.push({
              pathname: "/(home)/(user)/(tabs)/autoclips",
              params: {
                clipId: id,
                fromDeepLink: "true",
              },
            });

            // Ensure params are set
            setTimeout(() => {
              router.setParams({
                clipId: id,
                fromDeepLink: "true",
              });
            }, 200);
          } else {
            // iOS: Direct navigation if stack exists, otherwise build it
            if (!segments.includes("(home)") && isInitialLink) {
              // Build stack for iOS initial link
              router.replace("/(home)/(user)");
              // Wait for navigation to settle
              setTimeout(() => {
                router.push({
                  pathname: "/(home)/(user)/(tabs)/autoclips",
                  params: {
                    clipId: id,
                    fromDeepLink: "true",
                  },
                });
              }, 300);
            } else {
              // Direct navigation for runtime links
              router.push({
                pathname: "/(home)/(user)/(tabs)/autoclips",
                params: {
                  clipId: id,
                  fromDeepLink: "true",
                },
              });
            }
          }
        }
      } catch (error) {
        console.error("[DeepLink] Navigation error:", error);
        // Fallback to home
        router.replace("/(home)/(user)");
      }
    },
    [router, segments, isSignedIn, isGuest]
  );

  const processDeepLink = useCallback(
    async (url: string, isInitialLink = false) => {
      if (!url || isProcessingDeepLink) return;

      console.log(
        `[DeepLink] Processing ${isInitialLink ? "initial" : "runtime"} link:`,
        url,
        `Platform: ${Platform.OS}`
      );
      setIsProcessingDeepLink(true);

      try {
        const parsedUrl = Linking.parse(url);
        const { hostname, path, queryParams } = parsedUrl;

        console.log("[DeepLink] Parsed URL:", { hostname, path, queryParams });

        // Handle auth callbacks
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

        // Wait for auth to be loaded
        if (!isLoaded) {
          console.log("[DeepLink] Auth not loaded, queueing deep link");
          deepLinkQueue.enqueue(url);
          return;
        }

        // FIXED: Wait for navigation to be ready for initial links
        if (isInitialLink && !isNavigationReady) {
          console.log(
            "[DeepLink] Navigation not ready for initial link, waiting..."
          );
          // Queue it to be processed when navigation is ready
          setTimeout(() => {
            processDeepLink(url, isInitialLink);
          }, 500);
          return;
        }

        // Parse the path based on platform-specific URL formats
        let pathToProcess = "";

        if (Platform.OS === "android") {
          // Android: Handle fleet://cars/123 format where hostname='cars' and path='123'
          if (hostname && !path?.includes(hostname)) {
            pathToProcess = hostname + (path ? "/" + path : "");
          } else {
            pathToProcess = path || hostname || "";
          }
        } else {
          // iOS: Standard path parsing
          pathToProcess = path || "";
        }

        if (pathToProcess) {
          // Normalize path for better matching
          const normalizedPath = pathToProcess
            .toLowerCase()
            .replace(/^\/+/, "");
          console.log(
            `[DeepLink - ${Platform.OS}] Processing normalized path:`,
            normalizedPath
          );

          // Extract ID from various path formats
          let carId: string | null = null;
          let clipId: string | null = null;

          // Match patterns like: cars/123, car/123, /cars/123, etc.
          const carMatch = normalizedPath.match(/^(?:\/)?cars?\/(\d+)$/);
          const clipMatch = normalizedPath.match(
            /^(?:\/)?(?:clips?|autoclips?)\/(\d+)$/
          );

          if (carMatch) {
            carId = carMatch[1];
          } else if (clipMatch) {
            clipId = clipMatch[1];
          }

          const isEffectivelySignedIn = isSignedIn || isGuest;

          // Handle car deep links
          if (carId && !isNaN(Number(carId))) {
            if (!isEffectivelySignedIn) {
              console.log(
                "[DeepLink] User not signed in, redirecting to sign-in first"
              );
              global.pendingDeepLink = { type: "car", id: carId };
              router.replace("/(auth)/sign-in");
              return;
            }

            await navigateToDeepLink("car", carId, isInitialLink);
          }
          // Handle clip deep links
          else if (clipId && !isNaN(Number(clipId))) {
            if (!isEffectivelySignedIn) {
              global.pendingDeepLink = { type: "autoclip", id: clipId };
              router.replace("/(auth)/sign-in");
              return;
            }

            await navigateToDeepLink("clip", clipId, isInitialLink);
          }
          // Handle invalid deep links
          else {
            console.warn(
              "[DeepLink] Unrecognized deep link pattern:",
              pathToProcess
            );

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
          const isEffectivelySignedIn = isSignedIn || isGuest;
          if (isEffectivelySignedIn) {
            router.replace("/(home)/(user)");
          } else {
            router.replace("/(auth)/sign-in");
          }
        }
      } catch (err) {
        console.error("[DeepLink] Processing error:", err);

        // Error recovery
        const isEffectivelySignedIn = isSignedIn || isGuest;
        if (isEffectivelySignedIn) {
          router.replace("/(home)/(user)");
        } else {
          router.replace("/(auth)/sign-in");
        }
      } finally {
        setIsProcessingDeepLink(false);
        // Mark deep links as ready after processing
        if (isInitialLink) {
          initManager.setReady("deepLinks");
        }
      }
    },
    [
      router,
      isLoaded,
      isSignedIn,
      isGuest,
      navigateToDeepLink,
      isNavigationReady,
    ]
  );

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
          console.log(
            `[DeepLink - ${Platform.OS}] App opened with initial URL:`,
            url
          );
          setInitialUrl(url);
        } else {
          console.log("[DeepLink] No initial URL found");
          initManager.setReady("deepLinks");
        }
      })
      .catch((err) => {
        console.error("[DeepLink] Error getting initial URL:", err);
        initManager.setReady("deepLinks");
      });
  }, []);

  // FIXED: Mark navigation as ready when we have proper routing
  useEffect(() => {
    if (isLoaded && segments.length > 0) {
      // Give navigation a moment to stabilize
      const timeout = setTimeout(() => {
        setIsNavigationReady(true);
      }, 500);

      return () => clearTimeout(timeout);
    }
  }, [isLoaded, segments]);

  // Process initial URL when auth and navigation are ready
  useEffect(() => {
    if (
      initialUrl &&
      isLoaded &&
      isNavigationReady &&
      !initialUrlProcessed.current
    ) {
      initialUrlProcessed.current = true;
      console.log(
        `[DeepLink - ${Platform.OS}] Processing initial URL after auth and navigation ready:`,
        initialUrl
      );
      processDeepLink(initialUrl, true);
    } else if (!initialUrl && isLoaded && !initialUrlProcessed.current) {
      // No initial URL and auth is loaded - mark as ready
      initialUrlProcessed.current = true;
      initManager.setReady("deepLinks");
    }
  }, [initialUrl, isLoaded, processDeepLink, isNavigationReady]);

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
      }, 300);
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
      console.log(
        `[DeepLink - ${Platform.OS}] Runtime deep link received:`,
        url
      );

      if (isInitialized && isNavigationReady) {
        processDeepLink(url);
      } else {
        console.log(
          "[DeepLink] App not initialized or navigation not ready, queuing deep link"
        );
        deepLinkQueue.enqueue(url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isInitialized, processDeepLink, isNavigationReady]);

  // Handle pending deep links after sign-in
  useEffect(() => {
    if (isSignedIn && global.pendingDeepLink) {
      const { type, id } = global.pendingDeepLink;
      console.log(
        "[DeepLink] Processing pending deep link after sign-in:",
        type,
        id
      );

      // Wait a bit for navigation to stabilize after sign in
      setTimeout(() => {
        if (type === "car" && id) {
          navigateToDeepLink("car", id, false);
        } else if (type === "autoclip" && id) {
          navigateToDeepLink("clip", id, false);
        }

        global.pendingDeepLink = null;
      }, 500);
    }
  }, [isSignedIn, navigateToDeepLink]);

  return null;
};

// SIMPLIFIED: NotificationsProvider
function NotificationsProvider() {
  const {
    unreadCount,
    isPermissionGranted,
    registerForPushNotifications,
    diagnosticInfo,
  } = useNotifications();
  const { user, isSignedIn } = useAuth();
  const { isGuest } = useGuestUser();
  const initTimeoutRef = useRef<NodeJS.Timeout>();

  // EFFECT: Initialize notifications with faster timeout
  useEffect(() => {
    const initializeNotifications = async () => {
      // RULE: Skip if no user or guest
      if (!user?.id || isGuest || !isSignedIn) {
        return;
      }

      try {
        // TIMEOUT PROTECTION: 3 second initialization timeout
        initTimeoutRef.current = setTimeout(() => {
          console.warn(
            "[NotificationsProvider] TIMEOUT: Skipping notifications after 3 seconds"
          );
        }, 3000);

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
            console.log("[NotificationsProvider] Android channel configured");
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
          const newPermissions = await Notifications.requestPermissionsAsync();

          if (newPermissions?.status !== "granted") {
            console.log("[NotificationsProvider] Permission denied");
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
        registerForPushNotifications(true).catch((error) => {
          console.warn(
            "[NotificationsProvider] Background registration failed:",
            error
          );
        });

        if (initTimeoutRef.current) {
          clearTimeout(initTimeoutRef.current);
          initTimeoutRef.current = undefined;
        }
      } catch (error: any) {
        console.error("[NotificationsProvider] Initialization error:", error);

        if (initTimeoutRef.current) {
          clearTimeout(initTimeoutRef.current);
          initTimeoutRef.current = undefined;
        }
      }
    };

    initializeNotifications();

    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
    };
  }, [user?.id, isSignedIn, isGuest, registerForPushNotifications]);

  return null;
}

function RootLayoutNav() {
  const { isLoaded, isSignedIn, isSigningOut, isSigningIn } = useAuth();
  const { isGuest } = useGuestUser();
  const segments = useSegments();
  const router = useRouter();

  const [splashAnimationComplete, setSplashAnimationComplete] = useState(false);
  const contentOpacity = useRef(new Animated.Value(0.01)).current;

  // This effect correctly handles routing only when auth is loaded.
  useEffect(() => {
    // RULE: Only route when auth is loaded and no sign-in/out is in progress.
    if (!isLoaded || isSigningOut || isSigningIn) return;

    const isEffectivelySignedIn = isSignedIn || isGuest;
    const inAuthGroup = segments[0] === "(auth)";

    // Basic routing logic
    if (isEffectivelySignedIn && inAuthGroup) {
      router.replace("/(home)");
    } else if (!isEffectivelySignedIn && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
    }
  }, [
    isLoaded,
    isSignedIn,
    isGuest,
    segments,
    router,
    isSigningOut,
    isSigningIn,
  ]);

  // Mark auth as ready when loaded
  useEffect(() => {
    if (isLoaded) {
      initManager.setReady("auth");
    }
  }, [isLoaded]);

  // OPTIMIZED: Smoother splash to content transition
  const handleSplashComplete = useCallback(() => {
    console.log('[RootLayout] Custom splash screen completed');
    // Mark splash as ready
    initManager.setReady("splash");

    // Start fading in content BEFORE removing splash
    Animated.timing(contentOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Delay splash removal to ensure content is visible
    setTimeout(() => {
      console.log('[RootLayout] Setting splash animation complete');
      setSplashAnimationComplete(true);
    }, 150);
  }, [contentOpacity]);

  // Get theme for background color
  const colorScheme = useColorScheme();
  const backgroundColor = colorScheme === "dark" ? "#000000" : "#FFFFFF";

  return (
    <View style={{ flex: 1, backgroundColor }}>
      <Animated.View
        style={[styles.contentContainer, { opacity: contentOpacity }]}
      >
        {isLoaded ? <Slot /> : null}
      </Animated.View>

      {!splashAnimationComplete ? (
        <View style={StyleSheet.absoluteFillObject}>
          {console.log('[RootLayout] Rendering CustomSplashScreen')}
          <CustomSplashScreen onAnimationComplete={handleSplashComplete} />
        </View>
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
  splashContainer: {
    ...StyleSheet.absoluteFillObject,
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
export default Sentry.wrap(function RootLayout() {
  const badgeClearingRef = useRef(false);

  // EFFECT: Initialize app systems - OPTIMIZED
  useEffect(() => {
    const initializeApp = async () => {
      try {
        await SplashScreen.preventAutoHideAsync();

        // RULE: Hide the native splash screen immediately to show custom splash
        await SplashScreen.hideAsync();

        // RULE: Mark splash as ready immediately
        initManager.setReady("splash");

        // RULE: Clear badge once - non-blocking
        if (!badgeClearingRef.current) {
          badgeClearingRef.current = true;
          Notifications.setBadgeCountAsync(0).catch((badgeError) => {
            console.warn(
              "[RootLayout] Non-critical: Badge clear failed:",
              badgeError
            );
          });
        }

        // RULE: Cache initial permissions - non-blocking
        Notifications.getPermissionsAsync()
          .then((permissionStatus) => {
            console.log(
              "[RootLayout] Initial permission status:",
              permissionStatus.status
            );

            notificationCache.set(
              NotificationCacheManager.keys.permissions(),
              permissionStatus,
              10 * 60 * 1000
            );
          })
          .catch((notifError) => {
            console.warn(
              "[RootLayout] Non-critical: Permission check failed:",
              notifError
            );
          });

        // RULE: Mark auth as ready (will be overridden by AuthProvider)
        setTimeout(() => {
          initManager.setReady("auth");
        }, 50);

        // RULE: Android splash failsafe
        if (Platform.OS === "android") {
          setTimeout(() => {
            SplashScreen.hideAsync().catch(() => {});
          }, 2000);
        }
      } catch (e) {
        console.warn("[RootLayout] Initialization error:", e);
        // RULE: Force completion on error
        initManager.setReady("splash");
        initManager.setReady("auth");
        initManager.setReady("deepLinks");
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



  // EFFECT: Cleanup on unmount
  useEffect(() => {
    return () => {
      notificationCoordinator.cleanup();
    };
  }, []);

  const toastConfig = {
    info: ({ text1, text2 }: any) => (
      <View className="bg-orange-500 mx-4 my-2 p-4 rounded-2xl shadow-lg">
        <Text className="text-white font-semibold">{text1}</Text>
        {text2 ? <Text className="text-white mt-1">{text2}</Text> : null}
      </View>
    ),
  };

useSlowConnectionToast();     


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
                  <Toast config={toastConfig} />
                </FavoritesProvider>
              </ThemeProvider>
            </QueryClientProvider>
          </AuthProvider>
        </GuestUserProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
});