import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, AppState } from 'react-native';
import { supabase } from '@/utils/supabase';
import { isSigningOut } from '../app/(home)/_layout';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { isGlobalSigningOut } from '@/utils/AuthContext';
import { notificationCache, NotificationCacheManager } from '@/utils/NotificationCacheManager';

// Type definitions for better type safety
type ExpoToken = `ExponentPushToken[${string}]`;

interface TokenStatus {
  signed_in?: boolean;
  active?: boolean;
}

interface SupabaseError {
  code?: string;
  message: string;
  details?: string;
}

// Notification handler configuration
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Notification types enum for better type safety
export enum NotificationType {
  CAR_LIKE = 'car_like',
  PRICE_DROP = 'price_drop',
  NEW_MESSAGE = 'new_message',
  SUBSCRIPTION = 'subscription',
  CAR_SOLD = 'car_sold',
  VIEW_MILESTONE = 'view_milestone',
  AUTOCLIP_LIKE = 'autoclip_like',
  DAILY_REMINDER = 'daily_reminder'
}

interface NotificationData {
  screen?: string;
  params?: Record<string, any>;
  type?: NotificationType;
  metadata?: Record<string, any>;
  notificationId?: string;
}

// Storage keys
const STORAGE_KEYS = {
  PUSH_TOKEN: 'expoPushToken',
  PUSH_TOKEN_TIMESTAMP: 'expoPushTokenTimestamp',
  PUSH_TOKEN_ID: 'expoPushTokenId',
  NOTIFICATION_ERRORS: 'notificationErrors'
} as const;

// Constants
const CONFIG = {
  TOKEN_REFRESH_INTERVAL: 30 * 24 * 60 * 60 * 1000, // 30 days
  FORCE_REGISTER_DEV: __DEV__, // Only force in development
  DEBUG_MODE: __DEV__, // Production-ready debug mode
  DB_TIMEOUT: 10000, // 10 seconds 
  MAX_ERROR_LOGS: 10,
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000 // 1 second
} as const;

export class NotificationService {
  // Singleton pattern for better resource management
  private static instance: NotificationService;
  
  private constructor() {}
  
  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  static async getAllUserDeviceTokens(userId: string): Promise<Array<{
    id: string;
    token: string;
    device_type: string;
    last_updated: string;
    signed_in: boolean;
    active: boolean;
  }>> {
    try {
      const { data, error } = await this.timeoutPromiseWithRetry(
        () => supabase
          .from('user_push_tokens')
          .select('id, token, device_type, last_updated, signed_in, active')
          .eq('user_id', userId)
          .eq('active', true)
          .order('last_updated', { ascending: false }),
        CONFIG.DB_TIMEOUT,
        'getAllUserDeviceTokens'
      );
      
      if (error) {
        return [];
      }
      
      return data || [];
    } catch (error) {
      this.recordError('getAllUserDeviceTokens', error);
      return [];
    }
  }
  
  static async signOutFromAllDevices(userId: string): Promise<boolean> {
    try {
      const { error } = await this.timeoutPromiseWithRetry(
        () => supabase
          .from('user_push_tokens')
          .update({ 
            signed_in: false,
            last_updated: new Date().toISOString()
          })
          .eq('user_id', userId),
        CONFIG.DB_TIMEOUT,
        'signOutFromAllDevices'
      );
      
      if (error) {
        return false;
      }
      
      return true;
    } catch (error) {
      this.recordError('signOutFromAllDevices', error);
      return false;
    }
  }

  static async hasMultipleActiveDevices(
    userId: string
  ): Promise<{ hasMultiple: boolean; count: number }> {
    try {
      const { count, error } = await this.timeoutPromiseWithRetry(
        () => supabase
          .from('user_push_tokens')
          .select('*', { count: 'exact' })
          .eq('user_id', userId)
          .eq('active', true)
          .eq('signed_in', true),
        CONFIG.DB_TIMEOUT,
        'hasMultipleActiveDevices'
      );
      
      if (error) {
        return { hasMultiple: false, count: 0 };
      }
      
      return { 
        hasMultiple: (count || 0) > 1,
        count: count || 0
      };
    } catch (error) {
      this.recordError('hasMultipleActiveDevices', error);
      return { hasMultiple: false, count: 0 };
    }
  }

