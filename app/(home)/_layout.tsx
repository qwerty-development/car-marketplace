// app/(home)/_layout.tsx
import React, { useEffect, useState, useRef } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { useAuth, useUser } from '@clerk/clerk-expo'
import { supabase } from '@/utils/supabase'
import { Alert, View, ActivityIndicator, useColorScheme, Animated } from 'react-native'
import { useNotifications } from '@/hooks/useNotifications'
import { useTheme } from '@/utils/ThemeContext'

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
  const { isLoaded, isSignedIn } = useAuth()
  const { user } = useUser()
  const router = useRouter()
  const segments = useSegments()
  const { isDarkMode } = useTheme()

  const [isCheckingUser, setIsCheckingUser] = useState(true)
  const [isRouting, setIsRouting] = useState(true)
  const { registerForPushNotifications, refreshNotifications } = useNotifications()
  const registrationAttempted = useRef(false)

  // 1) Check/Create Supabase user and handle notifications
  useEffect(() => {
    const checkAndCreateUser = async () => {
      if (!user || isSigningOut) return

      try {
        console.log('Checking user in Supabase:', user.id)

        // Check if user exists in Supabase
        const { data: existingUser, error: fetchError } = await supabase
          .from('users')
          .select()
          .eq('id', user.id)
          .single()

        if (fetchError && fetchError.code !== 'PGRST116') {
          console.error('Error fetching user from Supabase:', fetchError)
          throw fetchError
        }

        // Create user if they don't exist
        if (!existingUser) {
          console.log('User not found in Supabase, creating new user record')

          const { error: insertError } = await supabase.from('users').insert([
            {
              id: user.id,
              name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
              email: user.emailAddresses[0]?.emailAddress || '',
              favorite: []
            }
          ])

          if (insertError) {
            console.error('Error creating user in Supabase:', insertError)
            throw insertError
          }

          console.log('Created new user in Supabase')
        } else {
          console.log('User found in Supabase:', existingUser.id)
        }

        // Update last_active timestamp
        const { error: updateError } = await supabase
          .from('users')
          .update({ last_active: new Date().toISOString() })
          .eq('id', user.id)

        if (updateError) {
          console.error('Error updating last_active timestamp:', updateError)
          throw updateError
        }

        console.log('Updated last_active for user in Supabase')

        // Refresh notifications data
        try {
          console.log('Refreshing notification data...')
          await refreshNotifications()
        } catch (notificationError) {
          console.error('Error refreshing notifications:', notificationError)
          // Continue the flow even if notification refresh fails
        }

        // Register for notifications if not already attempted
        if (!registrationAttempted.current) {
          try {
            console.log('Registering for push notifications...')
            await registerForPushNotifications()
            registrationAttempted.current = true
            console.log('Successfully registered for push notifications')
          } catch (notificationError) {
            console.error('Error registering for push notifications:', notificationError)
            // Continue the flow even if notification registration fails
          }
        }
      } catch (error) {
        console.error('Error in user sync:', error)
        Alert.alert(
          'Error',
          'There was a problem setting up your account. Please try again later.'
        )
      } finally {
        setIsCheckingUser(false)
      }
    }

    if (isSignedIn && user) {
      checkAndCreateUser()
    } else {
      setIsCheckingUser(false)
    }
  }, [isSignedIn, user, registerForPushNotifications, refreshNotifications])

  // 2) Handle routing based on auth state and role
  useEffect(() => {
    if (!isLoaded) return
    if (isCheckingUser) return

    if (!isSignedIn) {
      router.replace('/sign-in')
      return
    }

    const role = (user?.publicMetadata?.role as string) || 'user'
    const correctRouteSegment = `(${role})`

    if (segments[1] !== correctRouteSegment) {
      setIsRouting(true)
      router.replace(`/(home)/${correctRouteSegment}`)
      setIsRouting(false)
    } else {
      setIsRouting(false)
    }
  }, [isLoaded, isSignedIn, isCheckingUser, user, segments])

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