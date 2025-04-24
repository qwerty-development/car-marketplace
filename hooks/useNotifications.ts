import { useEffect, useRef, useCallback, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { NotificationService } from '@/services/NotificationService';
import { router } from 'expo-router';
import { useAuth } from '@/utils/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { isSigningOut } from '@/app/(home)/_layout';
import NetInfo from '@react-native-community/netinfo';
import { isGlobalSigningOut } from '../utils/AuthContext';

// Storage keys
const STORAGE_KEYS = {
  PUSH_TOKEN: 'expoPushToken',
  REGISTRATION_STATE: 'notificationRegistrationState',
  TOKEN_REFRESH_TIME: 'pushTokenRefreshTime'
} as const;

// Configuration constants
const CONFIG = {
  MAX_REGISTRATION_ATTEMPTS: 3,
  REGISTRATION_TIMEOUT: 60 * 60 * 1000, // 1 hour
  DEBUG_MODE: __DEV__, // IMPORTANT: Production-ready debug mode
  DUPLICATE_WINDOW: 5000, // 5 seconds
  NAVIGATION_RETRY_DELAY: 1000,
  REGISTRATION_RETRY_BASE_DELAY: 5000,
  MAX_RETRY_DELAY: 30 * 60 * 1000, // 30 minutes
  RECENT_REGISTRATION_THRESHOLD: 24 * 60 * 60 * 1000 // 24 hours
} as const;

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
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [isPermissionGranted, setIsPermissionGranted] = useState<boolean>(false);
  const [diagnosticInfo, setDiagnosticInfo] = useState<any>(null);
  
  // Refs for subscriptions and listeners
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  const lastNotificationResponse = useRef<Notifications.NotificationResponse | null>(null);
  const realtimeSubscription = useRef<RealtimeChannel | null>(null);
  const lastHandledNotification = useRef<string | null>(null);
  const pushTokenListener = useRef<Notifications.Subscription | null>(null);
  
  // App state and registration management
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const registrationAttempts = useRef<number>(0);
  const registrationTimer = useRef<NodeJS.Timeout | null>(null);
  const networkStatus = useRef<boolean>(true);
  const initialSetupComplete = useRef<boolean>(false);
  const forceRegistrationOnNextForeground = useRef<boolean>(false);

  /**
   * Enhanced logging function with production-ready debug mode
   */
  const debugLog = useCallback((message: string, data?: any) => {
    if (CONFIG.DEBUG_MODE) {
      const timestamp = new Date().toISOString();
      const logPrefix = `[useNotifications ${timestamp}]`;

      if (data !== undefined) {
        console.log(`${logPrefix} ${message}`, data);
      } else {
        console.log(`${logPrefix} ${message}`);
      }
    }
  }, []);

  /**
   * Token refresh handler with proper type correction and error handling
   */
  const handleTokenRefresh = useCallback(async (pushToken: Notifications.ExpoPushToken) => {
    if (!user?.id || isSigningOut) return;

    debugLog('Expo push token refreshed:', pushToken.data);

    try {
      // Validate token format with regex
      const validExpoTokenFormat = /^ExponentPushToken\[.+\]$/;
      if (!validExpoTokenFormat.test(pushToken.data)) {
        debugLog('Received non-Expo format token during refresh, ignoring');
        return;
      }

      // Save token to secure storage immediately for resilience
      await SecureStore.setItemAsync(STORAGE_KEYS.PUSH_TOKEN, pushToken.data);
      await SecureStore.setItemAsync(STORAGE_KEYS.TOKEN_REFRESH_TIME, Date.now().toString());

      // Skip database update if offline
      if (!networkStatus.current) {
        debugLog('Network unavailable, database update queued for when online');
        forceRegistrationOnNextForeground.current = true;
        return;
      }

      // Verify token exists in database
      const verification = await NotificationService.forceTokenVerification(user.id);

      if (verification.isValid && verification.token === pushToken.data) {
        debugLog('Token verified successfully, no action needed');
      } else {
        // Token not in database or different, register it
        await registerForPushNotifications(true);
      }
    } catch (error) {
      debugLog('Error handling token refresh:', error);
      forceRegistrationOnNextForeground.current = true;
    }
  }, [user?.id, debugLog]);

  /**
   * Notification handler with duplicate prevention and error recovery
   */
  const handleNotification = useCallback(async (notification: Notifications.Notification) => {
    if (!user) return;

    // Prevent duplicate handling within 5-second window
    const notificationId = notification.request.identifier;
    const lastHandledData = lastHandledNotification.current?.split('|');
    const lastHandledId = lastHandledData?.[0];
    const lastHandledTime = lastHandledData?.[1];
    const currentTime = Date.now().toString();

    if (lastHandledId === notificationId && lastHandledTime) {
      const timeDiff = Date.now() - parseInt(lastHandledTime, 10);
      if (timeDiff < CONFIG.DUPLICATE_WINDOW) {
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

  /**
   * Notification response handler with improved navigation and error recovery
   */
  const handleNotificationResponse = useCallback(async (response: Notifications.NotificationResponse) => {
    if (!user) return;

    // Prevent duplicate response handling
    const responseId = response.notification.request.identifier;
    const lastResponseTime = lastNotificationResponse.current?.notification.date?.getTime();
    const currentTime = new Date().getTime();

    if (
      lastNotificationResponse.current?.notification.request.identifier === responseId &&
      lastResponseTime &&
      (currentTime - lastResponseTime) < CONFIG.DUPLICATE_WINDOW
    ) {
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

        // Navigate to the specified screen with retry logic
        debugLog(`Navigating to ${navigationData.screen}`);

        const navigate = () => {
          if (navigationData.params) {
            router.push({
              pathname: navigationData.screen as any,
              params: navigationData.params
            });
          } else {
            router.push(navigationData.screen as any);
          }
        };

        try {
          navigate();
        } catch (navError) {
          debugLog('Navigation error, retrying with delay:', navError);
          setTimeout(() => {
            try {
              navigate();
            } catch (retryError) {
              debugLog('Retry navigation also failed:', retryError);
            }
          }, CONFIG.NAVIGATION_RETRY_DELAY);
        }
      }
    } catch (error) {
      debugLog('Error handling notification response:', error);
    }
  }, [user, debugLog]);

  /**
   * Get registration state from secure storage
   */
  const getRegistrationState = useCallback(async (): Promise<RegistrationState | null> => {
    try {
      const stateJson = await SecureStore.getItemAsync(STORAGE_KEYS.REGISTRATION_STATE);
      if (!stateJson) return null;

      return JSON.parse(stateJson) as RegistrationState;
    } catch (error) {
      debugLog('Error reading registration state:', error);
      return null;
    }
  }, [debugLog]);

  /**
   * Save registration state to secure storage
   */
  const saveRegistrationState = useCallback(async (state: RegistrationState): Promise<void> => {
    try {
      await SecureStore.setItemAsync(STORAGE_KEYS.REGISTRATION_STATE, JSON.stringify(state));
    } catch (error) {
      debugLog('Error saving registration state:', error);
    }
  }, [debugLog]);

  /**
   * Enhanced registration function with production-ready logic
   */
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

    // Check network status
    const netState = await NetInfo.fetch();
    networkStatus.current = !!netState.isConnected;

    if (!netState.isConnected && !force) {
      debugLog('Network unavailable, deferring registration');
      forceRegistrationOnNextForeground.current = true;
      return;
    }

    // Get previous registration state
    const regState = await getRegistrationState();

    // Skip if recently registered successfully and not forced
    if (regState?.registered && !force) {
      const timeSinceLastAttempt = Date.now() - regState.lastAttemptTime;
      if (timeSinceLastAttempt < CONFIG.RECENT_REGISTRATION_THRESHOLD) {
        debugLog('Recent successful registration exists, skipping');
        setIsPermissionGranted(true);
        return;
      }
    }

    // Skip repeated failures within timeout period unless forced
    if (regState && regState.attempts >= CONFIG.MAX_REGISTRATION_ATTEMPTS && !force) {
      const timeSinceLastAttempt = Date.now() - regState.lastAttemptTime;
      if (timeSinceLastAttempt < CONFIG.REGISTRATION_TIMEOUT) {
        debugLog(`Max registration attempts reached and within timeout, skipping`);
        return;
      }
    }

    // Track this attempt
    registrationAttempts.current = (regState?.attempts || 0) + 1;
    debugLog(`Push notification registration attempt ${registrationAttempts.current}/${CONFIG.MAX_REGISTRATION_ATTEMPTS}`);

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
        if (pushTokenListener.current) {
          pushTokenListener.current.remove();
          pushTokenListener.current = null;
        }
        pushTokenListener.current = Notifications.addPushTokenListener(handleTokenRefresh);

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
          // Non-critical error
          debugLog('Failed to get diagnostics:', e);
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
        if (registrationAttempts.current < CONFIG.MAX_REGISTRATION_ATTEMPTS) {
          const delay = Math.min(
            CONFIG.REGISTRATION_RETRY_BASE_DELAY * Math.pow(2, registrationAttempts.current - 1),
            CONFIG.MAX_RETRY_DELAY
          );
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
      if (registrationAttempts.current < CONFIG.MAX_REGISTRATION_ATTEMPTS) {
        const delay = Math.min(
          CONFIG.REGISTRATION_RETRY_BASE_DELAY * Math.pow(2, registrationAttempts.current - 1),
          CONFIG.MAX_RETRY_DELAY
        );
        debugLog(`Scheduling retry after error in ${Math.round(delay / 1000)}s`);

        registrationTimer.current = setTimeout(() => {
          registerForPushNotifications();
        }, delay);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id, handleTokenRefresh, getRegistrationState, saveRegistrationState, debugLog]);

  /**
   * Enhanced token cleanup with better error handling
   */
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

      // Reset registration state
      registrationAttempts.current = 0;
      forceRegistrationOnNextForeground.current = false;

      // Clear registration state from storage
      try {
        await SecureStore.deleteItemAsync(STORAGE_KEYS.REGISTRATION_STATE);
      } catch (e) {
        debugLog('Failed to clear registration state:', e);
      }

      return true;
    } catch (error) {
      debugLog('Error cleaning up push token:', error);
      return false;
    }
  }, [user?.id, debugLog]);

  /**
   * Standard notification handling functions with improved error handling
   */
  const markAsRead = useCallback(async (notificationId: string): Promise<void> => {
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

  const markAllAsRead = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
      await NotificationService.markAllAsRead(user.id);
      setUnreadCount(0);
      await NotificationService.setBadgeCount(0);
    } catch (error) {
      debugLog('Error marking all notifications as read:', error);
    }
  }, [user, debugLog]);

  const deleteNotification = useCallback(async (notificationId: string): Promise<void> => {
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

  const refreshNotifications = useCallback(async (): Promise<void> => {
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

  /**
   * Network status monitoring with recovery
   */
  useEffect(() => {
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

  /**
   * App state change handling with correct token verification
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      const previousState = appState.current;
      appState.current = nextAppState;

      if (isGlobalSigningOut) {
        debugLog('Skipping notification initialization during sign-out');
        return;
      }

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

            // Log current signed_in status without changing it
            debugLog('Token verified on app foreground, current signed_in status:', verification.signedIn);

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
            if (!regState || Date.now() - regState.lastAttemptTime > CONFIG.REGISTRATION_TIMEOUT) {
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

  /**
   * Set up notification system on mount with complete cleanup
   */
  useEffect(() => {
    if (!user?.id) return;

    let mounted = true;

    const initialize = async () => {
      if (!mounted) return;

      if (isGlobalSigningOut) {
        debugLog('Skipping notification initialization during sign-out');
        return;
      }

      debugLog('Setting up notification system for user:', user.id);

      // First, check if we have a local token
      let localToken = await SecureStore.getItemAsync(STORAGE_KEYS.PUSH_TOKEN);
      
      // If no local token, try to sync from database
      if (!localToken) {
        debugLog('No local token found, attempting to sync from database');
        localToken = await NotificationService.syncTokenFromDatabase(user.id);
      }

      // Set up notification listeners
      notificationListener.current = Notifications.addNotificationReceivedListener(handleNotification);
      responseListener.current = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

      // Get initial unread count
      await refreshNotifications();

      // Continue with token verification and registration...
      try {
        // If we have a token (either local or synced), verify it
        if (localToken) {
          const verification = await NotificationService.forceTokenVerification(user.id);
          
          if (verification.isValid) {
            debugLog('Token is valid, setting up refresh listener');
            
            // Set up token refresh listener
            if (pushTokenListener.current) {
              pushTokenListener.current.remove();
              pushTokenListener.current = null;
            }
            pushTokenListener.current = Notifications.addPushTokenListener(handleTokenRefresh);
            
            setIsPermissionGranted(true);
            
            // Only update signed_in status if it's not already correct
            if (verification.signedIn === false) {
              debugLog('Token found but marked as signed out, updating to signed in');
              await NotificationService.markTokenAsSignedIn(user.id, verification.token || '');
            }
          } else {
            debugLog('Token validation failed, registering new token');
            await registerForPushNotifications(true);
          }
        } else {
          debugLog('No token available, registering new token');
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

      // Remove notification listeners
      if (notificationListener.current) {
        notificationListener.current.remove();
        notificationListener.current = null;
      }
      if (responseListener.current) {
        responseListener.current.remove();
        responseListener.current = null;
      }
      if (pushTokenListener.current) {
        pushTokenListener.current.remove();
        pushTokenListener.current = null;
      }
      if (realtimeSubscription.current) {
        try {
          realtimeSubscription.current.unsubscribe();
        } catch (error) {
          debugLog('Error during subscription cleanup:', error);
        }
        realtimeSubscription.current = null;
      }
    };
  }, [
    user?.id,
    handleNotification,
    handleNotificationResponse,
    refreshNotifications,
    registerForPushNotifications,
    handleTokenRefresh,
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