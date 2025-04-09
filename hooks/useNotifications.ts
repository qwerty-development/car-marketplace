// hooks/useNotifications.ts
import { useEffect, useRef, useCallback, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform, AppState } from 'react-native';
import { NotificationService } from '@/services/NotificationService';
import { router } from 'expo-router';
import { useAuth } from '@/utils/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '@/utils/supabase';
import Constants from 'expo-constants';
import { isSigningOut } from '@/app/(home)/_layout';
import NetInfo from '@react-native-community/netinfo';

// Storage key for push token
const PUSH_TOKEN_STORAGE_KEY = 'expoPushToken';
const REGISTRATION_STATE_KEY = 'notificationRegistrationState';

// Maximum registration attempts
const MAX_REGISTRATION_ATTEMPTS = 5;
const REGISTRATION_TIMEOUT = 0.1 * 60 * 1000; // 3 minutes
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
      // Save token to secure storage immediately for resilience
      await SecureStore.setItemAsync(PUSH_TOKEN_STORAGE_KEY, pushToken.data);
      await SecureStore.setItemAsync('pushTokenRefreshTime', Date.now().toString());
      debugLog('Saved refreshed token to secure storage');

      // Skip database update if offline
      if (!networkStatus.current) {
        debugLog('Network unavailable, database update queued for when online');
        forceRegistrationOnNextForeground.current = true;
        return;
      }

      // Try to update token in database
      const success = await NotificationService.updatePushToken(pushToken.data, user.id);

      if (!success) {
        debugLog('Token database update failed, token preserved in storage');
        forceRegistrationOnNextForeground.current = true;
      } else {
        debugLog('Token successfully updated in database and storage');

        // Update registration state
        try {
          const regState: RegistrationState = {
            lastAttemptTime: Date.now(),
            attempts: 0,
            registered: true
          };
          await SecureStore.setItemAsync(REGISTRATION_STATE_KEY, JSON.stringify(regState));
        } catch (e) {
          // Non-critical error
        }
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

        // Navigate to the specified screen with retry logic
        debugLog(`Navigating to ${navigationData.screen}`);

        try {
          // Use timeout to prevent hanging if navigation fails
          const navigationPromise = new Promise<void>((resolve, reject) => {
            try {
              if (navigationData.params) {
                router.push({
                  pathname: navigationData.screen,
                  params: navigationData.params
                });
              } else {
                router.push(navigationData.screen);
              }
              resolve();
            } catch (e) {
              reject(e);
            }
          });

          // Add timeout to navigation
          const timeoutPromise = new Promise<void>((_, reject) => {
            setTimeout(() => {
              reject(new Error('Navigation timeout'));
            }, 3000);
          });

          await Promise.race([navigationPromise, timeoutPromise]);
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

      // 2. Get token using service with force parameter
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

        // Schedule retry with exponential backoff (max 30 minutes)
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

      if (error instanceof Error) {
        debugLog('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }

      // Save state for future attempts
      await saveRegistrationState({
        lastAttemptTime: Date.now(),
        attempts: registrationAttempts.current,
        lastError: error instanceof Error ? error.message : String(error),
        registered: false
      });

      // Reset permission state
      setIsPermissionGranted(false);

      // Schedule retry with exponential backoff (max 30 minutes)
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

  // Enhanced token cleanup with persistence verification
  const cleanupPushToken = useCallback(async () => {
    debugLog('Starting comprehensive push token cleanup process');

    try {
      // Clear any pending registration timer
      if (registrationTimer.current) {
        clearTimeout(registrationTimer.current);
        registrationTimer.current = null;
      }

      // Get token from secure storage
      const token = await SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY);

      if (!token) {
        debugLog('No push token found in storage, nothing to clean up');
        return true;
      }

      debugLog('Found push token to clean up');

      // Cleanup registration state
      await SecureStore.deleteItemAsync(REGISTRATION_STATE_KEY);

      // If we have a user ID, use it for targeted deletion
      if (user?.id) {
        try {
          const success = await NotificationService.cleanupPushToken(user.id);
          if (!success) {
            debugLog('Database cleanup failed, continuing with local cleanup');
          }
        } catch (dbError) {
          debugLog('Database error during token cleanup:', dbError);
        }
      } else {
        // If no user ID, try token-only service cleanup
        try {
          await NotificationService.cleanupPushToken();
        } catch (tokenError) {
          debugLog('Service cleanup failed:', tokenError);
        }
      }

      // Always remove from secure storage
      const tokenKeys = [
        PUSH_TOKEN_STORAGE_KEY,
        'pushTokenRefreshTime',
        'pushTokenRegistrationAttempts'
      ];

      await Promise.all(
        tokenKeys.map(key =>
          SecureStore.deleteItemAsync(key).catch(e =>
            debugLog(`Error deleting ${key}:`, e)
          )
        )
      );

      debugLog('Token removed from secure storage');

      // Reset registration attempts counter
      registrationAttempts.current = 0;
      forceRegistrationOnNextForeground.current = false;

      return true;
    } catch (error) {
      debugLog('Error cleaning up push token:', error);

      // Attempt storage cleanup anyway
      try {
        await SecureStore.deleteItemAsync(PUSH_TOKEN_STORAGE_KEY);
        await SecureStore.deleteItemAsync('pushTokenRefreshTime');
        await SecureStore.deleteItemAsync(REGISTRATION_STATE_KEY);
      } catch (storageError) {
        debugLog('Failed to clean token from storage:', storageError);
      }

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

      debugLog(`Network status changed: ${wasConnected ? 'connected' : 'disconnected'} -> ${isConnected ? 'connected' : 'disconnected'}`);

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

  // App state change handling with robust token verification
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

        // Always refresh notifications when coming to foreground
        refreshNotifications();

        // If a token refresh or registration has been pending, force it now
        if (forceRegistrationOnNextForeground.current) {
          debugLog('Forced registration pending, executing now');
          registerForPushNotifications(true);
          forceRegistrationOnNextForeground.current = false;
          return;
        }

        // Regular token verification when app comes to foreground
        (async () => {
          // Get registration state
          const regState = await getRegistrationState();

          // If registered recently (within 12 hours), skip verification
          if (regState?.registered) {
            const timeSinceLastSuccess = Date.now() - regState.lastAttemptTime;
            if (timeSinceLastSuccess < 12 * 60 * 60 * 1000) {
              debugLog('Recent successful registration, skipping verification');
              return;
            }
          }

          // Otherwise verify token in database
          const storedToken = await SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY);
          if (!storedToken) {
            debugLog('No stored token found, initiating registration');
            registerForPushNotifications();
            return;
          }

          // Basic validation before database check
          if (!storedToken.includes('[') && !storedToken.includes(']') && storedToken.length < 10) {
            debugLog('Invalid token format, initiating new registration');
            registerForPushNotifications(true);
            return;
          }

          try {
            debugLog('Verifying token in database');
            const { data } = await supabase
              .from('user_push_tokens')
              .select('token')
              .eq('user_id', user.id)
              .eq('token', storedToken)
              .single();

            if (!data) {
              debugLog('Token in storage but not in database, re-registering');
              registerForPushNotifications(true);
            } else {
              debugLog('Token verified in database');

              // Update last verified timestamp
              await saveRegistrationState({
                lastAttemptTime: Date.now(),
                attempts: 0,
                registered: true
              });
            }
          } catch (error) {
            debugLog('Error verifying token on app foreground:', error);

            // Only force registration if it's been a while since last attempt
            if (!regState || Date.now() - regState.lastAttemptTime > 60 * 60 * 1000) {
              registerForPushNotifications();
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

      // Enhanced token initialization procedure
      try {
        // First check if we have a registration state
        const regState = await getRegistrationState();

        if (regState?.registered) {
          debugLog('Found existing registration state:', regState);

          // If registered within last 24 hours, just verify token
          const timeSinceLastSuccess = Date.now() - regState.lastAttemptTime;

          if (timeSinceLastSuccess < 24 * 60 * 60 * 1000) {
            // Get the token
            const storedToken = await SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY);

            if (storedToken) {
              debugLog('Using existing token, last registration was recent');
              setIsPermissionGranted(true);

              // Add token listener for refreshes
              if (pushTokenListener.current) {
                pushTokenListener.current.remove();
              }
              pushTokenListener.current = Notifications.addPushTokenListener(handleTokenRefresh);

              // Verify token in database asynchronously without blocking UI
              setTimeout(() => {
                if (mounted) {
                  supabase
                    .from('user_push_tokens')
                    .select('token')
                    .eq('user_id', user.id)
                    .eq('token', storedToken)
                    .single()
                    .then(({ data }) => {
                      if (!data && mounted) {
                        debugLog('Token not in database despite registration state');
                        registerForPushNotifications(true);
                      }
                    })
                    .catch(() => {
                      // Continue without blocking UI
                    });
                }
              }, 5000);

              return;
            }
          }
        }

        // No recent registration state or no token, do full registration
        debugLog('No recent registration state found, starting full registration');
        await registerForPushNotifications();
      } catch (error) {
        debugLog('Error during token initialization:', error);
        // Try registration despite the error
        await registerForPushNotifications();
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
          debugLog('Unsubscribing from realtime notifications');
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