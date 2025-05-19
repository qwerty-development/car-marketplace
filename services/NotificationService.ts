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

  private static getProjectId(): string {
    try {
      // 1. Environment variable (highest priority)
      const envProjectId = process.env.EXPO_PUBLIC_PROJECT_ID;
      if (envProjectId) {
        this.debugLog('Using env project ID:', envProjectId);
        return envProjectId;
      }

      // 2. Constants.expoConfig
      if (Constants.expoConfig?.extra?.projectId) {
        this.debugLog('Using expoConfig.extra.projectId:', Constants.expoConfig.extra.projectId);
        return Constants.expoConfig.extra.projectId;
      }

      // 3. Constants.expoConfig.extra.eas.projectId
      if (Constants.expoConfig?.extra?.eas?.projectId) {
        this.debugLog('Using expoConfig.extra.eas.projectId:', Constants.expoConfig.extra.eas.projectId);
        return Constants.expoConfig.extra.eas.projectId;
      }

      // 4. Constants.manifest
      if (Constants.manifest?.extra?.projectId) {
        this.debugLog('Using manifest.extra.projectId:', Constants.manifest.extra.projectId);
        return Constants.manifest.extra.projectId;
      }

      // 5. Debug logging for troubleshooting
      if (CONFIG.DEBUG_MODE) {
        this.debugLog('All Constants:', {
          expoConfig: Constants.expoConfig,
          manifest: Constants.manifest,
          easConfig: Constants.easConfig
        });
      }

      // 6. Fallback value
      const fallbackId = 'aaf80aae-b9fd-4c39-a48a-79f2eac06e68';
      this.debugLog('Using fallback project ID:', fallbackId);
      return fallbackId;
    } catch (error) {
      console.error('Error accessing Constants for project ID:', error);
      return 'aaf80aae-b9fd-4c39-a48a-79f2eac06e68';
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

// Enhancement 1: Improve the forceTokenVerification method to better handle deleted tokens
// Location: In NotificationService class, replace the existing forceTokenVerification method

// In services/NotificationService.ts
// Update the forceTokenVerification method:

static async forceTokenVerification(userId: string): Promise<{
  isValid: boolean;
  tokenId?: string;
  token?: string;
  signedIn?: boolean;
}> {
  try {
    this.debugLog(`Verifying push token for user ${userId}`);

    // CRITICAL CHANGE: Add overall timeout to prevent hanging
    const timeoutPromise = new Promise<{isValid: boolean}>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Token verification timed out'));
      }, 5000); // 5 second timeout
    });

    // Create the actual verification process
    const verificationPromise = (async () => {
      const storedToken = await SecureStore.getItemAsync(STORAGE_KEYS.PUSH_TOKEN);
      const storedTokenId = await SecureStore.getItemAsync(STORAGE_KEYS.PUSH_TOKEN_ID);

      if (!storedToken) {
        this.debugLog('No token in storage, registration needed');
        return { isValid: false };
      }

      if (!this.isValidExpoToken(storedToken)) {
        this.debugLog('Token in storage is not in Expo format, registration needed');
        await Promise.all([
          SecureStore.deleteItemAsync(STORAGE_KEYS.PUSH_TOKEN),
          SecureStore.deleteItemAsync(STORAGE_KEYS.PUSH_TOKEN_TIMESTAMP),
          SecureStore.deleteItemAsync(STORAGE_KEYS.PUSH_TOKEN_ID)
        ]);
        return { isValid: false };
      }

      // CRITICAL CHANGE: Simplified verification flow
      // Only check by token value, skip checking by ID which can be slower
      try {
        const { data: tokenByValue, error: valueError } = await this.timeoutPromiseWithRetry(
          () => supabase
            .from('user_push_tokens')
            .select('id, token, active, signed_in')
            .eq('user_id', userId)
            .eq('token', storedToken)
            .single(),
          CONFIG.DB_TIMEOUT,
          'verifyTokenByValue',
          1 // CRITICAL CHANGE: Reduced retries from 3 to 1
        );

        if (!valueError && tokenByValue) {
          this.debugLog('Found matching token by value in database');
          
          // Update local storage with the token ID
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
      } catch (error) {
        this.debugLog('Error verifying token by value:', error);
      }

      // CRITICAL CHANGE: Skip checking for any token for this user
      // This operation can be slow for reinstalls, and the result is the same
      
      this.debugLog('Token verification unsuccessful, will need registration');
      return { 
        isValid: false,
        token: storedToken
      };
    })();

    // Race the verification against the timeout
    return await Promise.race([verificationPromise, timeoutPromise]);
    
  } catch (error) {
    this.recordError('forceTokenVerification', error);
    return { isValid: false };
  }
}

