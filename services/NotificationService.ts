// services/NotificationService.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { AppState, Platform } from 'react-native';
import { supabase } from '@/utils/supabase';
import { isSigningOut } from '../app/(home)/_layout';

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

export class NotificationService {
  // Push notification registration
static async registerForPushNotificationsAsync(userId: string, maxRetries = 5) {
  console.log('Starting push notification registration for user:', userId);
  let token;
  let retryCount = 0;
  let delay = 2000; // Initial delay 2 seconds

  // Verify the device is physical (not a simulator/emulator)
  if (!Device.isDevice) {
    console.warn('Push notifications are not available on simulator/emulator');
    return null;
  }

  try {
    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log('Existing notification permission status:', existingStatus);

    let finalStatus = existingStatus;

    // Request permissions if not already granted
    if (existingStatus !== 'granted') {
      console.log('Requesting notification permissions...');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log('New permission status:', finalStatus);
    }

    if (finalStatus !== 'granted') {
      console.warn('Failed to get push notification permission');
      return null;
    }

    // Set up Android notification channel
    if (Platform.OS === 'android') {
      console.log('Setting up Android notification channel');
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#D55004',
        sound: 'notification.wav',
      });
    }

    // Skip token registration during sign out
    if (isSigningOut) {
      console.log('User is signing out, skipping token registration');
      return null;
    }

    // Get project ID from environment variables
    const projectId = process.env.EXPO_PUBLIC_PROJECT_ID;
    if (!projectId) {
      console.error('EXPO_PUBLIC_PROJECT_ID is undefined. Push notifications will not work!');
      console.error('Environment variables available:', Object.keys(process.env).filter(key => key.startsWith('EXPO_')));
      throw new Error('Missing Expo project ID');
    }

    // Get push token
    console.log('Getting Expo push token with project ID:', projectId);
    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId: projectId,
    });

    token = tokenResponse.data;
    console.log('Received push token:', token);

    if (token) {
      console.log('Updating push token in database');

      // Implement retry logic for token registration with exponential backoff
      let success = false;
      retryCount = 0;
      delay = 2000; // Reset the delay for token registration attempts

      while (!success && retryCount < maxRetries) {
        success = await this.updatePushToken(token, userId);
        if (!success) {
          retryCount++;
          console.log(`Token registration attempt ${retryCount} failed, retrying in ${delay/1000} seconds...`);
          // Exponential backoff with jitter
          await new Promise(resolve => setTimeout(resolve, delay + Math.random() * 1000));
          delay *= 2;
        }
      }

      if (!success) {
        console.error(`Failed to register token after ${maxRetries} attempts`);
      } else {
        console.log(`Successfully registered token after ${retryCount > 0 ? retryCount : 1} ${retryCount === 0 ? 'attempt' : 'attempts'}`);
      }
    }

    return token;
  } catch (error) {
    console.error('Error in registerForPushNotificationsAsync:', error);

    // Additional debug info
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }

    return null;
  }
}

  // Update push token in database
static async updatePushToken(token: string, userId: string) {
  try {
    console.log(`Updating token ${token} for user ${userId}`);

    // Implement exponential backoff for checking user existence
    let userExists = false;
    let retryCount = 0;
    const maxRetries = 5;
    let delay = 1000; // Start with 1 second

    while (!userExists && retryCount < maxRetries) {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id')
          .eq('id', userId)
          .single();

        if (data) {
          userExists = true;
          console.log(`User ${userId} confirmed in database after ${retryCount} retries`);
        } else {
          console.warn(`User ${userId} not found in database, retry ${retryCount + 1}/${maxRetries}`);
          retryCount++;

          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
        }
      } catch (error) {
        console.error(`Error checking user existence (attempt ${retryCount + 1}):`, error);
        retryCount++;

        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      }
    }

    if (!userExists) {
      console.error(`Failed to confirm user ${userId} in database after ${maxRetries} attempts`);
      return false;
    }

    // Proceed with token update only if user exists
    try {
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

      if (error) {
        // Handle specific error cases
        if (error.code === '23503') { // Foreign key violation
          console.error('Foreign key violation in updatePushToken - user may have been deleted');
          return false;
        }
        console.error('Supabase error in updatePushToken:', error);
        throw error;
      }

      console.log('Push token successfully updated in database');
      return true;
    } catch (error) {
      console.error('Error during token upsert operation:', error);
      return false;
    }
  } catch (error) {
    console.error('Error in updatePushToken:', error);
    return false;
  }
}



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
}