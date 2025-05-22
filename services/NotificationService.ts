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
  NOTIFICATION_ERRORS: 'notificationErrors',
  PRODUCTION_LOGS: 'productionNotificationLogs'
} as const;

// Constants - ENHANCED FOR PRODUCTION
const CONFIG = {
  TOKEN_REFRESH_INTERVAL: 30 * 24 * 60 * 60 * 1000, // 30 days
  FORCE_REGISTER_DEV: __DEV__, // Only force in development
  DEBUG_MODE: true, // ALWAYS TRUE FOR PRODUCTION DEBUGGING
  DB_TIMEOUT: 15000, // Increased to 15 seconds for production
  MAX_ERROR_LOGS: 20, // Increased for production
  MAX_RETRIES: 5, // Increased retries for production
  RETRY_DELAY: 2000, // Increased delay
  PRODUCTION_PROJECT_ID: 'aaf80aae-b9fd-4c39-a48a-79f2eac06e68', // HARDCODED FALLBACK
  MAX_REGISTRATION_ATTEMPTS: 10, // Aggressive retry for production
  VERIFICATION_TIMEOUT: 5000,
  EMERGENCY_RETRY_DELAY: 30000 // 30 seconds for emergency retry
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

  // ENHANCED PRODUCTION LOGGING
  private static async productionLog(level: 'INFO' | 'ERROR' | 'WARN', message: string, data?: any): Promise<void> {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data: data ? JSON.stringify(data) : undefined,
      platform: Platform.OS,
      isProduction: !__DEV__
    };

    // Always log to console
    console.log(`[PROD-NOTIFICATIONS ${timestamp}] ${level}: ${message}`, data || '');

    try {
      // Store in secure storage for debugging
      const existingLogs = await SecureStore.getItemAsync(STORAGE_KEYS.PRODUCTION_LOGS) || '[]';
      const logs = JSON.parse(existingLogs);
      logs.push(logEntry);
      
      // Keep only last 50 logs
      if (logs.length > 50) {
        logs.splice(0, logs.length - 50);
      }
      
      await SecureStore.setItemAsync(STORAGE_KEYS.PRODUCTION_LOGS, JSON.stringify(logs));
    } catch (e) {
      console.error('Failed to store production log:', e);
    }
  }

  private static debugLog(message: string, data?: any): void {
    this.productionLog('INFO', message, data);
  }

  // PRODUCTION-HARDENED PROJECT ID RESOLUTION
  private static getProjectId(): string {
    const methodName = 'getProjectId';
    
    try {
      this.productionLog('INFO', `${methodName}: Starting project ID resolution`);
      
      // Method 1: Environment variable (most reliable)
      const envProjectId = process.env.EXPO_PUBLIC_PROJECT_ID;
      if (envProjectId && envProjectId.length > 0) {
        this.productionLog('INFO', `${methodName}: Found env project ID: ${envProjectId}`);
        return envProjectId;
      }
      
      // Method 2: Constants.expoConfig?.extra?.eas?.projectId
      const easProjectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (easProjectId && typeof easProjectId === 'string' && easProjectId.length > 0) {
        this.productionLog('INFO', `${methodName}: Found EAS project ID: ${easProjectId}`);
        return easProjectId;
      }
      
      // Method 3: Constants.expoConfig?.extra?.projectId
      const extraProjectId = Constants.expoConfig?.extra?.projectId;
      if (extraProjectId && typeof extraProjectId === 'string' && extraProjectId.length > 0) {
        this.productionLog('INFO', `${methodName}: Found extra project ID: ${extraProjectId}`);
        return extraProjectId;
      }
      
      // Method 4: Parse from app.json-style config
      try {
        const appConfig = Constants.expoConfig;
        if (appConfig) {
          this.productionLog('INFO', `${methodName}: Analyzing app config structure`, {
            hasExtra: !!appConfig.extra,
            extraKeys: appConfig.extra ? Object.keys(appConfig.extra) : [],
            hasEas: !!(appConfig.extra?.eas),
            easKeys: appConfig.extra?.eas ? Object.keys(appConfig.extra.eas) : []
          });
        }
      } catch (e) {
        this.productionLog('ERROR', `${methodName}: Error analyzing app config`, e);
      }
      
      // Method 5: Hardcoded fallback for production
      this.productionLog('WARN', `${methodName}: Using hardcoded production project ID: ${CONFIG.PRODUCTION_PROJECT_ID}`);
      return CONFIG.PRODUCTION_PROJECT_ID;
      
    } catch (error) {
      this.productionLog('ERROR', `${methodName}: Critical error in project ID resolution`, error);
      // Emergency fallback
      return CONFIG.PRODUCTION_PROJECT_ID;
    }
  }

  // AGGRESSIVE TOKEN VERIFICATION WITH PRODUCTION LOGGING
  static async forceTokenVerification(userId: string): Promise<{
    isValid: boolean;
    tokenId?: string;
    token?: string;
    signedIn?: boolean;
  }> {
    const methodName = 'forceTokenVerification';
    
    try {
      this.productionLog('INFO', `${methodName}: Starting verification for user ${userId}`);

      // Check local storage first
      const storedToken = await SecureStore.getItemAsync(STORAGE_KEYS.PUSH_TOKEN);
      const storedTokenId = await SecureStore.getItemAsync(STORAGE_KEYS.PUSH_TOKEN_ID);
      const tokenTimestamp = await SecureStore.getItemAsync(STORAGE_KEYS.PUSH_TOKEN_TIMESTAMP);

      if (!storedToken) {
        this.productionLog('WARN', `${methodName}: No token in local storage`);
        return { isValid: false };
      }

      if (!this.isValidExpoToken(storedToken)) {
        this.productionLog('ERROR', `${methodName}: Invalid token format in storage`, { tokenPreview: storedToken.substring(0, 20) });
        await Promise.all([
          SecureStore.deleteItemAsync(STORAGE_KEYS.PUSH_TOKEN),
          SecureStore.deleteItemAsync(STORAGE_KEYS.PUSH_TOKEN_TIMESTAMP),
          SecureStore.deleteItemAsync(STORAGE_KEYS.PUSH_TOKEN_ID)
        ]);
        return { isValid: false };
      }

      // Skip database check for very recent tokens
      if (tokenTimestamp) {
        const age = Date.now() - parseInt(tokenTimestamp, 10);
        if (age < 10000) { // 10 seconds
          this.productionLog('INFO', `${methodName}: Token very recent (${age}ms), assuming valid`);
          return { 
            isValid: true, 
            token: storedToken,
            tokenId: storedTokenId,
            signedIn: true
          };
        }
      }

      // Database verification with enhanced error handling
      try {
        this.productionLog('INFO', `${methodName}: Checking token in database`);
        
        const { data: tokenByValue, error: valueError } = await this.timeoutPromise(
          supabase
            .from('user_push_tokens')
            .select('id, token, active, signed_in, user_id')
            .eq('user_id', userId)
            .eq('token', storedToken)
            .single(),
          CONFIG.VERIFICATION_TIMEOUT,
          `${methodName}_dbQuery`
        );

        if (valueError) {
          this.productionLog('ERROR', `${methodName}: Database error during verification`, valueError);
          
          if (valueError.code === 'PGRST116') {
            this.productionLog('WARN', `${methodName}: Token not found in database`);
            return { isValid: false, token: storedToken };
          }
          
          // For other errors, assume token might be valid but unverifiable
          this.productionLog('WARN', `${methodName}: Database error, assuming token valid for now`);
          return { 
            isValid: true, 
            token: storedToken,
            tokenId: storedTokenId,
            signedIn: undefined
          };
        }

        if (tokenByValue) {
          this.productionLog('INFO', `${methodName}: Token verified successfully in database`, {
            tokenId: tokenByValue.id,
            active: tokenByValue.active,
            signedIn: tokenByValue.signed_in
          });
          
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
        this.productionLog('ERROR', `${methodName}: Exception during database verification`, verifyError);
        
        // If verification fails, still consider token potentially valid
        return { 
          isValid: true, 
          token: storedToken,
          tokenId: storedTokenId,
          signedIn: undefined
        };
      }
      
      this.productionLog('WARN', `${methodName}: Token not found in database but exists locally`);
      return { 
        isValid: false,
        token: storedToken
      };
      
    } catch (error) {
      this.productionLog('ERROR', `${methodName}: Critical error during verification`, error);
      return { isValid: false };
    }
  }

  // PRODUCTION-HARDENED TOKEN REGISTRATION
  static async ensureValidTokenRegistration(userId: string, token: string): Promise<boolean> {
    const methodName = 'ensureValidTokenRegistration';
    
    try {
      this.productionLog('INFO', `${methodName}: Starting registration for user ${userId}`);
      
      if (!this.isValidExpoToken(token)) {
        this.productionLog('ERROR', `${methodName}: Invalid token format`, { tokenPreview: token.substring(0, 20) });
        return false;
      }
      
      // Save to storage immediately
      await this.saveTokenToStorage(token);
      this.productionLog('INFO', `${methodName}: Token saved to local storage`);
      
      // Clean up old tokens aggressively
      try {
        this.productionLog('INFO', `${methodName}: Cleaning up old tokens for device`);
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
          `${methodName}_cleanup`,
          3
        );
        
        if (cleanupError) {
          this.productionLog('WARN', `${methodName}: Cleanup warning (non-critical)`, cleanupError);
        } else {
          this.productionLog('INFO', `${methodName}: Successfully cleaned up old tokens`);
        }
      } catch (cleanupError) {
        this.productionLog('WARN', `${methodName}: Cleanup error (continuing anyway)`, cleanupError);
      }
      
      // Multiple insertion strategies
      let registrationSuccess = false;
      let lastError = null;
      
      // Strategy 1: Direct insertion
      try {
        this.productionLog('INFO', `${methodName}: Attempting direct token insertion`);
        
        const insertPayload = {
          user_id: userId,
          token: token,
          device_type: Platform.OS,
          last_updated: new Date().toISOString(),
          signed_in: true,
          active: true
        };
        
        this.productionLog('INFO', `${methodName}: Insert payload`, insertPayload);
        
        const { data: insertData, error: insertError } = await this.timeoutPromiseWithRetry(
          () => supabase
            .from('user_push_tokens')
            .insert(insertPayload)
            .select('id'),
          CONFIG.DB_TIMEOUT,
          `${methodName}_insert`,
          3
        );
        
        if (!insertError && insertData && insertData.length > 0) {
          this.productionLog('INFO', `${methodName}: Direct insertion successful`, { tokenId: insertData[0].id });
          await SecureStore.setItemAsync(STORAGE_KEYS.PUSH_TOKEN_ID, insertData[0].id);
          registrationSuccess = true;
        } else if (insertError) {
          lastError = insertError;
          this.productionLog('ERROR', `${methodName}: Direct insertion failed`, insertError);
          
          if (insertError.code === '23505') {
            this.productionLog('INFO', `${methodName}: Constraint violation, switching to update strategy`);
          } else {
            this.productionLog('ERROR', `${methodName}: Unexpected insertion error`, insertError);
          }
        }
        
      } catch (insertException) {
        lastError = insertException;
        this.productionLog('ERROR', `${methodName}: Exception during insertion`, insertException);
      }
      
      // Strategy 2: Update existing token
      if (!registrationSuccess) {
        try {
          this.productionLog('INFO', `${methodName}: Attempting token update`);
          
          const updatePayload = {
            signed_in: true,
            active: true,
            device_type: Platform.OS,
            last_updated: new Date().toISOString()
          };
          
          this.productionLog('INFO', `${methodName}: Update payload`, updatePayload);
          
          const { data: updateData, error: updateError } = await this.timeoutPromiseWithRetry(
            () => supabase
              .from('user_push_tokens')
              .update(updatePayload)
              .eq('token', token)
              .select('id'),
            CONFIG.DB_TIMEOUT,
            `${methodName}_update`,
            3
          );
          
          if (!updateError) {
            this.productionLog('INFO', `${methodName}: Update successful`, updateData);
            registrationSuccess = true;
            
            // Try to get token ID
            if (updateData && updateData.length > 0) {
              await SecureStore.setItemAsync(STORAGE_KEYS.PUSH_TOKEN_ID, updateData[0].id);
            } else {
              // Fallback: query for token ID
              try {
                const { data: retrieveData } = await supabase
                  .from('user_push_tokens')
                  .select('id')
                  .eq('token', token)
                  .single();
                
                if (retrieveData?.id) {
                  await SecureStore.setItemAsync(STORAGE_KEYS.PUSH_TOKEN_ID, retrieveData.id);
                }
              } catch (e) {
                this.productionLog('WARN', `${methodName}: Could not retrieve token ID after update`, e);
              }
            }
          } else {
            lastError = updateError;
            this.productionLog('ERROR', `${methodName}: Update failed`, updateError);
          }
          
        } catch (updateException) {
          lastError = updateException;
          this.productionLog('ERROR', `${methodName}: Exception during update`, updateException);
        }
      }
      
      // Strategy 3: Upsert as last resort
      if (!registrationSuccess) {
        try {
          this.productionLog('INFO', `${methodName}: Attempting upsert as last resort`);
          
          const upsertPayload = {
            user_id: userId,
            token: token,
            device_type: Platform.OS,
            last_updated: new Date().toISOString(),
            signed_in: true,
            active: true
          };
          
          const { data: upsertData, error: upsertError } = await this.timeoutPromiseWithRetry(
            () => supabase
              .from('user_push_tokens')
              .upsert(upsertPayload, {
                onConflict: 'token',
                ignoreDuplicates: false
              })
              .select('id'),
            CONFIG.DB_TIMEOUT,
            `${methodName}_upsert`,
            3
          );
          
          if (!upsertError && upsertData && upsertData.length > 0) {
            this.productionLog('INFO', `${methodName}: Upsert successful`, { tokenId: upsertData[0].id });
            await SecureStore.setItemAsync(STORAGE_KEYS.PUSH_TOKEN_ID, upsertData[0].id);
            registrationSuccess = true;
          } else {
            lastError = upsertError;
            this.productionLog('ERROR', `${methodName}: Upsert failed`, upsertError);
          }
          
        } catch (upsertException) {
          lastError = upsertException;
          this.productionLog('ERROR', `${methodName}: Exception during upsert`, upsertException);
        }
      }
      
      // Final verification
      if (registrationSuccess) {
        this.productionLog('INFO', `${methodName}: Registration successful, performing verification`);
        
        // Quick verification
        try {
          const { data: verifyData, error: verifyError } = await supabase
            .from('user_push_tokens')
            .select('id, active, signed_in')
            .eq('user_id', userId)
            .eq('token', token)
            .single();
          
          if (!verifyError && verifyData) {
            this.productionLog('INFO', `${methodName}: Final verification successful`, verifyData);
          } else {
            this.productionLog('WARN', `${methodName}: Final verification failed but registration reported success`, verifyError);
          }
        } catch (e) {
          this.productionLog('WARN', `${methodName}: Could not perform final verification`, e);
        }
        
        return true;
      } else {
        this.productionLog('ERROR', `${methodName}: All registration strategies failed`, { lastError });
        return false;
      }
      
    } catch (outerError) {
      this.productionLog('ERROR', `${methodName}: Critical error in token registration`, outerError);
      return false;
    }
  }

  // PRODUCTION-HARDENED MAIN REGISTRATION METHOD
  static async registerForPushNotificationsAsync(userId: string, forceRefresh = false): Promise<string | null> {
    const methodName = 'registerForPushNotificationsAsync';
    
    if (!Device.isDevice && !CONFIG.FORCE_REGISTER_DEV) {
      this.productionLog('WARN', `${methodName}: Not a device, skipping registration`);
      return null;
    }

    if (isSigningOut) {
      this.productionLog('WARN', `${methodName}: User signing out, skipping registration`);
      return null;
    }

    this.productionLog('INFO', `${methodName}: Starting registration`, { userId, forceRefresh, platform: Platform.OS });

    try {
      // Permission handling with retries
      let permissionStatus = null;
      let permissionAttempts = 0;
      const maxPermissionAttempts = 3;
      
      while (!permissionStatus && permissionAttempts < maxPermissionAttempts) {
        permissionAttempts++;
        
        try {
          this.productionLog('INFO', `${methodName}: Permission attempt ${permissionAttempts}`);
          
          const { status: existingStatus } = await Notifications.getPermissionsAsync();
          this.productionLog('INFO', `${methodName}: Current permission status: ${existingStatus}`);

          if (existingStatus !== 'granted') {
            this.productionLog('INFO', `${methodName}: Requesting permissions`);
            const { status } = await Notifications.requestPermissionsAsync();
            permissionStatus = status;
            this.productionLog('INFO', `${methodName}: Permission request result: ${status}`);
          } else {
            permissionStatus = existingStatus;
          }
          
        } catch (permError) {
          this.productionLog('ERROR', `${methodName}: Permission attempt ${permissionAttempts} failed`, permError);
          if (permissionAttempts >= maxPermissionAttempts) {
            throw permError;
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (permissionStatus !== 'granted') {
        this.productionLog('ERROR', `${methodName}: Permission denied after ${permissionAttempts} attempts`);
        return null;
      }

      // Android channel setup with retries
      if (Platform.OS === 'android') {
        try {
          this.productionLog('INFO', `${methodName}: Setting up Android notification channel`);
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#D55004',
            sound: 'notification.wav',
            enableVibrate: true,
            enableLights: true
          });
          this.productionLog('INFO', `${methodName}: Android channel setup complete`);
        } catch (channelError) {
          this.productionLog('WARN', `${methodName}: Android channel setup failed (continuing)`, channelError);
        }
      }

      // Check existing token if not forcing refresh
      if (!forceRefresh) {
        try {
          this.productionLog('INFO', `${methodName}: Checking existing token`);
          const verification = await this.forceTokenVerification(userId);
          
          if (verification.isValid && verification.token) {
            this.productionLog('INFO', `${methodName}: Valid token found, using existing`, {
              hasTokenId: !!verification.tokenId,
              signedIn: verification.signedIn
            });
            
            await this.saveTokenToStorage(verification.token, verification.tokenId);
            
            if (verification.signedIn === false) {
              this.productionLog('INFO', `${methodName}: Updating existing token to signed_in=true`);
              await this.updateTokenStatus(userId, verification.token, { signed_in: true });
            }
            
            return verification.token;
          }
        } catch (verifyError) {
          this.productionLog('WARN', `${methodName}: Token verification failed, proceeding with fresh registration`, verifyError);
        }
      }

      // Get project ID with comprehensive logging
      const projectId = this.getProjectId();
      this.productionLog('INFO', `${methodName}: Using project ID for token request: ${projectId}`);
      
      // Token acquisition with multiple attempts
      let tokenResponse = null;
      let tokenError = null;
      const maxTokenAttempts = 5;
      
      for (let attempt = 1; attempt <= maxTokenAttempts; attempt++) {
        try {
          this.productionLog('INFO', `${methodName}: Token acquisition attempt ${attempt}/${maxTokenAttempts}`);
          
          tokenResponse = await this.timeoutPromise(
            Notifications.getExpoPushTokenAsync({ projectId }),
            20000, // 20 seconds timeout
            `${methodName}_getToken_attempt${attempt}`
          );
          
          if (tokenResponse?.data) {
            this.productionLog('INFO', `${methodName}: Token acquired successfully on attempt ${attempt}`, {
              tokenPreview: tokenResponse.data.substring(0, 30) + '...'
            });
            break;
          } else {
            this.productionLog('WARN', `${methodName}: No token data in response on attempt ${attempt}`, tokenResponse);
          }
          
        } catch (error) {
          tokenError = error;
          this.productionLog('ERROR', `${methodName}: Token acquisition attempt ${attempt} failed`, error);
          
          if (attempt < maxTokenAttempts) {
            const delay = 2000 * attempt;
            this.productionLog('INFO', `${methodName}: Waiting ${delay}ms before retry`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      if (!tokenResponse?.data) {
        this.productionLog('ERROR', `${methodName}: Failed to acquire token after ${maxTokenAttempts} attempts`, tokenError);
        throw new Error(`Token acquisition failed: ${tokenError?.message || 'Unknown error'}`);
      }

      const token = tokenResponse.data;
      
      if (!this.isValidExpoToken(token)) {
        this.productionLog('ERROR', `${methodName}: Invalid token format received`, { tokenPreview: token.substring(0, 50) });
        throw new Error(`Invalid token format: ${token}`);
      }

      // Save token immediately
      await this.saveTokenToStorage(token);
      this.productionLog('INFO', `${methodName}: Token saved to local storage`);
      
      // Database registration with multiple strategies
      let registrationSuccess = false;
      let registrationAttempts = 0;
      const maxRegistrationAttempts = CONFIG.MAX_REGISTRATION_ATTEMPTS;
      
      while (!registrationSuccess && registrationAttempts < maxRegistrationAttempts) {
        registrationAttempts++;
        
        try {
          this.productionLog('INFO', `${methodName}: Database registration attempt ${registrationAttempts}/${maxRegistrationAttempts}`);
          
          registrationSuccess = await this.ensureValidTokenRegistration(userId, token);
          
          if (registrationSuccess) {
            this.productionLog('INFO', `${methodName}: Database registration successful on attempt ${registrationAttempts}`);
          } else {
            this.productionLog('WARN', `${methodName}: Database registration failed on attempt ${registrationAttempts}`);
            
            if (registrationAttempts < maxRegistrationAttempts) {
              const delay = Math.min(5000 * registrationAttempts, CONFIG.EMERGENCY_RETRY_DELAY);
              this.productionLog('INFO', `${methodName}: Waiting ${delay}ms before registration retry`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
          
        } catch (regError) {
          this.productionLog('ERROR', `${methodName}: Registration attempt ${registrationAttempts} exception`, regError);
          
          if (registrationAttempts < maxRegistrationAttempts) {
            const delay = Math.min(5000 * registrationAttempts, CONFIG.EMERGENCY_RETRY_DELAY);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      if (registrationSuccess) {
        this.productionLog('INFO', `${methodName}: Complete success - token acquired and registered`);
        return token;
      } else {
        this.productionLog('ERROR', `${methodName}: Registration failed after ${registrationAttempts} attempts, but token was acquired`);
        // Return token anyway since we have it locally
        return token;
      }
      
    } catch (error) {
      this.productionLog('ERROR', `${methodName}: Critical error in registration process`, error);
      return null;
    }
  }

  // EXISTING METHODS WITH ENHANCED LOGGING
  
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
        productionLogs: [],
        configuration: {
          debugMode: CONFIG.DEBUG_MODE,
          tokenRefreshInterval: CONFIG.TOKEN_REFRESH_INTERVAL,
          dbTimeout: CONFIG.DB_TIMEOUT,
          maxRetries: CONFIG.MAX_RETRIES,
          productionProjectId: CONFIG.PRODUCTION_PROJECT_ID
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

      // Get production logs
      try {
        const prodLogs = await SecureStore.getItemAsync(STORAGE_KEYS.PRODUCTION_LOGS);
        if (prodLogs) {
          diagnostics.productionLogs = JSON.parse(prodLogs);
        }
      } catch (e) {
        diagnostics.productionLogs = [{ error: 'Failed to parse production logs' }];
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

  // NEW METHOD: Emergency token registration for production
  static async emergencyTokenRegistration(userId: string): Promise<boolean> {
    const methodName = 'emergencyTokenRegistration';
    
    try {
      this.productionLog('INFO', `${methodName}: Starting emergency registration for user ${userId}`);
      
      // Clear all existing state
      await Promise.all([
        SecureStore.deleteItemAsync(STORAGE_KEYS.PUSH_TOKEN),
        SecureStore.deleteItemAsync(STORAGE_KEYS.PUSH_TOKEN_TIMESTAMP),
        SecureStore.deleteItemAsync(STORAGE_KEYS.PUSH_TOKEN_ID)
      ]);
      
      // Force a completely fresh registration
      const token = await this.registerForPushNotificationsAsync(userId, true);
      
      if (token) {
        this.productionLog('INFO', `${methodName}: Emergency registration successful`);
        return true;
      } else {
        this.productionLog('ERROR', `${methodName}: Emergency registration failed`);
        return false;
      }
      
    } catch (error) {
      this.productionLog('ERROR', `${methodName}: Exception during emergency registration`, error);
      return false;
    }
  }

  // NEW METHOD: Get production logs for debugging
  static async getProductionLogs(): Promise<any[]> {
    try {
      const logs = await SecureStore.getItemAsync(STORAGE_KEYS.PRODUCTION_LOGS);
      return logs ? JSON.parse(logs) : [];
    } catch (error) {
      console.error('Failed to get production logs:', error);
      return [];
    }
  }

  // NEW METHOD: Clear production logs
  static async clearProductionLogs(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEYS.PRODUCTION_LOGS);
    } catch (error) {
      console.error('Failed to clear production logs:', error);
    }
  }
}