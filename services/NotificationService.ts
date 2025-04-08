// services/NotificationService.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, AppState } from 'react-native';
import { supabase } from '@/utils/supabase';
import { isSigningOut } from '../app/(home)/_layout';
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
const DB_OPERATION_TIMEOUT = 10000; // 10 seconds

export class NotificationService {
  // Get project ID safely
  private static getProjectId(): string {
    // First try environment variable
    const envProjectId = process.env.EXPO_PUBLIC_PROJECT_ID;

    if (envProjectId) {
      return envProjectId;
    }

    // Fallback to Constants (more reliable in production)
    try {
      // @ts-ignore - This is available in Expo but might not be typed correctly
      const expoConstants = Constants.expoConfig || Constants.manifest;

      // Try to get project ID from various possible locations
      const constantsProjectId =
        // @ts-ignore - Accessing potentially undefined properties
        expoConstants?.extra?.projectId ||
        expoConstants?.id ||
        expoConstants?.slug;

      if (constantsProjectId) {
        console.log('Using project ID from Constants:', constantsProjectId);
        return constantsProjectId;
      }
    } catch (error) {
      console.error('Error accessing Constants:', error);
    }

    // Last resort - use hardcoded project ID if available
    // REPLACE THIS WITH YOUR ACTUAL PROJECT ID
    const hardcodedProjectId = 'aaf80aae-b9fd-4c39-a48a-79f2eac06e68';
    console.warn('Using hardcoded project ID as fallback. This is not recommended for production.');
    return hardcodedProjectId;
  }

