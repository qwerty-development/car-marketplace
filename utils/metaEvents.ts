/**
 * Meta Events Constants
 * Centralized location for all Meta ad tracking event names
 * Used with react-native-fbsdk-next AppEventsLogger.logEvent()
 */

export const META_EVENTS = {
  // App lifecycle events
  APP_ACTIVATE: 'fb_mobile_activate_app',

  // Authentication events
  SIGN_IN: 'fb_mobile_sign_in',
  COMPLETE_REGISTRATION: 'fb_mobile_complete_registration',

  // Guest events
  GUEST_START: 'guest_start',
} as const;
