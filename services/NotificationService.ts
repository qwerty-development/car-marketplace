// services/NotificationService.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '@/utils/supabase';
// REMOVED: import { isSigningOut } from '../app/(home)/_layout'; // REMOVED: Avoid dependency on UI state
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// Set up notification handler - CRITICAL: MUST BE CALLED OUTSIDE OF ANY COMPONENT
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
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

// Store key for push token
const PUSH_TOKEN_STORAGE_KEY = 'expoPushToken';

// Database operation timeout
const DB_OPERATION_TIMEOUT = 15000; // Increased timeout slightly to 15 seconds

export class NotificationService {
  // Get project ID safely
  private static getProjectId(): string | null { // Return null if not found
    // 1. Environment Variable (Preferred for builds)
    const envProjectId = process.env.EXPO_PUBLIC_PROJECT_ID;
    if (envProjectId) {
      console.log('[NotificationService] Using project ID from environment variable:', envProjectId);
      return envProjectId;
    }
    console.warn('[NotificationService] EXPO_PUBLIC_PROJECT_ID environment variable not set.');

    // 2. Constants (Fallback)
    try {
      // @ts-ignore - expoConfig is preferred but check manifest too
      const expoConstants = Constants.expoConfig ?? Constants.manifest;

      // Try various potential locations within constants
      const constantsProjectId =
        // @ts-ignore
        expoConstants?.extra?.eas?.projectId || // EAS Build metadata
        // @ts-ignore
        expoConstants?.extra?.projectId || // Custom extra field
        expoConstants?.id ||
        expoConstants?.slug;

      if (constantsProjectId) {
        console.log('[NotificationService] Using project ID from Constants:', constantsProjectId);
        return constantsProjectId;
      }
    } catch (error) {
      console.error('[NotificationService] Error accessing Constants for project ID:', error);
    }

    // 3. Hardcoded (Last Resort - Avoid in production if possible)
    // REPLACE THIS WITH YOUR ACTUAL PROJECT ID ONLY IF ABSOLUTELY NECESSARY
    // const hardcodedProjectId = 'YOUR_PROJECT_ID_HERE'; // Example: 'aaf80aae-b9fd-4c39-a48a-79f2eac06e68';
    // if (hardcodedProjectId !== 'YOUR_PROJECT_ID_HERE') {
    //   console.warn('[NotificationService] Using hardcoded project ID as fallback. Ensure EXPO_PUBLIC_PROJECT_ID is set in eas.json for production builds.');
    //   return hardcodedProjectId;
    // }

    console.error('[NotificationService] CRITICAL: Expo Project ID could not be determined. Push notifications likely will fail.');
    return null; // Return null to indicate failure
  }

