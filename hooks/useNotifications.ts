import { useEffect, useRef, useCallback, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform, AppState } from 'react-native';
import { NotificationService } from '@/services/NotificationService';
import { router } from 'expo-router';
import { useAuth } from '@/utils/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { isSigningOut } from '@/app/(home)/_layout';
import NetInfo from '@react-native-community/netinfo';

// Storage key for push token
const PUSH_TOKEN_STORAGE_KEY = 'expoPushToken';
const REGISTRATION_STATE_KEY = 'notificationRegistrationState';

// Constants
const MAX_REGISTRATION_ATTEMPTS = 3;
const REGISTRATION_TIMEOUT = 60 * 60 * 1000; // 1 hour
const DEBUG_MODE = __DEV__ || true; // Enable debug mode in dev and initially in prod

interface RegistrationState {
  lastAttemptTime: number;
  attempts: number;
  lastError?: string;
  registered: boolean;
}

interface UseNotificationsReturn {
  unreadCount: number;
  isPermissionGranted: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  refreshNotifications: () => Promise<void>;
  loading: boolean;
  cleanupPushToken: () => Promise<void>;
  registerForPushNotifications: (force?: boolean) => Promise<void>;
  diagnosticInfo: any;
}

export function useNotifications(): UseNotificationsReturn {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const [diagnosticInfo, setDiagnosticInfo] = useState<any>(null);
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();
  const lastNotificationResponse = useRef<Notifications.NotificationResponse>();
  const realtimeSubscription = useRef<RealtimeChannel>();
  const lastHandledNotification = useRef<string>();
  const pushTokenListener = useRef<any>();
  const appState = useRef(AppState.currentState);
  const registrationAttempts = useRef(0);
  const registrationTimer = useRef<NodeJS.Timeout | null>(null);
  const networkStatus = useRef<boolean>(true);
  const initialSetupComplete = useRef<boolean>(false);
  const forceRegistrationOnNextForeground = useRef<boolean>(false);

  // Improved logging with timestamps
  const debugLog = useCallback((message: string, data?: any) => {
    if (DEBUG_MODE) {
      const timestamp = new Date().toISOString();
      const logPrefix = `[useNotifications ${timestamp}]`;

      if (data) {
        console.log(`${logPrefix} ${message}`, data);
      } else {
        console.log(`${logPrefix} ${message}`);
      }
    }
  }, []);

  // Handler for token refresh events with improved error handling
  const handleTokenRefresh = useCallback(async (pushToken: Notifications.ExpoPushToken) => {
    if (!user?.id || isSigningOut) return;

    debugLog('Expo push token refreshed:', pushToken.data);

    try {
      // Validate token format
      const validExpoTokenFormat = /^ExponentPushToken\[.+\]$/;
      if (!validExpoTokenFormat.test(pushToken.data)) {
        debugLog('Received non-Expo format token during refresh, ignoring');
        return;
      }

      // Save token to secure storage immediately for resilience
      await SecureStore.setItemAsync(PUSH_TOKEN_STORAGE_KEY, pushToken.data);
      await SecureStore.setItemAsync('pushTokenRefreshTime', Date.now().toString());

      // Skip database update if offline
      if (!networkStatus.current) {
        debugLog('Network unavailable, database update queued for when online');
        forceRegistrationOnNextForeground.current = true;
        return;
      }

      // Check if this token exists in database
      const verification = await NotificationService.forceTokenVerification(user.id);

      if (verification.isValid && verification.token === pushToken.data) {
       console.log('Token verified successfully, no action needed');
      } else {
        // Token not in database or different, register it
        await registerForPushNotifications(true);
      }
    } catch (error) {
      debugLog('Error handling token refresh:', error);
      forceRegistrationOnNextForeground.current = true;
    }
  }, [user?.id, debugLog]);

  // Handler for received notifications with duplicate protection
  const handleNotification = useCallback(async (notification: Notifications.Notification) => {
    if (!user) return;

    // Avoid duplicate handling with a 5 second window
    const notificationId = notification.request.identifier;
    const lastHandledTime = lastHandledNotification.current?.split('|')[1];
    const currentTime = Date.now().toString();

    if (lastHandledNotification.current?.split('|')[0] === notificationId) {
      // Check if within 5 seconds
      if (lastHandledTime && (Date.now() - parseInt(lastHandledTime)) < 5000) {
        debugLog('Skipping duplicate notification handling within 5s window');
        return;
      }
    }

    lastHandledNotification.current = `${notificationId}|${currentTime}`;

    try {
      debugLog('Notification received:', {
        title: notification.request.content.title,
        body: notification.request.content.body
      });

      // Update unread count
      const newUnreadCount = await NotificationService.getUnreadCount(user.id);
      setUnreadCount(newUnreadCount);

      // Update badge count
      await NotificationService.setBadgeCount(newUnreadCount);
    } catch (error) {
      debugLog('Error handling notification:', error);
    }
  }, [user, debugLog]);

  // Handler for when user taps on a notification with improved navigation
  const handleNotificationResponse = useCallback(async (response: Notifications.NotificationResponse) => {
    if (!user) return;

    // Avoid duplicate handling with contextual awareness
    const responseId = response.notification.request.identifier;
    const lastResponseTime = lastNotificationResponse.current?.notification.date;
    const currentTime = new Date();

    if (lastNotificationResponse.current?.notification.request.identifier === responseId &&
        lastResponseTime &&
        (currentTime.getTime() - lastResponseTime.getTime()) < 5000) {
      debugLog('Skipping duplicate notification response within 5s window');
      return;
    }

    lastNotificationResponse.current = response;

    try {
      debugLog('User responded to notification:', {
        title: response.notification.request.content.title
      });

      const navigationData = await NotificationService.handleNotificationResponse(response);
      if (navigationData?.screen) {
        // Mark notification as read if it has an ID
        const notificationId = response.notification.request.content.data?.notificationId;
        if (notificationId) {
          await NotificationService.markAsRead(notificationId);
          const newUnreadCount = await NotificationService.getUnreadCount(user.id);
          setUnreadCount(newUnreadCount);
          await NotificationService.setBadgeCount(newUnreadCount);
        }

        // Navigate to the specified screen
        debugLog(`Navigating to ${navigationData.screen}`);

        try {
          if (navigationData.params) {
            router.push({
              pathname: navigationData.screen,
              params: navigationData.params
            });
          } else {
            router.push(navigationData.screen);
          }
        } catch (navError) {
          debugLog('Navigation error, retrying with delay:', navError);

          // Retry navigation after a delay
          setTimeout(() => {
            try {
              if (navigationData.params) {
                router.push({
                  pathname: navigationData.screen,
                  params: navigationData.params
                });
              } else {
                router.push(navigationData.screen);
              }
            } catch (retryError) {
              debugLog('Retry navigation also failed:', retryError);
            }
          }, 1000);
        }
      }
    } catch (error) {
      debugLog('Error handling notification response:', error);
    }
  }, [user, debugLog]);

  // Get registration state from storage
  const getRegistrationState = useCallback(async (): Promise<RegistrationState | null> => {
    try {
      const stateJson = await SecureStore.getItemAsync(REGISTRATION_STATE_KEY);
      if (!stateJson) return null;

      return JSON.parse(stateJson) as RegistrationState;
    } catch (error) {
      debugLog('Error reading registration state:', error);
      return null;
    }
  }, [debugLog]);

  // Save registration state to storage
  const saveRegistrationState = useCallback(async (state: RegistrationState): Promise<void> => {
    try {
      await SecureStore.setItemAsync(REGISTRATION_STATE_KEY, JSON.stringify(state));
    } catch (error) {
      debugLog('Error saving registration state:', error);
    }
  }, [debugLog]);

  // Enhanced and simplified registration function with context awareness
  const registerForPushNotifications = useCallback(async (force = false) => {
    if (!user?.id) {
      debugLog('No user ID available, skipping notification registration');
      return;
    }

    if (isSigningOut) {
      debugLog('User is signing out, skipping registration');
      return;
    }

    // Clear any existing registration timer
    if (registrationTimer.current) {
      clearTimeout(registrationTimer.current);
      registrationTimer.current = null;
    }

    // Check network status first
    const netState = await NetInfo.fetch();
    if (!netState.isConnected && !force) {
      debugLog('Network unavailable, deferring registration');
      forceRegistrationOnNextForeground.current = true;
      return;
    }
    networkStatus.current = !!netState.isConnected;

    // Get previous registration state
    const regState = await getRegistrationState();

    // Skip if recently registered successfully and not forced
    if (regState?.registered && !force) {
      const timeSinceLastAttempt = Date.now() - regState.lastAttemptTime;
      if (timeSinceLastAttempt < 24 * 60 * 60 * 1000) { // Within 24 hours
        debugLog('Recent successful registration exists, skipping');
        setIsPermissionGranted(true);
        return;
      }
    }

    // Skip repeated failures within timeout period unless forced
    if (regState && regState.attempts >= MAX_REGISTRATION_ATTEMPTS && !force) {
      const timeSinceLastAttempt = Date.now() - regState.lastAttemptTime;
      if (timeSinceLastAttempt < REGISTRATION_TIMEOUT) {
        debugLog(`Max registration attempts reached and within timeout, skipping`);
        return;
      }
    }

    // Track this attempt
    registrationAttempts.current = (regState?.attempts || 0) + 1;
    debugLog(`Push notification registration attempt ${registrationAttempts.current}/${MAX_REGISTRATION_ATTEMPTS}`);

    try {
      setLoading(true);

      // 1. Check and request permissions
      const permissionStatus = await NotificationService.getPermissions();
      debugLog('Current permission status:', permissionStatus?.status);

      if (permissionStatus?.status !== 'granted') {
        debugLog('Permission not granted, requesting...');
        const newPermission = await NotificationService.requestPermissions();

        if (newPermission?.status !== 'granted') {
          debugLog('Permission denied by user');
          setIsPermissionGranted(false);

          // Save state for future attempts
          await saveRegistrationState({
            lastAttemptTime: Date.now(),
            attempts: registrationAttempts.current,
            lastError: 'Permission denied',
            registered: false
          });

          setLoading(false);
          return;
        }
      }

      setIsPermissionGranted(true);
      debugLog('Notification permissions granted');

      // 2. Get token using service
      debugLog('Getting Expo push token...');
      const token = await NotificationService.registerForPushNotificationsAsync(user.id, force);

      if (token) {
        debugLog('Successfully registered push token');

        // Set up token refresh listener if not already set
        if (!pushTokenListener.current) {
          pushTokenListener.current = Notifications.addPushTokenListener(handleTokenRefresh);
        }

        // Registration successful, update state
        registrationAttempts.current = 0;
        await saveRegistrationState({
          lastAttemptTime: Date.now(),
          attempts: 0,
          registered: true
        });

        // Get updated diagnostic info
        try {
          const diagInfo = await NotificationService.getDiagnostics();
          setDiagnosticInfo(diagInfo);
        } catch (e) {
          // Non-critical
        }
      } else {
        debugLog('Failed to get push token');

        // Save state for future attempts
        await saveRegistrationState({
          lastAttemptTime: Date.now(),
          attempts: registrationAttempts.current,
          lastError: 'Failed to get token',
          registered: false
        });

        // Schedule retry with exponential backoff
        if (registrationAttempts.current < MAX_REGISTRATION_ATTEMPTS) {
          const delay = Math.min(5000 * Math.pow(2, registrationAttempts.current - 1), 30 * 60 * 1000);
          debugLog(`Scheduling retry in ${Math.round(delay / 1000)}s`);

          registrationTimer.current = setTimeout(() => {
            registerForPushNotifications();
          }, delay);
        }
      }
    } catch (error) {
      debugLog('Error registering for notifications:', error);

      // Save state for future attempts
      await saveRegistrationState({
        lastAttemptTime: Date.now(),
        attempts: registrationAttempts.current,
        lastError: error instanceof Error ? error.message : String(error),
        registered: false
      });

      // Reset permission state
      setIsPermissionGranted(false);

      // Schedule retry with exponential backoff
      if (registrationAttempts.current < MAX_REGISTRATION_ATTEMPTS) {
        const delay = Math.min(5000 * Math.pow(2, registrationAttempts.current - 1), 30 * 60 * 1000);
        debugLog(`Scheduling retry after error in ${Math.round(delay / 1000)}s`);

        registrationTimer.current = setTimeout(() => {
          registerForPushNotifications();
        }, delay);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id, handleTokenRefresh, getRegistrationState, saveRegistrationState, debugLog]);

  // Enhanced token cleanup that uses the updated NotificationService
  const cleanupPushToken = useCallback(async () => {
    debugLog('Starting push token cleanup process');

    try {
      // Clear any pending registration timer
      if (registrationTimer.current) {
        clearTimeout(registrationTimer.current);
        registrationTimer.current = null;
      }

      if (!user?.id) {
        debugLog('No user ID available, skipping token cleanup');
        return true;
      }

      // Use the updated service method
      const success = await NotificationService.cleanupPushToken(user.id);

      if (success) {
        debugLog('Push token marked as signed out successfully');
      } else {
        debugLog('Failed to mark push token as signed out');
      }

      // Reset registration attempts counter
      registrationAttempts.current = 0;
      forceRegistrationOnNextForeground.current = false;

      return true;
    } catch (error) {
      debugLog('Error cleaning up push token:', error);
      return false;
    }
  }, [user?.id, debugLog]);

  // Standard notification handling functions
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user) return;

    try {
      await NotificationService.markAsRead(notificationId);
      const newUnreadCount = await NotificationService.getUnreadCount(user.id);
      setUnreadCount(newUnreadCount);
      await NotificationService.setBadgeCount(newUnreadCount);
    } catch (error) {
      debugLog('Error marking notification as read:', error);
    }
  }, [user, debugLog]);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    try {
      await NotificationService.markAllAsRead(user.id);
      setUnreadCount(0);
      await NotificationService.setBadgeCount(0);
    } catch (error) {
      debugLog('Error marking all notifications as read:', error);
    }
  }, [user, debugLog]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!user) return;

    try {
      await NotificationService.deleteNotification(notificationId);
      const newUnreadCount = await NotificationService.getUnreadCount(user.id);
      setUnreadCount(newUnreadCount);
      await NotificationService.setBadgeCount(newUnreadCount);
    } catch (error) {
      debugLog('Error deleting notification:', error);
    }
  }, [user, debugLog]);

  const refreshNotifications = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const count = await NotificationService.getUnreadCount(user.id);
      setUnreadCount(count);
      await NotificationService.setBadgeCount(count);
    } catch (error) {
      debugLog('Error refreshing notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user, debugLog]);

  // Network status monitoring
  useEffect(() => {
    // Track network status changes
    const unsubscribe = NetInfo.addEventListener(state => {
      const wasConnected = networkStatus.current;
      const isConnected = !!state.isConnected;
      networkStatus.current = isConnected;

      // If coming back online and we need to force registration
      if (isConnected && !wasConnected && forceRegistrationOnNextForeground.current && user?.id) {
        debugLog('Network reconnected, triggering registration');
        registerForPushNotifications(true);
        forceRegistrationOnNextForeground.current = false;
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user?.id, registerForPushNotifications, debugLog]);

  // App state change handling
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      const previousState = appState.current;
      appState.current = nextAppState;

      // App coming to foreground from background or inactive
      if (
        (previousState.match(/inactive|background/) || previousState === 'unknown') &&
        nextAppState === 'active' &&
        user?.id
      ) {
        debugLog('App has come to foreground');

        // Reset badge count and refresh notifications
        (async () => {
          try {
            await refreshNotifications();
            await NotificationService.setBadgeCount(0);
          } catch (error) {
            debugLog('Error handling foreground badge reset:', error);
          }
        })();

        // If a token refresh or registration has been pending, force it now
        if (forceRegistrationOnNextForeground.current) {
          debugLog('Forced registration pending, executing now');
          registerForPushNotifications(true);
          forceRegistrationOnNextForeground.current = false;
          return;
        }

        // Database verification on foreground
        (async () => {
          try {
            debugLog('Verifying token on app foreground');

            // Check if we have a token that needs verification
            const verification = await NotificationService.forceTokenVerification(user.id);

            if (!verification.isValid) {
              debugLog('Token verification failed on app foreground, initiating registration');
              await registerForPushNotifications(true);
              return;
            }

            debugLog('Token verified on app foreground, updating status');



            // Update registration state
            await saveRegistrationState({
              lastAttemptTime: Date.now(),
              attempts: 0,
              registered: true
            });
          } catch (error) {
            debugLog('Error during token verification on foreground:', error);

            // Only force registration if it's been a while since last attempt
            const regState = await getRegistrationState();
            if (!regState || Date.now() - regState.lastAttemptTime > 60 * 60 * 1000) { // 1 hour
              registerForPushNotifications(true);
            }
          }
        })();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [
    refreshNotifications,
    registerForPushNotifications,
    user,
    getRegistrationState,
    saveRegistrationState,
    debugLog
  ]);

  // Set up notification system on mount/unmount
  useEffect(() => {
    if (!user?.id) return;

    let mounted = true;

    const initialize = async () => {
      if (!mounted) return;

      debugLog('Setting up notification system for user:', user.id);

      // Set up notification listeners
      notificationListener.current = Notifications.addNotificationReceivedListener(handleNotification);
      responseListener.current = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

      // Get initial unread count
      await refreshNotifications();

      // Get diagnostic information
      try {
        const diagInfo = await NotificationService.getDiagnostics();
        setDiagnosticInfo(diagInfo);
      } catch (e) {
        // Non-critical
      }

      // Token verification and registration
      try {
        // Check for existing valid token
        const verification = await NotificationService.forceTokenVerification(user.id);

        if (verification.isValid && verification.token) {
          debugLog('Found valid token during initialization');

          // Update token status


          // Set up token refresh listener
          if (pushTokenListener.current) {
            pushTokenListener.current.remove();
          }
          pushTokenListener.current = Notifications.addPushTokenListener(handleTokenRefresh);

          // Update registration state
          await saveRegistrationState({
            lastAttemptTime: Date.now(),
            attempts: 0,
            registered: true
          });

          setIsPermissionGranted(true);
        } else {
          // No valid token found, initiate registration
          debugLog('No valid token found during initialization, registering');
          await registerForPushNotifications(true);
        }
      } catch (error) {
        debugLog('Error during notification initialization:', error);
        await registerForPushNotifications(true);
      } finally {
        initialSetupComplete.current = true;
      }
    };

    initialize();

    return () => {
      mounted = false;
      debugLog('Cleaning up notification system');

      // Clear any pending registration timer
      if (registrationTimer.current) {
        clearTimeout(registrationTimer.current);
        registrationTimer.current = null;
      }

      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
      if (pushTokenListener.current) {
        pushTokenListener.current.remove();
      }
      if (realtimeSubscription.current) {
        try {
          realtimeSubscription.current.unsubscribe();
        } catch (error) {
          debugLog('Error during subscription cleanup:', error);
        }
      }
    };
  }, [
    user?.id,
    handleNotification,
    handleNotificationResponse,
    refreshNotifications,
    registerForPushNotifications,
    handleTokenRefresh,
    getRegistrationState,
    saveRegistrationState,
    debugLog
  ]);

  return {
    unreadCount,
    isPermissionGranted,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications,
    loading,
    cleanupPushToken,
    registerForPushNotifications,
    diagnosticInfo
  };
}