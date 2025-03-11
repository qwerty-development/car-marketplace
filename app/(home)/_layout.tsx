// app/(home)/_layout.tsx
import React, { useEffect, useState, useRef } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { useAuth } from '@/utils/AuthContext'
import { supabase } from '@/utils/supabase'
import { Alert, View, ActivityIndicator, useColorScheme, Animated } from 'react-native'
import { useNotifications } from '@/hooks/useNotifications'
import { useTheme } from '@/utils/ThemeContext'
import { useGuestUser } from '@/utils/GuestUserContext';

// Global sign-out flag
let isSigningOut = false
export { isSigningOut }

export function setIsSigningOut(value: boolean) {
  isSigningOut = value
}

function LoadingSkeleton() {
  const colorScheme = useColorScheme()
  const fadeAnim = useRef(new Animated.Value(0.5)).current

  useEffect(() => {
    // Pulse from 0.5 to 1 opacity and back
    const pulse = Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0.5,
        duration: 500,
        useNativeDriver: true,
      }),
    ])

    // Loop the pulse animation indefinitely
    const loop = Animated.loop(pulse)
    loop.start()

    // Cleanup on unmount
    return () => {
      loop.stop()
    }
  }, [fadeAnim])

  return (
    <Animated.View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        opacity: fadeAnim,
        backgroundColor: colorScheme === 'dark' ? '#000000' : '#FFFFFF',
      }}
    >
      <ActivityIndicator
        size="large"
        color={colorScheme === 'dark' ? '#FFFFFF' : '#000000'}
      />
    </Animated.View>
  )
}

export default function HomeLayout() {
  const { isLoaded, isSignedIn, user, profile } = useAuth()
  const router = useRouter()
  const segments = useSegments()
  const { isDarkMode } = useTheme()
  const { isGuest, guestId } = useGuestUser();
  const [isCheckingUser, setIsCheckingUser] = useState(true)
  const [isRouting, setIsRouting] = useState(true)
  const { registerForPushNotifications, refreshNotifications } = useNotifications()
  const registrationAttempted = useRef(false)

  // 1) Check/Create Supabase user and handle notifications
  useEffect(() => {
    const checkAndCreateUser = async () => {
      if ((!user && !isGuest) || isSigningOut) return;

      try {
        const userId = isGuest ? `guest_${guestId}` : user?.id;

        if (!userId) return;

        // Check if user exists in Supabase
        const { data: existingUser, error: fetchError } = await supabase
          .from('users')
          .select()
          .eq('id', userId)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          throw fetchError;
        }

        // Create user if they don't exist
        if (!existingUser) {
          const email = isGuest
            ? `guest_${guestId}@example.com`
            : user?.email || '';

          const name = isGuest
            ? 'Guest User'
            : profile?.name || user?.user_metadata?.name || '';

          const { error: insertError } = await supabase.from('users').insert([
            {
              id: userId,
              name: name,
              email: email,
              favorite: [],
              is_guest: isGuest
            }
          ]);
          if (insertError) throw insertError;
          console.log('Created new user in Supabase');
        }

        // Update last_active timestamp
        const { error: updateError } = await supabase
          .from('users')
          .update({ last_active: new Date().toISOString() })
          .eq('id', userId);

        if (updateError) throw updateError;
        console.log('Updated last_active for user in Supabase');

        // Register for notifications (skip for guests or conditionally register)
        if (!isGuest) {
          await registerForPushNotifications();
        }
      } catch (error) {
        console.error('Error in user sync:', error);
        Alert.alert(
          'Error',
          'There was a problem setting up your account. Please try again later.'
        );
      } finally {
        setIsCheckingUser(false);
      }
    };

    if ((isSignedIn && user) || isGuest) {
      checkAndCreateUser();
    } else {
      setIsCheckingUser(false);
    }
  }, [isSignedIn, user, isGuest, guestId, profile]);

  // Modify the routing logic
  useEffect(() => {
    if (!isLoaded) return;
    if (isCheckingUser) return;

    const isEffectivelySignedIn = isSignedIn || isGuest;

    if (!isEffectivelySignedIn) {
      router.replace('/sign-in');
      return;
    }

    // Always route guests to user role
    let role = 'user';

    if (!isGuest && user) {

      const userRole = profile?.role;
      role = userRole || 'user';
    }

    const correctRouteSegment = `(${role})`;

    if (segments[1] !== correctRouteSegment) {
      setIsRouting(true);
      router.replace(`/(home)/${correctRouteSegment}`);
      setIsRouting(false);
    } else {
      setIsRouting(false);
    }
  }, [isLoaded, isSignedIn, isGuest, isCheckingUser, user, segments]);

  // 3) Show loading animation while in any loading state
  if (isRouting || !isLoaded || isCheckingUser) {
    return <LoadingSkeleton />
  }

  // 4) Render child routes
  return (
    <View style={{ flex: 1, backgroundColor: isDarkMode ? '#000000' : '#FFFFFF' }}>
      <Slot />
    </View>
  )
}