  private static async recordError(context: string, error: any): Promise<void> {
    try {
      // Type-safe error logging
      const errorLog = await SecureStore.getItemAsync(STORAGE_KEYS.NOTIFICATION_ERRORS) || '[]';
      const errors: Array<{
        timestamp: string;
        context: string;
        error: string;
        stack?: string;
      }> = JSON.parse(errorLog);

      errors.push({
        timestamp: new Date().toISOString(),
        context,
        error: error?.message || String(error),
        stack: error?.stack
      });

      // Keep last MAX_ERROR_LOGS errors only
      if (errors.length > CONFIG.MAX_ERROR_LOGS) {
        errors.shift();
      }

      await SecureStore.setItemAsync(STORAGE_KEYS.NOTIFICATION_ERRORS, JSON.stringify(errors));
    } catch (e) {
      console.error('Failed to record error:', e);
    }
  }

  // FIXED: Enhanced project ID resolution using AuthContext logic
  private static getProjectId(): string {
    try {
      // First priority: Environment variable (most reliable in production)
      const envProjectId = process.env.EXPO_PUBLIC_PROJECT_ID;
      if (envProjectId) {
        return envProjectId;
      }

      // Second priority: EAS configuration
      const easProjectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (easProjectId) {
        return easProjectId;
      }

      // Third priority: Direct extra configuration
      const extraProjectId = Constants.expoConfig?.extra?.projectId;
      if (extraProjectId) {
        return extraProjectId;
      }

      // Fourth priority: App config values
      // @ts-ignore - Accessing manifest properties that might exist in certain builds
      const manifestProjectId = Constants.manifest?.extra?.eas?.projectId ||
                                // @ts-ignore
                                Constants.manifest?.extra?.projectId;
      if (manifestProjectId) {
        return manifestProjectId;
      }

      // Extract from updates URL as last resort
      try {
        // @ts-ignore
        const updatesUrl = Constants.expoConfig?.updates?.url || Constants.manifest?.updates?.url;
        if (updatesUrl && typeof updatesUrl === 'string') {
          const projectIdMatch = updatesUrl.match(/([a-f0-9-]{36})/i);
          if (projectIdMatch && projectIdMatch[1]) {
            return projectIdMatch[1];
          }
        }
      } catch (urlError) {
        // Continue to fallback
      }

      // Fallback to hardcoded value
      const fallbackId = 'aaf80aae-b9fd-4c39-a48a-79f2eac06e68';
      return fallbackId;
    } catch (error) {
      // Absolute last resort fallback
      return 'aaf80aae-b9fd-4c39-a48a-79f2eac06e68';
    }
  }

  // FIXED: Enhanced experience ID resolution
  private static getExperienceId(): string {
    try {
      // Method 1: From owner and slug
      const owner = Constants.expoConfig?.owner || Constants.manifest?.owner;
      const slug = Constants.expoConfig?.slug || Constants.manifest?.slug;
      
      if (owner && slug) {
        const experienceId = `@${owner}/${slug}`;
        return experienceId;
      }

      // Method 2: From app config
      // @ts-ignore
      const directExperienceId = Constants.expoConfig?.experienceId || Constants.manifest?.experienceId;
      if (directExperienceId) {
        return directExperienceId;
      }

      // Method 3: Extract from updates URL
      try {
        // @ts-ignore
        const updatesUrl = Constants.expoConfig?.updates?.url || Constants.manifest?.updates?.url;
        if (updatesUrl) {
          // URL format: https://u.expo.dev/projectId or similar
          const match = updatesUrl.match(/@([^/]+)\/([^/]+)/);
          if (match) {
            const experienceId = `@${match[1]}/${match[2]}`;
            return experienceId;
          }
        }
      } catch (urlError) {
        // Continue to fallback
      }

      // Fallback: construct from known values
      const fallbackExperienceId = '@qwerty-app/clerk-expo-quickstart';
      return fallbackExperienceId;
    } catch (error) {
      return '@qwerty-app/clerk-expo-quickstart';
    }
  }

