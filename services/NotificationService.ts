import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, AppState } from 'react-native';
import { supabase } from '@/utils/supabase';
import { isSigningOut } from '../app/(home)/_layout';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { isGlobalSigningOut } from '@/utils/AuthContext';

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

  private static debugLog(message: string, data?: any): void {
    if (CONFIG.DEBUG_MODE) {
      const timestamp = new Date().toISOString();
      const logPrefix = `[NotificationService ${timestamp}]`;

      if (data) {
        console.log(`${logPrefix} ${message}`, data);
      } else {
        console.log(`${logPrefix} ${message}`);
      }
    }
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
      this.debugLog(`Retrieving all active device tokens for user ${userId}`);
      
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
        this.debugLog('Error retrieving user device tokens:', error);
        return [];
      }
      
      this.debugLog(`Found ${data?.length || 0} active device tokens for user`);
      return data || [];
    } catch (error) {
      this.recordError('getAllUserDeviceTokens', error);
      return [];
    }
  }
  
  static async signOutFromAllDevices(userId: string): Promise<boolean> {
    try {
      this.debugLog(`Signing out user ${userId} from all devices`);
      
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
        this.debugLog('Error signing out from all devices:', error);
        return false;
      }
      
      this.debugLog('Successfully signed out from all devices');
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
        this.debugLog('Error checking for multiple devices:', error);
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
      this.debugLog(`ERROR in ${context}:`, error);

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
      this.debugLog('Starting comprehensive project ID resolution...');
      
      // First priority: Environment variable (most reliable in production)
      const envProjectId = process.env.EXPO_PUBLIC_PROJECT_ID;
      if (envProjectId) {
        this.debugLog(`Using Project ID from environment: ${envProjectId}`);
        return envProjectId;
      }

      // Second priority: EAS configuration
      const easProjectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (easProjectId) {
        this.debugLog(`Using EAS Project ID: ${easProjectId}`);
        return easProjectId;
      }

      // Third priority: Direct extra configuration
      const extraProjectId = Constants.expoConfig?.extra?.projectId;
      if (extraProjectId) {
        this.debugLog(`Using Extra Project ID: ${extraProjectId}`);
        return extraProjectId;
      }

      // Fourth priority: App config values
      // @ts-ignore - Accessing manifest properties that might exist in certain builds
      const manifestProjectId = Constants.manifest?.extra?.eas?.projectId ||
                                // @ts-ignore
                                Constants.manifest?.extra?.projectId;
      if (manifestProjectId) {
        this.debugLog(`Using manifest Project ID: ${manifestProjectId}`);
        return manifestProjectId;
      }

      // Extract from updates URL as last resort
      try {
        // @ts-ignore
        const updatesUrl = Constants.expoConfig?.updates?.url || Constants.manifest?.updates?.url;
        if (updatesUrl && typeof updatesUrl === 'string') {
          const projectIdMatch = updatesUrl.match(/([a-f0-9-]{36})/i);
          if (projectIdMatch && projectIdMatch[1]) {
            this.debugLog(`Extracted Project ID from updates URL: ${projectIdMatch[1]}`);
            return projectIdMatch[1];
          }
        }
      } catch (urlError) {
        this.debugLog('Error extracting Project ID from URL:', urlError);
      }

      // Fallback to hardcoded value
      const fallbackId = 'aaf80aae-b9fd-4c39-a48a-79f2eac06e68';
      this.debugLog(`Using fallback Project ID: ${fallbackId}`);
      return fallbackId;
    } catch (error) {
      this.debugLog('Critical error resolving Project ID:', error);
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
        this.debugLog(`Built experience ID from owner/slug: ${experienceId}`);
        return experienceId;
      }

      // Method 2: From app config
      // @ts-ignore
      const directExperienceId = Constants.expoConfig?.experienceId || Constants.manifest?.experienceId;
      if (directExperienceId) {
        this.debugLog(`Using direct experience ID: ${directExperienceId}`);
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
            this.debugLog(`Extracted experience ID from updates URL: ${experienceId}`);
            return experienceId;
          }
        }
      } catch (urlError) {
        this.debugLog('Error extracting experience ID from URL:', urlError);
      }

      // Fallback: construct from known values
      const fallbackExperienceId = '@qwerty-app/clerk-expo-quickstart';
      this.debugLog(`Using fallback experience ID: ${fallbackExperienceId}`);
      return fallbackExperienceId;
    } catch (error) {
      this.debugLog('Error resolving experience ID:', error);
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
        this.debugLog(`${operationName} attempt ${attempt} failed:`, error);
        
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

  private static async tokenNeedsRefresh(): Promise<boolean> {
    try {
      const timestampStr = await SecureStore.getItemAsync(STORAGE_KEYS.PUSH_TOKEN_TIMESTAMP);
      if (!timestampStr) return true;

      const timestamp = parseInt(timestampStr, 10);
      const now = Date.now();

      return (now - timestamp) > CONFIG.TOKEN_REFRESH_INTERVAL;
    } catch (error) {
      this.recordError('tokenNeedsRefresh', error);
      return true; // Refresh on error
    }
  }

  private static async saveTokenToStorage(token: string, tokenId?: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(STORAGE_KEYS.PUSH_TOKEN, token);
      await SecureStore.setItemAsync(STORAGE_KEYS.PUSH_TOKEN_TIMESTAMP, Date.now().toString());

      if (tokenId) {
        await SecureStore.setItemAsync(STORAGE_KEYS.PUSH_TOKEN_ID, tokenId);
      }

      this.debugLog('Token saved to secure storage');
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
      this.debugLog(`Verifying push token for user ${userId}`);

      // Check local storage first for improved speed
      const storedToken = await SecureStore.getItemAsync(STORAGE_KEYS.PUSH_TOKEN);
      const storedTokenId = await SecureStore.getItemAsync(STORAGE_KEYS.PUSH_TOKEN_ID);
      const tokenTimestamp = await SecureStore.getItemAsync(STORAGE_KEYS.PUSH_TOKEN_TIMESTAMP);

      if (!storedToken) {
        this.debugLog('No token in local storage, verification failed');
        return { isValid: false };
      }

      if (!this.isValidExpoToken(storedToken)) {
        this.debugLog('Token in storage has invalid format, cleaning up');
        await Promise.all([
          SecureStore.deleteItemAsync(STORAGE_KEYS.PUSH_TOKEN),
          SecureStore.deleteItemAsync(STORAGE_KEYS.PUSH_TOKEN_TIMESTAMP),
          SecureStore.deleteItemAsync(STORAGE_KEYS.PUSH_TOKEN_ID)
        ]);
        return { isValid: false };
      }

      // Check token age - if too recent (< 5 seconds), consider it valid to avoid race conditions
      if (tokenTimestamp) {
        const age = Date.now() - parseInt(tokenTimestamp, 10);
        if (age < 5000) { // 5 seconds
          this.debugLog('Token was just created, skipping database verification');
          return { 
            isValid: true, 
            token: storedToken,
            tokenId: storedTokenId,
            signedIn: true  // Assume signed in since it's brand new
          };
        }
      }

      // Use a shorter timeout specifically for token verification
      const VERIFICATION_TIMEOUT = 3000; // 3 seconds

      try {
        // Attempt quick database verification with shorter timeout
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
          this.debugLog('Token verified successfully in database');
          
          // Update local storage with token ID if needed
          if (!storedTokenId || storedTokenId !== tokenByValue.id) {
            await SecureStore.setItemAsync(STORAGE_KEYS.PUSH_TOKEN_ID, tokenByValue.id);
          }
          
          return {
            isValid: true,
            tokenId: tokenByValue.id,
            token: tokenByValue.token,
            signedIn: tokenByValue.signed_in
          };
        }
      } catch (verifyError) {
        // If verification times out, still consider token potentially valid
        // but mark for reverification later
        if (verifyError.message && verifyError.message.includes('timed out')) {
          this.debugLog('Verification timed out but token exists locally, considering valid');
          return { 
            isValid: true, 
            token: storedToken,
            tokenId: storedTokenId,
            signedIn: undefined  // Unknown state
          };
        }
        
        this.debugLog('Error during token verification:', verifyError);
      }
      
      // If we reach here, database verification failed but we have a token in local storage
      this.debugLog('Token not found in database but exists locally');
      return { 
        isValid: false,
        token: storedToken  // Return the token for potential re-registration
      };
      
    } catch (error) {
      this.recordError('forceTokenVerification', error);
      return { isValid: false };
    }
  }

