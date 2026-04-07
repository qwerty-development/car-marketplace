// utils/safeMetaLogger.ts
// Safe wrapper for Facebook AppEventsLogger to prevent NativeEventEmitter crashes
// during module initialization in dev builds or simulator environments

import AsyncStorage from '@react-native-async-storage/async-storage';
import { META_EVENTS } from './metaEvents';

let _AppEventsLogger: any = null;

// In-memory guard to prevent same-session race conditions in fireGuestStartOnce.
// AsyncStorage handles cross-restart deduplication; this Set handles concurrent calls
// within the same JS process (e.g., initializeGuestState and setGuestMode firing together).
const _guestStartFiredIds = new Set<string>();

function getLogger() {
  if (_AppEventsLogger === null) {
    try {
      _AppEventsLogger = require('react-native-fbsdk-next').AppEventsLogger;
    } catch {
      _AppEventsLogger = false;
    }
  }
  return _AppEventsLogger || null;
}

export const fireGuestStartOnce = async (guestId: string) => {
  // Synchronous in-memory check prevents concurrent calls from both passing
  // the AsyncStorage guard before either has written the flag.
  if (_guestStartFiredIds.has(guestId)) return;
  _guestStartFiredIds.add(guestId);

  try {
    const flagKey = `guestStartTracked_${guestId}`;
    const alreadyTracked = await AsyncStorage.getItem(flagKey);
    if (alreadyTracked) return;

    // Set flag before firing — if the event call fails, we accept one missed ping
    // rather than risk a duplicate on the next cold start.
    await AsyncStorage.setItem(flagKey, 'true');
    safeLogEvent(META_EVENTS.GUEST_START);
    // Flush immediately so the event isn't stuck in the SDK queue
    // (called here specifically, not on every safeLogEvent call)
    getLogger()?.flush();
  } catch (e) {
    // Allow retry on next cold start if storage fails
    _guestStartFiredIds.delete(guestId);
    console.error('[MetaEvents] fireGuestStartOnce error:', e);
  }
};

export const safeLogEvent = (eventName: string, params?: Record<string, any>) => {
  try {
    const logger = getLogger();
    if (logger) {
      if (params) {
        logger.logEvent(eventName, params);
      } else {
        logger.logEvent(eventName);
      }
    } else {
      console.warn('[MetaEvents] AppEventsLogger not available, event skipped:', eventName);
    }
  } catch (e) {
    console.error('[MetaEvents] safeLogEvent error for', eventName, e);
  }
};