  // Push notification registration with improved error handling and fallbacks
  public static async registerForPushNotificationsAsync(userId: string, maxRetries = 3): Promise<string | null> {
    console.log(`[NotificationService] Starting push notification registration for user: ${userId}`);

    // **Critical Check:** Ensure userId is valid before proceeding
    if (!userId) {
      console.error('[NotificationService] Registration failed: userId is missing.');
      return null;
    }

    // Verify the device is physical
    if (!Device.isDevice) {
      console.warn('[NotificationService] Push notifications require a physical device, not a simulator/emulator.');
      return null;
    }

    let attempt = 0;
    while (attempt < maxRetries) {
        attempt++;
        console.log(`[NotificationService] Registration attempt ${attempt}/${maxRetries}`);

        try {
            // 1. Get Project ID
            const projectId = this.getProjectId();
            if (!projectId) {
              // Error already logged in getProjectId
              throw new Error("Project ID not found."); // Throw to trigger retry or failure
            }
            console.log(`[NotificationService] Using project ID: ${projectId}`);

            // 2. Check/Request Permissions
            console.log('[NotificationService] Checking notification permissions...');
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            console.log(`[NotificationService] Existing permission status: ${existingStatus}`);

            if (existingStatus !== 'granted') {
                console.log('[NotificationService] Requesting notification permissions...');
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
                console.log(`[NotificationService] New permission status: ${finalStatus}`);
            }

            if (finalStatus !== 'granted') {
                console.warn('[NotificationService] Push notification permission not granted.');
                // Don't retry if permission explicitly denied, return null immediately.
                return null;
            }
            console.log('[NotificationService] Notification permissions granted.');

            // 3. Set up Android Channel (if applicable)
            if (Platform.OS === 'android') {
                console.log('[NotificationService] Setting up Android notification channel...');
                try {
                    await Notifications.setNotificationChannelAsync('default', {
                        name: 'default',
                        importance: Notifications.AndroidImportance.MAX,
                        vibrationPattern: [0, 250, 250, 250],
                        lightColor: '#D55004',
                        sound: 'notification.wav', // Ensure this file exists in your native resources or use default
                    });
                    console.log('[NotificationService] Android channel set up successfully.');
                } catch (channelError) {
                    console.warn('[NotificationService] Error setting up Android notification channel (non-fatal):', channelError);
                }
            }

            // REMOVED: isSigningOut check - Registration should proceed if user is logged in.

            // 4. Get Expo Push Token
            let token: string | null = null;
            try {
                console.log('[NotificationService] Getting Expo push token...');
                // Use timeout for token retrieval
                const tokenResponse = await this.runWithTimeout(
                    Notifications.getExpoPushTokenAsync({ projectId }),
                    DB_OPERATION_TIMEOUT // Reuse DB timeout for consistency
                );

                token = tokenResponse.data;
                console.log('[NotificationService] Successfully received Expo push token.');

                // Immediately save token to SecureStore for resilience
                await SecureStore.setItemAsync(PUSH_TOKEN_STORAGE_KEY, token);
                console.log('[NotificationService] Token saved to SecureStore.');

            } catch (tokenError: any) {
                console.error('[NotificationService] Error getting Expo push token:', tokenError);
                // Attempt recovery from storage ONLY if fetching failed
                try {
                    const storedToken = await SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY);
                    if (storedToken) {
                        console.log('[NotificationService] Using previously stored token as fallback:', storedToken);
                        token = storedToken;
                    } else {
                         console.warn('[NotificationService] No stored token found to use as fallback.');
                         // Throw error to potentially retry the entire process if attempts remain
                         throw new Error(`Failed to get new token and no fallback available: ${tokenError.message}`);
                    }
                } catch (storageError) {
                    console.error('[NotificationService] Error reading token from storage during fallback:', storageError);
                    // Throw error to potentially retry the entire process
                     throw new Error(`Failed to get token and failed to read fallback: ${tokenError.message}`);
                }
            }

            // Ensure we have a token before proceeding
            if (!token) {
                 throw new Error("Token acquisition failed after potential fallback.");
            }

            // 5. Register token in database (with timeout and internal retry handled by the loop)
            console.log(`[NotificationService] Attempting to update token in database for user ${userId}...`);
            const dbSuccess = await this.runWithTimeout(
                this.updatePushTokenInDatabase(token, userId),
                DB_OPERATION_TIMEOUT
            );

            if (dbSuccess) {
                console.log('[NotificationService] Successfully registered token in database.');
                return token; // SUCCESS! Exit loop and return token.
            } else {
                // Log failure but let the loop handle retry
                console.warn(`[NotificationService] Database update failed for attempt ${attempt}.`);
                 // Throw an error to ensure retry logic catches it
                throw new Error("Database update failed.");
            }

        } catch (error: any) {
            console.error(`[NotificationService] Error during registration attempt ${attempt}:`, error.message || error);
            if (attempt >= maxRetries) {
                console.error('[NotificationService] Max registration retries reached. Giving up.');
                // Try to return the token if we have it, even if DB failed,
                // as notifications *might* still work via Expo's servers if previously registered.
                try {
                    const fallbackToken = await SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY);
                    if (fallbackToken) {
                        console.warn("[NotificationService] Returning token from storage despite final DB registration failure.");
                        return fallbackToken;
                    }
                } catch (e) { /* ignore storage read error here */ }
                return null; // Final failure
            }
            // Wait before retrying
            const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Exponential backoff up to 10s
            console.log(`[NotificationService] Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    console.error('[NotificationService] Registration failed after all retries.');
    return null; // Should technically be unreachable if logic is correct, but acts as a final safety net.
  }




  public static async updatePushTokenInDatabase(token: string, userId: string): Promise<boolean> {
    if (!token || !userId) {
      console.error('[NotificationService] updatePushTokenInDatabase failed: Invalid token or userId.');
      return false;
    }

    // Use a timestamp for logging to potentially see concurrency
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [NotificationService] Attempting UPSERT for token ${token.substring(0, 10)}... for user ${userId}`);

    try {
        const { error } = await supabase
            .from('user_push_tokens')
            .upsert(
                {
                    // Data to insert or update:
                    token: token,
                    user_id: userId, // Ensure this user ID is associated with the token
                    device_type: Platform.OS,
                    last_updated: timestamp // Use the consistent timestamp
                },
                {
                    // Specify the column(s) that have the unique constraint.
                    // If a row exists with this token, Supabase will update the
                    // other fields (user_id, device_type, last_updated) instead of inserting.
                    onConflict: 'token',
                    // ignoreDuplicates: false // Default is false, which means UPDATE occurs on conflict. Set to true only if you wanted INSERT or IGNORE.
                }
            );

        // Check for errors after the upsert attempt
        if (error) {
            console.error(`[${timestamp}] [NotificationService] Supabase UPSERT error: Code=${error.code}, Message=${error.message}, Details=${error.details}`);
            // Specific error handling
            if (error.code === '23503') { // Foreign key violation (user_id doesn't exist in users table)
                console.error(`[${timestamp}] [NotificationService] Foreign key violation on UPSERT - user ${userId} may not exist in database.`);
            } else if (error.code === '23505') {
                 // This error should NOT happen with a correctly configured upsert on the 'token' conflict target.
                 // If it does, it might mean the 'token' column doesn't actually have the unique constraint named 'user_push_tokens_token_key',
                 // or there's another unique constraint being violated. Double-check DB schema.
                 console.error(`[${timestamp}] [NotificationService] !!! Unexpected Duplicate key error during UPSERT. Check DB constraints.`);
            }
            // Any other error
            return false; // Indicate failure
        }

        console.log(`[${timestamp}] [NotificationService] Push token successfully UPSERTED in database for user ${userId}.`);
        return true; // Indicate success

    } catch (error: any) {
        console.error(`[${timestamp}] [NotificationService] Exception during database UPSERT operation:`, error.message || error);
        return false; // Indicate failure
    }
  }

