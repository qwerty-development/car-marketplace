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
  static async registerForPushNotificationsAsync(userId: string) {
    console.log('Starting push notification registration for user:', userId);
    let token;

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
        await this.updatePushToken(token, userId);
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
        console.error('Supabase error in updatePushToken:', error);
        throw error;
      }

      console.log('Push token successfully updated in database');
      return true;
    } catch (error) {
      console.error('Error updating push token:', error);
      return false;
    }
  }

/**
 * Subscribes to realtime notification updates
 * @param userId User ID to filter notifications
 * @param onNotification Callback function for new notifications
 * @returns Supabase RealtimeChannel instance
 */
static subscribeToRealtime(userId: string, onNotification: (notification: any) => void) {
  console.log(`Setting up realtime subscription for user ${userId}`);

  // Prepare subscription options with detailed error reporting
  const subscriptionOptions = {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
    filter: `user_id=eq.${userId}`,
  };

  // Record subscription attempts for retry logic
  let attempts = 0;
  const maxAttempts = 3;

  // Create subscription with enhanced error handling
  const channel = supabase.channel('notifications');

  // Function to handle subscription events
  const handleSubscriptionStatus = (status: string, errorData?: any) => {
    switch (status) {
      case 'SUBSCRIBED':
        console.log('Successfully subscribed to realtime notifications');
        attempts = 0; // Reset attempts on success
        break;

      case 'CHANNEL_ERROR':
        attempts++;
        console.error(
          `Error subscribing to realtime notifications (attempt ${attempts}/${maxAttempts}):`,
          errorData || 'No error details available'
        );

        // Add connection details for diagnosis
        console.error('Subscription details:', {
          userId,
          filter: subscriptionOptions.filter,
          connectionStatus: supabase.realtime?.getStatus?.() || 'unknown'
        });

        // Retry logic for transient errors
        if (attempts < maxAttempts) {
          console.log(`Retrying subscription in ${attempts * 2} seconds...`);
          setTimeout(() => {
            channel.subscribe(handleSubscriptionStatus);
          }, attempts * 2000);
        }
        break;

      case 'TIMED_OUT':
        console.warn('Subscription timed out, will reconnect automatically');
        break;

      case 'CLOSED':
        console.log('Realtime subscription closed');
        break;

      default:
        console.log(`Realtime subscription status: ${status}`);
    }
  };

  return channel
    .on(
      'postgres_changes',
      subscriptionOptions,
      payload => {
        try {
          console.log('Realtime notification received:',
            payload?.new?.id || 'No ID',
            payload?.new?.type || 'Unknown type'
          );

          if (payload?.new) {
            onNotification(payload.new);
          } else {
            console.warn('Received notification with missing data:', payload);
          }
        } catch (error) {
          console.error('Error processing notification payload:', error);
        }
      }
    )
    .subscribe(handleSubscriptionStatus);
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