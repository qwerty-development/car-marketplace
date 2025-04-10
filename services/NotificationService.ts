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
const PUSH_TOKEN_ID_KEY = 'expoPushTokenId';

// Constants
const TOKEN_REFRESH_INTERVAL = 30 * 24 * 60 * 60 * 1000; // 30 days
const FORCE_REGISTER_DEV = true; // Force registration in development
const DEBUG_MODE = __DEV__ || true; // Enable debug mode in dev and initially in prod
const DB_TIMEOUT = 10000; // 10 seconds for database operations

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
      return envProjectId;
    }

    try {
      // Try the dedicated easConfig property
      const easConfigProjectId = Constants?.easConfig?.projectId;
      if (easConfigProjectId) {
        return easConfigProjectId;
      }

      // Access manifest/expoConfig object with fallback
      const expoConstants = Constants.expoConfig || Constants.manifest;
      if (expoConstants) {
        // Check extra.eas.projectId
        const easProjectId = expoConstants.extra?.eas?.projectId;
        if (easProjectId) {
          return easProjectId;
        }

        // Check extra.projectId
        const extraProjectId = expoConstants.extra?.projectId;
        if (extraProjectId) {
          return extraProjectId;
        }

        // Check direct projectId property
        const directProjectId = expoConstants.projectId;
        if (directProjectId) {
          return directProjectId;
        }
      }
    } catch (error) {
      console.error('Error accessing Constants for project ID:', error);
    }

    // Last resort - use hardcoded project ID from eas.json
    return 'aaf80aae-b9fd-4c39-a48a-79f2eac06e68';
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

  // Validate token format - only accept Expo tokens
  private static isValidExpoToken(token: string): boolean {
    if (!token) return false;
    const validExpoTokenFormat = /^ExponentPushToken\[.+\]$/;
    return validExpoTokenFormat.test(token);
  }

  // Check if token needs refresh (older than the refresh interval)
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

  // Save token details to secure storage
  private static async saveTokenToStorage(token: string, tokenId?: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(PUSH_TOKEN_STORAGE_KEY, token);
      await SecureStore.setItemAsync(PUSH_TOKEN_TIMESTAMP_KEY, Date.now().toString());

      if (tokenId) {
        await SecureStore.setItemAsync(PUSH_TOKEN_ID_KEY, tokenId);
      }

      this.debugLog('Token saved to secure storage');
    } catch (error) {
      this.recordError('saveTokenToStorage', error);
      throw error; // Re-throw as this is critical
    }
  }

  // Core verification function to check if a token exists and is valid
  static async forceTokenVerification(userId: string): Promise<{
    isValid: boolean;
    tokenId?: string;
    token?: string;
  }> {
    try {
      this.debugLog(`Verifying push token for user ${userId}`);

      // Get token from storage
      const storedToken = await SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY);
      const storedTokenId = await SecureStore.getItemAsync(PUSH_TOKEN_ID_KEY);

      if (!storedToken) {
        this.debugLog('No token in storage, registration needed');
        return { isValid: false };
      }

      // Verify it's a proper Expo format token
      if (!this.isValidExpoToken(storedToken)) {
        this.debugLog('Token in storage is not in Expo format, registration needed');
        await SecureStore.deleteItemAsync(PUSH_TOKEN_STORAGE_KEY);
        await SecureStore.deleteItemAsync(PUSH_TOKEN_TIMESTAMP_KEY);
        await SecureStore.deleteItemAsync(PUSH_TOKEN_ID_KEY);
        return { isValid: false };
      }

      // If we have a token ID in storage, check that specific token
      if (storedTokenId) {
        const { data: tokenData, error: tokenError } = await this.timeoutPromise(
          supabase
            .from('user_push_tokens')
            .select('id, token, active')
            .eq('id', storedTokenId)
            .single(),
          DB_TIMEOUT,
          'verifySpecificToken'
        );

        if (!tokenError && tokenData && tokenData.token === storedToken) {
          this.debugLog('Found matching token by ID in database');
          return {
            isValid: true,
            tokenId: tokenData.id,
            token: tokenData.token
          };
        }
      }

      // Check if stored token exists in database
      const { data: tokenByValue, error: valueError } = await this.timeoutPromise(
        supabase
          .from('user_push_tokens')
          .select('id, token, active')
          .eq('user_id', userId)
          .eq('token', storedToken)
          .single(),
        DB_TIMEOUT,
        'verifyTokenByValue'
      );

      if (!valueError && tokenByValue) {
        this.debugLog('Found matching token by value in database');
        return {
          isValid: true,
          tokenId: tokenByValue.id,
          token: tokenByValue.token
        };
      }

      // Look for any active token for this user/device
      const { data: activeTokens, error: activeError } = await this.timeoutPromise(
        supabase
          .from('user_push_tokens')
          .select('id, token, active')
          .eq('user_id', userId)
          .eq('device_type', Platform.OS)
          .eq('active', true)
          .order('last_updated', { ascending: false })
          .limit(1),
        DB_TIMEOUT,
        'findActiveToken'
      );

      if (!activeError && activeTokens && activeTokens.length > 0) {
        const activeToken = activeTokens[0];
        if (this.isValidExpoToken(activeToken.token)) {
          this.debugLog('Found active token for user/device, reusing');

          // Update local storage with this token
          await this.saveTokenToStorage(activeToken.token, activeToken.id);

          return {
            isValid: true,
            tokenId: activeToken.id,
            token: activeToken.token
          };
        }
      }

      // No valid token found
      this.debugLog('No valid token found in database, registration needed');
      return { isValid: false };
    } catch (error) {
      this.recordError('forceTokenVerification', error);
      return { isValid: false };
    }
  }

  // Update user's token status
  static async updateTokenStatus(userId: string, token: string, status: { signed_in?: boolean, active?: boolean }): Promise<boolean> {
    try {
      if (!token || !userId) {
        return false;
      }

      const updates: any = {
        last_updated: new Date().toISOString(),
        ...status
      };

      const { error } = await this.timeoutPromise(
        supabase
          .from('user_push_tokens')
          .update(updates)
          .eq('user_id', userId)
          .eq('token', token),
        DB_TIMEOUT,
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

  // Marks user as signed out by updating the database
  static async markTokenAsSignedOut(userId: string): Promise<boolean> {
    try {
      this.debugLog(`Marking tokens as signed out for user ${userId}`);

      // Get token from storage
      const token = await SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY);

      if (token && this.isValidExpoToken(token)) {
        // Update token status in database
        const success = await this.updateTokenStatus(userId, token, {
          signed_in: false,
          active: true // Keep it active for future push notifications
        });

        if (success) {
          this.debugLog('Successfully marked token as signed out');
        } else {
          this.debugLog('Failed to update token status in database');
        }
      }

      // Clear token from secure storage
      await SecureStore.deleteItemAsync(PUSH_TOKEN_STORAGE_KEY);
      await SecureStore.deleteItemAsync(PUSH_TOKEN_TIMESTAMP_KEY);
      await SecureStore.deleteItemAsync(PUSH_TOKEN_ID_KEY);

      return true;
    } catch (error) {
      this.recordError('markTokenAsSignedOut', error);
      return false;
    }
  }

  // Register for push notifications and get token
  static async registerForPushNotificationsAsync(userId: string, forceRefresh = false): Promise<string | null> {
    if (!Device.isDevice && !FORCE_REGISTER_DEV) {
      this.debugLog('Push notifications not available on simulator/emulator');
      return null;
    }

    if (isSigningOut) {
      this.debugLog('User is signing out, skipping token registration');
      return null;
    }

    this.debugLog(`Starting push notification registration for user: ${userId}`);

    try {
      // 1. Check for existing valid token in database first
      if (!forceRefresh) {
        const verification = await this.forceTokenVerification(userId);

        if (verification.isValid && verification.token) {
          this.debugLog('Using existing verified token from database');

          // Mark as signed in and active
          await this.updateTokenStatus(userId, verification.token, {
            signed_in: true,
            active: true
          });

          // Update local storage
          await this.saveTokenToStorage(verification.token, verification.tokenId);

          return verification.token;
        }
      }

      // 2. Request permissions
      let permissionStatus;
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          permissionStatus = status;
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

      // 3. Set up Android notification channel
      if (Platform.OS === 'android') {
        try {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#D55004',
            sound: 'notification.wav',
          });
        } catch (channelError) {
          this.recordError('setupAndroidChannel', channelError);
        }
      }

      // 4. Get project ID
      const projectId = this.getProjectId();

      // 5. Get new Expo push token
      this.debugLog('Getting new Expo push token...');
      const tokenResponse = await this.timeoutPromise(
        Notifications.getExpoPushTokenAsync({
          projectId: projectId,
        }),
        15000,
        'getExpoPushTokenAsync'
      );

      const token = tokenResponse.data;

      // Verify token format
      if (!this.isValidExpoToken(token)) {
        throw new Error(`Received invalid token format: ${token}`);
      }

      // Save to storage immediately
      await this.saveTokenToStorage(token);

      // 6. Register in database
      const { data: tokensData, error: tokensError } = await this.timeoutPromise(
        supabase
          .from('user_push_tokens')
          .select('id, token')
          .eq('user_id', userId)
          .eq('token', token),
        DB_TIMEOUT,
        'checkExistingToken'
      );

      let tokenId;

      // If token already exists, update it
      if (!tokensError && tokensData && tokensData.length > 0) {
        tokenId = tokensData[0].id;

        const { error: updateError } = await this.timeoutPromise(
          supabase
            .from('user_push_tokens')
            .update({
              signed_in: true,
              active: true,
              last_updated: new Date().toISOString()
            })
            .eq('id', tokenId),
          DB_TIMEOUT,
          'updateExistingToken'
        );

        if (updateError) {
          this.recordError('updateExistingToken', updateError);
        } else {
          this.debugLog('Updated existing token record');
        }
      }
      // Otherwise insert new token
      else {
        const { data: insertData, error: insertError } = await this.timeoutPromise(
          supabase
            .from('user_push_tokens')
            .insert({
              user_id: userId,
              token,
              device_type: Platform.OS,
              signed_in: true,
              active: true,
              last_updated: new Date().toISOString()
            })
            .select('id'),
          DB_TIMEOUT,
          'insertNewToken'
        );

        if (insertError) {
          this.recordError('insertNewToken', insertError);
        } else if (insertData && insertData.length > 0) {
          tokenId = insertData[0].id;
          this.debugLog('Inserted new token record');
        }
      }

      // Save token ID to storage if available
      if (tokenId) {
        await SecureStore.setItemAsync(PUSH_TOKEN_ID_KEY, tokenId);
      }

      this.debugLog('Token registration completed successfully');
      return token;
    } catch (error) {
      this.recordError('registerForPushNotificationsAsync', error);
      return null;
    }
  }

  // Handle notification response (when user taps notification)
  static async handleNotificationResponse(response: Notifications.NotificationResponse) {
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
      return permissions;
    } catch (error) {
      this.recordError('getPermissions', error);
      return null;
    }
  }

  static async requestPermissions() {
    try {
      const permissions = await Notifications.requestPermissionsAsync();
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
      const { count, error } = await supabase
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

  // Improved cleanup function that marks tokens as signed out instead of deleting
  static async cleanupPushToken(userId: string): Promise<boolean> {
    this.debugLog('Starting push token cleanup process for sign out');

    try {
      // Mark token as signed out in database instead of deleting
      const success = await this.markTokenAsSignedOut(userId);

      // Clean up local storage
      const keysToDelete = [
        PUSH_TOKEN_STORAGE_KEY,
        PUSH_TOKEN_TIMESTAMP_KEY,
        PUSH_TOKEN_ID_KEY
      ];

      await Promise.all(keysToDelete.map(key =>
        SecureStore.deleteItemAsync(key).catch(error =>
          this.recordError(`deleteStorageKey-${key}`, error)
        )
      ));

      this.debugLog('Token cleanup process completed successfully');
      return success;
    } catch (error) {
      this.recordError('cleanupPushToken', error);

      // Emergency local storage cleanup
      try {
        await SecureStore.deleteItemAsync(PUSH_TOKEN_STORAGE_KEY);
        await SecureStore.deleteItemAsync(PUSH_TOKEN_TIMESTAMP_KEY);
        await SecureStore.deleteItemAsync(PUSH_TOKEN_ID_KEY);
      } catch (storageError) {
        this.recordError('emergencyStorageCleanup', storageError);
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
          tokenId: null,
          tokenAge: null,
          tokenFormat: null
        },
        permissions: null,
        errors: []
      };

      // Get token information
      const token = await SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY);
      const tokenId = await SecureStore.getItemAsync(PUSH_TOKEN_ID_KEY);
      const timestamp = await SecureStore.getItemAsync(PUSH_TOKEN_TIMESTAMP_KEY);

      if (token) {
        diagnostics.tokens.hasStoredToken = true;
        diagnostics.tokens.tokenFormat = this.isValidExpoToken(token);
        diagnostics.tokens.tokenPreview = token.substring(0, 5) + '...' + token.substring(token.length - 5);
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