    // Helper for running promises with a timeout
    public static async runWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
        let timeoutHandle: NodeJS.Timeout | null = null;
        const timeoutPromise = new Promise<T>((_, reject) => {
            timeoutHandle = setTimeout(() => {
                reject(new Error(`Operation timed out after ${timeoutMs}ms`));
            }, timeoutMs);
        });

        try {
            return await Promise.race([promise, timeoutPromise]);
        } finally {
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
            }
        }
    }


  // Handle notification response (when user taps notification)
 public static async handleNotificationResponse(response: Notifications.NotificationResponse) {
    try {
      const identifier = response.notification.request.identifier;
      console.log(`[NotificationService] Handling notification response: ${identifier}`);

      const data = response.notification.request.content.data as NotificationData;
      console.log('[NotificationService] Notification data:', data);

      if (data?.screen) {
        console.log(`[NotificationService] Preparing navigation for screen: ${data.screen}`);
        return {
          screen: data.screen,
          params: data.params || {}
        };
      }
      console.log('[NotificationService] No navigation screen found in notification data.');
      return null;
    } catch (error) {
      console.error('[NotificationService] Error in handleNotificationResponse:', error);
      return null;
    }
  }

  // Badge management
 public static async getBadgeCount() {
    try {
      const count = await Notifications.getBadgeCountAsync();
      // console.log(`[NotificationService] Current badge count: ${count}`);
      return count;
    } catch (error) {
      console.error('[NotificationService] Error getting badge count:', error);
      return 0;
    }
  }

 public static async setBadgeCount(count: number) {
    try {
      await Notifications.setBadgeCountAsync(count);
      // console.log(`[NotificationService] Set badge count to: ${count}`);
      return true;
    } catch (error) {
      console.error(`[NotificationService] Error setting badge count to ${count}:`, error);
      return false;
    }
  }

  // Permissions management
  public static async getPermissions() {
    try {
      const permissions = await Notifications.getPermissionsAsync();
      console.log('[NotificationService] Current notification permissions:', permissions);
      return permissions;
    } catch (error) {
      console.error('[NotificationService] Error getting permissions:', error);
      return null;
    }
  }

public  static async requestPermissions() {
    try {
      console.log('[NotificationService] Requesting notification permissions...');
      const permissions = await Notifications.requestPermissionsAsync();
      console.log('[NotificationService] Permission request result:', permissions);
      return permissions;
    } catch (error) {
      console.error('[NotificationService] Error requesting permissions:', error);
      return null;
    }
  }

  // Notification management
public  static async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('[NotificationService] All scheduled notifications cancelled.');
      return true;
    } catch (error) {
      console.error('[NotificationService] Error canceling notifications:', error);
      return false;
    }
  }

  // Fetch notifications (from your backend table)
  public static async fetchNotifications(userId: string, { page = 1, limit = 20 } = {}) {
    // Add check for valid userId
     if (!userId) {
        console.error('[NotificationService] fetchNotifications called without userId.');
        return { notifications: [], total: 0, hasMore: false };
    }
    try {
      const { data, error, count } = await supabase
        .from('notifications') // Your app's notification table
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (error) {
        console.error('[NotificationService] Supabase error fetching notifications:', error);
        throw error; // Re-throw to be caught below
      }

      return {
        notifications: data || [],
        total: count || 0,
        hasMore: count ? count > page * limit : false
      };
    } catch (error) {
      console.error('[NotificationService] Error fetching notifications:', error);
      return {
        notifications: [],
        total: 0,
        hasMore: false
      };
    }
  }

  // Mark notifications as read
