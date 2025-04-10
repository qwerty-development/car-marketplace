import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, AppState } from 'react-native';
import { supabase } from '@/utils/supabase';
import { isSigningOut } from '../app/(home)/_layout';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
     shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type NotificationType =
  | 'car_like'
  | 'price_drop'
  | 'new_message'
  | 'subscription'
  | 'car_sold'
  | 'view_milestone'
  | 'autoclip_like'
  | 'daily_reminder';

interface NotificationData {
  screen?: string;
  params?: Record<string, any>;
  type?: NotificationType;
  metadata?: Record<string, any>;
  notificationId?: string;
}

// Storage keys
const PUSH_TOKEN_STORAGE_KEY = 'expoPushToken';
const PUSH_TOKEN_TIMESTAMP_KEY = 'expoPushTokenTimestamp';
const PUSH_TOKEN_REGISTRATION_ATTEMPTS = 'pushTokenRegistrationAttempts';

// Constants
const DB_OPERATION_TIMEOUT = 5000; // 15 seconds
const MAX_RETRIES = 5;
const TOKEN_REFRESH_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days
const FORCE_REGISTER_DEV = true; // Force registration in development
const DEBUG_MODE = __DEV__ || true; // Enable debug mode in dev and initially in prod

export class NotificationService {
  private static debugLog(message: string, data?: any): void {
    if (DEBUG_MODE) {
      const timestamp = new Date().toISOString();
      const logPrefix = `[NotificationService ${timestamp}]`;

      if (data) {
        console.log(`${logPrefix} ${message}`, data);
      } else {
        console.log(`${logPrefix} ${message}`);
      }
    }
  }

  private static async recordError(context: string, error: any): Promise<void> {
    try {
      this.debugLog(`ERROR in ${context}:`, error);

      // Save error to secure storage for diagnostics
      const errorLog = await SecureStore.getItemAsync('notificationErrors') || '[]';
      const errors = JSON.parse(errorLog);

      errors.push({
        timestamp: new Date().toISOString(),
        context,
        error: error?.message || String(error),
        stack: error?.stack
      });

      // Keep last 10 errors only
      if (errors.length > 10) {
        errors.shift();
      }

      await SecureStore.setItemAsync('notificationErrors', JSON.stringify(errors));
    } catch (e) {
      console.error('Failed to record error:', e);
    }
  }


private static getProjectId(): string {
  const envProjectId = process.env.EXPO_PUBLIC_PROJECT_ID;
  if (envProjectId) {
    console.log('Using project ID from environment:', envProjectId);
    return envProjectId;
  }

  try {
    // 2.1 Try the dedicated easConfig property (new in more recent versions)
    const easConfigProjectId = Constants?.easConfig?.projectId;
    if (easConfigProjectId) {
      console.log('Using project ID from Constants.easConfig:', easConfigProjectId);
      return easConfigProjectId;
    }

    // 2.2 Access manifest/expoConfig object with fallback
    const expoConstants = Constants.expoConfig || Constants.manifest;
    if (expoConstants) {
      // 2.3 Check extra.eas.projectId (common in newer EAS builds)
      const easProjectId = expoConstants.extra?.eas?.projectId;
      if (easProjectId) {
        console.log('Using project ID from Constants.expoConfig.extra.eas:', easProjectId);
        return easProjectId;
      }

      // 2.4 Check extra.projectId (common in app.json/app.config.js configuration)
      const extraProjectId = expoConstants.extra?.projectId;
      if (extraProjectId) {
        console.log('Using project ID from Constants.expoConfig.extra:', extraProjectId);
        return extraProjectId;
      }

      // 2.5 Check direct projectId property
      const directProjectId = expoConstants.projectId;
      if (directProjectId) {
        console.log('Using project ID from Constants.expoConfig.projectId:', directProjectId);
        return directProjectId;
      }
    }
  } catch (error) {
    console.error('Error accessing Constants for project ID:', error);
  }

  // 3. Last resort - use hardcoded project ID from eas.json
  // This should match the projectId in eas.json
  const hardcodedProjectId = 'aaf80aae-b9fd-4c39-a48a-79f2eac06e68';
  console.warn('Using HARDCODED project ID as fallback. This is not recommended for production.');
  return hardcodedProjectId;
}

