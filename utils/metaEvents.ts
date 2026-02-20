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
} as const;

/**
 * Helper function to log Meta events with optional parameters
 * @param event - Event key from META_EVENTS
 * @param parameters - Optional event parameters for Meta
 */
export function logMetaEvent(
  event: (typeof META_EVENTS)[keyof typeof META_EVENTS],
  parameters?: Record<string, any>
): void {
  try {
    const { AppEventsLogger } = require('react-native-fbsdk-next');
    if (parameters) {
      AppEventsLogger.logEvent(event, undefined, parameters);
    } else {
      AppEventsLogger.logEvent(event);
    }
  } catch (error) {
    console.error('[Meta Events] Failed to log event:', event, error);
  }
}
