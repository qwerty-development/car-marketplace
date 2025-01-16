// services/NotificationService.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { AppState, Platform } from 'react-native';
import { supabase } from '@/utils/supabase';
import { isSigningOut } from '../app/(home)/_layout';

// Set up notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:true,
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
}

export class NotificationService {
  // Push notification registration
 static async registerForPushNotificationsAsync(userId: string) {
    let token;

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Failed to get push token for push notification!');
        return;
      }

      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#D55004',
            sound: 'notification.wav',
          });
        }

        // Only get a new token if not signing out
        if (!isSigningOut) {
          token = (await Notifications.getExpoPushTokenAsync({
            projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
          })).data;

          if (token) {
            await this.updatePushToken(token, userId);
          }
        }
      } catch (error) {
        console.error('Error getting push token:', error);
      }
    }

    return token;
  }

  // Update push token in database
  static async updatePushToken(token: string, userId: string) {
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

      if (error) throw error;
    } catch (error) {
      console.error('Error updating push token:', error);
    }
  }

  // Subscribe to realtime notifications
  static subscribeToRealtime(userId: string, onNotification: (notification: any) => void) {
    return supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        payload => {
          onNotification(payload.new);
        }
      )
      .subscribe();
  }

  // Handle notification response (when user taps notification)
  static async handleNotificationResponse(response: Notifications.NotificationResponse) {
    const data = response.notification.request.content.data as NotificationData;
    if (data?.screen) {
      return {
        screen: data.screen,
        params: data.params || {}
      };
    }
    return null;
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
      return await Notifications.getPermissionsAsync();
    } catch (error) {
      console.error('Error getting permissions:', error);
      return null;
    }
  }

  static async requestPermissions() {
    try {
      return await Notifications.requestPermissionsAsync();
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return null;
    }
  }

  // Notification management - Keep this
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