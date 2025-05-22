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
  TOKEN_REFRESH_TIME: 'pushTokenRefreshTime',
  PRODUCTION_RETRY_STATE: 'productionRetryState'
} as const;

// Enhanced configuration for production
const CONFIG = {
  MAX_REGISTRATION_ATTEMPTS: 10, // Increased for production
  REGISTRATION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  DEBUG_MODE: true, // Always true for production debugging
  DUPLICATE_WINDOW: 5000, // 5 seconds
  NAVIGATION_RETRY_DELAY: 1000,
  REGISTRATION_RETRY_BASE_DELAY: 3000, // Reduced base delay
  MAX_RETRY_DELAY: 60 * 1000, // 1 minute max
  RECENT_REGISTRATION_THRESHOLD: 12 * 60 * 60 * 1000, // 12 hours (reduced)
  EMERGENCY_RETRY_INTERVAL: 5 * 60 * 1000, // 5 minutes
  PRODUCTION_VERIFICATION_INTERVAL: 2 * 60 * 1000, // 2 minutes
  AGGRESSIVE_RETRY_THRESHOLD: 3, // After 3 failures, get aggressive
  MAX_EMERGENCY_RETRIES: 20 // Very persistent for production
} as const;

interface RegistrationState {
  lastAttemptTime: number;
  attempts: number;
  lastError?: string;
  registered: boolean;
  consecutiveFailures: number;
  lastSuccessTime?: number;
}

interface ProductionRetryState {
  emergencyRetries: number;
  lastEmergencyAttempt: number;
  totalFailures: number;
  lastTokenVerification: number;
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
  emergencyTokenRegistration: () => Promise<void>;
  getProductionLogs: () => Promise<any[]>;
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
  const emergencyTimer = useRef<NodeJS.Timeout | null>(null);
  const verificationTimer = useRef<NodeJS.Timeout | null>(null);
  const networkStatus = useRef<boolean>(true);
  const initialSetupComplete = useRef<boolean>(false);
  const forceRegistrationOnNextForeground = useRef<boolean>(false);
  const isCurrentlyRegistering = useRef<boolean>(false);