  // Push notification registration with improved error handling and fallbacks
  static async registerForPushNotificationsAsync(userId: string, maxRetries = 3) {
    console.log('Starting push notification registration for user:', userId);

    // Use promise with timeout to prevent hanging operations
    const timeoutPromise = (promise, timeoutMs) => {
      let timeoutHandle;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error('Operation timed out')), timeoutMs);
      });

      return Promise.race([
        promise,
        timeoutPromise
      ]).finally(() => clearTimeout(timeoutHandle));
    };

    // Verify the device is physical (not a simulator/emulator)
    if (!Device.isDevice) {
      console.warn('Push notifications are not available on simulator/emulator');
      return null;
    }

    try {
      // 1. Check and request permissions with better error handling
      let permissionStatus;
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        console.log('Existing notification permission status:', existingStatus);

        if (existingStatus !== 'granted') {
          console.log('Requesting notification permissions...');
          const { status } = await Notifications.requestPermissionsAsync();
          permissionStatus = status;
          console.log('New permission status:', permissionStatus);
        } else {
          permissionStatus = existingStatus;
        }
      } catch (permError) {
        console.error('Error checking permissions:', permError);
        permissionStatus = 'denied'; // Fail safely
      }

      if (permissionStatus !== 'granted') {
        console.warn('Push notification permission not granted');
        return null;
      }

      // 2. Set up Android notification channel
      if (Platform.OS === 'android') {
        console.log('Setting up Android notification channel');
        try {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#D55004',
            sound: 'notification.wav',
          });
        } catch (channelError) {
          console.error('Error setting up notification channel:', channelError);
          // Continue despite channel error - it's not fatal
        }
      }

      // Skip token registration during sign out
      if (isSigningOut) {
        console.log('User is signing out, skipping token registration');
        return null;
      }

      // 3. Get project ID with fallback mechanisms
      const projectId = this.getProjectId();
      console.log('Using project ID for push notifications:', projectId);

      // 4. Get push token with error handling
      let token;
      try {
        console.log('Getting Expo push token...');
        const tokenResponse = await Notifications.getExpoPushTokenAsync({
          projectId: projectId,
        });

        token = tokenResponse.data;
        console.log('Successfully received push token:', token);

        // Immediately save token to SecureStore for resilience
        await SecureStore.setItemAsync(PUSH_TOKEN_STORAGE_KEY, token);
      } catch (tokenError) {
        console.error('Error getting push token:', tokenError);

        // Try to recover token from storage if available
        try {
          const storedToken = await SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY);
          if (storedToken) {
            console.log('Using previously stored token as fallback:', storedToken);
            token = storedToken;
          }
        } catch (storageError) {
          console.error('Error reading token from storage:', storageError);
        }

        if (!token) return null;
      }

      // 5. Register token in database with simplified retry logic
      let registered = false;
      let retryCount = 0;

      while (!registered && retryCount < maxRetries) {
        try {
          console.log(`Token registration attempt ${retryCount + 1}/${maxRetries}`);

          // Use a timeout to prevent hanging
          registered = await timeoutPromise(
            this.updatePushToken(token, userId),
            DB_OPERATION_TIMEOUT
          );

          if (registered) {
            console.log('Successfully registered token in database');
            break;
          }
        } catch (dbError) {
          console.error(`Error during token registration attempt ${retryCount + 1}:`, dbError);
        }

        retryCount++;
        if (retryCount < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 8000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      // Even if registration fails, return the token
      // This allows notifications to work even if the database operation fails
      return token;

    } catch (error) {
      console.error('Fatal error in registerForPushNotificationsAsync:', error);

      // Log detailed error information
      if (error instanceof Error) {
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }

      return null;
    }
  }

  // Update push token in database with simplified approach
  static async updatePushToken(token: string, userId: string): Promise<boolean> {
    if (!token || !userId) {
      console.error('Invalid token or userId for updatePushToken');
      return false;
    }

    console.log(`Updating token for user ${userId}`);

    try {
      // Simplified approach - try direct upsert first
      const { error } = await supabase
        .from('user_push_tokens')
        .upsert({
          user_id: userId,
          token,
          device_type: Platform.OS,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'token',
        });

      if (!error) {
        console.log('Push token successfully updated in database');
        return true;
      }

      // If direct upsert fails, check if it's a foreign key issue
      if (error.code === '23503') { // Foreign key violation
        console.error('Foreign key violation - user may not exist in database');

        // Check if user exists and create if needed
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('id', userId)
          .maybeSingle();

        if (!userData) {
          console.log('User not found in database, token registration will be retried later');
          return false;
        }

        // Try upsert again
        const { error: retryError } = await supabase
          .from('user_push_tokens')
          .upsert({
            user_id: userId,
            token,
            device_type: Platform.OS,
            last_updated: new Date().toISOString()
          }, {
            onConflict: 'token',
          });

        if (retryError) {
          console.error('Error in second token upsert attempt:', retryError);
          return false;
        }

        console.log('Push token successfully updated on second attempt');
        return true;
      }

      console.error('Supabase error in updatePushToken:', error);
      return false;
    } catch (error) {
      console.error('Exception in updatePushToken:', error);
      return false;
    }
  }

  // Rest of the methods...
  // Handle notification response (when user taps notification)
  static async handleNotificationResponse(response: Notifications.NotificationResponse) {
    try {
      console.log('Handling notification response:', response.notification.request.identifier);

      const data = response.notification.request.content.data as NotificationData;
      console.log('Notification data:', data);

      if (data?.screen) {
        return {
          screen: data.screen,
          params: data.params || {}
        };
      }
      return null;
    } catch (error) {
      console.error('Error in handleNotificationResponse:', error);
      return null;
    }
  }

  // Badge management
  static async getBadgeCount() {
    try {
      return await Notifications.getBadgeCountAsync();
    } catch (error) {
      console.error('Error getting badge count:', error);
      return 0;
    }
  }

  static async setBadgeCount(count: number) {
    try {
      await Notifications.setBadgeCountAsync(count);
      return true;
    } catch (error) {
      console.error('Error setting badge count:', error);
      return false;
    }
  }

  // Permissions management
  static async getPermissions() {
    try {
      const permissions = await Notifications.getPermissionsAsync();
      console.log('Current notification permissions:', permissions);
      return permissions;
    } catch (error) {
      console.error('Error getting permissions:', error);
      return null;
    }
  }

  static async requestPermissions() {
    try {
      console.log('Requesting notification permissions...');
      const permissions = await Notifications.requestPermissionsAsync();
      console.log('Permission request result:', permissions);
      return permissions;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return null;
    }
  }

  // Notification management
  static async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      return true;
    } catch (error) {
      console.error('Error canceling notifications:', error);
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
      console.error('Error fetching notifications:', error);
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
      console.error('Error marking notification as read:', error);
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
      console.error('Error marking all notifications as read:', error);
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
      console.error('Error deleting notification:', error);
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
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  static async cleanupPushToken(userId?: string) {
    console.log('Starting robust push token cleanup');

    try {
      // Get token from secure storage
      const token = await SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY);

      if (!token) {
        console.log('No push token found in storage, nothing to clean up');
        return true;
      }

      console.log('Found push token to clean up:', token);

      // Delete from Supabase with retry logic
      let success = false;
      let retryCount = 0;
      const maxRetries = 3;

      while (!success && retryCount < maxRetries) {
        try {
          let query = supabase.from('user_push_tokens').delete();

          // If userId is provided, use it to narrow the deletion
          if (userId) {
            query = query.eq('user_id', userId);
          }

          // Always filter by token to ensure we're deleting the correct record
          const { error } = await query.eq('token', token);

          if (error) {
            retryCount++;
            console.error(`Token deletion attempt ${retryCount} failed:`, error);

            if (retryCount < maxRetries) {
              // Exponential backoff with jitter
              const delay = Math.pow(2, retryCount) * 500 + Math.random() * 200;
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          } else {
            success = true;
            console.log('Successfully removed push token from database');
          }
        } catch (error) {
          retryCount++;
          console.error(`Exception during token deletion attempt ${retryCount}:`, error);

          if (retryCount < maxRetries) {
            // Exponential backoff with jitter
            const delay = Math.pow(2, retryCount) * 500 + Math.random() * 200;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      // Regardless of database success, clean up local storage
      await SecureStore.deleteItemAsync(PUSH_TOKEN_STORAGE_KEY);
      console.log('Removed push token from secure storage');

      return true;
    } catch (error) {
      console.error('Push token cleanup failed:', error);

      // Attempt to clean local storage even if the rest failed
      try {
        await SecureStore.deleteItemAsync(PUSH_TOKEN_STORAGE_KEY);
      } catch (storageError) {
        console.error('Failed to clean token from storage:', storageError);
      }

      return false;
    }
  }
}