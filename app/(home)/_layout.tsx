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
    const checkAndCreateUser = async () => {
      // Skip if signing out or no user info
      if ((!user && !isGuest) || isSigningOut) return;

      try {
        const userId = isGuest ? `guest_${guestId}` : user?.id;
        if (!userId) return;

        // Check if user exists in Supabase
        const { data: existingUser, error: fetchError } = await supabase
          .from("users")
          .select()
          .eq("id", userId)
          .single();

        if (fetchError && fetchError.code !== "PGRST116") {
          throw fetchError;
        }

        // Create user if they don't exist
        if (!existingUser) {
          const email = isGuest
            ? `guest_${guestId}@example.com`
            : user?.email || "";

          const name = isGuest
            ? "Guest User"
            : profile?.name || user?.user_metadata?.name || "";

          // Use upsert with conflict handling
          const { error: upsertError } = await supabase.from("users").upsert(
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
              onConflict: "id", // Handle ID conflicts
              ignoreDuplicates: false,
            }
          );

          if (upsertError) {
            // Only throw for non-duplicate errors
            if (upsertError.code !== "23505") {
              throw upsertError;
            } else {
              console.log("User record already exists, continuing...");
            }
          } else {
            console.log("Created new user in Supabase");
          }

          // IMPORTANT: Add a delay before attempting push notification registration
          // to ensure the user record is fully committed in the database
          await new Promise((resolve) => setTimeout(resolve, 500)); // Reduced from 3000ms
        }

        // Skip further processing if sign out started during this operation
        if (isSigningOut) {
          console.log("Sign out detected, skipping remaining user setup");
          setIsCheckingUser(false);
          return;
        }

        // Update last_active timestamp
        const { error: updateError } = await supabase
          .from("users")
          .update({ last_active: new Date().toISOString() })
          .eq("id", userId);

        if (updateError) throw updateError;
        console.log("Updated last_active for user in Supabase");

        // Register for notifications ONLY after we've confirmed user exists
        if (!isGuest && !isSigningOut) {
          try {
            // Move this to a background task or perform later
            registerForPushNotifications().catch((notificationError) => {
              console.error(
                "Error registering for push notifications:",
                notificationError
              );
            });
          } catch (notificationError) {
            console.error(
              "Error initiating push notifications:",
              notificationError
            );
          }
        }
      } catch (error: any) {
        console.error("Error in user sync:", error);

        // Only show alert for unexpected errors
        if (
          !(error.code === "23505" && error.details?.includes("email")) &&
          !(error.code === "23503")
        ) {
     
        }
      } finally {
        if (!isSigningOut) {
          setIsCheckingUser(false);
        }
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