  // Create timeout promise to prevent hanging operations
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

private static isValidPushToken(token: string): boolean {
  if (!token) return false;

  // Expo push tokens follow a specific format
  const validExpoTokenFormat = /^ExponentPushToken\[.+\]$/;
  const isExpoToken = validExpoTokenFormat.test(token);

  // APNs tokens are hex strings of a specific length
  const isApnsToken = /^[a-f0-9]{64}$/.test(token);

  // FCM tokens are typically longer alphanumeric strings
  const isFcmToken = /^[a-zA-Z0-9\-_:]{140,250}$/.test(token);

  // Log token type for diagnostics
  if (isExpoToken) {
    this.debugLog('Token validated as Expo Push Token format');
  } else if (isApnsToken) {
    this.debugLog('WARNING: Detected raw APNs token format - may not work with Expo Push Service');
  } else if (isFcmToken) {
    this.debugLog('WARNING: Detected FCM token format - may not work with Expo Push Service');
  } else {
    this.debugLog(`Invalid token format: ${token.substring(0, 10)}...`);
  }

  return isExpoToken || isApnsToken || isFcmToken;
}

private static async migrateToExpoToken(oldToken: string, userId: string): Promise<string | null> {
  this.debugLog(`Migrating non-Expo token to Expo format: ${oldToken.substring(0, 5)}...`);

  try {
    // 1. Delete the old token from database
    await this.timeoutPromise(
      supabase
        .from('user_push_tokens')
        .delete()
        .eq('token', oldToken),
      10000,
      'deleteOldToken'
    );

    // 2. Clear token from secure storage
    await SecureStore.deleteItemAsync(PUSH_TOKEN_STORAGE_KEY);
    await SecureStore.deleteItemAsync(PUSH_TOKEN_TIMESTAMP_KEY);

    // 3. Force new Expo token registration
    const projectId = this.getProjectId();

    const tokenResponse = await this.timeoutPromise(
      Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      }),
      15000,
      'getNewExpoPushToken'
    );

    const newToken = tokenResponse.data;

    // Verify we got a proper Expo token
    const validExpoTokenFormat = /^ExponentPushToken\[.+\]$/;
    if (!validExpoTokenFormat.test(newToken)) {
      throw new Error(`Received invalid Expo token format: ${newToken.substring(0, 10)}...`);
    }

    // 4. Save the new token
    await this.saveTokenToStorage(newToken);

    // 5. Register in database
    const success = await this.updatePushToken(newToken, userId);

    if (success) {
      this.debugLog('Successfully migrated to Expo token format');
      return newToken;
    } else {
      this.debugLog('Database registration of migrated token failed');
      return newToken; // Still return token as it might work for push
    }
  } catch (error) {
    this.recordError('migrateToExpoToken', error);
    return null;
  }
}

  // Check if token needs refresh (older than 7 days)
  private static async tokenNeedsRefresh(): Promise<boolean> {
    try {
      const timestampStr = await SecureStore.getItemAsync(PUSH_TOKEN_TIMESTAMP_KEY);
      if (!timestampStr) return true;

      const timestamp = parseInt(timestampStr, 10);
      const now = Date.now();

      return (now - timestamp) > TOKEN_REFRESH_INTERVAL;
    } catch (error) {
      this.recordError('tokenNeedsRefresh', error);
      return true; // Refresh on error
    }
  }

  // Save token with timestamp
  private static async saveTokenToStorage(token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(PUSH_TOKEN_STORAGE_KEY, token);
      await SecureStore.setItemAsync(PUSH_TOKEN_TIMESTAMP_KEY, Date.now().toString());
      this.debugLog('Token saved to secure storage');
    } catch (error) {
      this.recordError('saveTokenToStorage', error);
      throw error; // Re-throw as this is critical
    }
  }

