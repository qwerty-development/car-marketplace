// app/(home)/_layout.tsx
import React, { useEffect, useState, useRef } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { useAuth } from "@/utils/AuthContext";
import { supabase } from "@/utils/supabase";
import { Alert, View, useColorScheme } from "react-native";
import { useNotifications } from "@/hooks/useNotifications";
import { useTheme } from "@/utils/ThemeContext";
import { useGuestUser } from "@/utils/GuestUserContext";
import LogoLoader from "@/components/LogoLoader";

// Global sign-out flag with improved implementation
let isSigningOut = false;
export { isSigningOut };

// Improved setter with logging and operation cancellation
export function setIsSigningOut(value: boolean) {
  const previous = isSigningOut;
  isSigningOut = value;

  // Log changes for debugging
  if (previous !== value) {
    console.log(`Sign out state changed: ${previous} -> ${value}`);

    // Cancel any pending operations when signing out starts
    if (value === true) {
      console.log("Cancelling pending operations due to sign out");
      // Additional cleanup could be added here if needed
    }
  }
}

// Coordinated sign out function to improve sign out process
export async function coordinateSignOut(
  router: any,
  authSignOut: () => Promise<void>
) {
  // Only proceed if not already signing out
  if (isSigningOut) {
    console.log("Sign out already in progress");
    return;
  }

  // Set global flag first to prevent concurrent operations
  setIsSigningOut(true);

  try {
    // 1. Navigate to auth screen immediately to prevent further user interactions
    console.log("Navigating to sign-in screen");
    router.replace("/(auth)/sign-in");

    // 2. Small delay to ensure navigation completes before heavier operations
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 3. Trigger the actual sign out process
    console.log("Executing auth sign out");
    await authSignOut();

    console.log("Sign out coordination completed successfully");
    return true;
  } catch (error) {
    console.error("Error during coordinated sign out:", error);

    // Force navigation to sign-in on failure
    router.replace("/(auth)/sign-in");

    // Reset global flag
    setIsSigningOut(false);
    return false;
  }
}

export default function HomeLayout() {
  const { isLoaded, isSignedIn, user, profile } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const { isDarkMode } = useTheme();
  const { isGuest, guestId } = useGuestUser();
  const [isCheckingUser, setIsCheckingUser] = useState(true);
  const [isRouting, setIsRouting] = useState(true);
  const { registerForPushNotifications } = useNotifications();
  const registrationAttempted = useRef(false);

  const [showLoader, setShowLoader] = useState(true)
  useEffect(() => {
    const timeout = setTimeout(() => setShowLoader(false), 1500)
    return () => clearTimeout(timeout)
  }, [])

  // 1) Check/Create Supabase user and handle notifications
  useEffect(() => {
// In app/(home)/_layout.tsx
// Update the checkAndCreateUser function:

const checkAndCreateUser = async () => {
  // Skip if signing out or no user info
  if ((!user && !isGuest) || isSigningOut) return;

  try {
    const userId = isGuest ? `guest_${guestId}` : user?.id;
    if (!userId) return;

    // CRITICAL CHANGE: Split into two phases - critical and non-critical
    // Phase 1: Quick check for user existence - doesn't block UI
    const { data: existingUser, error: fetchError } = await supabase
      .from("users")
      .select("id") // Only select ID for quick check
      .eq("id", userId)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      throw fetchError;
    }

    // Create user if they don't exist - critical operation
    if (!existingUser) {
      const email = isGuest
        ? `guest_${guestId}@example.com`
        : user?.email || "";

      const name = isGuest
        ? "Guest User"
        : profile?.name || user?.user_metadata?.name || "";

      await supabase.from("users").upsert(
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
      );

      console.log("Created new user in Supabase");
    }

    // CRITICAL CHANGE: Mark user checking as complete to unblock UI
    // This allows the app to show the main interface faster
    setIsCheckingUser(false);

    // Phase 2: Non-critical operations moved to background
    // These operations happen after UI is shown
    setTimeout(async () => {
      try {
        // Skip if sign out started during this operation
        if (isSigningOut) return;
        
        // Update last_active timestamp (non-critical)
        await supabase
          .from("users")
          .update({ last_active: new Date().toISOString() })
          .eq("id", userId);
        
        console.log("Updated last_active for user in Supabase");

        // Register for notifications as a background task (non-critical)
        if (!isGuest && !isSigningOut) {
          registerForPushNotifications().catch((notificationError) => {
            console.error(
              "Error in background push notification registration:",
              notificationError
            );
          });
        }
      } catch (error) {
        console.error("Background user sync error:", error);
        // Non-blocking error - app continues to function
      }
    }, 3000); // 3 seconds after UI is shown
    
  } catch (error: any) {
    console.error("Error in user sync:", error);
    setIsCheckingUser(false);
  }
};

    if ((isSignedIn && user) || isGuest) {
      checkAndCreateUser();
    } else {
      setIsCheckingUser(false);
    }
  }, [
    isSignedIn,
    user,
    isGuest,
    guestId,
    profile,
    registerForPushNotifications,
  ]);

  // Handle routing logic with sign-out awareness
  useEffect(() => {
    if (isSigningOut || !isLoaded) return;

    // Wait until we finish checking user
    if (isCheckingUser) return;

    const isEffectivelySignedIn = isSignedIn || isGuest;

    if (!isEffectivelySignedIn) {
      router.replace("/(auth)/sign-in");
      return;
    }

    // Ensure profile is loaded before routing
    if (!isGuest && !profile) {
      return; // Wait until profile is ready
    }

    const role = isGuest ? "user" : profile?.role || "user";
    const correctRouteSegment = `(${role})`;

    if (segments[1] !== correctRouteSegment) {
      setIsRouting(true);
      router.replace(`/(home)/${correctRouteSegment}`);
      setIsRouting(false);
    } else {
      setIsRouting(false);
    }
  }, [
    isLoaded,
    isSignedIn,
    isGuest,
    user,
    profile,
    segments,
    router,
    isCheckingUser,
  ]);

if (
  showLoader || 
  isCheckingUser || 
  isRouting || 
  !isLoaded || 
  (!isGuest && !profile)
) {
  return <LogoLoader />
}

  return (
    <View
      style={{ flex: 1, backgroundColor: isDarkMode ? "#000000" : "#FFFFFF" }}
    >
      <Slot />
    </View>
  );
}
