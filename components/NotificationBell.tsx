import { NotificationService } from '@/services/NotificationService'
import { useTheme } from '@/utils/ThemeContext'
import { useAuth } from '@/utils/AuthContext'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useState, useEffect, useRef } from 'react'
import { TouchableOpacity, View, Text, I18nManager } from 'react-native'
import * as Haptics from 'expo-haptics'
import Animated, {
  useAnimatedStyle,
  withSpring,
  withSequence,
  withDelay,
  FadeInDown,
  FadeOutUp
} from 'react-native-reanimated'
import { useNotifications } from '@/hooks/useNotifications'
import NetInfo from '@react-native-community/netinfo'

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity)

const NotificationBadge = ({ count }: { count: number }) => {
  const isRTL = I18nManager.isRTL
  // Convert count to display text, handling large numbers
  const displayText = count > 99 ? '99+' : count.toString()

  // Determine badge width based on number of digits
  const badgeWidth = displayText.length > 2 ? 24 : 20

  return (
    <Animated.View
      entering={FadeInDown}
      exiting={FadeOutUp}
      className='absolute -top-2 bg-red rounded-full items-center justify-center'
      style={[
        {
          minWidth: badgeWidth,
          height: 20,
          paddingHorizontal: 4
        },
        isRTL ? { left: -8 } : { right: -8 }
      ]}>
      <Text
        className='text-white text-xs font-bold'
        numberOfLines={1}
        adjustsFontSizeToFit>
        {displayText}
      </Text>
    </Animated.View>
  )
}

export const NotificationBell = () => {
  const { isDarkMode } = useTheme()
  const { user } = useAuth()
  const router = useRouter()
  const lastCount = useRef(0)
  const isRTL = I18nManager.isRTL

  // Use the centralized notification hook instead of direct Supabase queries
  const {
    unreadCount,
    refreshNotifications,
    loading
  } = useNotifications()

  const animatedStyle = useAnimatedStyle(() => {
    if (unreadCount > lastCount.current) {
      return {
        transform: [
          {
            scale: withSequence(withSpring(1.2), withDelay(150, withSpring(1)))
          }
        ]
      }
    }
    return { transform: [{ scale: 1 }] }
  })

  // Trigger haptic feedback when unreadCount changes
  useEffect(() => {
    if (unreadCount > lastCount.current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
    lastCount.current = unreadCount
  }, [unreadCount])

  // Refresh notifications when component mounts
  useEffect(() => {
    if (!user) return

    refreshNotifications()

    // Set up a periodic refresh (less frequent than before since we have the
    // notification system's background updates)
    const refreshInterval = setInterval(() => {
      refreshNotifications()
    }, 5 * 60 * 1000) // Every 5 minutes instead of every minute

    // Set up network status listener to refresh on reconnection
    const unsubscribeNetInfo = NetInfo.addEventListener(state => {
      if (state.isConnected && !loading) {
        refreshNotifications()
      }
    })

    return () => {
      clearInterval(refreshInterval)
      unsubscribeNetInfo()
    }
  }, [user, refreshNotifications, loading])

  if (!user) return null

  return (
    <AnimatedTouchableOpacity
      style={[animatedStyle, isRTL ? { marginLeft: 4 } : { marginRight: 4 }]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        router.push('/(home)/(user)/notifications')
      }}
      className='relative p-2'>
      <Ionicons
        name={unreadCount > 0 ? 'notifications' : 'notifications-outline'}
        size={24}
        color={isDarkMode ? '#FFFFFF' : '#000000'}
      />
      {unreadCount > 0 && <NotificationBadge count={unreadCount} />}
    </AnimatedTouchableOpacity>
  )
}