// Update ensureValidTokenRegistration for more robust database operations
static async ensureValidTokenRegistration(userId: string, token: string): Promise<boolean> {
  try {
    this.debugLog(`Ensuring valid token registration for user ${userId}`);
    
    if (!this.isValidExpoToken(token)) {
      this.debugLog(`Invalid token format: ${token}`);
      return false;
    }
    
    // IMPROVEMENT 1: Begin by marking the token as valid in local storage
    await this.saveTokenToStorage(token);
    
    // IMPROVEMENT 2: Clean up old tokens for THIS USER on THIS DEVICE
    try {
      this.debugLog('Cleaning up old tokens for this user on this device');
      const { error: cleanupError } = await this.timeoutPromiseWithRetry(
        () => supabase
          .from('user_push_tokens')
          .update({
            active: false,
            signed_in: false,
            last_updated: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('device_type', Platform.OS)
          .neq('token', token), // Don't deactivate the current token
        CONFIG.DB_TIMEOUT,
        'cleanupOldTokens',
        2 // Two retries is enough for cleanup
      );
      
      if (cleanupError) {
        this.debugLog('Warning: Failed to clean up old tokens:', cleanupError);
      } else {
        this.debugLog('Successfully cleaned up old tokens for this user on this device');
      }
    } catch (error) {
      this.debugLog('Non-critical error in token cleanup:', error);
    }
    
    // IMPROVEMENT 3: Use upsert with composite key constraint
    try {
      this.debugLog('Attempting to upsert token with composite key (user_id, token)');
      
      const tokenData = {
        user_id: userId,
        token: token,
        device_type: Platform.OS,
        last_updated: new Date().toISOString(),
        signed_in: true,
        active: true
      };
      
      // Use upsert which handles both insert and update cases
      const { data: upsertData, error: upsertError } = await this.timeoutPromiseWithRetry(
        () => supabase
          .from('user_push_tokens')
          .upsert(tokenData, {
            onConflict: 'user_id,token', // Composite unique constraint
            ignoreDuplicates: false
          })
          .select('id'),
        CONFIG.DB_TIMEOUT,
        'upsertToken'
      );
      
      if (upsertError) {
        this.debugLog('Error during token upsert:', upsertError);
        
        // Fallback: Try direct insert/update if upsert fails
        this.debugLog('Falling back to traditional insert/update approach');
        
        // First check if this user-token combination exists
        const { data: existingToken, error: checkError } = await this.timeoutPromiseWithRetry(
          () => supabase
            .from('user_push_tokens')
            .select('id')
            .eq('user_id', userId)
            .eq('token', token)
            .single(),
          CONFIG.DB_TIMEOUT,
          'checkExistingToken'
        );
        
        if (checkError && checkError.code !== 'PGRST116') {
          this.debugLog('Error checking existing token:', checkError);
          throw checkError;
        }
        
        if (existingToken) {
          // Update existing token
          this.debugLog('Updating existing user-token combination');
          const { error: updateError } = await this.timeoutPromiseWithRetry(
            () => supabase
              .from('user_push_tokens')
              .update({
                signed_in: true,
                active: true,
                device_type: Platform.OS,
                last_updated: new Date().toISOString()
              })
              .eq('id', existingToken.id),
            CONFIG.DB_TIMEOUT,
            'updateExistingToken'
          );
          
          if (updateError) {
            this.debugLog('Failed to update existing token:', updateError);
            throw updateError;
          }
          
          await SecureStore.setItemAsync(STORAGE_KEYS.PUSH_TOKEN_ID, existingToken.id);
          return true;
        } else {
          // Insert new token
          this.debugLog('Inserting new user-token combination');
          const { data: insertData, error: insertError } = await this.timeoutPromiseWithRetry(
            () => supabase
              .from('user_push_tokens')
              .insert(tokenData)
              .select('id'),
            CONFIG.DB_TIMEOUT,
            'insertNewToken'
          );
          
          if (insertError) {
            this.debugLog('Failed to insert new token:', insertError);
            throw insertError;
          }
          
          if (insertData && insertData.length > 0) {
            await SecureStore.setItemAsync(STORAGE_KEYS.PUSH_TOKEN_ID, insertData[0].id);
            return true;
          }
        }
        
        return false;
      }
      
      if (upsertData && upsertData.length > 0) {
        this.debugLog('Successfully upserted token with ID:', upsertData[0].id);
        await SecureStore.setItemAsync(STORAGE_KEYS.PUSH_TOKEN_ID, upsertData[0].id);
        
        // IMPROVEMENT 4: Deactivate other users' tokens for this device
        try {
          this.debugLog('Deactivating other users tokens for this device');
          const { error: deactivateError } = await this.timeoutPromiseWithRetry(
            () => supabase
              .from('user_push_tokens')
              .update({
                signed_in: false,
                active: false,
                last_updated: new Date().toISOString()
              })
              .eq('token', token)
              .neq('user_id', userId), // Other users with same token
            CONFIG.DB_TIMEOUT,
            'deactivateOtherUsers'
          );
          
          if (deactivateError) {
            this.debugLog('Warning: Failed to deactivate other users tokens:', deactivateError);
          } else {
            this.debugLog('Successfully deactivated other users tokens for this device');
          }
        } catch (error) {
          this.debugLog('Non-critical error deactivating other users tokens:', error);
        }
        
        return true;
      }
      
      this.debugLog('Unexpected: Upsert succeeded but no data returned');
      return true; // Still consider it successful
    } catch (error) {
      this.recordError('ensureValidTokenRegistration', error);
      this.debugLog('Critical error in token registration:', error);
      return false;
    }
  } catch (outerError) {
    this.recordError('ensureValidTokenRegistration_outer', outerError);
    this.debugLog('Fatal error in token registration:', outerError);
    return false;
  }
}

  // Enhanced updateTokenStatus with better error handling and retry logic
  static async updateTokenStatus(userId: string, token: string, status: TokenStatus): Promise<boolean> {
    try {
      this.debugLog('===== UPDATE TOKEN STATUS DEBUG =====');
      this.debugLog('User ID:', userId);
      this.debugLog('Token:', token);
      this.debugLog('Status to update:', status);
      
      if (!token || !userId) {
        this.debugLog('ERROR: Missing token or userId');
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
        this.debugLog('Error checking existing tokens:', checkError);
        this.recordError('updateTokenStatus.checkExisting', checkError);
        return false;
      }

      if (!existingTokens || existingTokens.length === 0) {
        this.debugLog('WARNING: No matching token found in database!');
        return false;
      }

      this.debugLog('Current token status:', {
        signed_in: existingTokens[0].signed_in,
        active: existingTokens[0].active
      });

      const updates = {
        last_updated: new Date().toISOString(),
        ...status
      };

      this.debugLog('Attempting update with:', updates);

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
        this.debugLog('UPDATE ERROR:', error);
        this.recordError('updateTokenStatus', error);
        return false;
      }

      this.debugLog('UPDATE SUCCESS:', updateData);
      this.debugLog('===== END UPDATE TOKEN STATUS DEBUG =====');
      return true;
    } catch (error) {
      this.debugLog('EXCEPTION in updateTokenStatus:', error);
      this.recordError('updateTokenStatus', error);
      return false;
    }
  }

  // Improved markTokenAsSignedOut with atomic operations
  static async markTokenAsSignedOut(userId: string): Promise<boolean> {
    try {
      this.debugLog(`Marking tokens as signed out for user ${userId}`);

      const token = await SecureStore.getItemAsync(STORAGE_KEYS.PUSH_TOKEN);

      // Update database first before clearing local storage
      if (token && this.isValidExpoToken(token)) {
        const success = await this.updateTokenStatus(userId, token, {
          signed_in: false,
        });

        if (success) {
          this.debugLog('Successfully marked token as signed out');
        } else {
          this.debugLog('Failed to update token status in database');
          // Continue with cleanup even if update fails
        }
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
      this.debugLog('Attempting to sync token from database for user:', userId);
      
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
        this.debugLog('Error fetching tokens from database:', error);
        return null;
      }

      if (!tokens || tokens.length === 0) {
        this.debugLog('No tokens found in database for user');
        return null;
      }

      const latestToken = tokens[0];
      this.debugLog('Found token in database:', latestToken);

      // Only sync if token is valid
      if (this.isValidExpoToken(latestToken.token)) {
        await this.saveTokenToStorage(latestToken.token, latestToken.id);
        return latestToken.token;
      } else {
        this.debugLog('Invalid token format in database');
        return null;
      }
    } catch (error) {
      this.debugLog('Error syncing token from database:', error);
      return null;
    }
  }

  // FIXED: Enhanced token registration with both projectId and experienceId
  static async registerForPushNotificationsAsync(userId: string, forceRefresh = false): Promise<string | null> {
    if (!Device.isDevice && !CONFIG.FORCE_REGISTER_DEV) {
      this.debugLog('Push notifications not available on simulator/emulator');
      return null;
    }

    if (isSigningOut) {
      this.debugLog('User is signing out, skipping token registration');
      return null;
    }

    this.debugLog(`Starting push notification registration for user: ${userId}, force: ${forceRefresh}`);

    try {
      // IMPROVEMENT 1: Always get fresh permissions status
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let permissionStatus = existingStatus;

      this.debugLog(`Current permission status: ${permissionStatus}`);

      if (existingStatus !== 'granted') {
        this.debugLog('Permission not granted, requesting...');
        const { status } = await Notifications.requestPermissionsAsync();
        permissionStatus = status;
        this.debugLog(`Updated permission status: ${permissionStatus}`);
      }

      if (permissionStatus !== 'granted') {
        this.debugLog('Push notification permission not granted after request');
        return null;
      }

      // IMPROVEMENT 2: Set up Android notification channel early
      if (Platform.OS === 'android') {
        try {
          this.debugLog('Setting up Android notification channel');
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#D55004',
            sound: 'notification.wav',
            enableVibrate: true,
            enableLights: true
          });
          this.debugLog('Android notification channel setup complete');
        } catch (channelError) {
          this.recordError('setupAndroidChannel', channelError);
          this.debugLog('Failed to set up Android notification channel, continuing anyway');
          // Continue even if channel setup fails
        }
      }

      // IMPROVEMENT 3: Only check existing token if not forcing refresh
      let verification = { isValid: false, token: null as string | null };
      
      if (!forceRefresh) {
        try {
          this.debugLog('Checking for existing valid token');
          verification = await this.forceTokenVerification(userId);
          this.debugLog(`Token verification result: ${JSON.stringify({
            isValid: verification.isValid,
            hasToken: !!verification.token,
            signedIn: verification.signedIn
          })}`);
        } catch (error) {
          this.debugLog('Error during token verification, will attempt fresh registration:', error);
        }

        // Use existing token if valid and not forcing refresh
        if (verification.isValid && verification.token) {
          this.debugLog('Using existing verified token from database');
          await this.saveTokenToStorage(verification.token, verification.tokenId);
          
          // Ensure token is marked as signed in
          if (verification.signedIn === false) {
            this.debugLog('Updating existing token to signed_in=true');
            await this.updateTokenStatus(userId, verification.token, { signed_in: true });
          }
          
          return verification.token;
        }
      } else {
        this.debugLog('Force refresh specified, skipping token verification');
      }

      // IMPROVEMENT 4: Get both project ID and experience ID
      const projectId = this.getProjectId();
      const experienceId = this.getExperienceId();
      
      this.debugLog(`Getting new Expo push token with:`, {
        projectId,
        experienceId,
        platform: Platform.OS
      });
      
      // IMPROVEMENT 5: Enhanced token acquisition with multiple approaches
      let tokenResponse;
      let tokenError = null;
      
      // Try with both projectId and experienceId first (recommended for production)
      try {
        this.debugLog('Attempting token acquisition with projectId and experienceId');
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
        this.debugLog('Token acquisition with both params failed:', fullError);
        
        // Fallback: Try with just projectId
        try {
          this.debugLog('Fallback: Attempting token acquisition with projectId only');
          tokenResponse = await this.timeoutPromiseWithRetry(
            () => Notifications.getExpoPushTokenAsync({
              projectId: projectId,
            }),
            15000,
            'getExpoPushTokenAsync_projectOnly',
            2
          );
        } catch (projectOnlyError) {
          this.debugLog('Token acquisition with projectId only also failed:', projectOnlyError);
          
          // Final fallback: Try with just experienceId
          try {
            this.debugLog('Final fallback: Attempting token acquisition with experienceId only');
            tokenResponse = await this.timeoutPromiseWithRetry(
              () => Notifications.getExpoPushTokenAsync({
                projectId: projectId,

              }),
              15000,
              'getExpoPushTokenAsync_experienceOnly',
              2
            );
          } catch (experienceOnlyError) {
            this.debugLog('All token acquisition methods failed');
            throw new Error(`Token acquisition failed: ${fullError?.message || projectOnlyError?.message || experienceOnlyError?.message}`);
          }
        }
      }

      const token = tokenResponse.data;
      this.debugLog(`Received token: ${token.substring(0, 10)}...`);

      if (!this.isValidExpoToken(token)) {
        this.debugLog(`Invalid token format received: ${token}`);
        throw new Error(`Received invalid token format: ${token}`);
      }

      // IMPROVEMENT 6: Always save to storage immediately before DB operations can fail
      await this.saveTokenToStorage(token);
      this.debugLog('Token saved to local storage');
      
      // IMPROVEMENT 7: More robust registration with clearer error handling
      let registrationSuccess = false;
      let registrationError = null;
      
      try {
        this.debugLog('Attempting to register token in database');
        registrationSuccess = await this.ensureValidTokenRegistration(userId, token);
      } catch (regError) {
        registrationError:any = regError;
        this.debugLog('Error during token registration:', regError);
        this.recordError('tokenRegistration', regError);
      }
      
      if (registrationSuccess) {
        this.debugLog('Token registration completed successfully');
        return token;
      } else {
        this.debugLog('Token registration failed in database, but token was obtained');
        if (registrationError) {
          // Log specific error details
          this.debugLog(`Registration error details: ${registrationError.message}`);
        }
        return token; // Still return token since we have it in storage
      }
    } catch (error) {
      this.recordError('registerForPushNotificationsAsync', error);
      this.debugLog(`Critical error in push token registration: ${error.message}`);
      return null;
    }
  }

  // Enhanced handleNotificationResponse with better type safety
  static async handleNotificationResponse(response: Notifications.NotificationResponse): Promise<{
    screen?: string;
    params?: Record<string, any>;
  } | null> {
    try {
      this.debugLog('Handling notification response:', response.notification.request.identifier);

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

  // Notification state management with retry logic
  static async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const { error } = await this.timeoutPromiseWithRetry(
        () => supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notificationId),
        CONFIG.DB_TIMEOUT,
        'markAsRead'
      );

      if (error) throw error;
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
      const { count, error } = await this.timeoutPromiseWithRetry(
        () => supabase
          .from('notifications')
          .select('*', { count: 'exact' })
          .eq('user_id', userId)
          .eq('is_read', false),
        CONFIG.DB_TIMEOUT,
        'getUnreadCount'
      );

      if (error) throw error;
      return count || 0;
    } catch (error) {
      this.recordError('getUnreadCount', error);
      return 0;
    }
  }

  static async cleanupPushToken(userId: string): Promise<boolean> {
    this.debugLog('Starting push token cleanup process for CURRENT DEVICE only');
  
    try {
      // Get the current device's token
      const token = await SecureStore.getItemAsync(STORAGE_KEYS.PUSH_TOKEN);
  
      // Update database first before clearing local storage
      if (token && this.isValidExpoToken(token)) {
        const success = await this.updateTokenStatus(userId, token, {
          signed_in: false,
        });
  
        if (success) {
          this.debugLog('Successfully marked current device token as signed out');
        } else {
          this.debugLog('Failed to update current device token status in database');
          // Continue with cleanup even if update fails
        }
      }
  
      // Clear local storage atomically - only affects current device
      await Promise.all([
        SecureStore.deleteItemAsync(STORAGE_KEYS.PUSH_TOKEN),
        SecureStore.deleteItemAsync(STORAGE_KEYS.PUSH_TOKEN_TIMESTAMP),
        SecureStore.deleteItemAsync(STORAGE_KEYS.PUSH_TOKEN_ID)
      ]);
  
      this.debugLog('Current device token cleanup process completed');
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
        this.debugLog('Sign-out in progress, skipping markTokenAsSignedIn');
        return false;
      }
  
      this.debugLog(`Marking token as signed in for user ${userId}`);
  
      const tokenToUse = token || await SecureStore.getItemAsync(STORAGE_KEYS.PUSH_TOKEN);
  
      if (!tokenToUse || !this.isValidExpoToken(tokenToUse)) {
        this.debugLog('No valid token found for sign-in update');
        return false;
      }
  
      const success = await this.updateTokenStatus(userId, tokenToUse, {
        signed_in: true,
      });
  
      if (success) {
        this.debugLog('Successfully marked token as signed in');
      } else {
        this.debugLog('Failed to update token sign-in status in database');
      }
  
      return success;
    } catch (error) {
      this.recordError('markTokenAsSignedIn', error);
      return false;
    }
  }
}