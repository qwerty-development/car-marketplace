import React, { useEffect, useState, useRef } from "react";
import { Slot, useRouter, useSegments, Stack } from "expo-router";
import { useAuth } from "@/utils/AuthContext";
import { supabase } from "@/utils/supabase";
import { Alert, View, useColorScheme, Platform } from "react-native";
import { useNotifications } from "@/hooks/useNotifications";
import { useTheme } from "@/utils/ThemeContext";
import { useGuestUser } from "@/utils/GuestUserContext";
import LogoLoader from "@/components/LogoLoader";

// CRITICAL SYSTEM: Global sign-out flag management
let isSigningOut = false;
export { isSigningOut };

// REDUCED TIMEOUT CONSTANTS: For better performance
const OPERATION_TIMEOUTS = {
  USER_CHECK: 3000, // Reduced from 8 seconds
  DATABASE_OPERATION: 2000, // Reduced from 5 seconds
  PROFILE_FETCH: 1500, // Reduced from 3 seconds
  BACKGROUND_OPERATIONS: 5000, // Reduced from 10 seconds
  ROUTING_OPERATION: 1000, // Reduced from 3 seconds
  MASTER_TIMEOUT: 8000, // Reduced from 15 seconds
} as const;

// CRITICAL INTERFACE: Operation state tracking
interface OperationState {
  userCheck: 'idle' | 'running' | 'completed' | 'failed';
  profileFetch: 'idle' | 'running' | 'completed' | 'failed';
  routing: 'idle' | 'running' | 'completed';
}

// Declare global routing flag for HomeLayout
declare global {
  var isHomeLayoutRouting: boolean;
  var lastHomeLayoutRoute: string;
}

// Initialize global flags
global.isHomeLayoutRouting = false;
global.lastHomeLayoutRoute = "";

// METHOD: Set global sign-out state
export function setIsSigningOut(value: boolean) {
  const previous = isSigningOut;
  isSigningOut = value;

  if (previous !== value) {
    console.log(`[HomeLayout] Sign out state changed: ${previous} -> ${value}`);

    if (value === true) {
      console.log("[HomeLayout] Cancelling pending operations due to sign out");
    }
  }
}

// METHOD: Coordinate sign out process
export async function coordinateSignOut(
  router: any,
  authSignOut: () => Promise<void>
) {
  // RULE: Prevent duplicate sign out attempts
  if (isSigningOut) {
    console.log("[HomeLayout] Sign out already in progress");
    return;
  }

  setIsSigningOut(true);
  global.isHomeLayoutRouting = true;

  try {
    console.log("[HomeLayout] Navigating to sign-in screen");
    router.replace("/(auth)/sign-in");

    await new Promise((resolve) => setTimeout(resolve, 100));

    console.log("[HomeLayout] Executing auth sign out");
    await authSignOut();

    console.log("[HomeLayout] Sign out coordination completed successfully");
    return true;
  } catch (error) {
    console.error("[HomeLayout] Error during coordinated sign out:", error);
    router.replace("/(auth)/sign-in");
    setIsSigningOut(false);
    return false;
  } finally {
    setTimeout(() => {
      global.isHomeLayoutRouting = false;
    }, 2000);
  }
}

// UTILITY: Timeout wrapper for database operations
const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
};