public  static async markAsRead(notificationId: string) {
     if (!notificationId) {
        console.error('[NotificationService] markAsRead called without notificationId.');
        return false;
    }
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() }) // Also mark read time
        .eq('id', notificationId);

      if (error) {
        console.error('[NotificationService] Supabase error marking notification as read:', error);
        throw error;
      }
      return true;
    } catch (error) {
      console.error('[NotificationService] Error marking notification as read:', error);
      return false;
    }
  }

  // Mark all notifications as read
public  static async markAllAsRead(userId: string) {
      if (!userId) {
        console.error('[NotificationService] markAllAsRead called without userId.');
        return false;
    }
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('is_read', false); // Only update unread ones

      if (error) {
         console.error('[NotificationService] Supabase error marking all notifications as read:', error);
        throw error;
      }
      return true;
    } catch (error) {
      console.error('[NotificationService] Error marking all notifications as read:', error);
      return false;
    }
  }

  // Delete notification
  public static async deleteNotification(notificationId: string) {
      if (!notificationId) {
        console.error('[NotificationService] deleteNotification called without notificationId.');
        return false;
    }
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) {
        console.error('[NotificationService] Supabase error deleting notification:', error);
        throw error;
      }
      return true;
    } catch (error) {
      console.error('[NotificationService] Error deleting notification:', error);
      return false;
    }
  }

  // Get unread count
  public static async getUnreadCount(userId: string): Promise<number> {
     if (!userId) {
        console.error('[NotificationService] getUnreadCount called without userId.');
        return 0;
    }
    try {
      // Use count aggregate for efficiency
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true }) // head: true fetches only count
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) {
        console.error('[NotificationService] Supabase error getting unread count:', error);
        throw error;
      }
      return count ?? 0;
    } catch (error) {
      console.error('[NotificationService] Error getting unread count:', error);
      return 0;
    }
  }

  // Cleanup push token from DB and storage (e.g., on logout)
  static async cleanupPushToken(userId?: string) {
    console.log('[NotificationService] Starting push token cleanup process.');

    let token: string | null = null;
    try {
      // Get token from secure storage first
      token = await SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY);

      if (!token) {
        console.log('[NotificationService] No push token found in storage, nothing to clean up from DB.');
        // Still attempt to clear storage just in case, although it should be empty.
        await SecureStore.deleteItemAsync(PUSH_TOKEN_STORAGE_KEY).catch(e => console.warn("Minor error clearing already empty storage:", e));
        return true;
      }

      console.log(`[NotificationService] Found push token in storage to clean up: ${token.substring(0, 10)}...`);

      // Delete from Supabase
      let query = supabase.from('user_push_tokens').delete();

      // IMPORTANT: Always try to delete using the specific TOKEN.
      // Optionally add userId if available for more targeted deletion,
      // but prioritize token deletion to handle cases where userId might be wrong/unavailable.
      query = query.eq('token', token);
      if (userId) {
         query = query.match({ user_id: userId, token: token }); // More specific if userId is known
         console.log(`[NotificationService] Attempting DB deletion for user ${userId} and specific token.`);
      } else {
         console.warn(`[NotificationService] Attempting DB deletion by token only (userId not provided).`);
      }


      const { error } = await query;

      if (error) {
        // Log error but proceed to clear storage anyway
        console.error('[NotificationService] Error removing push token from database:', error.message);
      } else {
        console.log('[NotificationService] Successfully removed push token from database (or it was already gone).');
      }

    } catch (error: any) {
      // Catch errors during storage access or DB interaction
      console.error('[NotificationService] Exception during push token cleanup:', error.message || error);
    } finally {
        // **Crucially, always attempt to clear local storage** regardless of DB success/failure
        try {
            if (token) { // Only delete if we actually read a token
                 await SecureStore.deleteItemAsync(PUSH_TOKEN_STORAGE_KEY);
                 console.log('[NotificationService] Removed push token from secure storage.');
            }
        } catch (storageError: any) {
            console.error('[NotificationService] Failed to remove push token from secure storage:', storageError.message || storageError);
        }
    }
     // Generally return true unless there was a critical failure preventing storage cleanup
     // The main goal is to stop using the token locally.
    return true;
  }
}