  // Improved timeout promise with retry logic
  private static async timeoutPromiseWithRetry<T>(
    promiseFactory: () => Promise<T>,
    timeoutMs: number,
    operationName: string,
    maxRetries: number = CONFIG.MAX_RETRIES
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.timeoutPromise(promiseFactory(), timeoutMs, operationName);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * attempt));
        }
      }
    }
    
    throw lastError || new Error(`${operationName} failed after ${maxRetries} attempts`);
  }

  private static timeoutPromise<T>(promise: Promise<T>, timeoutMs: number, operationName: string): Promise<T> {
    let timeoutHandle: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`Operation '${operationName}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return Promise.race([
      promise,
      timeoutPromise
    ]).finally(() => clearTimeout(timeoutHandle));
  }

  // Type-safe token validation
  private static isValidExpoToken(token: string): token is ExpoToken {
    if (!token) return false;
    const validExpoTokenFormat = /^ExponentPushToken\[.+\]$/;
    return validExpoTokenFormat.test(token);
  }

  private static async clearLocalTokenStorage(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(STORAGE_KEYS.PUSH_TOKEN),
      SecureStore.deleteItemAsync(STORAGE_KEYS.PUSH_TOKEN_TIMESTAMP),
      SecureStore.deleteItemAsync(STORAGE_KEYS.PUSH_TOKEN_ID)
    ]);
  }

  private static async saveTokenToStorage(token: string, tokenId?: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(STORAGE_KEYS.PUSH_TOKEN, token);
      await SecureStore.setItemAsync(STORAGE_KEYS.PUSH_TOKEN_TIMESTAMP, Date.now().toString());

      if (tokenId) {
        await SecureStore.setItemAsync(STORAGE_KEYS.PUSH_TOKEN_ID, tokenId);
      }
    } catch (error) {
      this.recordError('saveTokenToStorage', error);
      throw error; // Re-throw as this is critical
    }
  }

  static async forceTokenVerification(userId: string): Promise<{
    isValid: boolean;
    tokenId?: string;
    token?: string;
    signedIn?: boolean;
  }> {
    try {
      // RULE 1: Check cache first
      const cachedVerification = notificationCache.getCachedTokenVerification(userId);
      if (cachedVerification) {
        return cachedVerification;
      }

      // RULE 2: Check local storage
      const storedToken = await SecureStore.getItemAsync(STORAGE_KEYS.PUSH_TOKEN);
      const storedTokenId = await SecureStore.getItemAsync(STORAGE_KEYS.PUSH_TOKEN_ID);
      const tokenTimestamp = await SecureStore.getItemAsync(STORAGE_KEYS.PUSH_TOKEN_TIMESTAMP);

      if (!storedToken) {
        return { isValid: false };
      }

      if (!this.isValidExpoToken(storedToken)) {
        await this.clearLocalTokenStorage();
        return { isValid: false };
      }

      // RULE 3: Skip database verification for very recent tokens
      if (tokenTimestamp) {
        const age = Date.now() - parseInt(tokenTimestamp, 10);
        if (age < 5000) { // 5 seconds
          const result = { 
            isValid: true, 
            token: storedToken,
            tokenId: storedTokenId,
            signedIn: true
          };
          
          // Cache the result
          notificationCache.cacheTokenVerification(userId, result);
          return result;
        }
      }

      // RULE 4: Perform database verification with shorter timeout
      const VERIFICATION_TIMEOUT = 3000; // 3 seconds

      try {
        const { data: tokenByValue, error: valueError } = await this.timeoutPromise(
          supabase
            .from('user_push_tokens')
            .select('id, token, active, signed_in')
            .eq('user_id', userId)
            .eq('token', storedToken)
            .single(),
          VERIFICATION_TIMEOUT,
          'verifyTokenByValue'
        );

        if (!valueError && tokenByValue) {
          // Update local storage with token ID if needed
          if (!storedTokenId || storedTokenId !== tokenByValue.id) {
            await SecureStore.setItemAsync(STORAGE_KEYS.PUSH_TOKEN_ID, tokenByValue.id);
          }
          
          const result = {
            isValid: true,
            tokenId: tokenByValue.id,
            token: tokenByValue.token,
            signedIn: tokenByValue.signed_in
          };

          // RULE 5: Cache successful verification
          notificationCache.cacheTokenVerification(userId, result);
          
          return result;
        }
      } catch (verifyError: any) {
        if (verifyError.message?.includes('timed out')) {
          // For timeout scenarios, cache with shorter TTL
          const result = { 
            isValid: true, 
            token: storedToken,
            tokenId: storedTokenId,
            signedIn: undefined
          };
          
          // Cache with reduced TTL (1 minute instead of 5)
          notificationCache.set(
            NotificationCacheManager.keys.tokenVerification(userId),
            result,
            60 * 1000
          );
          
          return result;
        }
      }
      
      return { 
        isValid: false,
        token: storedToken
      };
      
    } catch (error) {
      this.recordError('forceTokenVerification', error);
      return { isValid: false };
    }
  }

  static async ensureValidTokenRegistration(userId: string, token: string): Promise<boolean> {
    try {
      if (!this.isValidExpoToken(token)) {
        return false;
      }
      
      // RULE 1: Save to local storage immediately
      await this.saveTokenToStorage(token);
      
      // RULE 2: Invalidate cache before database operations
      notificationCache.invalidate(NotificationCacheManager.keys.tokenVerification(userId));
      
      // RULE 3: Use upsert for atomic insert/update
      try {
        const tokenData = {
          user_id: userId,
          token: token,
          device_type: Platform.OS,
          last_updated: new Date().toISOString(),
          signed_in: true,
          active: true
        };

        // First, deactivate other tokens for this device in one operation
        const { error: deactivateError } = await this.timeoutPromiseWithRetry(
          () => supabase
            .from('user_push_tokens')
            .update({ 
              active: false,
              signed_in: false 
            })
            .eq('user_id', userId)
            .eq('device_type', Platform.OS)
            .neq('token', token), // Don't deactivate the current token
          CONFIG.DB_TIMEOUT,
          'deactivateOldTokens',
          2
        );

        if (deactivateError) {
          this.recordError('deactivateOldTokens', deactivateError);
        }

        // Now upsert the current token
        const { data: upsertData, error: upsertError } = await this.timeoutPromiseWithRetry(
          () => supabase
            .from('user_push_tokens')
            .upsert(tokenData, {
              onConflict: 'user_id,token',
              ignoreDuplicates: false
            })
            .select('id')
            .single(),
          CONFIG.DB_TIMEOUT,
          'upsertToken'
        );

        if (upsertError) {
          return false;
        }

        if (upsertData?.id) {
          await SecureStore.setItemAsync(STORAGE_KEYS.PUSH_TOKEN_ID, upsertData.id);
          
          // RULE 4: Cache the successful registration
          notificationCache.cacheTokenVerification(userId, {
            isValid: true,
            tokenId: upsertData.id,
            token: token,
            signedIn: true
          });
          
          return true;
        }

        return false;
      } catch (error) {
        this.recordError('ensureValidTokenRegistration', error);
        return false;
      }
    } catch (outerError) {
      this.recordError('ensureValidTokenRegistration_outer', outerError);
      return false;
    }
  }

  // Enhanced updateTokenStatus with better error handling and retry logic
  static async updateTokenStatus(userId: string, token: string, status: TokenStatus): Promise<boolean> {
    try {
      if (!token || !userId) {
        return false;
      }

      // Verify token exists before updating
      const { data: existingTokens, error: checkError } = await this.timeoutPromiseWithRetry(
        () => supabase
          .from('user_push_tokens')
          .select('*')
          .eq('user_id', userId)
          .eq('token', token),
        CONFIG.DB_TIMEOUT,
        'checkExistingTokens'
      );

      if (checkError) {
        this.recordError('updateTokenStatus.checkExisting', checkError);
        return false;
      }

      if (!existingTokens || existingTokens.length === 0) {
        return false;
      }

      const updates = {
        last_updated: new Date().toISOString(),
        ...status
      };

      const { data: updateData, error } = await this.timeoutPromiseWithRetry(
        () => supabase
          .from('user_push_tokens')
          .update(updates)
          .eq('user_id', userId)
          .eq('token', token)
          .select(),
        CONFIG.DB_TIMEOUT,
        'updateTokenStatus'
      );

      if (error) {
        this.recordError('updateTokenStatus', error);
        return false;
      }

      return true;
    } catch (error) {
      this.recordError('updateTokenStatus', error);
      return false;
    }
  }

  // Improved markTokenAsSignedOut with atomic operations
  static async markTokenAsSignedOut(userId: string): Promise<boolean> {
    try {
      const token = await SecureStore.getItemAsync(STORAGE_KEYS.PUSH_TOKEN);

      // Update database first before clearing local storage
      if (token && this.isValidExpoToken(token)) {
        await this.updateTokenStatus(userId, token, {
          signed_in: false,
        });
      }

      // Clear local storage atomically
      await Promise.all([
        SecureStore.deleteItemAsync(STORAGE_KEYS.PUSH_TOKEN),
        SecureStore.deleteItemAsync(STORAGE_KEYS.PUSH_TOKEN_TIMESTAMP),
        SecureStore.deleteItemAsync(STORAGE_KEYS.PUSH_TOKEN_ID)
      ]);

      return true;
    } catch (error) {
      this.recordError('markTokenAsSignedOut', error);
      return false;
    }
  }

  // Enhanced syncTokenFromDatabase with better error handling
  static async syncTokenFromDatabase(userId: string): Promise<string | null> {
    try {
      const { data: tokens, error } = await this.timeoutPromiseWithRetry(
        () => supabase
          .from('user_push_tokens')
          .select('*')
          .eq('user_id', userId)
          .order('last_updated', { ascending: false })
          .limit(1),
        CONFIG.DB_TIMEOUT,
        'syncTokenFromDatabase'
      );

      if (error) {
        return null;
      }

      if (!tokens || tokens.length === 0) {
        return null;
      }

      const latestToken = tokens[0];

      // Only sync if token is valid
      if (this.isValidExpoToken(latestToken.token)) {
        await this.saveTokenToStorage(latestToken.token, latestToken.id);
        return latestToken.token;
      } else {
        return null;
      }
    } catch (error) {
      return null;
    }
  }

  // FIXED: Enhanced token registration with both projectId and experienceId
  static async registerForPushNotificationsAsync(userId: string, forceRefresh = false): Promise<string | null> {
    if (!Device.isDevice && !CONFIG.FORCE_REGISTER_DEV) {
      return null;
    }

    if (isSigningOut) {
      return null;
    }


    try {
      // IMPROVEMENT 1: Always get fresh permissions status
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let permissionStatus = existingStatus;


      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        permissionStatus = status;
      }

      if (permissionStatus !== 'granted') {
        return null;
      }

      // IMPROVEMENT 2: Set up Android notification channel early
      if (Platform.OS === 'android') {
        try {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#D55004',
            sound: 'notification.wav',
            enableVibrate: true,
            enableLights: true
          });
        } catch (channelError) {
          this.recordError('setupAndroidChannel', channelError);;
          // Continue even if channel setup fails
        }
      }

      // IMPROVEMENT 3: Only check existing token if not forcing refresh
      let verification = { isValid: false, token: null as string | null };
      
      if (!forceRefresh) {
        try {
          verification = await this.forceTokenVerification(userId);
        } catch (error) {
          // Continue to attempt fresh registration
        }

        // Use existing token if valid and not forcing refresh
        if (verification.isValid && verification.token) {
          await this.saveTokenToStorage(verification.token, verification.tokenId);
          
          // Ensure token is marked as signed in
          if (verification.signedIn === false) {
            await this.updateTokenStatus(userId, verification.token, { signed_in: true });
          }
          
          return verification.token;
        }
      }

      // IMPROVEMENT 4: Get both project ID and experience ID
      const projectId = this.getProjectId();
      const experienceId = this.getExperienceId();
      
      // IMPROVEMENT 5: Enhanced token acquisition with multiple approaches
      let tokenResponse;
      let tokenError = null;
      
      // Try with both projectId and experienceId first (recommended for production)
      try {
        tokenResponse = await this.timeoutPromiseWithRetry(
          () => Notifications.getExpoPushTokenAsync({
            projectId: projectId,
          
          }),
          15000,
          'getExpoPushTokenAsync_full',
          2
        );
      } catch (fullError) {
        tokenError = fullError;
        
        // Fallback: Try with just projectId
        try {
          tokenResponse = await this.timeoutPromiseWithRetry(
            () => Notifications.getExpoPushTokenAsync({
              projectId: projectId,
            }),
            15000,
            'getExpoPushTokenAsync_projectOnly',
            2
          );
        } catch (projectOnlyError) {
          // Final fallback: Try with just experienceId
          try {
            tokenResponse = await this.timeoutPromiseWithRetry(
              () => Notifications.getExpoPushTokenAsync({
                projectId: projectId,

              }),
              15000,
              'getExpoPushTokenAsync_experienceOnly',
              2
            );
          } catch (experienceOnlyError) {
            throw new Error(`Token acquisition failed: ${fullError?.message || projectOnlyError?.message || experienceOnlyError?.message}`);
          }
        }
      }

      const token = tokenResponse.data;

      if (!this.isValidExpoToken(token)) {
        throw new Error(`Received invalid token format: ${token}`);
      }

      // IMPROVEMENT 6: Always save to storage immediately before DB operations can fail
      await this.saveTokenToStorage(token);
      
      // IMPROVEMENT 7: More robust registration with clearer error handling
      let registrationSuccess = false;
      let registrationError = null;
      
      try {
        registrationSuccess = await this.ensureValidTokenRegistration(userId, token);
      } catch (regError) {
        registrationError:any = regError;
        this.recordError('tokenRegistration', regError);
      }
      
      if (registrationSuccess) {
        return token;
      } else {
        return token; // Still return token since we have it in storage
      }
    } catch (error: any) {
      this.recordError('registerForPushNotificationsAsync', error);
      return null;
    }
  }

  // Enhanced handleNotificationResponse with better type safety
  static async handleNotificationResponse(response: Notifications.NotificationResponse): Promise<{
    screen?: string;
    params?: Record<string, any>;
  } | null> {
    try {
      const data = response.notification.request.content.data as NotificationData;

      if (data?.screen) {
        return {
          screen: data.screen,
          params: data.params || {}
        };
      }
      return null;
    } catch (error) {
      this.recordError('handleNotificationResponse', error);
      return null;
    }
  }

  // Badge management with error handling
  static async getBadgeCount(): Promise<number> {
    try {
      return await Notifications.getBadgeCountAsync();
    } catch (error) {
      this.recordError('getBadgeCount', error);
      return 0;
    }
  }

  static async setBadgeCount(count: number): Promise<boolean> {
    try {
      await Notifications.setBadgeCountAsync(count);
      return true;
    } catch (error) {
      this.recordError('setBadgeCount', error);
      return false;
    }
  }

  // Permission management with better types
  static async getPermissions(): Promise<Notifications.NotificationPermissionsStatus | null> {
    try {
      return await Notifications.getPermissionsAsync();
    } catch (error) {
      this.recordError('getPermissions', error);
      return null;
    }
  }

  static async requestPermissions(): Promise<Notifications.NotificationPermissionsStatus | null> {
    try {
      return await Notifications.requestPermissionsAsync();
    } catch (error) {
      this.recordError('requestPermissions', error);
      return null;
    }
  }

  // Notification management
  static async cancelAllNotifications(): Promise<boolean> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      return true;
    } catch (error) {
      this.recordError('cancelAllNotifications', error);
      return false;
    }
  }

  // Enhanced fetchNotifications with better error handling
  static async fetchNotifications(userId: string, { page = 1, limit = 20 } = {}): Promise<{
    notifications: any[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const { data, error, count } = await this.timeoutPromiseWithRetry(
        () => supabase
          .from('notifications')
          .select('*', { count: 'exact' })
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .range((page - 1) * limit, page * limit - 1),
        CONFIG.DB_TIMEOUT,
        'fetchNotifications'
      );

      if (error) throw error;

      return {
        notifications: data || [],
        total: count || 0,
        hasMore: count ? count > page * limit : false
      };
    } catch (error) {
      this.recordError('fetchNotifications', error);
      return {
        notifications: [],
        total: 0,
        hasMore: false
      };
    }
  }

  static async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const { data, error } = await this.timeoutPromiseWithRetry(
        () => supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notificationId)
          .select('user_id')
          .single(),
        CONFIG.DB_TIMEOUT,
        'markAsRead'
      );

      if (error) throw error;
      
      // Invalidate unread count cache for the user
      if (data?.user_id) {
        notificationCache.invalidate(
          NotificationCacheManager.keys.unreadCount(data.user_id)
        );
      }
      
      return true;
    } catch (error) {
      this.recordError('markAsRead', error);
      return false;
    }
  }


  static async markAllAsRead(userId: string): Promise<boolean> {
    try {
      const { error } = await this.timeoutPromiseWithRetry(
        () => supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', userId)
          .eq('is_read', false),
        CONFIG.DB_TIMEOUT,
        'markAllAsRead'
      );

      if (error) throw error;
      return true;
    } catch (error) {
      this.recordError('markAllAsRead', error);
      return false;
    }
  }

  static async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      const { error } = await this.timeoutPromiseWithRetry(
        () => supabase
          .from('notifications')
          .delete()
          .eq('id', notificationId),
        CONFIG.DB_TIMEOUT,
        'deleteNotification'
      );

      if (error) throw error;
      return true;
    } catch (error) {
      this.recordError('deleteNotification', error);
      return false;
    }
  }

  static async getUnreadCount(userId: string): Promise<number> {
    try {
      // Check cache first
      const cachedCount = notificationCache.get<number>(
        NotificationCacheManager.keys.unreadCount(userId)
      );
      
      if (cachedCount !== null) {
        return cachedCount;
      }

      const { count, error } = await this.timeoutPromiseWithRetry(
        () => supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_read', false),
        CONFIG.DB_TIMEOUT,
        'getUnreadCount'
      );

      if (error) throw error;
      
      const unreadCount = count || 0;
      
      // Cache the result
      notificationCache.set(
        NotificationCacheManager.keys.unreadCount(userId),
        unreadCount,
        30 * 1000 // 30 seconds
      );
      
      return unreadCount;
    } catch (error) {
      this.recordError('getUnreadCount', error);
      return 0;
    }
  }

  static async cleanupPushToken(userId: string): Promise<boolean> {
    try {
      // Get the current device's token
      const token = await SecureStore.getItemAsync(STORAGE_KEYS.PUSH_TOKEN);
  
      // Update database first before clearing local storage
      if (token && this.isValidExpoToken(token)) {
        await this.updateTokenStatus(userId, token, {
          signed_in: false,
        });
      }
  
      // Clear local storage atomically - only affects current device
      await Promise.all([
        SecureStore.deleteItemAsync(STORAGE_KEYS.PUSH_TOKEN),
        SecureStore.deleteItemAsync(STORAGE_KEYS.PUSH_TOKEN_TIMESTAMP),
        SecureStore.deleteItemAsync(STORAGE_KEYS.PUSH_TOKEN_ID)
      ]);
  
      return true;
    } catch (error) {
      this.recordError('cleanupPushToken', error);
      
      // Emergency cleanup of local storage
      try {
        await Promise.all([
          SecureStore.deleteItemAsync(STORAGE_KEYS.PUSH_TOKEN),
          SecureStore.deleteItemAsync(STORAGE_KEYS.PUSH_TOKEN_TIMESTAMP),
          SecureStore.deleteItemAsync(STORAGE_KEYS.PUSH_TOKEN_ID)
        ]);
      } catch (storageError) {
        this.recordError('emergencyStorageCleanup', storageError);
      }
  
      return false;
    }
  }

  // Enhanced getDiagnostics with more detailed information
  static async getDiagnostics(): Promise<any> {
    try {
      const diagnostics: Record<string, any> = {
        timestamp: new Date().toISOString(),
        device: {
          platform: Platform.OS,
          version: Platform.Version,
          isDevice: Device.isDevice,
          brand: Device.brand,
          modelName: Device.modelName,
          deviceName: Device.deviceName,
          osName: Device.osName,
          osVersion: Device.osVersion
        },
        tokens: {
          hasStoredToken: false,
          tokenId: null,
          tokenAge: null,
          tokenFormat: null,
          tokenPreview: null
        },
        permissions: null,
        errors: [],
        configuration: {
          debugMode: CONFIG.DEBUG_MODE,
          tokenRefreshInterval: CONFIG.TOKEN_REFRESH_INTERVAL,
          dbTimeout: CONFIG.DB_TIMEOUT,
          projectId: this.getProjectId(),
          experienceId: this.getExperienceId()
        }
      };

      // Get token information
      const token = await SecureStore.getItemAsync(STORAGE_KEYS.PUSH_TOKEN);
      const tokenId = await SecureStore.getItemAsync(STORAGE_KEYS.PUSH_TOKEN_ID);
      const timestamp = await SecureStore.getItemAsync(STORAGE_KEYS.PUSH_TOKEN_TIMESTAMP);

      if (token) {
        diagnostics.tokens.hasStoredToken = true;
        diagnostics.tokens.tokenFormat = this.isValidExpoToken(token);
        diagnostics.tokens.tokenPreview = token.substring(0, 10) + '...' + token.substring(token.length - 5);
      }

      if (tokenId) {
        diagnostics.tokens.tokenId = tokenId;
      }

      if (timestamp) {
        const tokenDate = new Date(parseInt(timestamp, 10));
        diagnostics.tokens.tokenAge = Math.floor((Date.now() - parseInt(timestamp, 10)) / (1000 * 60 * 60 * 24));
        diagnostics.tokens.tokenTimestamp = tokenDate.toISOString();
      }

      // Get permission status
      try {
        const permissions = await Notifications.getPermissionsAsync();
        diagnostics.permissions = permissions;
      } catch (e) {
        diagnostics.permissions = { error: String(e) };
      }

      // Get error logs
      try {
        const errorLogs = await SecureStore.getItemAsync(STORAGE_KEYS.NOTIFICATION_ERRORS);
        if (errorLogs) {
          diagnostics.errors = JSON.parse(errorLogs);
        }
      } catch (e) {
        diagnostics.errors = [{ error: 'Failed to parse error logs' }];
      }

      return diagnostics;
    } catch (error) {
      this.recordError('getDiagnostics', error);
      return { error: String(error) };
    }
  }

  // Enhanced markTokenAsSignedIn with validation
  static async markTokenAsSignedIn(userId: string, token?: string): Promise<boolean> {
    try {
      // Check if sign-out is in progress
      if (isGlobalSigningOut) {
        return false;
      }
  
      const tokenToUse = token || await SecureStore.getItemAsync(STORAGE_KEYS.PUSH_TOKEN);
  
      if (!tokenToUse || !this.isValidExpoToken(tokenToUse)) {
        return false;
      }
  
      const success = await this.updateTokenStatus(userId, tokenToUse, {
        signed_in: true,
      });
  
      return success;
    } catch (error) {
      this.recordError('markTokenAsSignedIn', error);
      return false;
    }
  }
}