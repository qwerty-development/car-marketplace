// hooks/useNotifications.ts - FIXED VERSION
import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { NotificationService } from '@/services/NotificationService';
import { router } from 'expo-router';
import { useAuth } from '@/utils/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { isSigningOut } from '@/utils/signOutState';
import NetInfo from '@react-native-community/netinfo';
import { isGlobalSigningOut } from '../utils/AuthContext';
import { notificationCache, NotificationCacheManager } from '@/utils/NotificationCacheManager';
import { notificationCoordinator } from '@/utils/NotificationOperationCoordinator';

// CRITICAL FIX 1: Enhanced timeout configurations
const OPERATION_TIMEOUTS = {
  REGISTRATION: 12000, // 12 seconds for registration
  PERMISSION_REQUEST: 8000, // 8 seconds for permissions
  TOKEN_VERIFICATION: 5000, // 5 seconds for verification
  NAVIGATION: 3000, // 3 seconds for navigation
  INITIALIZATION: 15000, // 15 seconds total initialization timeout
} as const;

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
  DEBUG_MODE: __DEV__,
  DUPLICATE_WINDOW: 5000, // 5 seconds
  NAVIGATION_RETRY_DELAY: 1000,
  REGISTRATION_RETRY_BASE_DELAY: 5000,
  MAX_RETRY_DELAY: 30 * 60 * 1000, // 30 minutes
  RECENT_REGISTRATION_THRESHOLD: 24 * 60 * 60 * 1000, // 24 hours
  TOKEN_VERIFICATION_INTERVAL: 12 * 60 * 60 * 1000, // 12 hours
  FOREGROUND_VERIFICATION_DELAY: 2000, // 2 seconds
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

