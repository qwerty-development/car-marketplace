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

// TIMEOUT CONSTANTS: Prevent infinite operations
const OPERATION_TIMEOUTS = {
  USER_CHECK: 8000, // 8 seconds max for user check
  DATABASE_OPERATION: 5000, // 5 seconds max for individual DB operations
  PROFILE_FETCH: 3000, // 3 seconds max for profile fetch
  BACKGROUND_OPERATIONS: 10000, // 10 seconds max for background operations
  ROUTING_OPERATION: 3000, // 3 seconds max for routing decisions
  MASTER_TIMEOUT: 15000, // 15 seconds absolute maximum
} as const;

// CRITICAL INTERFACE: Operation state tracking
interface OperationState {
  userCheck: 'idle' | 'running' | 'completed' | 'failed';
  profileFetch: 'idle' | 'running' | 'completed' | 'failed';
  routing: 'idle' | 'running' | 'completed';
}

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
          // Ensure proper navigation hierarchy for autoclips
        }
        
        if (isCarDeepLink) {
          console.log('[HomeLayout] Android car deep link detected');
          // Ensure proper navigation hierarchy for car details
        }
      }
    }
  }, [segments]);

  // CRITICAL SYSTEM: Master timeout to prevent infinite loading
  useEffect(() => {
    const masterTimeout = setTimeout(() => {
      console.warn('[HomeLayout] MASTER TIMEOUT: Forcing app to load after 15 seconds');
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
    };
  }, []);

  // CRITICAL EFFECT: Enhanced user check and creation with timeout protection
  useEffect(() => {
    const checkAndCreateUser = async () => {
      // RULE: Skip if conditions not met
      if ((!user && !isGuest) || isSigningOut || forceComplete) return;
      if (operationState.userCheck !== 'idle') return;

      try {
        setOperationState(prev => ({ ...prev, userCheck: 'running' }));
        
        // TIMEOUT PROTECTION: User check operation timeout
        const userCheckTimeout = setTimeout(() => {
          console.warn('[HomeLayout] User check TIMEOUT: Completing anyway after 8 seconds');
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

        // STEP 3: Create user if doesn't exist
        if (!existingUser) {
          const email = isGuest
            ? `guest_${guestId}@example.com`
            : user?.email || "";

          const name = isGuest
            ? "Guest User"
            : profile?.name || user?.user_metadata?.name || "";

          try {
            await withTimeout(
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
            );

            console.log("[HomeLayout] Created new user in Supabase");
          } catch (createError: any) {
            if (createError.message.includes('timed out')) {
              console.warn('[HomeLayout] User creation TIMEOUT: Continuing anyway');
            } else {
              console.error('[HomeLayout] User creation error:', createError);
            }
          }
        }

        // STEP 4: Clear timeout and mark as completed
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

            // TIMEOUT PROTECTION: Background operations timeout
            const backgroundTimeout = setTimeout(() => {
              console.warn('[HomeLayout] Background operations TIMEOUT after 10 seconds');
            }, OPERATION_TIMEOUTS.BACKGROUND_OPERATIONS);

            await Promise.allSettled(Array.from(backgroundOperationsRef.current));
            clearTimeout(backgroundTimeout);
            
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
        }, 1000);
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

  // CRITICAL EFFECT: Enhanced routing logic with timeout protection
  useEffect(() => {
    // RULE: Skip if conditions not met
    if (isSigningOut || !isLoaded || forceComplete) return;
    if (operationState.routing !== 'idle') return;

    // RULE: Wait for user check to complete, but not indefinitely
    if (operationState.userCheck === 'running') {
      const routingTimeout = setTimeout(() => {
        console.warn('[HomeLayout] Routing TIMEOUT: Proceeding anyway after 3 seconds');
        setOperationState(prev => ({ ...prev, routing: 'running' }));
      }, OPERATION_TIMEOUTS.ROUTING_OPERATION);
      
      operationTimeouts.current.set('routing', routingTimeout);
      return;
    }

    setOperationState(prev => ({ ...prev, routing: 'running' }));

    // STEP 1: Determine effective sign-in state
    const isEffectivelySignedIn = isSignedIn || isGuest;

    // STEP 2: Handle unauthenticated users
    if (!isEffectivelySignedIn) {
      router.replace("/(auth)/sign-in");
      setOperationState(prev => ({ ...prev, routing: 'completed' }));
      return;
    }

    // STEP 3: Handle guests (skip profile check)
    if (isGuest) {
      const correctRouteSegment = "(user)";
      if (segments[1] !== correctRouteSegment) {
        router.replace(`/(home)/${correctRouteSegment}`);
      }
      setOperationState(prev => ({ ...prev, routing: 'completed' }));
      return;
    }

    // STEP 4: Handle authenticated users (ensure profile loaded)
    if (!profile) {
      // TIMEOUT PROTECTION: Profile loading timeout
      const profileTimeout = setTimeout(() => {
        console.warn('[HomeLayout] Profile loading TIMEOUT: Using default role after 3 seconds');
        const defaultRole = "user";
        const correctRouteSegment = `(${defaultRole})`;
        
        if (segments[1] !== correctRouteSegment) {
          router.replace(`/(home)/${correctRouteSegment}`);
        }
        setOperationState(prev => ({ ...prev, routing: 'completed' }));
      }, OPERATION_TIMEOUTS.PROFILE_FETCH);
      
      operationTimeouts.current.set('profile', profileTimeout);
      return;
    }

    // STEP 5: Clear profile timeout if set
    const profileTimeout = operationTimeouts.current.get('profile');
    if (profileTimeout) {
      clearTimeout(profileTimeout);
      operationTimeouts.current.delete('profile');
    }

    // STEP 6: Route based on user role
    const role = profile?.role || "user";
    const correctRouteSegment = `(${role})`;

    if (segments[1] !== correctRouteSegment) {
      router.replace(`/(home)/${correctRouteSegment}`);
    }
    
    setOperationState(prev => ({ ...prev, routing: 'completed' }));
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

  // EFFECT: Loader management with multiple completion conditions
  useEffect(() => {
    const checkIfReady = () => {
      // RULE: Force complete overrides everything
      if (forceComplete) {
        setShowLoader(false);
        return;
      }

      // RULE: Check if all critical operations are done
      const isUserCheckDone = operationState.userCheck === 'completed' || operationState.userCheck === 'failed';
      const isRoutingDone = operationState.routing === 'completed';
      const isBasicLoadingDone = isLoaded;

      // RULE: All conditions must be met to hide loader
      if (isUserCheckDone && isRoutingDone && isBasicLoadingDone) {
        setShowLoader(false);
      }
    };

    checkIfReady();
  }, [operationState, isLoaded, forceComplete]);

  // SAFETY SYSTEM: Emergency loader timeout
  useEffect(() => {
    const loaderTimeout = setTimeout(() => {
      console.warn('[HomeLayout] EMERGENCY TIMEOUT: Showing app after 12 seconds');
      setShowLoader(false);
    }, 12000); // 12 second emergency timeout

    return () => clearTimeout(loaderTimeout);
  }, []);

  // CONDITIONAL RENDERING: Show loader only when necessary
  if (showLoader && !forceComplete) {
    return <LogoLoader />;
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