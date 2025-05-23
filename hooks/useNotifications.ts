// hooks/useNotifications.ts - OPTIMIZED VERSION
import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
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
import { notificationCache, NotificationCacheManager } from '@/utils/NotificationCacheManager';
import { notificationCoordinator } from '@/utils/NotificationOperationCoordinator';

// Storage keys
const STORAGE_KEYS = {
  PUSH_TOKEN: 'expoPushToken',
  REGISTRATION_STATE: 'notificationRegistrationState',
  TOKEN_REFRESH_TIME: 'pushTokenRefreshTime'
} as const;

// Configuration constants - OPTIMIZED
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
  
  // App state and registration management - OPTIMIZED
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const registrationTimer = useRef<NodeJS.Timeout | null>(null);
  const networkStatus = useRef<boolean>(true);
  const verificationTimer = useRef<NodeJS.Timeout | null>(null);

  /**
   * OPTIMIZATION 1: Memoized debug logger
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
   * OPTIMIZATION 2: Memoized operation keys for coordinator
   */
  const operationKeys = useMemo(() => ({
    registration: user?.id ? `register_${user.id}` : null,
    verification: user?.id ? `verify_${user.id}` : null,
    tokenRefresh: user?.id ? `refresh_${user.id}` : null,
  }), [user?.id]);

  /**
   * OPTIMIZATION 3: Enhanced token refresh handler with coordinator
   */
  const handleTokenRefresh = useCallback(async (pushToken: Notifications.ExpoPushToken) => {
    if (!user?.id || isSigningOut || !operationKeys.tokenRefresh) return;

    debugLog('Expo push token refreshed:', pushToken.data);

    try {
      await notificationCoordinator.executeExclusive(
        operationKeys.tokenRefresh,
        async (signal) => {
          // Check if operation was cancelled
          notificationCoordinator.checkAborted(signal);

          // Validate token format
          const validExpoTokenFormat = /^ExponentPushToken\[.+\]$/;
          if (!validExpoTokenFormat.test(pushToken.data)) {
            debugLog('Received non-Expo format token during refresh, ignoring');
            return;
          }

          // Save token to secure storage
          await SecureStore.setItemAsync(STORAGE_KEYS.PUSH_TOKEN, pushToken.data);
          await SecureStore.setItemAsync(STORAGE_KEYS.TOKEN_REFRESH_TIME, Date.now().toString());

          // Skip database update if offline
          if (!networkStatus.current) {
            debugLog('Network unavailable, database update queued for when online');
            return;
          }

          // Verify token exists in database using cached verification
          const verification = await NotificationService.forceTokenVerification(user.id);

          if (!verification.isValid || verification.token !== pushToken.data) {
            await registerForPushNotifications(true);
          }
        }
      );
    } catch (error: any) {
      if (error.message !== 'Operation cancelled') {
        debugLog('Error handling token refresh:', error);
      }
    }
  }, [user?.id, operationKeys.tokenRefresh, debugLog]);

  /**
   * OPTIMIZATION 4: Notification handler with better duplicate prevention
   */
  const handleNotification = useCallback(async (notification: Notifications.Notification) => {
    if (!user) return;

    const notificationId = notification.request.identifier;
    const now = Date.now();
    
    // Check duplicate with optimized logic
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

      // Update unread count using cached method
      const newUnreadCount = await NotificationService.getUnreadCount(user.id);
      setUnreadCount(newUnreadCount);
    } catch (error) {
      debugLog('Error handling notification:', error);
    }
  }, [user, debugLog]);

  /**
   * OPTIMIZATION 5: Response handler with improved navigation
   */
  const handleNotificationResponse = useCallback(async (response: Notifications.NotificationResponse) => {
    if (!user) return;

    // Prevent duplicate response handling with optimized check
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

      const navigationData = await NotificationService.handleNotificationResponse(response);
      
      if (navigationData?.screen) {
        // Mark notification as read
        const notificationId = response.notification.request.content.data?.notificationId;
        if (notificationId) {
          await NotificationService.markAsRead(notificationId);
          // Cached count will be automatically updated
          const newUnreadCount = await NotificationService.getUnreadCount(user.id);
          setUnreadCount(newUnreadCount);
        }

        // Navigate with single retry
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
    } catch (error) {
      debugLog('Error handling notification response:', error);
    }
  }, [user, debugLog]);

  /**
   * OPTIMIZATION 6: Registration state management with cache
   */
  const getRegistrationState = useCallback(async (): Promise<RegistrationState | null> => {
    try {
      const stateJson = await SecureStore.getItemAsync(STORAGE_KEYS.REGISTRATION_STATE);
      return stateJson ? JSON.parse(stateJson) : null;
    } catch (error) {
      debugLog('Error reading registration state:', error);
      return null;
    }
  }, [debugLog]);

  const saveRegistrationState = useCallback(async (state: RegistrationState): Promise<void> => {
    try {
      await SecureStore.setItemAsync(STORAGE_KEYS.REGISTRATION_STATE, JSON.stringify(state));
    } catch (error) {
      debugLog('Error saving registration state:', error);
    }
  }, [debugLog]);

  /**
   * OPTIMIZATION 7: Main registration function with coordinator
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
      await notificationCoordinator.queueOperation(
        operationKeys.registration,
        async () => {
          debugLog(`Starting push notification registration. Force: ${force}`);

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
            return;
          }

          setLoading(true);

          try {
            // RULE 1: Check cached permissions first
            let cachedPermissions = notificationCache.get<Notifications.NotificationPermissionsStatus>(
              NotificationCacheManager.keys.permissions()
            );

            if (!cachedPermissions) {
              cachedPermissions = await NotificationService.getPermissions();
              if (cachedPermissions) {
                notificationCache.set(
                  NotificationCacheManager.keys.permissions(),
                  cachedPermissions,
                  10 * 60 * 1000 // 10 minutes
                );
              }
            }

            let permissionStatus = cachedPermissions?.status;

            if (permissionStatus !== 'granted') {
              debugLog('Permission not granted, requesting');
              const newPermissions = await NotificationService.requestPermissions();
              
              if (newPermissions) {
                permissionStatus = newPermissions.status;
                // Update cache
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
                
                return;
              }
            }

            setIsPermissionGranted(true);

            // RULE 2: Use cached verification if not forcing
            if (!force) {
              const cachedVerification = notificationCache.getCachedTokenVerification(user.id);
              if (cachedVerification?.isValid) {
                debugLog('Using cached token verification');
                return;
              }
            }

            // RULE 3: Register for notifications
            const token = await NotificationService.registerForPushNotificationsAsync(user.id, force);

            if (token) {
              debugLog('Successfully registered push token');
              
              // Set up token refresh listener
              if (pushTokenListener.current) {
                pushTokenListener.current.remove();
              }
              pushTokenListener.current = Notifications.addPushTokenListener(handleTokenRefresh);
              
              await saveRegistrationState({
                lastAttemptTime: Date.now(),
                attempts: 0,
                registered: true
              });
            } else {
              debugLog('Failed to register push token');
              
              // Schedule retry with exponential backoff
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
            }
          } finally {
            setLoading(false);
          }
        }
      );
    } catch (error: any) {
      if (error.message !== 'Operation cancelled') {
        debugLog('Error in registration queue:', error);
      }
      setLoading(false);
    }
  }, [user?.id, operationKeys.registration, handleTokenRefresh, getRegistrationState, saveRegistrationState, debugLog]);

  /**
   * OPTIMIZATION 8: Enhanced cleanup function
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

      // Clear timers
      if (registrationTimer.current) {
        clearTimeout(registrationTimer.current);
        registrationTimer.current = null;
      }
      if (verificationTimer.current) {
        clearTimeout(verificationTimer.current);
        verificationTimer.current = null;
      }

      if (user?.id) {
        await NotificationService.cleanupPushToken(user.id);
        
        // Clear cache entries for this user
        notificationCache.invalidatePattern(`.*_${user.id}.*`);
      }

      // Clear registration state
      await SecureStore.deleteItemAsync(STORAGE_KEYS.REGISTRATION_STATE);

      return true;
    } catch (error) {
      debugLog('Error cleaning up push token:', error);
      return false;
    }
  }, [user?.id, operationKeys, debugLog]);

  /**
   * OPTIMIZATION 9: Cached notification operations
   */
  const markAsRead = useCallback(async (notificationId: string): Promise<void> => {
    if (!user) return;

    try {
      await NotificationService.markAsRead(notificationId);
      // Count will be automatically updated from cache
      const newUnreadCount = await NotificationService.getUnreadCount(user.id);
      setUnreadCount(newUnreadCount);
    } catch (error) {
      debugLog('Error marking notification as read:', error);
    }
  }, [user, debugLog]);

  const markAllAsRead = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
      await NotificationService.markAllAsRead(user.id);
      // Invalidate cache
      notificationCache.invalidate(NotificationCacheManager.keys.unreadCount(user.id));
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
      // Cache will be invalidated automatically
      const newUnreadCount = await NotificationService.getUnreadCount(user.id);
      setUnreadCount(newUnreadCount);
    } catch (error) {
      debugLog('Error deleting notification:', error);
    }
  }, [user, debugLog]);

  const refreshNotifications = useCallback(async (): Promise<void> => {
    if (!user) return;

    setLoading(true);
    try {
      // Force cache refresh
      notificationCache.invalidate(NotificationCacheManager.keys.unreadCount(user.id));
      const count = await NotificationService.getUnreadCount(user.id);
      setUnreadCount(count);
    } catch (error) {
      debugLog('Error refreshing notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user, debugLog]);

  /**
   * OPTIMIZATION 10: Network monitoring with debounced recovery
   */
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const wasConnected = networkStatus.current;
      const isConnected = !!state.isConnected;
      networkStatus.current = isConnected;

      if (isConnected && !wasConnected && user?.id) {
        debugLog('Network reconnected, scheduling token verification');
        
        // Debounce network recovery actions
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
        }, 5000); // Wait 5 seconds after network recovery
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
   * OPTIMIZATION 11: App state monitoring with intelligent verification
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      const previousState = appState.current;
      appState.current = nextAppState;

      if (isGlobalSigningOut) {
        debugLog('Skipping notification operations during sign-out');
        return;
      }

      // App coming to foreground
      if (
        previousState.match(/inactive|background/) &&
        nextAppState === 'active' &&
        user?.id &&
        operationKeys.verification
      ) {
        debugLog('App has come to foreground');

        // Immediate badge reset
        NotificationService.setBadgeCount(0).catch(() => {});

        // Debounced verification
        notificationCoordinator.debounceVerification(
          user.id,
          async () => {
            try {
              // Check cached verification first
              const cachedVerification = notificationCache.getCachedTokenVerification(user.id);
              
              if (cachedVerification?.isValid) {
                debugLog('Using cached verification on foreground');
                return;
              }

              // Perform verification
              const storedToken = await SecureStore.getItemAsync(STORAGE_KEYS.PUSH_TOKEN);
              
              if (!storedToken) {
                debugLog('No token found, initiating registration');
                await registerForPushNotifications(true);
                return;
              }

              const verification = await NotificationService.forceTokenVerification(user.id);
              
              if (!verification.isValid) {
                debugLog('Token invalid, re-registering');
                await registerForPushNotifications(true);
              } else if (verification.signedIn === false) {
                debugLog('Token needs sign-in status update');
                await NotificationService.markTokenAsSignedIn(user.id, verification.token);
              }
            } catch (error) {
              debugLog('Error during foreground verification:', error);
            }
          }
        );

        // Refresh notifications count
        refreshNotifications();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [user?.id, operationKeys.verification, registerForPushNotifications, refreshNotifications, debugLog]);

  /**
   * OPTIMIZATION 12: Initial setup with staged initialization
   */
  useEffect(() => {
    if (!user?.id) return;

    let mounted = true;

    const initializeNotificationsAsync = async () => {
      if (!mounted || isGlobalSigningOut) {
        debugLog('Skipping notification initialization');
        return;
      }

      debugLog('Setting up notification system for user:', user.id);

      // Stage 1: Set up listeners immediately
      try {
        if (notificationListener.current) notificationListener.current.remove();
        notificationListener.current = Notifications.addNotificationReceivedListener(handleNotification);

        if (responseListener.current) responseListener.current.remove();
        responseListener.current = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
        
        // Check cached permissions
        const cachedPermissions = notificationCache.get<Notifications.NotificationPermissionsStatus>(
          NotificationCacheManager.keys.permissions()
        );
        
        if (cachedPermissions?.status === 'granted') {
          setIsPermissionGranted(true);
        } else {
          // Check permissions asynchronously
          NotificationService.getPermissions().then(permissionStatus => {
            if (permissionStatus?.status === 'granted') {
              setIsPermissionGranted(true);
              // Cache the result
              notificationCache.set(
                NotificationCacheManager.keys.permissions(),
                permissionStatus,
                10 * 60 * 1000
              );
            }
          });
        }

        // Initial count retrieval (will use cache if available)
        refreshNotifications();
      } catch (initialError) {
        debugLog('Error during initial setup:', initialError);
      }

      // Stage 2: Deferred token registration
      setTimeout(async () => {
        if (!mounted || isGlobalSigningOut || !user?.id) {
          return;
        }

        try {
          // Check for cached verification first
          const cachedVerification = notificationCache.getCachedTokenVerification(user.id);
          
          if (cachedVerification?.isValid) {
            debugLog('Using cached token verification on init');
            setIsPermissionGranted(true);
            
            // Set up token refresh listener
            if (pushTokenListener.current) pushTokenListener.current.remove();
            pushTokenListener.current = Notifications.addPushTokenListener(handleTokenRefresh);
            
            return;
          }

          // Check local token
          const localToken = await SecureStore.getItemAsync(STORAGE_KEYS.PUSH_TOKEN);
          
          if (localToken) {
            debugLog('Verifying local token');
            const verification = await NotificationService.forceTokenVerification(user.id);
            
            if (verification.isValid) {
              setIsPermissionGranted(true);
              
              // Set up token refresh listener
              if (pushTokenListener.current) pushTokenListener.current.remove();
              pushTokenListener.current = Notifications.addPushTokenListener(handleTokenRefresh);
              
              return;
            }
          }

          // Register new token
          await registerForPushNotifications(true);
        } catch (deferredError) {
          debugLog('Error during deferred initialization:', deferredError);
        }
      }, CONFIG.FOREGROUND_VERIFICATION_DELAY);
    };

    initializeNotificationsAsync();

    // Cleanup function
    return () => {
      mounted = false;
      debugLog('Cleaning up notification system');

      // Cancel all operations
      if (operationKeys.registration) {
        notificationCoordinator.cancelOperation(operationKeys.registration);
      }
      if (operationKeys.verification) {
        notificationCoordinator.cancelOperation(operationKeys.verification);
      }

      // Clear timers
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