// utils/safeMetaLogger.ts
// Safe wrapper for Facebook AppEventsLogger to prevent NativeEventEmitter crashes
// during module initialization in dev builds or simulator environments

let _AppEventsLogger: any = null;

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

export const safeLogEvent = (eventName: string, params?: Record<string, any>) => {
  try {
    const logger = getLogger();
    if (logger) {
      if (params) {
        logger.logEvent(eventName, params);
      } else {
        logger.logEvent(eventName);
      }
    }
  } catch (e) {
    // Silently fail - analytics should never crash the app
  }
};
