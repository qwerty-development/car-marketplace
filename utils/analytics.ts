/**
 * Mobile Analytics Utility
 * 
 * Fire-and-forget wrappers around Supabase RPC functions for tracking user behavior.
 * Analytics failures are silently swallowed to prevent breaking the app.
 */

import { Platform } from 'react-native'
import { supabase } from './supabase'

const PLATFORM = Platform.OS as 'ios' | 'android'

type AuthMethod = 'phone' | 'email' | 'google' | 'apple' | 'unknown'
type EventType = 'sign_in' | 'sign_up' | 'sign_out'

/**
 * Log an authentication event (sign-in, sign-up, sign-out).
 * Fire-and-forget — never blocks or crashes the app.
 * 
 * @param eventType - The type of auth event
 * @param authMethod - How the user authenticated (phone, email, google, apple)
 */
export function logAuthEvent(eventType: EventType, authMethod: AuthMethod) {
  supabase
    .rpc('log_auth_event', {
      p_event_type: eventType,
      p_auth_method: authMethod,
      p_platform: PLATFORM,
    })
    .then(() => {
      console.log(`[Analytics] Auth event logged: ${eventType} via ${authMethod}`)
    })
    .catch((error) => {
      // Silently fail — analytics should never break the app
      console.warn(`[Analytics] Failed to log auth event: ${error?.message}`)
    })
}

/**
 * Send an active session heartbeat with the current screen name.
 * Upserts a single row per user per platform — call every ~2 minutes.
 * 
 * @param currentScreen - The current screen/path name
 */
export function sendHeartbeat(currentScreen: string) {
  supabase
    .rpc('upsert_active_session', {
      p_platform: PLATFORM,
      p_current_path: currentScreen,
      p_metadata: {},
    })
    .then(() => {
      console.log(`[Analytics] Heartbeat sent for screen: ${currentScreen}`)
    })
    .catch((error) => {
      console.warn(`[Analytics] Failed to send heartbeat: ${error?.message}`)
    })
}

/**
 * Remove the active session (called on sign-out or app background).
 */
export function endSession() {
  supabase
    .rpc('remove_active_session', {
      p_platform: PLATFORM,
    })
    .then(() => {
      console.log('[Analytics] Active session ended')
    })
    .catch((error) => {
      console.warn(`[Analytics] Failed to end session: ${error?.message}`)
    })
}

/**
 * Log a screen view / page navigation.
 * Rate limited server-side to 30 per minute per user.
 * 
 * @param screenName - The name of the screen being viewed
 */
export function logScreenView(screenName: string) {
  supabase
    .rpc('log_page_view', {
      p_path: screenName,
      p_platform: PLATFORM,
    })
    .then(() => {
      console.log(`[Analytics] Screen view logged: ${screenName}`)
    })
    .catch((error) => {
      console.warn(`[Analytics] Failed to log screen view: ${error?.message}`)
    })
}