// CRITICAL FIX 2: Timeout utility for hook operations
const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
};

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
  
  // CRITICAL FIX 3: Enhanced timeout management
  const operationTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const initializationTimeout = useRef<NodeJS.Timeout | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const registrationTimer = useRef<NodeJS.Timeout | null>(null);
  const networkStatus = useRef<boolean>(true);
  const verificationTimer = useRef<NodeJS.Timeout | null>(null);
  const [initializationComplete, setInitializationComplete] = useState(false);

  // CRITICAL FIX 4: Cleanup function for timeouts
  const cleanupTimeout = useCallback((key: string) => {
    const timeout = operationTimeouts.current.get(key);
    if (timeout) {
      clearTimeout(timeout);
      operationTimeouts.current.delete(key);
    }
  }, []);

  const setOperationTimeout = useCallback((key: string, timeoutMs: number, callback: () => void) => {
    cleanupTimeout(key);
    const timeout = setTimeout(callback, timeoutMs);
    operationTimeouts.current.set(key, timeout);
    return timeout;
  }, [cleanupTimeout]);

  /**
   * CRITICAL FIX 5: Enhanced debug logger with timeout info
   */
  const debugLog = useCallback((message: string, data?: any) => {
    if (CONFIG.DEBUG_MODE) {
      const timestamp = new Date().toISOString();
      const timeouts = operationTimeouts.current.size;
      const logPrefix = `[useNotifications ${timestamp}] [Timeouts:${timeouts}]`;

      if (data !== undefined) {
        console.log(`${logPrefix} ${message}`, data);
      } else {
        console.log(`${logPrefix} ${message}`);
      }
    }
  }, []);

  /**
   * CRITICAL FIX 6: Memoized operation keys for coordinator
   */
  const operationKeys = useMemo(() => ({
    registration: user?.id ? `register_${user.id}` : null,
    verification: user?.id ? `verify_${user.id}` : null,
    tokenRefresh: user?.id ? `refresh_${user.id}` : null,
  }), [user?.id]);

  /**
   * CRITICAL FIX 7: Enhanced token refresh handler with timeout protection
   */
  const handleTokenRefresh = useCallback(async (pushToken: Notifications.ExpoPushToken) => {
    if (!user?.id || isSigningOut || !operationKeys.tokenRefresh) return;

    debugLog('Expo push token refreshed:', pushToken.data);

    try {
      await withTimeout(
        notificationCoordinator.executeExclusive(
          operationKeys.tokenRefresh,
          async (signal) => {
            notificationCoordinator.checkAborted(signal);

            const validExpoTokenFormat = /^ExponentPushToken\[.+\]$/;
            if (!validExpoTokenFormat.test(pushToken.data)) {
              debugLog('Received non-Expo format token during refresh, ignoring');
              return;
            }

            await SecureStore.setItemAsync(STORAGE_KEYS.PUSH_TOKEN, pushToken.data);
            await SecureStore.setItemAsync(STORAGE_KEYS.TOKEN_REFRESH_TIME, Date.now().toString());

            if (!networkStatus.current) {
              debugLog('Network unavailable, database update queued for when online');
              return;
            }

            const verification = await NotificationService.forceTokenVerification(user.id);

            if (!verification.isValid || verification.token !== pushToken.data) {
              await registerForPushNotifications(true);
            }
          }
        ),
        OPERATION_TIMEOUTS.TOKEN_VERIFICATION,
        'token refresh'
      );
    } catch (error: any) {
      if (error.message.includes('timed out')) {
        debugLog('Token refresh timed out');
      } else if (error.message !== 'Operation cancelled') {
        debugLog('Error handling token refresh:', error);
      }
    }
  }, [user?.id, operationKeys.tokenRefresh, debugLog]);

  /**
   * CRITICAL FIX 8: Enhanced notification handler with timeout protection
   */
  const handleNotification = useCallback(async (notification: Notifications.Notification) => {
    if (!user) return;

    const notificationId = notification.request.identifier;
    const now = Date.now();
    
    const lastHandled = lastHandledNotification.current;
    if (lastHandled) {
      const [lastId, lastTimeStr] = lastHandled.split('|');
      const lastTime = parseInt(lastTimeStr, 10);
      
      if (lastId === notificationId && (now - lastTime) < CONFIG.DUPLICATE_WINDOW) {
        debugLog('Skipping duplicate notification');
        return;
      }
    }

    lastHandledNotification.current = `${notificationId}|${now}`;

    try {
      debugLog('Notification received:', {
        title: notification.request.content.title,
        body: notification.request.content.body
      });

      // Add timeout to unread count update
      const newUnreadCount = await withTimeout(
        NotificationService.getUnreadCount(user.id),
        3000, // 3 second timeout
        'unread count update'
      );
      setUnreadCount(newUnreadCount);
    } catch (error: any) {
      if (error.message.includes('timed out')) {
        debugLog('Notification handling timed out');
      } else {
        debugLog('Error handling notification:', error);
      }
    }
  }, [user, debugLog]);

  /**
   * CRITICAL FIX 9: Enhanced response handler with timeout protection
   */
  const handleNotificationResponse = useCallback(async (response: Notifications.NotificationResponse) => {
    if (!user) return;

    const responseId = response.notification.request.identifier;
    const currentTime = Date.now();
    const lastResponse = lastNotificationResponse.current;

    if (lastResponse?.notification.request.identifier === responseId) {
      const lastTime = lastResponse.notification.date?.getTime();
      if (lastTime && (currentTime - lastTime) < CONFIG.DUPLICATE_WINDOW) {
        debugLog('Skipping duplicate notification response');
        return;
      }
    }

    lastNotificationResponse.current = response;

    try {
      debugLog('User responded to notification');

      const navigationData = await withTimeout(
        NotificationService.handleNotificationResponse(response),
        OPERATION_TIMEOUTS.NAVIGATION,
        'notification response handling'
      );
      
      if (navigationData?.screen) {
        const notificationId = response.notification.request.content.data?.notificationId;
        if (notificationId) {
          await NotificationService.markAsRead(notificationId);
          const newUnreadCount = await NotificationService.getUnreadCount(user.id);
          setUnreadCount(newUnreadCount);
        }

        // Navigation with timeout protection
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
          debugLog('Navigation error, retrying once');
          setTimeout(navigate, CONFIG.NAVIGATION_RETRY_DELAY);
        }
      }
    } catch (error: any) {
      if (error.message.includes('timed out')) {
        debugLog('Notification response handling timed out');
      } else {
        debugLog('Error handling notification response:', error);
      }
    }
  }, [user, debugLog]);

  /**
   * CRITICAL FIX 10: Enhanced registration state management with timeout
   */
  const getRegistrationState = useCallback(async (): Promise<RegistrationState | null> => {
    try {
      const stateJson = await withTimeout(
        SecureStore.getItemAsync(STORAGE_KEYS.REGISTRATION_STATE),
        2000, // 2 second timeout
        'registration state read'
      );
      return stateJson ? JSON.parse(stateJson) : null;
    } catch (error: any) {
      if (error.message.includes('timed out')) {
        debugLog('Registration state read timed out');
      } else {
        debugLog('Error reading registration state:', error);
      }
      return null;
    }
  }, [debugLog]);

  const saveRegistrationState = useCallback(async (state: RegistrationState): Promise<void> => {
    try {
      await withTimeout(
        SecureStore.setItemAsync(STORAGE_KEYS.REGISTRATION_STATE, JSON.stringify(state)),
        2000, // 2 second timeout
        'registration state save'
      );
    } catch (error: any) {
      if (error.message.includes('timed out')) {
        debugLog('Registration state save timed out');
      } else {
        debugLog('Error saving registration state:', error);
      }
    }
  }, [debugLog]);

  /**
   * CRITICAL FIX 11: Main registration function with comprehensive timeout protection
   */
  const registerForPushNotifications = useCallback(async (force = false) => {
    if (!user?.id || !operationKeys.registration) {
      debugLog('No user ID available, skipping notification registration');
      return;
    }

    if (isSigningOut) {
      debugLog('User is signing out, skipping registration');
      return;
    }

    try {
      await withTimeout(
        notificationCoordinator.queueOperation(
          operationKeys.registration,
          async () => {
            debugLog(`Starting push notification registration. Force: ${force}`);

            // Clear any existing registration timer
            if (registrationTimer.current) {
              clearTimeout(registrationTimer.current);
              registrationTimer.current = null;
            }

            // Set registration timeout
            const registrationTimeoutId = setOperationTimeout(
              'registration',
              OPERATION_TIMEOUTS.REGISTRATION,
              () => {
                debugLog('Registration operation timed out');
                setLoading(false);
                setInitializationComplete(true);
              }
            );

            const netState = await NetInfo.fetch();
            networkStatus.current = !!netState.isConnected;

            if (!netState.isConnected && !force) {
              debugLog('Network unavailable, deferring registration');
              cleanupTimeout('registration');
              setInitializationComplete(true);
              return;
            }

            setLoading(true);

            try {
              let cachedPermissions = notificationCache.get<Notifications.NotificationPermissionsStatus>(
                NotificationCacheManager.keys.permissions()
              );

              if (!cachedPermissions) {
                cachedPermissions = await withTimeout(
                  NotificationService.getPermissions(),
                  OPERATION_TIMEOUTS.PERMISSION_REQUEST,
                  'permission check'
                );
                
                if (cachedPermissions) {
                  notificationCache.set(
                    NotificationCacheManager.keys.permissions(),
                    cachedPermissions,
                    10 * 60 * 1000
                  );
                }
              }

              let permissionStatus = cachedPermissions?.status;

              if (permissionStatus !== 'granted') {
                debugLog('Permission not granted, requesting');
                const newPermissions = await withTimeout(
                  NotificationService.requestPermissions(),
                  OPERATION_TIMEOUTS.PERMISSION_REQUEST,
                  'permission request'
                );
                
                if (newPermissions) {
                  permissionStatus = newPermissions.status;
                  notificationCache.set(
                    NotificationCacheManager.keys.permissions(),
                    newPermissions,
                    10 * 60 * 1000
                  );
                }

                if (permissionStatus !== 'granted') {
                  debugLog('Permission denied by user');
                  setIsPermissionGranted(false);
                  
                  await saveRegistrationState({
                    lastAttemptTime: Date.now(),
                    attempts: 0,
                    lastError: 'Permission denied',
                    registered: false
                  });
                  
                  cleanupTimeout('registration');
                  setInitializationComplete(true);
                  return;
                }
              }

              setIsPermissionGranted(true);

              if (!force) {
                const cachedVerification = notificationCache.getCachedTokenVerification(user.id);
                if (cachedVerification?.isValid) {
                  debugLog('Using cached token verification');
                  cleanupTimeout('registration');
                  setInitializationComplete(true);
                  return;
                }
              }

              const token = await withTimeout(
                NotificationService.registerForPushNotificationsAsync(user.id, force),
                OPERATION_TIMEOUTS.REGISTRATION,
                'token registration'
              );

              if (token) {
                debugLog('Successfully registered push token');
                
                if (pushTokenListener.current) {
                  pushTokenListener.current.remove();
                }
                pushTokenListener.current = Notifications.addPushTokenListener(handleTokenRefresh);
                
                await saveRegistrationState({
                  lastAttemptTime: Date.now(),
                  attempts: 0,
                  registered: true
                });

                cleanupTimeout('registration');
                setInitializationComplete(true);
              } else {
                debugLog('Failed to register push token');
                
                const regState = await getRegistrationState();
                const attempts = (regState?.attempts || 0) + 1;
                
                if (attempts < CONFIG.MAX_REGISTRATION_ATTEMPTS) {
                  const delay = Math.min(
                    CONFIG.REGISTRATION_RETRY_BASE_DELAY * Math.pow(2, attempts - 1),
                    CONFIG.MAX_RETRY_DELAY
                  );
                  
                  debugLog(`Scheduling retry in ${Math.round(delay / 1000)}s`);
                  registrationTimer.current = setTimeout(() => {
                    registerForPushNotifications(false);
                  }, delay);
                }
                
                await saveRegistrationState({
                  lastAttemptTime: Date.now(),
                  attempts,
                  lastError: 'Failed to get token',
                  registered: false
                });

                cleanupTimeout('registration');
                setInitializationComplete(true);
              }
            } finally {
              setLoading(false);
            }
          }
        ),
        OPERATION_TIMEOUTS.REGISTRATION,
        'registration queue operation'
      );
    } catch (error: any) {
      if (error.message.includes('timed out')) {
        debugLog('Registration operation timed out');
      } else if (error.message !== 'Operation cancelled') {
        debugLog('Error in registration queue:', error);
      }
      setLoading(false);
      setInitializationComplete(true);
    }
  }, [user?.id, operationKeys.registration, handleTokenRefresh, getRegistrationState, saveRegistrationState, debugLog, cleanupTimeout, setOperationTimeout]);

  /**
   * CRITICAL FIX 12: Enhanced cleanup function with timeout protection
   */
  const cleanupPushToken = useCallback(async () => {
    debugLog('Starting push token cleanup');

    try {
      // Cancel any pending operations
      if (operationKeys.registration) {
        notificationCoordinator.cancelOperation(operationKeys.registration);
      }
      if (operationKeys.verification) {
        notificationCoordinator.cancelOperation(operationKeys.verification);
      }

      // Clear all timeouts
      operationTimeouts.current.forEach(timeout => clearTimeout(timeout));
      operationTimeouts.current.clear();

      if (registrationTimer.current) {
        clearTimeout(registrationTimer.current);
        registrationTimer.current = null;
      }
      if (verificationTimer.current) {
        clearTimeout(verificationTimer.current);
        verificationTimer.current = null;
      }

      if (user?.id) {
        const cleanupResult = await withTimeout(
          NotificationService.cleanupPushToken(user.id),
          3000, // 3 second timeout
          'push token cleanup'
        );
        
        notificationCache.invalidatePattern(`.*_${user.id}.*`);
        return cleanupResult;
      }

      await SecureStore.deleteItemAsync(STORAGE_KEYS.REGISTRATION_STATE);
      return true;
    } catch (error: any) {
      if (error.message.includes('timed out')) {
        debugLog('Push token cleanup timed out');
      } else {
        debugLog('Error cleaning up push token:', error);
      }
      return false;
    }
  }, [user?.id, operationKeys, debugLog]);

  /**
   * CRITICAL FIX 13: Cached notification operations with timeout
   */
  const markAsRead = useCallback(async (notificationId: string): Promise<void> => {
    if (!user) return;

    try {
      await withTimeout(
        NotificationService.markAsRead(notificationId),
        3000, // 3 second timeout
        'mark as read'
      );
      
      const newUnreadCount = await NotificationService.getUnreadCount(user.id);
      setUnreadCount(newUnreadCount);
    } catch (error: any) {
      if (error.message.includes('timed out')) {
        debugLog('Mark as read timed out');
      } else {
        debugLog('Error marking notification as read:', error);
      }
    }
  }, [user, debugLog]);

  const markAllAsRead = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
      await withTimeout(
        NotificationService.markAllAsRead(user.id),
        5000, // 5 second timeout
        'mark all as read'
      );
      
      notificationCache.invalidate(NotificationCacheManager.keys.unreadCount(user.id));
      setUnreadCount(0);
      await NotificationService.setBadgeCount(0);
    } catch (error: any) {
      if (error.message.includes('timed out')) {
        debugLog('Mark all as read timed out');
      } else {
        debugLog('Error marking all notifications as read:', error);
      }
    }
  }, [user, debugLog]);

  const deleteNotification = useCallback(async (notificationId: string): Promise<void> => {
    if (!user) return;

    try {
      await withTimeout(
        NotificationService.deleteNotification(notificationId),
        3000, // 3 second timeout
        'delete notification'
      );
      
      const newUnreadCount = await NotificationService.getUnreadCount(user.id);
      setUnreadCount(newUnreadCount);
    } catch (error: any) {
      if (error.message.includes('timed out')) {
        debugLog('Delete notification timed out');
      } else {
        debugLog('Error deleting notification:', error);
      }
    }
  }, [user, debugLog]);

  const refreshNotifications = useCallback(async (): Promise<void> => {
    if (!user) return;

    setLoading(true);
    try {
      notificationCache.invalidate(NotificationCacheManager.keys.unreadCount(user.id));
      const count = await withTimeout(
        NotificationService.getUnreadCount(user.id),
        3000, // 3 second timeout
        'refresh notifications'
      );
      setUnreadCount(count);
    } catch (error: any) {
      if (error.message.includes('timed out')) {
        debugLog('Refresh notifications timed out');
      } else {
        debugLog('Error refreshing notifications:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [user, debugLog]);

  /**
   * CRITICAL FIX 14: Network monitoring with timeout protection
   */
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const wasConnected = networkStatus.current;
      const isConnected = !!state.isConnected;
      networkStatus.current = isConnected;

      if (isConnected && !wasConnected && user?.id) {
        debugLog('Network reconnected, scheduling token verification');
        
        if (verificationTimer.current) {
          clearTimeout(verificationTimer.current);
        }
        
        verificationTimer.current = setTimeout(() => {
          if (operationKeys.verification) {
            notificationCoordinator.debounceVerification(
              user.id,
              () => registerForPushNotifications(true)
            );
          }
        }, 5000);
      }
    });

    return () => {
      unsubscribe();
      if (verificationTimer.current) {
        clearTimeout(verificationTimer.current);
      }
    };
  }, [user?.id, operationKeys.verification, registerForPushNotifications, debugLog]);

  /**
   * CRITICAL FIX 15: App state monitoring with timeout protection
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      const previousState = appState.current;
      appState.current = nextAppState;

      if (isGlobalSigningOut) {
        debugLog('Skipping notification operations during sign-out');
        return;
      }

      if (
        previousState.match(/inactive|background/) &&
        nextAppState === 'active' &&
        user?.id &&
        operationKeys.verification
      ) {
        debugLog('App has come to foreground');

        NotificationService.setBadgeCount(0).catch(() => {});

        notificationCoordinator.debounceVerification(
          user.id,
          async () => {
            try {
              const cachedVerification = notificationCache.getCachedTokenVerification(user.id);
              
              if (cachedVerification?.isValid) {
                debugLog('Using cached verification on foreground');
                return;
              }

              const storedToken = await SecureStore.getItemAsync(STORAGE_KEYS.PUSH_TOKEN);
              
              if (!storedToken) {
                debugLog('No token found, initiating registration');
                await registerForPushNotifications(true);
                return;
              }

              const verification = await withTimeout(
                NotificationService.forceTokenVerification(user.id),
                OPERATION_TIMEOUTS.TOKEN_VERIFICATION,
                'foreground token verification'
              );
              
              if (!verification.isValid) {
                debugLog('Token invalid, re-registering');
                await registerForPushNotifications(true);
              } else if (verification.signedIn === false) {
                debugLog('Token needs sign-in status update');
                await NotificationService.markTokenAsSignedIn(user.id, verification.token);
              }
            } catch (error: any) {
              if (error.message.includes('timed out')) {
                debugLog('Foreground verification timed out');
              } else {
                debugLog('Error during foreground verification:', error);
              }
            }
          }
        );

        refreshNotifications();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [user?.id, operationKeys.verification, registerForPushNotifications, refreshNotifications, debugLog]);

  /**
   * CRITICAL FIX 16: Initial setup with comprehensive timeout protection
   */
  useEffect(() => {
    if (!user?.id) {
      setInitializationComplete(true);
      return;
    }

    let mounted = true;

    // CRITICAL: Set master initialization timeout
    initializationTimeout.current = setTimeout(() => {
      debugLog('Master initialization timeout reached, forcing completion');
      setInitializationComplete(true);
      setLoading(false);
    }, OPERATION_TIMEOUTS.INITIALIZATION);

    const initializeNotificationsAsync = async () => {
      if (!mounted || isGlobalSigningOut) {
        debugLog('Skipping notification initialization');
        setInitializationComplete(true);
        return;
      }

      debugLog('Setting up notification system for user:', user.id);

      try {
        // Stage 1: Set up listeners immediately
        if (notificationListener.current) notificationListener.current.remove();
        notificationListener.current = Notifications.addNotificationReceivedListener(handleNotification);

        if (responseListener.current) responseListener.current.remove();
        responseListener.current = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
        
        const cachedPermissions = notificationCache.get<Notifications.NotificationPermissionsStatus>(
          NotificationCacheManager.keys.permissions()
        );
        
        if (cachedPermissions?.status === 'granted') {
          setIsPermissionGranted(true);
        } else {
          try {
            const permissionStatus = await withTimeout(
              NotificationService.getPermissions(),
              OPERATION_TIMEOUTS.PERMISSION_REQUEST,
              'initial permission check'
            );
            
            if (permissionStatus?.status === 'granted') {
              setIsPermissionGranted(true);
              notificationCache.set(
                NotificationCacheManager.keys.permissions(),
                permissionStatus,
                10 * 60 * 1000
              );
            }
          } catch (permError: any) {
            if (permError.message.includes('timed out')) {
              debugLog('Initial permission check timed out');
            }
          }
        }

        // Initial count retrieval with timeout
        try {
          await withTimeout(refreshNotifications(), 3000, 'initial refresh');
        } catch (refreshError: any) {
          if (refreshError.message.includes('timed out')) {
            debugLog('Initial refresh timed out');
          }
        }
      } catch (initialError) {
        debugLog('Error during initial setup:', initialError);
      }

      // Stage 2: Deferred token registration with timeout
      setTimeout(async () => {
        if (!mounted || isGlobalSigningOut || !user?.id) {
          setInitializationComplete(true);
          return;
        }

        try {
          const cachedVerification = notificationCache.getCachedTokenVerification(user.id);
          
          if (cachedVerification?.isValid) {
            debugLog('Using cached token verification on init');
            setIsPermissionGranted(true);
            
            if (pushTokenListener.current) pushTokenListener.current.remove();
            pushTokenListener.current = Notifications.addPushTokenListener(handleTokenRefresh);
            
            if (initializationTimeout.current) {
              clearTimeout(initializationTimeout.current);
            }
            setInitializationComplete(true);
            return;
          }

          const localToken = await SecureStore.getItemAsync(STORAGE_KEYS.PUSH_TOKEN);
          
          if (localToken) {
            debugLog('Verifying local token');
            const verification = await withTimeout(
              NotificationService.forceTokenVerification(user.id),
              OPERATION_TIMEOUTS.TOKEN_VERIFICATION,
              'initial token verification'
            );
            
            if (verification.isValid) {
              setIsPermissionGranted(true);
              
              if (pushTokenListener.current) pushTokenListener.current.remove();
              pushTokenListener.current = Notifications.addPushTokenListener(handleTokenRefresh);
              
              if (initializationTimeout.current) {
                clearTimeout(initializationTimeout.current);
              }
              setInitializationComplete(true);
              return;
            }
          }

          // Register new token - this may take time but shouldn't block initialization
          registerForPushNotifications(true).finally(() => {
            if (initializationTimeout.current) {
              clearTimeout(initializationTimeout.current);
            }
            setInitializationComplete(true);
          });
        } catch (deferredError: any) {
          if (deferredError.message.includes('timed out')) {
            debugLog('Deferred initialization timed out');
          } else {
            debugLog('Error during deferred initialization:', deferredError);
          }
          
          if (initializationTimeout.current) {
            clearTimeout(initializationTimeout.current);
          }
          setInitializationComplete(true);
        }
      }, CONFIG.FOREGROUND_VERIFICATION_DELAY);
    };

    initializeNotificationsAsync();

    // Cleanup function
    return () => {
      mounted = false;
      debugLog('Cleaning up notification system');

      if (initializationTimeout.current) {
        clearTimeout(initializationTimeout.current);
      }

      // Cancel all operations
      if (operationKeys.registration) {
        notificationCoordinator.cancelOperation(operationKeys.registration);
      }
      if (operationKeys.verification) {
        notificationCoordinator.cancelOperation(operationKeys.verification);
      }

      // Clear all timeouts
      operationTimeouts.current.forEach(timeout => clearTimeout(timeout));
      operationTimeouts.current.clear();

      if (registrationTimer.current) {
        clearTimeout(registrationTimer.current);
        registrationTimer.current = null;
      }
      if (verificationTimer.current) {
        clearTimeout(verificationTimer.current);
        verificationTimer.current = null;
      }

      // Remove listeners
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
    operationKeys,
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