export default function HomeLayout() {
  const { isLoaded, isSignedIn, user, profile } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const { isDarkMode } = useTheme();
  const { isGuest, guestId } = useGuestUser();
  
  // STATE MANAGEMENT: Enhanced operation tracking
  const [operationState, setOperationState] = useState<OperationState>({
    userCheck: 'idle',
    profileFetch: 'idle',
    routing: 'idle',
  });
  
  const [showLoader, setShowLoader] = useState(true);
  const [forceComplete, setForceComplete] = useState(false);
  
  // HOOKS: External dependencies
  const { registerForPushNotifications } = useNotifications();
  
  // REFS: Timeout and operation management
  const registrationAttempted = useRef(false);
  const operationTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const backgroundOperationsRef = useRef<Set<Promise<any>>>(new Set());
  const routingDebounce = useRef<NodeJS.Timeout | null>(null);
  const lastRoutingAttempt = useRef<number>(0);

  // ANDROID FIX: Enhanced navigation stack management for deep links
  useEffect(() => {
    if (Platform.OS === 'android') {
      // Check if we're in a deep navigation state without proper stack
      const isDeepRoute = segments.length > 2 && !segments.includes('(tabs)');
      
      if (isDeepRoute) {
        console.log('[HomeLayout] Android deep route detected, ensuring proper stack:', segments);
        
        // Additional Android-specific deep link handling
        const isAutoclipDeepLink = segments.some(segment => 
          segment.includes('autoclips') || segment.includes('clips')
        );
        
        const isCarDeepLink = segments.some(segment => 
          segment.includes('CarDetails') || segment.includes('cars')
        );
        
        if (isAutoclipDeepLink) {
          console.log('[HomeLayout] Android autoclip deep link detected');
        }
        
        if (isCarDeepLink) {
          console.log('[HomeLayout] Android car deep link detected');
        }
      }
    }
  }, [segments]);

  // CRITICAL SYSTEM: Master timeout to prevent infinite loading
  useEffect(() => {
    const masterTimeout = setTimeout(() => {
      console.warn('[HomeLayout] MASTER TIMEOUT: Forcing app to load after 8 seconds');
      setForceComplete(true);
      setShowLoader(false);
      setOperationState({
        userCheck: 'completed',
        profileFetch: 'completed',
        routing: 'completed',
      });
    }, OPERATION_TIMEOUTS.MASTER_TIMEOUT);

    return () => clearTimeout(masterTimeout);
  }, []);

  // CLEANUP SYSTEM: Timeout management
  useEffect(() => {
    return () => {
      // RULE: Clear all operation timeouts on unmount
      operationTimeouts.current.forEach(timeout => clearTimeout(timeout));
      operationTimeouts.current.clear();
      
      // RULE: Cancel background operations
      backgroundOperationsRef.current.clear();
      
      // Clear routing debounce
      if (routingDebounce.current) {
        clearTimeout(routingDebounce.current);
        routingDebounce.current = null;
      }
    };
  }, []);

  // OPTIMIZED: Concurrent user check and creation
  useEffect(() => {
    const checkAndCreateUser = async () => {
      // RULE: Skip if conditions not met
      if ((!user && !isGuest) || isSigningOut || forceComplete) return;
      if (operationState.userCheck !== 'idle') return;

      try {
        setOperationState(prev => ({ ...prev, userCheck: 'running' }));
        
        // TIMEOUT PROTECTION: User check operation timeout
        const userCheckTimeout = setTimeout(() => {
          console.warn('[HomeLayout] User check TIMEOUT: Completing anyway');
          setOperationState(prev => ({ ...prev, userCheck: 'completed' }));
        }, OPERATION_TIMEOUTS.USER_CHECK);
        
        operationTimeouts.current.set('userCheck', userCheckTimeout);

        // STEP 1: Determine user ID
        const userId = isGuest ? `guest_${guestId}` : user?.id;
        if (!userId) {
          setOperationState(prev => ({ ...prev, userCheck: 'completed' }));
          return;
        }

        // STEP 2: Quick existence check with timeout protection
        let existingUser;
        try {
          const result = await withTimeout(
            supabase
              .from("users")
              .select("id")
              .eq("id", userId)
              .single(),
            OPERATION_TIMEOUTS.DATABASE_OPERATION,
            'user existence check'
          );
          existingUser = result.data;
        } catch (error: any) {
          if (error.message.includes('timed out')) {
            console.warn('[HomeLayout] User existence check TIMEOUT: Assuming user needs creation');
            existingUser = null;
          } else if (error.code !== "PGRST116") {
            throw error;
          } else {
            existingUser = null;
          }
        }

        // STEP 3: Create user if doesn't exist (non-blocking)
        if (!existingUser) {
          const email = isGuest
            ? `guest_${guestId}@example.com`
            : user?.email || "";

          const name = isGuest
            ? "Guest User"
            : profile?.name || user?.user_metadata?.name || "";

          // Create user in background
          const createUserPromise = withTimeout(
            supabase.from("users").upsert(
              [
                {
                  id: userId,
                  name: name,
                  email: email,
                  favorite: [],
                  is_guest: isGuest,
                  last_active: new Date().toISOString(),
                },
              ],
              {
                onConflict: "id",
                ignoreDuplicates: false,
              }
            ),
            OPERATION_TIMEOUTS.DATABASE_OPERATION,
            'user creation'
          ).catch(error => {
            console.warn('[HomeLayout] User creation error (non-critical):', error);
          });

          backgroundOperationsRef.current.add(createUserPromise);
        }

        // STEP 4: Clear timeout and mark as completed immediately
        clearTimeout(userCheckTimeout);
        operationTimeouts.current.delete('userCheck');
        setOperationState(prev => ({ ...prev, userCheck: 'completed' }));

        // STEP 5: Background operations (non-blocking)
        const backgroundOperations = async () => {
          try {
            if (isSigningOut || forceComplete) return;
            
            // BACKGROUND TASK: Update last_active (non-blocking)
            const lastActivePromise = withTimeout(
              supabase
                .from("users")
                .update({ last_active: new Date().toISOString() })
                .eq("id", userId),
              OPERATION_TIMEOUTS.DATABASE_OPERATION,
              'last_active update'
            ).catch(error => {
              console.warn('[HomeLayout] Background last_active update failed:', error);
            });

            backgroundOperationsRef.current.add(lastActivePromise);
            
            // BACKGROUND TASK: Register for notifications (non-blocking)
            if (!isGuest && !isSigningOut) {
              const notificationPromise = registerForPushNotifications(false).catch((notificationError) => {
                console.warn("[HomeLayout] Background push notification registration failed:", notificationError);
              });
              
              backgroundOperationsRef.current.add(notificationPromise);
            }
          } catch (error) {
            console.warn('[HomeLayout] Background operations error:', error);
          }
        };

        // RULE: Execute background operations without blocking UI
        backgroundOperations();
        
      } catch (error: any) {
        console.error("[HomeLayout] Error in user sync:", error);
        setOperationState(prev => ({ ...prev, userCheck: 'failed' }));
        
        // RULE: Don't block app for user sync errors
        setTimeout(() => {
          setOperationState(prev => ({ ...prev, userCheck: 'completed' }));
        }, 500);
      }
    };

    // RULE: Execute user check when conditions are met
    if ((isSignedIn && user) || isGuest) {
      checkAndCreateUser();
    } else {
      setOperationState(prev => ({ ...prev, userCheck: 'completed' }));
    }
  }, [
    isSignedIn,
    user,
    isGuest,
    guestId,
    profile,
    registerForPushNotifications,
    operationState.userCheck,
    forceComplete,
  ]);

  // OPTIMIZED: Fast routing logic with loop prevention
  useEffect(() => {
    // RULE: Skip if conditions not met
    if (isSigningOut || !isLoaded || forceComplete) return;
    if (operationState.routing !== 'idle') return;
    
    // CRITICAL: Check global routing flags to prevent loops
    if (global.isHomeLayoutRouting || global.isRoutingInProgress || global.isRoutingFromNotFound) {
      console.log('[HomeLayout] Another component is routing, skipping');
      return;
    }

    // CRITICAL: Debounce routing
    const now = Date.now();
    if (now - lastRoutingAttempt.current < 500) {
      console.log('[HomeLayout] Routing too fast, debouncing');
      return;
    }
    lastRoutingAttempt.current = now;

    // Clear existing debounce
    if (routingDebounce.current) {
      clearTimeout(routingDebounce.current);
      routingDebounce.current = null;
    }

    routingDebounce.current = setTimeout(() => {
      // RULE: Don't wait too long for user check
      if (operationState.userCheck === 'running') {
        const routingTimeout = setTimeout(() => {
          console.warn('[HomeLayout] Routing TIMEOUT: Proceeding anyway');
          setOperationState(prev => ({ ...prev, routing: 'running' }));
        }, OPERATION_TIMEOUTS.ROUTING_OPERATION);
        
        operationTimeouts.current.set('routing', routingTimeout);
        return;
      }

      setOperationState(prev => ({ ...prev, routing: 'running' }));

      // STEP 1: Determine effective sign-in state
      const isEffectivelySignedIn = isSignedIn || isGuest;

      // STEP 2: Check current route to prevent redundant navigation
      const currentRoute = segments.join('/');
      const targetRoute = isEffectivelySignedIn ? 
        (isGuest ? "(home)/(user)" : `(home)/(${profile?.role || 'user'})`) : 
        "(auth)/sign-in";

      // CRITICAL: Prevent same route navigation
      if (currentRoute === global.lastHomeLayoutRoute) {
        console.log('[HomeLayout] Same route as last time, skipping:', currentRoute);
        setOperationState(prev => ({ ...prev, routing: 'completed' }));
        return;
      }

      global.lastHomeLayoutRoute = currentRoute;

      // STEP 3: Handle unauthenticated users
      if (!isEffectivelySignedIn) {
        global.isHomeLayoutRouting = true;
        router.replace("/(auth)/sign-in");
        setOperationState(prev => ({ ...prev, routing: 'completed' }));
        setTimeout(() => {
          global.isHomeLayoutRouting = false;
        }, 1000);
        return;
      }

      // STEP 4: Handle guests (skip profile check)
      if (isGuest) {
        const correctRouteSegment = "(user)";
        if (segments[1] !== correctRouteSegment) {
          global.isHomeLayoutRouting = true;
          router.replace(`/(home)/${correctRouteSegment}`);
          setTimeout(() => {
            global.isHomeLayoutRouting = false;
          }, 1000);
        }
        setOperationState(prev => ({ ...prev, routing: 'completed' }));
        return;
      }

      // STEP 5: Handle authenticated users - quick profile check
      if (!profile) {
        // TIMEOUT PROTECTION: Don't wait forever for profile
        const profileTimeout = setTimeout(() => {
          console.warn('[HomeLayout] Profile loading TIMEOUT: Using default role');
          const defaultRole = "user";
          const correctRouteSegment = `(${defaultRole})`;
          
          if (segments[1] !== correctRouteSegment) {
            global.isHomeLayoutRouting = true;
            router.replace(`/(home)/${correctRouteSegment}`);
            setTimeout(() => {
              global.isHomeLayoutRouting = false;
            }, 1000);
          }
          setOperationState(prev => ({ ...prev, routing: 'completed' }));
        }, OPERATION_TIMEOUTS.PROFILE_FETCH);
        
        operationTimeouts.current.set('profile', profileTimeout);
        return;
      }

      // STEP 6: Clear profile timeout if set
      const profileTimeout = operationTimeouts.current.get('profile');
      if (profileTimeout) {
        clearTimeout(profileTimeout);
        operationTimeouts.current.delete('profile');
      }

      // STEP 7: Route based on user role
      const role = profile?.role || "user";
      const correctRouteSegment = `(${role})`;

      if (segments[1] !== correctRouteSegment) {
        global.isHomeLayoutRouting = true;
        router.replace(`/(home)/${correctRouteSegment}`);
        setTimeout(() => {
          global.isHomeLayoutRouting = false;
        }, 1000);
      }
      
      setOperationState(prev => ({ ...prev, routing: 'completed' }));
    }, 300); // 300ms debounce

    return () => {
      if (routingDebounce.current) {
        clearTimeout(routingDebounce.current);
        routingDebounce.current = null;
      }
    };
  }, [
    isLoaded,
    isSignedIn,
    isGuest,
    user,
    profile,
    segments,
    router,
    operationState.userCheck,
    operationState.routing,
    forceComplete,
  ]);

  // OPTIMIZED: Faster loader management
  useEffect(() => {
    const checkIfReady = () => {
      // RULE: Force complete overrides everything
      if (forceComplete) {
        setShowLoader(false);
        return;
      }

      // RULE: Check if critical operations are done
      const isUserCheckDone = operationState.userCheck === 'completed' || operationState.userCheck === 'failed';
      const isRoutingDone = operationState.routing === 'completed';
      const isBasicLoadingDone = isLoaded;

      // RULE: Show app as soon as routing is done
      if (isRoutingDone && isBasicLoadingDone) {
        setShowLoader(false);
      }
    };

    checkIfReady();
  }, [operationState, isLoaded, forceComplete]);

  // SAFETY SYSTEM: Emergency loader timeout
  useEffect(() => {
    const loaderTimeout = setTimeout(() => {
      console.warn('[HomeLayout] EMERGENCY TIMEOUT: Showing app after 6 seconds');
      setShowLoader(false);
    }, 6000); // Reduced from 12 seconds

    return () => clearTimeout(loaderTimeout);
  }, []);

  // CONDITIONAL RENDERING: Show loader only when necessary
  if (showLoader && !forceComplete) {
    return (
      <View style={{ flex: 1, backgroundColor: isDarkMode ? "#000000" : "#FFFFFF" }}>
        <LogoLoader />
      </View>
    );
  }

  // MAIN RENDER: Home layout container with enhanced Android navigation
  return (
    <View
      style={{ flex: 1, backgroundColor: isDarkMode ? "#000000" : "#FFFFFF" }}
    >
      <Stack
        screenOptions={{
          headerShown: false,
          // ANDROID FIX: Ensure proper animation for deep links
          animation: Platform.OS === 'android' ? 'slide_from_right' : 'default',
          // ANDROID FIX: Improve performance during navigation
          animationTypeForReplace: Platform.OS === 'android' ? 'push' : 'pop',
          // ANDROID FIX: Prevent navigation stack issues
          gestureEnabled: Platform.OS === 'ios',
        }}
      >
        <Stack.Screen 
          name="(user)" 
          options={{ 
            headerShown: false,
            // ANDROID FIX: Ensure proper stack management
            presentation: Platform.OS === 'android' ? 'card' : 'modal',
          }} 
        />
        <Stack.Screen 
          name="(dealer)" 
          options={{ 
            headerShown: false,
            presentation: Platform.OS === 'android' ? 'card' : 'modal',
          }} 
        />
      </Stack>
    </View>
  );
}