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
import  Device  from 'react-native-device-info';
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
  
    debugLog(`Starting push notification registration. Force: ${force}`);
  
    // Check network status
    const netState = await NetInfo.fetch();
    networkStatus.current = !!netState.isConnected;
  
    if (!netState.isConnected && !force) {
      debugLog('Network unavailable, deferring registration');
      forceRegistrationOnNextForeground.current = true;
      return;
    }
  
    try {
      setLoading(true);
  
      // IMPROVEMENT: Add direct device diagnostics
      try {
        const deviceInfo = {
          brand: Device.getBrand(),
          model: await Device.getModel(),
          systemName: Device.getSystemName(),
          systemVersion: Device.getSystemVersion(),
          isTablet: Device.isTablet(),
          appVersion: Device.getVersion()
        };
        debugLog('Device info for diagnostics:', deviceInfo);
      } catch (diagError) {
        // Non-critical, continue with registration
        debugLog('Could not collect device diagnostics:', diagError);
      }
  
      // Directly request notification permissions
      const permissionStatus = await NotificationService.getPermissions();
      debugLog('Current permission status:', permissionStatus?.status);
  
      if (permissionStatus?.status !== 'granted') {
        debugLog('Permission not granted, requesting permissions');
        const newPermissions = await NotificationService.requestPermissions();
        
        if (newPermissions?.status !== 'granted') {
          debugLog('Permission denied by user');
          setIsPermissionGranted(false);
          setLoading(false);
          
          // Save state for future reference
          await saveRegistrationState({
            lastAttemptTime: Date.now(),
            attempts: registrationAttempts.current + 1,
            lastError: 'Permission denied',
            registered: false
          });
          
          return;
        }
        
        debugLog('Permission granted by user');
        setIsPermissionGranted(true);
      } else {
        setIsPermissionGranted(true);
      }
  
      // IMPROVEMENT: Always try to get token regardless of previous registration state
      if (force) {
        debugLog('Forced registration, skipping previous state check');
      } else {
        // Check previous registration state if not forcing
        const regState = await getRegistrationState();
        
        // More detailed logging for registration state
        debugLog('Previous registration state:', regState);
        
        if (regState?.registered && !force) {
          const timeSinceLastAttempt = Date.now() - regState.lastAttemptTime;
          debugLog(`Time since last registration: ${Math.round(timeSinceLastAttempt/1000/60)} minutes`);
          
          if (timeSinceLastAttempt < CONFIG.RECENT_REGISTRATION_THRESHOLD) {
            // Extra verification step for registered tokens
            try {
              const storedToken = await SecureStore.getItemAsync(STORAGE_KEYS.PUSH_TOKEN);
              if (storedToken) {
                debugLog('Verifying stored token with database');
                const verification = await NotificationService.forceTokenVerification(user.id);
                
                if (verification.isValid) {
                  debugLog('Token verification successful, skipping registration');
                  setIsPermissionGranted(true);
                  setLoading(false);
                  return;
                } else {
                  debugLog('Token verification failed, proceeding with registration');
                }
              } else {
                debugLog('No stored token found, proceeding with registration');
              }
            } catch (error) {
              debugLog('Error verifying token, proceeding with registration:', error);
            }
          }
        }
      }
  
      // IMPROVEMENT: Direct call to NotificationService with better error handling
      debugLog('Calling NotificationService.registerForPushNotificationsAsync');
      
      // Add retries for token registration
      let token = null;
      let lastError = null;
      
      for (let i = 0; i < 3; i++) {
        try {
          token = await NotificationService.registerForPushNotificationsAsync(user.id, force);
          if (token) break;
          
          // If we didn't get a token but no error was thrown, wait briefly before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          lastError = error;
          debugLog(`Token registration attempt ${i+1} failed:`, error);
          // Wait longer between retries
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
  
      if (token) {
        debugLog('Successfully registered push token');
        setIsPermissionGranted(true);
        
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
        
        // Get updated diagnostic info
        try {
          const diagInfo = await NotificationService.getDiagnostics();
          setDiagnosticInfo(diagInfo);
        } catch (e) {
          debugLog('Non-critical: Failed to get diagnostics:', e);
        }
      } else {
        debugLog('Failed to get push token after multiple attempts');
        
        if (lastError) {
          debugLog('Last error from token registration:', lastError);
        }
        
        // Increment attempt counter
        registrationAttempts.current = registrationAttempts.current + 1;
        
        // Save state for future attempts
        await saveRegistrationState({
          lastAttemptTime: Date.now(),
          attempts: registrationAttempts.current,
          lastError: lastError ? (lastError.message || String(lastError)) : 'Failed to get token',
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
            registerForPushNotifications(false);
          }, delay);
        }
      }
    } catch (error) {
      debugLog('Error registering for notifications:', error);
      
      // Update registration state
      registrationAttempts.current = registrationAttempts.current + 1;
      await saveRegistrationState({
        lastAttemptTime: Date.now(),
        attempts: registrationAttempts.current,
        lastError: error instanceof Error ? error.message : String(error),
        registered: false
      });
      
      // Schedule a retry regardless of error type
      if (registrationAttempts.current < CONFIG.MAX_REGISTRATION_ATTEMPTS) {
        const delay = Math.min(
          CONFIG.REGISTRATION_RETRY_BASE_DELAY * Math.pow(2, registrationAttempts.current - 1),
          CONFIG.MAX_RETRY_DELAY
        );
        
        debugLog(`Scheduling error recovery retry in ${Math.round(delay / 1000)}s`);
        registrationTimer.current = setTimeout(() => {
          registerForPushNotifications(true); // Force on retry after error
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
  
        // Verify token on app foreground with graceful degradation
        (async () => {
          try {
            debugLog('Verifying token on app foreground');
  
            // Enhanced verification with local storage check first
            const storedToken = await SecureStore.getItemAsync(STORAGE_KEYS.PUSH_TOKEN);
            
            if (!storedToken) {
              debugLog('No token in local storage, initiating registration');
              // Use setTimeout to avoid blocking UI thread
              setTimeout(() => registerForPushNotifications(true), 500);
              return;
            }
  
            // Verify token with timeout
            const verificationPromise = NotificationService.forceTokenVerification(user.id);
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Token verification timed out')), 5000);
            });
  
            // Race verification against timeout
            const verification = await Promise.race([verificationPromise, timeoutPromise])
              .catch(error => {
                debugLog('Token verification failed or timed out:', error);
                return { isValid: false };
              });
  
            if (!verification || !verification.isValid) {
              debugLog('Token verification failed on app foreground, scheduling registration');
              // Delay registration slightly to allow UI to settle
              setTimeout(() => registerForPushNotifications(true), 1000);
              return;
            }
  
            // If token is valid but not signed in, update its status
            if (verification.isValid && verification.signedIn === false && verification.token) {
              debugLog('Token is valid but marked as signed out, updating status');
              await NotificationService.markTokenAsSignedIn(user.id, verification.token);
            } else {
              debugLog('Token verified successfully on app foreground');
            }
  
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
              // Delay registration to allow UI to settle
              setTimeout(() => registerForPushNotifications(true), 1500);
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
  
    const initializeNotificationsAsync = async () => {
      if (!mounted || isGlobalSigningOut) {
        debugLog('Skipping notification initialization (unmounted or signing out)');
        return;
      }
    
      debugLog('Setting up notification system for user:', user.id);
    
      // --- Part 1: Quick Local Setup (Non-Blocking) ---
      try {
        // Set up local notification listeners early
        if (notificationListener.current) notificationListener.current.remove();
        notificationListener.current = Notifications.addNotificationReceivedListener(handleNotification);
    
        if (responseListener.current) responseListener.current.remove();
        responseListener.current = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
        
        // Check permission status asynchronously
        NotificationService.getPermissions().then(permissionStatus => {
          if (permissionStatus?.status === 'granted') {
            setIsPermissionGranted(true);
          } else {
            debugLog('Notification permissions not yet granted.');
          }
        }).catch(error => {
          debugLog('Error checking notification permissions:', error);
        });
    
        // Initial unread count retrieval
        refreshNotifications().catch(error => {
          debugLog('Error refreshing initial notifications:', error);
        });
    
      } catch (initialError) {
        debugLog('Error during initial notification setup:', initialError);
      }
    
      // --- Part 2: Deferred Token Registration ---
      // Use a longer delay to ensure UI is fully interactive first
      setTimeout(async () => {
        if (!mounted || isGlobalSigningOut || !user?.id) {
          debugLog('Skipping deferred token registration (unmounted, signing out, or no user)');
          return;
        }
    
        try {
          debugLog('Starting deferred token registration process');
          
          // Check for existing token first
          const localToken = await SecureStore.getItemAsync(STORAGE_KEYS.PUSH_TOKEN);
          
          if (localToken) {
            debugLog('Found local token, verifying validity');
            
            try {
              // Use a shorter timeout for verification to avoid hanging
              const verificationPromise = NotificationService.forceTokenVerification(user.id);
              const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Verification timed out')), 3000);
              });
              
              const verification = await Promise.race([verificationPromise, timeoutPromise])
                .catch(error => {
                  debugLog('Token verification timed out or failed:', error);
                  return { isValid: false };
                });
              
              if (verification.isValid) {
                debugLog('Local token verified successfully, setting up refresh listener');
                
                // Setup token refresh listener
                if (pushTokenListener.current) pushTokenListener.current.remove();
                pushTokenListener.current = Notifications.addPushTokenListener(handleTokenRefresh);
                
                // If token needs to be marked as signed in
                if (verification.signedIn === false && verification.token) {
                  debugLog('Token needs to be marked as signed in');
                  await NotificationService.markTokenAsSignedIn(user.id, verification.token);
                }
                
                setIsPermissionGranted(true);
                initialSetupComplete.current = true;
                
                // Update registration state
                await saveRegistrationState({
                  lastAttemptTime: Date.now(),
                  attempts: 0,
                  registered: true
                });
                
                return;
              }
              
              debugLog('Local token could not be verified, will register new token');
            } catch (verificationError) {
              debugLog('Error during token verification:', verificationError);
            }
          } else {
            debugLog('No local token found, will register new token');
          }
          
          // If we reach here, we need to register a new token
          await registerForPushNotifications(true);
          initialSetupComplete.current = true;
          
        } catch (deferredError) {
          debugLog('Error during deferred token registration:', deferredError);
          initialSetupComplete.current = true;
        }
      }, 2000); // Increased delay for better reliability
    };
  
    // Call the initialization function
    initializeNotificationsAsync();
  
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