// Enhancement 2: Add a new method for ensuring valid token registration
// Location: Add this new method to the NotificationService class

static async ensureValidTokenRegistration(userId: string, token: string): Promise<boolean> {
  try {
    this.debugLog(`Ensuring valid token registration for user ${userId}`);
    
    if (!this.isValidExpoToken(token)) {
      this.debugLog('Invalid token format, cannot register');
      return false;
    }
    
    // Check if this token is already registered for this user
    const { data: existingToken, error: checkError } = await this.timeoutPromiseWithRetry(
      () => supabase
        .from('user_push_tokens')
        .select('id, token, signed_in, active, device_type')
        .eq('user_id', userId)
        .eq('token', token)
        .single(),
      CONFIG.DB_TIMEOUT,
      'checkExistingToken'
    );
    
    if (!checkError && existingToken) {
      this.debugLog('Token already exists for this user, updating status');
      
      // Update token status if needed
      if (!existingToken.signed_in || !existingToken.active) {
        const { error: updateError } = await this.timeoutPromiseWithRetry(
          () => supabase
            .from('user_push_tokens')
            .update({
              signed_in: true,
              active: true,
              last_updated: new Date().toISOString()
            })
            .eq('id', existingToken.id),
          CONFIG.DB_TIMEOUT,
          'updateExistingToken'
        );
        
        if (updateError) {
          this.debugLog('Error updating existing token:', updateError);
          return false;
        }
        
        this.debugLog('Successfully updated token status');
      } else {
        this.debugLog('Token already in correct state, no update needed');
      }
      
      // Save token ID to storage
      await SecureStore.setItemAsync(STORAGE_KEYS.PUSH_TOKEN_ID, existingToken.id);
      return true;
    }
    
    // Token doesn't exist for this user, register it
    this.debugLog('Token not found for this user, registering new token');
    
    // First clean up any old tokens for this device to prevent duplicates
    try {
      const { error: cleanupError } = await this.timeoutPromiseWithRetry(
        () => supabase
          .from('user_push_tokens')
          .update({
            active: false,
            signed_in: false,
            last_updated: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('device_type', Platform.OS),
        CONFIG.DB_TIMEOUT,
        'cleanupOldTokens'
      );
      
      if (cleanupError) {
        this.debugLog('Warning: Failed to clean up old tokens:', cleanupError);
        // Continue anyway - not critical
      }
    } catch (error) {
      this.debugLog('Error in token cleanup:', error);
      // Continue anyway - not critical
    }
    
    // Insert new token
    const { data: insertData, error: insertError } = await this.timeoutPromiseWithRetry(
      () => supabase
        .from('user_push_tokens')
        .insert({
          user_id: userId,
          token: token,
          device_type: Platform.OS,
          last_updated: new Date().toISOString(),
          signed_in: true,
          active: true
        })
        .select('id'),
      CONFIG.DB_TIMEOUT,
      'insertNewToken'
    );
    
    if (insertError) {
      // Check for unique constraint violation
      if (insertError.code === '23505') {
        this.debugLog('Token already exists (constraint violation), trying update instead');
        
        // Token exists but couldn't be found earlier, try updating it
        const { error: updateError } = await this.timeoutPromiseWithRetry(
          () => supabase
            .from('user_push_tokens')
            .update({
              signed_in: true,
              active: true,
              last_updated: new Date().toISOString()
            })
            .eq('user_id', userId)
            .eq('token', token),
          CONFIG.DB_TIMEOUT,
          'updateExistingTokenAfterInsertFailed'
        );
        
        if (updateError) {
          this.debugLog('Failed to update token after insert failed:', updateError);
          return false;
        }
        
        // Retrieve the token ID
        const { data: retrieveData, error: retrieveError } = await this.timeoutPromiseWithRetry(
          () => supabase
            .from('user_push_tokens')
            .select('id')
            .eq('user_id', userId)
            .eq('token', token)
            .single(),
          CONFIG.DB_TIMEOUT,
          'retrieveTokenId'
        );
        
        if (!retrieveError && retrieveData) {
          await SecureStore.setItemAsync(STORAGE_KEYS.PUSH_TOKEN_ID, retrieveData.id);
          this.debugLog('Successfully updated token and retrieved ID');
          return true;
        }
        
        return false;
      }
      
      this.debugLog('Failed to insert new token:', insertError);
      return false;
    }
    
    // Successfully inserted new token
    if (insertData && insertData.length > 0) {
      await SecureStore.setItemAsync(STORAGE_KEYS.PUSH_TOKEN_ID, insertData[0].id);
      this.debugLog('Successfully registered new token');
      return true;
    }
    
    return false;
  } catch (error) {
    this.recordError('ensureValidTokenRegistration', error);
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

  // Optimized registerForPushNotificationsAsync with better flow and error handling
  static async registerForPushNotificationsAsync(userId: string, forceRefresh = false): Promise<string | null> {
    if (!Device.isDevice && !CONFIG.FORCE_REGISTER_DEV) {
      this.debugLog('Push notifications not available on simulator/emulator');
      return null;
    }
  
    if (isSigningOut) {
      this.debugLog('User is signing out, skipping token registration');
      return null;
    }
  
    this.debugLog(`Starting push notification registration for user: ${userId}`);
  
    try {
      // Always check for existing valid token first, even if forceRefresh is true
      // This helps us know if we should update vs insert
      let verification = { isValid: false, token: null as string | null };
      
      try {
        verification = await this.forceTokenVerification(userId);
      } catch (error) {
        this.debugLog('Error during token verification, will attempt fresh registration:', error);
      }
  
      // If token is valid and we're not forcing a refresh, use existing token
      if (!forceRefresh && verification.isValid && verification.token) {
        this.debugLog('Using existing verified token from database');
        await this.saveTokenToStorage(verification.token, verification.tokenId);
        
        // Ensure token is marked as signed in
        if (verification.signedIn === false) {
          await this.updateTokenStatus(userId, verification.token, { signed_in: true });
        }
        
        return verification.token;
      }
  
      // Check and request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let permissionStatus = existingStatus;
  
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        permissionStatus = status;
      }
  
      if (permissionStatus !== 'granted') {
        this.debugLog('Push notification permission not granted');
        return null;
      }
  
      // Set up Android notification channel
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
          this.recordError('setupAndroidChannel', channelError);
          // Continue even if channel setup fails
        }
      }
  
      // Get project ID and token
      const projectId = this.getProjectId();
      this.debugLog('Getting new Expo push token...');
      
      const tokenResponse = await this.timeoutPromiseWithRetry(
        () => Notifications.getExpoPushTokenAsync({
          projectId: projectId,
        }),
        15000,
        'getExpoPushTokenAsync'
      );
  
      const token = tokenResponse.data;
  
      if (!this.isValidExpoToken(token)) {
        throw new Error(`Received invalid token format: ${token}`);
      }
  
      // Always save to storage immediately
      await this.saveTokenToStorage(token);
      
      // Use enhanced method to ensure proper registration
      const registrationSuccess = await this.ensureValidTokenRegistration(userId, token);
      
      if (registrationSuccess) {
        this.debugLog('Token registration completed successfully');
        return token;
      } else {
        this.debugLog('Token registration failed, but token was obtained');
        return token; // Still return token since we have it in storage
      }
    } catch (error) {
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
          dbTimeout: CONFIG.DB_TIMEOUT
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