static async registerForPushNotificationsAsync(userId: string, forceRefresh = false): Promise<string | null> {
  // Skip for dev/simulator unless forced
  if (!Device.isDevice && !FORCE_REGISTER_DEV) {
    this.debugLog('Push notifications not available on simulator/emulator');
    return null;
  }

  // Skip during sign-out
  if (isSigningOut) {
    this.debugLog('User is signing out, skipping token registration');
    return null;
  }

  this.debugLog(`Starting push notification registration for user: ${userId}`);
  const startTime = Date.now();

  try {
    // 1. OPTIMIZATION: Check for existing valid token first
    if (!forceRefresh) {
      const existingToken = await SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY);
      const needsRefresh = await this.tokenNeedsRefresh();

      // Add specific check for Expo token format
      const validExpoTokenFormat = /^ExponentPushToken\[.+\]$/;
      const isExpoToken = existingToken && validExpoTokenFormat.test(existingToken);

      if (existingToken && this.isValidPushToken(existingToken) && !needsRefresh) {
        // Only use existing token if it's in Expo format
        if (isExpoToken) {
          this.debugLog('Using existing valid Expo token:', existingToken);

          // Verify token exists in database without blocking main flow
          this.verifyTokenInDatabase(existingToken, userId).catch(error => {
            this.recordError('verifyTokenInDatabase', error);
          });

          return existingToken;
        } else {
          this.debugLog('Stored token is not in Expo format, forcing refresh');
          forceRefresh = true;
        }
      }
    }

    // 2. PERMISSIONS: Check and request with better error handling
    let permissionStatus;
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      this.debugLog('Existing notification permission status:', existingStatus);

      if (existingStatus !== 'granted') {
        this.debugLog('Requesting notification permissions...');
        const { status } = await Notifications.requestPermissionsAsync();
        permissionStatus = status;
        this.debugLog('New permission status:', permissionStatus);
      } else {
        permissionStatus = existingStatus;
      }
    } catch (permError) {
      this.recordError('checkPermissions', permError);
      return null;
    }

    if (permissionStatus !== 'granted') {
      this.debugLog('Push notification permission not granted');
      return null;
    }

    // 3. ANDROID CHANNEL: Set up Android notification channel
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#D55004',
          sound: 'notification.wav',
        });
        this.debugLog('Android notification channel set up successfully');
      } catch (channelError) {
        this.recordError('setupAndroidChannel', channelError);
        // Continue - non-fatal error
      }
    }

    // 4. TOKEN GENERATION: Get project ID with fallback mechanisms
    const projectId = this.getProjectId();
    this.debugLog('Using project ID for push notifications:', projectId);

    // 5. Get push token with error handling
    let token: string | null = null;
    let tokenError: any = null;

    try {
      this.debugLog('Getting Expo push token...');
      const tokenResponse = await this.timeoutPromise(
        Notifications.getExpoPushTokenAsync({
          projectId: projectId,
        }),
        15000, // 15 second timeout
        'getExpoPushTokenAsync'
      );

      token = tokenResponse.data;

      // Enhanced token format validation
      const validExpoTokenFormat = /^ExponentPushToken\[.+\]$/;
      if (!validExpoTokenFormat.test(token)) {
        this.debugLog(`WARNING: Received token is not in Expo format: ${token?.substring(0, 10)}...`);

        // Attempt to recover proper Expo token format
        this.debugLog('Attempting to recover proper Expo token format...');
        const recoveryResponse = await this.timeoutPromise(
          Notifications.getExpoPushTokenAsync({
            projectId: projectId,
          }),
          15000,
          'getExpoPushTokenRecovery'
        );

        const recoveredToken = recoveryResponse.data;
        if (validExpoTokenFormat.test(recoveredToken)) {
          this.debugLog('Successfully recovered proper Expo token format');
          token = recoveredToken;
        } else {
          throw new Error(`Unable to obtain token in Expo format, received: ${token?.substring(0, 10)}...`);
        }
      }

      this.debugLog('Successfully received push token in Expo format');

      // Immediately save token to SecureStore for resilience
      await this.saveTokenToStorage(token);
    } catch (error) {
      tokenError = error;
      this.recordError('getExpoPushToken', error);

      // Try to recover token from storage as fallback
      try {
        const storedToken = await SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY);
        const validExpoTokenFormat = /^ExponentPushToken\[.+\]$/;
        if (storedToken && validExpoTokenFormat.test(storedToken)) {
          this.debugLog('Using previously stored Expo token as fallback:', storedToken);
          token = storedToken;
        } else if (storedToken && this.isValidPushToken(storedToken)) {
          this.debugLog('WARNING: Stored token is not in Expo format, token may not work properly');
          // Still use it as a last resort, but log the warning
          token = storedToken;
        }
      } catch (storageError) {
        this.recordError('getStoredToken', storageError);
      }
    }

    if (!token) {
      this.debugLog('Failed to get push token');
      return null;
    }

    // 6. STORE TOKEN: Register in database with enhanced retry logic
    let registered = false;
    const maxAttempts = MAX_RETRIES;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.debugLog(`Token database registration attempt ${attempt}/${maxAttempts}`);

        // Use timeout to prevent hanging
        registered = await this.timeoutPromise(
          this.updatePushToken(token, userId),
          DB_OPERATION_TIMEOUT,
          `updatePushToken-attempt-${attempt}`
        );

        if (registered) {
          this.debugLog('Successfully registered token in database');

          // Record successful registration
          try {
            await SecureStore.deleteItemAsync(PUSH_TOKEN_REGISTRATION_ATTEMPTS);
          } catch (e) {
            // Non-critical error
          }

          break;
        }
      } catch (dbError) {
        this.recordError(`tokenRegistration-attempt-${attempt}`, dbError);

        if (attempt === maxAttempts) {
          // Last attempt failed - will return token anyway but log the issue
          this.debugLog('All database registration attempts failed');

          // Record for future diagnostics
          try {
            await SecureStore.setItemAsync(
              PUSH_TOKEN_REGISTRATION_ATTEMPTS,
              JSON.stringify({
                attempts: maxAttempts,
                lastError: dbError?.message || String(dbError),
                timestamp: new Date().toISOString()
              })
            );
          } catch (e) {
            // Non-critical error
          }
        } else {
          // Exponential backoff with jitter for retries
          const delay = Math.min(1000 * Math.pow(2, attempt), 8000) + Math.random() * 1000;
          this.debugLog(`Retrying after ${Math.round(delay)}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // 7. PERFORMANCE LOGGING: Log completion time
    const duration = Date.now() - startTime;
    this.debugLog(`Token registration completed in ${duration}ms, database registered: ${registered}`);

    // Even if database registration fails, return the token
    // This allows notifications to work even if database operation fails
    return token;
  } catch (error) {
    this.recordError('registerForPushNotificationsAsync', error);
    return null;
  }
}

  // Verify token exists in database and add if missing
private static async verifyTokenInDatabase(token: string, userId: string): Promise<boolean> {
  try {
    // Skip if signing out
    if (isSigningOut) return false;

    this.debugLog(`Verifying token in database for user ${userId}`);

    // Check if it's an Expo token format
    const validExpoTokenFormat = /^ExponentPushToken\[.+\]$/;
    if (!validExpoTokenFormat.test(token)) {
      this.debugLog('Non-Expo token format detected during verification, triggering migration');
      const newToken = await this.migrateToExpoToken(token, userId);
      if (newToken) {
        return true; // Migration successful
      }
      // Continue with verification if migration fails
    }

    // Check if token exists in database
    const { data, error } = await this.timeoutPromise(
      supabase
        .from('user_push_tokens')
        .select('token')
        .eq('user_id', userId)
        .eq('token', token)
        .single(),
      10000,
      'verifyTokenQuery'
    );

    // Token not in database, add it
    if (error || !data) {
      this.debugLog('Token not found in database, adding it');
      return await this.updatePushToken(token, userId);
    }

    // Token exists, update timestamp
    this.debugLog('Token verified in database, updating timestamp');
    const { error: updateError } = await this.timeoutPromise(
      supabase
        .from('user_push_tokens')
        .update({ last_updated: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('token', token),
      10000,
      'tokenTimestampUpdate'
    );

    if (updateError) {
      this.recordError('updateTokenTimestamp', updateError);
    }

    return true;
  } catch (error) {
    this.recordError('verifyTokenInDatabase', error);
    return false;
  }
}

  // Update push token in database with improved error handling
  static async updatePushToken(token: string, userId: string): Promise<boolean> {
    if (!token || !userId) {
      this.debugLog('Invalid token or userId for updatePushToken');
      return false;
    }

    if (!this.isValidPushToken(token)) {
      this.debugLog(`Invalid token format: ${token.substring(0, 10)}...`);
      return false;
    }

    if (isSigningOut) {
      this.debugLog('User is signing out, skipping token update');
      return false;
    }

    this.debugLog(`Updating token for user ${userId}`);

    try {
      // Try to ensure user exists first for enhanced reliability
      try {
        const { data: userData, error: userError } = await this.timeoutPromise(
          supabase
            .from('users')
            .select('id')
            .eq('id', userId)
            .single(),
          10000,
          'checkUserExists'
        );

        if (userError || !userData) {
          this.debugLog('User not found in database, token registration will fail');
          return false;
        }
      } catch (userCheckError) {
        this.recordError('checkUserExists', userCheckError);
        // Continue anyway - user might exist
      }

      // Step 1: Try to delete any duplicate tokens for this user
      try {
        await this.timeoutPromise(
          supabase
            .from('user_push_tokens')
            .delete()
            .eq('token', token),
          10000,
          'deleteExistingToken'
        );

        this.debugLog('Cleaned up any existing token records');
      } catch (cleanupError) {
        this.recordError('cleanupExistingTokens', cleanupError);
        // Continue anyway - not critical
      }

      // Step 2: Insert new token with retry
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const { error } = await this.timeoutPromise(
            supabase
              .from('user_push_tokens')
              .insert({
                user_id: userId,
                token,
                device_type: Platform.OS,
                last_updated: new Date().toISOString()
              }),
            10000,
            `insertNewToken-attempt-${attempt}`
          );

          if (!error) {
            this.debugLog('Push token successfully inserted in database');
            return true;
          }

          // If insert fails with foreign key error or duplicate
          if (error.code === '23503' || error.code === '23505') {
            // Try upsert as fallback
            this.debugLog('Insert failed, trying upsert...');
            const { error: upsertError } = await this.timeoutPromise(
              supabase
                .from('user_push_tokens')
                .upsert({
                  user_id: userId,
                  token,
                  device_type: Platform.OS,
                  last_updated: new Date().toISOString()
                }, {
                  onConflict: 'token',
                }),
              10000,
              'upsertTokenFallback'
            );

            if (!upsertError) {
              this.debugLog('Push token successfully upserted in database');
              return true;
            }

            this.recordError('upsertTokenFallback', upsertError);
          } else {
            this.recordError(`insertToken-attempt-${attempt}`, error);
          }

          // If not the last attempt, wait before retrying
          if (attempt < 3) {
            const delay = 1000 * Math.pow(2, attempt);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        } catch (insertError) {
          this.recordError(`insertToken-attempt-${attempt}`, insertError);

          // If not the last attempt, wait before retrying
          if (attempt < 3) {
            const delay = 1000 * Math.pow(2, attempt);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      // All attempts failed, last resort: try raw SQL insert
      try {
        const { error: rawError } = await this.timeoutPromise(
          supabase.rpc('force_insert_token', {
            p_user_id: userId,
            p_token: token,
            p_device_type: Platform.OS
          }),
          10000,
          'forceInsertTokenRPC'
        );

        if (!rawError) {
          this.debugLog('Push token successfully inserted using RPC');
          return true;
        }

        this.recordError('forceInsertTokenRPC', rawError);
      } catch (rpcError) {
        this.recordError('forceInsertTokenRPC', rpcError);
      }

      return false;
    } catch (error) {
      this.recordError('updatePushToken', error);
      return false;
    }
  }

  // Handle notification response (when user taps notification)
  static async handleNotificationResponse(response: Notifications.NotificationResponse) {
    try {
      this.debugLog('Handling notification response:', response.notification.request.identifier);

      const data = response.notification.request.content.data as NotificationData;
      this.debugLog('Notification data:', data);

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

  // Badge management
  static async getBadgeCount() {
    try {
      return await Notifications.getBadgeCountAsync();
    } catch (error) {
      this.recordError('getBadgeCount', error);
      return 0;
    }
  }

  static async setBadgeCount(count: number) {
    try {
      await Notifications.setBadgeCountAsync(count);
      return true;
    } catch (error) {
      this.recordError('setBadgeCount', error);
      return false;
    }
  }

  // Permissions management
  static async getPermissions() {
    try {
      const permissions = await Notifications.getPermissionsAsync();
      this.debugLog('Current notification permissions:', permissions);
      return permissions;
    } catch (error) {
      this.recordError('getPermissions', error);
      return null;
    }
  }

  static async requestPermissions() {
    try {
      this.debugLog('Requesting notification permissions...');
      const permissions = await Notifications.requestPermissionsAsync();
      this.debugLog('Permission request result:', permissions);
      return permissions;
    } catch (error) {
      this.recordError('requestPermissions', error);
      return null;
    }
  }

  // Notification management
  static async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      return true;
    } catch (error) {
      this.recordError('cancelAllNotifications', error);
      return false;
    }
  }

  // Fetch notifications
  static async fetchNotifications(userId: string, { page = 1, limit = 20 } = {}) {
    try {
      const { data, error, count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

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

  // Mark notifications as read
  static async markAsRead(notificationId: string) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
      return true;
    } catch (error) {
      this.recordError('markAsRead', error);
      return false;
    }
  }

  // Mark all notifications as read
  static async markAllAsRead(userId: string) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
      return true;
    } catch (error) {
      this.recordError('markAllAsRead', error);
      return false;
    }
  }

  // Delete notification
  static async deleteNotification(notificationId: string) {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
      return true;
    } catch (error) {
      this.recordError('deleteNotification', error);
      return false;
    }
  }

  // Get unread count
  static async getUnreadCount(userId: string) {
    try {
      const { data, error, count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      this.recordError('getUnreadCount', error);
      return 0;
    }
  }

  // Improved cleanup function with robust error handling
  static async cleanupPushToken(userId?: string) {
    this.debugLog('Starting push token cleanup process');

    try {
      // Get token from secure storage
      const token = await SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY);

      if (!token) {
        this.debugLog('No push token found in storage, nothing to clean up');
        return true;
      }

      this.debugLog('Found push token to clean up');

      // Delete from Supabase with retry logic
      let success = false;
      const maxRetries = 3;

      for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
        try {
          let query = supabase.from('user_push_tokens').delete();

          // If userId is provided, use it to narrow the deletion
          if (userId) {
            query = query.eq('user_id', userId);
          }

          // Always filter by token to ensure we're deleting the correct record
          const { error } = await this.timeoutPromise(
            query.eq('token', token),
            10000,
            `deleteToken-attempt-${retryCount + 1}`
          );

          if (error) {
            this.recordError(`deleteToken-attempt-${retryCount + 1}`, error);

            if (retryCount < maxRetries - 1) {
              // Exponential backoff with jitter
              const delay = Math.pow(2, retryCount + 1) * 500 + Math.random() * 200;
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          } else {
            success = true;
            this.debugLog('Successfully removed push token from database');
            break;
          }
        } catch (error) {
          this.recordError(`deleteToken-attempt-${retryCount + 1}`, error);

          if (retryCount < maxRetries - 1) {
            // Exponential backoff with jitter
            const delay = Math.pow(2, retryCount + 1) * 500 + Math.random() * 200;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      // Always remove from secure storage regardless of database success
      await SecureStore.deleteItemAsync(PUSH_TOKEN_STORAGE_KEY);
      await SecureStore.deleteItemAsync(PUSH_TOKEN_TIMESTAMP_KEY);
      await SecureStore.deleteItemAsync(PUSH_TOKEN_REGISTRATION_ATTEMPTS);
      this.debugLog('Removed push token from secure storage');

      return true;
    } catch (error) {
      this.recordError('cleanupPushToken', error);

      // Attempt to clean local storage even if the rest failed
      try {
        await SecureStore.deleteItemAsync(PUSH_TOKEN_STORAGE_KEY);
        await SecureStore.deleteItemAsync(PUSH_TOKEN_TIMESTAMP_KEY);
        await SecureStore.deleteItemAsync(PUSH_TOKEN_REGISTRATION_ATTEMPTS);
      } catch (storageError) {
        this.recordError('cleanupTokenStorage', storageError);
      }

      return false;
    }
  }

  // Get diagnostic information for debugging
  static async getDiagnostics(): Promise<any> {
    try {
      const diagnostics: Record<string, any> = {
        timestamp: new Date().toISOString(),
        device: {
          platform: Platform.OS,
          version: Platform.Version,
          isDevice: Device.isDevice,
          brand: Device.brand,
          modelName: Device.modelName
        },
        tokens: {
          hasStoredToken: false,
          tokenAge: null,
          tokenFormat: null
        },
        permissions: null,
        errors: []
      };

      // Get token information
      const token = await SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY);
      const timestamp = await SecureStore.getItemAsync(PUSH_TOKEN_TIMESTAMP_KEY);
      const attempts = await SecureStore.getItemAsync(PUSH_TOKEN_REGISTRATION_ATTEMPTS);

      if (token) {
        diagnostics.tokens.hasStoredToken = true;
        diagnostics.tokens.tokenFormat = this.isValidPushToken(token);
        diagnostics.tokens.tokenPreview = token.substring(0, 5) + '...' + token.substring(token.length - 5);
      }

      if (timestamp) {
        const tokenDate = new Date(parseInt(timestamp, 10));
        diagnostics.tokens.tokenAge = Math.floor((Date.now() - parseInt(timestamp, 10)) / (1000 * 60 * 60 * 24));
        diagnostics.tokens.tokenTimestamp = tokenDate.toISOString();
      }

      if (attempts) {
        try {
          diagnostics.tokens.registrationAttempts = JSON.parse(attempts);
        } catch (e) {
          diagnostics.tokens.registrationAttempts = attempts;
        }
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
        const errorLogs = await SecureStore.getItemAsync('notificationErrors');
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
}