  /**
   * Enhanced production logging
   */
  const productionLog = useCallback(async (level: 'INFO' | 'ERROR' | 'WARN', message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data: data ? JSON.stringify(data) : undefined,
      userId: user?.id,
      platform: Platform.OS
    };

    console.log(`[PROD-NOTIFICATIONS ${timestamp}] ${level}: ${message}`, data || '');

    try {
      const existingLogs = await SecureStore.getItemAsync('productionNotificationLogs') || '[]';
      const logs = JSON.parse(existingLogs);
      logs.push(logEntry);
      
      if (logs.length > 100) {
        logs.splice(0, logs.length - 100);
      }
      
      await SecureStore.setItemAsync('productionNotificationLogs', JSON.stringify(logs));
    } catch (e) {
      console.error('Failed to store production log:', e);
    }
  }, [user?.id]);

  const debugLog = useCallback((message: string, data?: any) => {
    productionLog('INFO', message, data);
  }, [productionLog]);

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
   * Get production retry state
   */
  const getProductionRetryState = useCallback(async (): Promise<ProductionRetryState> => {
    try {
      const stateJson = await SecureStore.getItemAsync(STORAGE_KEYS.PRODUCTION_RETRY_STATE) || '{}';
      const defaultState: ProductionRetryState = {
        emergencyRetries: 0,
        lastEmergencyAttempt: 0,
        totalFailures: 0,
        lastTokenVerification: 0
      };
      return { ...defaultState, ...JSON.parse(stateJson) };
    } catch (error) {
      debugLog('Error reading production retry state:', error);
      return {
        emergencyRetries: 0,
        lastEmergencyAttempt: 0,
        totalFailures: 0,
        lastTokenVerification: 0
      };
    }
  }, [debugLog]);

  /**
   * Save production retry state
   */
  const saveProductionRetryState = useCallback(async (state: ProductionRetryState): Promise<void> => {
    try {
      await SecureStore.setItemAsync(STORAGE_KEYS.PRODUCTION_RETRY_STATE, JSON.stringify(state));
    } catch (error) {
      debugLog('Error saving production retry state:', error);
    }
  }, [debugLog]);

  /**
   * PRODUCTION-ENHANCED TOKEN REGISTRATION with AGGRESSIVE RETRY
   */
  const registerForPushNotifications = useCallback(async (force = false) => {
    if (!user?.id) {
      debugLog('No user ID available, skipping notification registration');
      return;
    }
  
    if (isSigningOut || isGlobalSigningOut) {
      debugLog('User is signing out, skipping registration');
      return;
    }

    if (isCurrentlyRegistering.current && !force) {
      debugLog('Registration already in progress, skipping duplicate request');
      return;
    }

    isCurrentlyRegistering.current = true;

    try {
      // Clear any existing timers
      if (registrationTimer.current) {
        clearTimeout(registrationTimer.current);
        registrationTimer.current = null;
      }

      debugLog(`Starting PRODUCTION push notification registration. Force: ${force}`);

      // Check network status
      const netState = await NetInfo.fetch();
      networkStatus.current = !!netState.isConnected;

      if (!netState.isConnected && !force) {
        debugLog('Network unavailable, deferring registration');
        forceRegistrationOnNextForeground.current = true;
        return;
      }

      setLoading(true);

      // Get current states
      const regState = await getRegistrationState();
      const prodRetryState = await getProductionRetryState();

      // Permission handling with retries
      let permissionGranted = false;
      for (let permAttempt = 1; permAttempt <= 3; permAttempt++) {
        try {
          const permissionStatus = await NotificationService.getPermissions();
          debugLog(`Permission check attempt ${permAttempt}:`, permissionStatus?.status);

          if (permissionStatus?.status !== 'granted') {
            debugLog(`Permission not granted, requesting... (attempt ${permAttempt})`);
            const newPermissions = await NotificationService.requestPermissions();
            
            if (newPermissions?.status !== 'granted') {
              debugLog(`Permission denied on attempt ${permAttempt}`);
              if (permAttempt >= 3) {
                setIsPermissionGranted(false);
                setLoading(false);
                return;
              }
              await new Promise(resolve => setTimeout(resolve, 1000));
              continue;
            }
          }
          
          permissionGranted = true;
          setIsPermissionGranted(true);
          break;
        } catch (permError) {
          debugLog(`Permission attempt ${permAttempt} failed:`, permError);
          if (permAttempt >= 3) throw permError;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (!permissionGranted) {
        debugLog('Failed to obtain permissions after 3 attempts');
        return;
      }

      // Check if we should skip registration based on recent success (unless forced)
      if (!force && regState?.registered && regState.lastSuccessTime) {
        const timeSinceSuccess = Date.now() - regState.lastSuccessTime;
        if (timeSinceSuccess < CONFIG.RECENT_REGISTRATION_THRESHOLD) {
          debugLog(`Recent successful registration (${Math.round(timeSinceSuccess/1000/60)} minutes ago), verifying token`);
          
          try {
            const verification = await NotificationService.forceTokenVerification(user.id);
            if (verification.isValid) {
              debugLog('Token verification successful, skipping registration');
              setIsPermissionGranted(true);
              setLoading(false);
              isCurrentlyRegistering.current = false;
              return;
            } else {
              debugLog('Token verification failed despite recent success, proceeding with registration');
            }
          } catch (verifyError) {
            debugLog('Token verification error, proceeding with registration:', verifyError);
          }
        }
      }

      // PRODUCTION REGISTRATION LOGIC - Multiple strategies
      let token = null;
      let registrationSuccess = false;
      let lastError = null;
      
      const maxAttempts = Math.min(
        CONFIG.MAX_REGISTRATION_ATTEMPTS,
        regState?.consecutiveFailures > CONFIG.AGGRESSIVE_RETRY_THRESHOLD ? 15 : 5
      );

      debugLog(`Starting registration with ${maxAttempts} max attempts`);
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          debugLog(`Registration attempt ${attempt}/${maxAttempts}`);
          
          if (isSigningOut || isGlobalSigningOut) {
            debugLog('Sign out detected during registration, aborting');
            break;
          }

          // Use NotificationService for token registration
          token = await NotificationService.registerForPushNotificationsAsync(user.id, true);
          
          if (token) {
            debugLog(`Token acquired on attempt ${attempt}`);
            
            // Immediate verification
            try {
              const verification = await NotificationService.forceTokenVerification(user.id);
              if (verification.isValid) {
                debugLog(`Token verification successful on attempt ${attempt}`);
                registrationSuccess = true;
                break;
              } else {
                debugLog(`Token verification failed on attempt ${attempt}, retrying`);
              }
            } catch (verifyError) {
              debugLog(`Token verification error on attempt ${attempt}:`, verifyError);
            }
          } else {
            debugLog(`No token received on attempt ${attempt}`);
          }
          
          // Progressive delay
          if (attempt < maxAttempts) {
            const delay = Math.min(
              CONFIG.REGISTRATION_RETRY_BASE_DELAY * Math.pow(1.5, attempt - 1),
              CONFIG.MAX_RETRY_DELAY
            );
            debugLog(`Waiting ${delay}ms before next attempt`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          
        } catch (error) {
          lastError = error;
          debugLog(`Registration attempt ${attempt} exception:`, error);
          
          if (attempt < maxAttempts) {
            const delay = Math.min(
              CONFIG.REGISTRATION_RETRY_BASE_DELAY * Math.pow(1.5, attempt - 1),
              CONFIG.MAX_RETRY_DELAY
            );
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      // Update registration state
      const newRegState: RegistrationState = {
        lastAttemptTime: Date.now(),
        attempts: (regState?.attempts || 0) + maxAttempts,
        lastError: lastError ? (lastError.message || String(lastError)) : undefined,
        registered: registrationSuccess,
        consecutiveFailures: registrationSuccess ? 0 : (regState?.consecutiveFailures || 0) + 1,
        lastSuccessTime: registrationSuccess ? Date.now() : regState?.lastSuccessTime
      };

      await saveRegistrationState(newRegState);

      // Update production retry state
      const newProdRetryState: ProductionRetryState = {
        ...prodRetryState,
        totalFailures: registrationSuccess ? prodRetryState.totalFailures : prodRetryState.totalFailures + 1,
        lastTokenVerification: Date.now()
      };

      await saveProductionRetryState(newProdRetryState);

      if (registrationSuccess) {
        debugLog('PRODUCTION registration successful!');
        setIsPermissionGranted(true);
        
        // Set up token refresh listener
        if (pushTokenListener.current) {
          pushTokenListener.current.remove();
        }
        pushTokenListener.current = Notifications.addPushTokenListener(handleTokenRefresh);
        
        // Get updated diagnostic info
        try {
          const diagInfo = await NotificationService.getDiagnostics();
          setDiagnosticInfo(diagInfo);
        } catch (e) {
          debugLog('Non-critical: Failed to get diagnostics:', e);
        }

        // Clear any emergency retry timers
        if (emergencyTimer.current) {
          clearTimeout(emergencyTimer.current);
          emergencyTimer.current = null;
        }
      } else {
        debugLog(`PRODUCTION registration failed after ${maxAttempts} attempts`);
        
        // Schedule emergency retry if we haven't exceeded limits
        if (newProdRetryState.emergencyRetries < CONFIG.MAX_EMERGENCY_RETRIES) {
          const emergencyDelay = Math.min(
            CONFIG.EMERGENCY_RETRY_INTERVAL * Math.pow(1.2, newProdRetryState.emergencyRetries),
            10 * 60 * 1000 // Max 10 minutes
          );
          
          debugLog(`Scheduling emergency retry in ${Math.round(emergencyDelay/1000)}s`);
          
          emergencyTimer.current = setTimeout(async () => {
            if (!isSigningOut && !isGlobalSigningOut && user?.id) {
              const updatedProdState = await getProductionRetryState();
              await saveProductionRetryState({
                ...updatedProdState,
                emergencyRetries: updatedProdState.emergencyRetries + 1,
                lastEmergencyAttempt: Date.now()
              });
              
              debugLog('Executing emergency retry');
              registerForPushNotifications(true);
            }
          }, emergencyDelay);
        } else {
          debugLog('Maximum emergency retries exceeded, switching to manual mode');
        }
      }
    } catch (error) {
      debugLog('Critical error in PRODUCTION registration:', error);
      
      // Update failure counts
      const prodRetryState = await getProductionRetryState();
      await saveProductionRetryState({
        ...prodRetryState,
        totalFailures: prodRetryState.totalFailures + 1
      });
    } finally {
      setLoading(false);
      isCurrentlyRegistering.current = false;
    }
  }, [user?.id, debugLog, getRegistrationState, saveRegistrationState, getProductionRetryState, saveProductionRetryState]);

  /**
   * Emergency token registration - NUCLEAR OPTION
   */
  const emergencyTokenRegistration = useCallback(async () => {
    if (!user?.id) {
      debugLog('No user for emergency registration');
      return;
    }

    debugLog('EMERGENCY TOKEN REGISTRATION INITIATED');
    
    try {
      // Clear all stored state
      await Promise.all([
        SecureStore.deleteItemAsync(STORAGE_KEYS.PUSH_TOKEN),
        SecureStore.deleteItemAsync(STORAGE_KEYS.PUSH_TOKEN_TIMESTAMP),
        SecureStore.deleteItemAsync(STORAGE_KEYS.PUSH_TOKEN_ID),
        SecureStore.deleteItemAsync(STORAGE_KEYS.REGISTRATION_STATE),
        SecureStore.deleteItemAsync(STORAGE_KEYS.PRODUCTION_RETRY_STATE)
      ]);

      debugLog('Cleared all notification state, forcing fresh registration');

      // Reset refs
      isCurrentlyRegistering.current = false;
      registrationAttempts.current = 0;

      // Force fresh registration
      await registerForPushNotifications(true);
      
      debugLog('Emergency registration completed');
    } catch (error) {
      debugLog('Emergency registration failed:', error);
    }
  }, [user?.id, debugLog, registerForPushNotifications]);

  /**
   * Get production logs for debugging
   */
  const getProductionLogs = useCallback(async (): Promise<any[]> => {
    try {
      const logs = await SecureStore.getItemAsync('productionNotificationLogs');
      return logs ? JSON.parse(logs) : [];
    } catch (error) {
      debugLog('Error getting production logs:', error);
      return [];
    }
  }, [debugLog]);

  /**
   * Token refresh handler
   */
  const handleTokenRefresh = useCallback(async (pushToken: Notifications.ExpoPushToken) => {
    if (!user?.id || isSigningOut) return;

    debugLog('Expo push token refreshed:', pushToken.data);

    try {
      const validExpoTokenFormat = /^ExponentPushToken\[.+\]$/;
      if (!validExpoTokenFormat.test(pushToken.data)) {
        debugLog('Received non-Expo format token during refresh, ignoring');
        return;
      }

      await SecureStore.setItemAsync(STORAGE_KEYS.PUSH_TOKEN, pushToken.data);
      await SecureStore.setItemAsync(STORAGE_KEYS.TOKEN_REFRESH_TIME, Date.now().toString());

      if (!networkStatus.current) {
        debugLog('Network unavailable, database update queued for when online');
        forceRegistrationOnNextForeground.current = true;
        return;
      }

      const verification = await NotificationService.forceTokenVerification(user.id);

      if (verification.isValid && verification.token === pushToken.data) {
        debugLog('Token verified successfully, no action needed');
      } else {
        await registerForPushNotifications(true);
      }
    } catch (error) {
      debugLog('Error handling token refresh:', error);
      forceRegistrationOnNextForeground.current = true;
    }
  }, [user?.id, debugLog, registerForPushNotifications]);

  /**
   * Notification handler
   */
  const handleNotification = useCallback(async (notification: Notifications.Notification) => {
    if (!user) return;

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

      const newUnreadCount = await NotificationService.getUnreadCount(user.id);
      setUnreadCount(newUnreadCount);
    } catch (error) {
      debugLog('Error handling notification:', error);
    }
  }, [user, debugLog]);

  /**
   * Notification response handler
   */
  const handleNotificationResponse = useCallback(async (response: Notifications.NotificationResponse) => {
    if (!user) return;

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
        const notificationId = response.notification.request.content.data?.notificationId;
        if (notificationId) {
          await NotificationService.markAsRead(notificationId);
          const newUnreadCount = await NotificationService.getUnreadCount(user.id);
          setUnreadCount(newUnreadCount);
        }

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
   * Standard notification handling functions
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

  const cleanupPushToken = useCallback(async () => {
    debugLog('Starting push token cleanup process');

    try {
      // Clear all timers
      if (registrationTimer.current) {
        clearTimeout(registrationTimer.current);
        registrationTimer.current = null;
      }
      if (emergencyTimer.current) {
        clearTimeout(emergencyTimer.current);
        emergencyTimer.current = null;
      }
      if (verificationTimer.current) {
        clearTimeout(verificationTimer.current);
        verificationTimer.current = null;
      }

      if (!user?.id) {
        debugLog('No user ID available, skipping token cleanup');
        return true;
      }

      const success = await NotificationService.cleanupPushToken(user.id);

      if (success) {
        debugLog('Push token marked as signed out successfully');
      } else {
        debugLog('Failed to mark push token as signed out');
      }

      // Reset all state
      registrationAttempts.current = 0;
      forceRegistrationOnNextForeground.current = false;
      isCurrentlyRegistering.current = false;

      // Clear all stored state
      try {
        await Promise.all([
          SecureStore.deleteItemAsync(STORAGE_KEYS.REGISTRATION_STATE),
          SecureStore.deleteItemAsync(STORAGE_KEYS.PRODUCTION_RETRY_STATE)
        ]);
      } catch (e) {
        debugLog('Failed to clear stored state:', e);
      }

      return true;
    } catch (error) {
      debugLog('Error cleaning up push token:', error);
      return false;
    }
  }, [user?.id, debugLog]);

  /**
   * Network status monitoring
   */
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const wasConnected = networkStatus.current;
      const isConnected = !!state.isConnected;
      networkStatus.current = isConnected;

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
   * App state change handling
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      const previousState = appState.current;
      appState.current = nextAppState;
  
      if (isGlobalSigningOut) {
        debugLog('Skipping notification handling during sign-out');
        return;
      }
  
      if (
        (previousState.match(/inactive|background/) || previousState === 'unknown') &&
        nextAppState === 'active' &&
        user?.id
      ) {
        debugLog('App has come to foreground - PRODUCTION MODE');
  
        // Badge reset and notification refresh
        (async () => {
          try {
            await refreshNotifications();
            await NotificationService.setBadgeCount(0);
          } catch (error) {
            debugLog('Error handling foreground badge reset:', error);
          }
        })();
  
        // Handle forced registration
        if (forceRegistrationOnNextForeground.current) {
          debugLog('Forced registration pending, executing now');
          registerForPushNotifications(true);
          forceRegistrationOnNextForeground.current = false;
          return;
        }
  
        // PRODUCTION: More aggressive token verification on foreground
        (async () => {
          try {
            debugLog('Performing PRODUCTION token verification on foreground');
  
            const storedToken = await SecureStore.getItemAsync(STORAGE_KEYS.PUSH_TOKEN);
            
            if (!storedToken) {
              debugLog('No token in storage, initiating immediate registration');
              setTimeout(() => registerForPushNotifications(true), 500);
              return;
            }
  
            // Quick verification with shorter timeout
            const verificationPromise = NotificationService.forceTokenVerification(user.id);
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Token verification timed out')), 5000);
            });
  
            const verification = await Promise.race([verificationPromise, timeoutPromise])
              .catch(error => {
                debugLog('Token verification failed/timed out:', error);
                return { isValid: false };
              });
  
            if (!verification || !verification.isValid) {
              debugLog('Token verification failed on foreground, forcing registration');
              setTimeout(() => registerForPushNotifications(true), 500);
              return;
            }
  
            if (verification.isValid && verification.signedIn === false && verification.token) {
              debugLog('Token valid but signed out, updating status');
              await NotificationService.markTokenAsSignedIn(user.id, verification.token);
            } else {
              debugLog('Token verified successfully on foreground');
            }
  
            // Update success state
            const regState = await getRegistrationState();
            await saveRegistrationState({
              lastAttemptTime: Date.now(),
              attempts: regState?.attempts || 0,
              registered: true,
              consecutiveFailures: 0,
              lastSuccessTime: Date.now()
            });
          } catch (error) {
            debugLog('Error during foreground token verification:', error);
            setTimeout(() => registerForPushNotifications(true), 1000);
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
   * Main notification system setup
   */
  useEffect(() => {
    if (!user?.id) return;
  
    let mounted = true;
  
    const initializeProductionNotifications = async () => {
      if (!mounted || isGlobalSigningOut) {
        debugLog('Skipping initialization (unmounted or signing out)');
        return;
      }
    
      debugLog('Setting up PRODUCTION notification system for user:', user.id);
    
      try {
        // Set up listeners immediately
        if (notificationListener.current) notificationListener.current.remove();
        notificationListener.current = Notifications.addNotificationReceivedListener(handleNotification);
    
        if (responseListener.current) responseListener.current.remove();
        responseListener.current = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
        
        // Check permissions
        NotificationService.getPermissions().then(permissionStatus => {
          if (permissionStatus?.status === 'granted') {
            setIsPermissionGranted(true);
          }
        }).catch(error => {
          debugLog('Error checking permissions:', error);
        });
    
        // Initial notification refresh
        refreshNotifications().catch(error => {
          debugLog('Error refreshing notifications:', error);
        });
      } catch (error) {
        debugLog('Error during listener setup:', error);
      }
    
      // PRODUCTION TOKEN REGISTRATION - Immediate attempt
      setTimeout(async () => {
        if (!mounted || isGlobalSigningOut || !user?.id) {
          debugLog('Skipping token registration (unmounted/signing out/no user)');
          return;
        }
    
        try {
          debugLog('Starting PRODUCTION token registration process');
          
          // Check existing token first
          const localToken = await SecureStore.getItemAsync(STORAGE_KEYS.PUSH_TOKEN);
          
          if (localToken) {
            debugLog('Found local token, performing quick verification');
            
            try {
              const verificationPromise = NotificationService.forceTokenVerification(user.id);
              const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Verification timeout')), 3000);
              });
              
              const verification = await Promise.race([verificationPromise, timeoutPromise])
                .catch(error => {
                  debugLog('Token verification failed:', error);
                  return { isValid: false };
                });
              
              if (verification.isValid) {
                debugLog('Local token verified, setting up refresh listener');
                
                if (pushTokenListener.current) pushTokenListener.current.remove();
                pushTokenListener.current = Notifications.addPushTokenListener(handleTokenRefresh);
                
                if (verification.signedIn === false && verification.token) {
                  debugLog('Updating token to signed in');
                  await NotificationService.markTokenAsSignedIn(user.id, verification.token);
                }
                
                setIsPermissionGranted(true);
                initialSetupComplete.current = true;
                
                await saveRegistrationState({
                  lastAttemptTime: Date.now(),
                  attempts: 0,
                  registered: true,
                  consecutiveFailures: 0,
                  lastSuccessTime: Date.now()
                });
                
                // Set up periodic verification
                verificationTimer.current = setInterval(async () => {
                  if (!isGlobalSigningOut && user?.id) {
                    try {
                      const quickVerification = await NotificationService.forceTokenVerification(user.id);
                      if (!quickVerification.isValid) {
                        debugLog('Periodic verification failed, triggering registration');
                        registerForPushNotifications(true);
                      }
                    } catch (e) {
                      debugLog('Periodic verification error:', e);
                    }
                  }
                }, CONFIG.PRODUCTION_VERIFICATION_INTERVAL);
                
                return;
              }
              
              debugLog('Local token verification failed, registering new token');
            } catch (error) {
              debugLog('Error during token verification:', error);
            }
          } else {
            debugLog('No local token found, registering new token');
          }
          
          // Register new token
          await registerForPushNotifications(true);
          initialSetupComplete.current = true;
          
        } catch (error) {
          debugLog('Error during PRODUCTION token registration:', error);
          initialSetupComplete.current = true;
        }
      }, 500); // Reduced delay for production
    };
  
    initializeProductionNotifications();
  
    return () => {
      mounted = false;
      debugLog('Cleaning up PRODUCTION notification system');
  
      // Clear all timers
      if (registrationTimer.current) {
        clearTimeout(registrationTimer.current);
        registrationTimer.current = null;
      }
      if (emergencyTimer.current) {
        clearTimeout(emergencyTimer.current);
        emergencyTimer.current = null;
      }
      if (verificationTimer.current) {
        clearInterval(verificationTimer.current);
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
    diagnosticInfo,
    emergencyTokenRegistration,
    getProductionLogs
  };
}