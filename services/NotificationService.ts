// services/NotificationService.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '@/utils/supabase';

// Set up notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Define view milestones and notification types
const VIEWS_MILESTONES = [50, 100, 500, 1000];

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
static async registerForPushNotificationsAsync(userId: string) {  // Add userId parameter
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
          sound: 'default',
        });
      }

      token = (await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PUBLIC_PROJECT_ID
      })).data;

      // Pass userId to updatePushToken
      if (token) {
        await this.updatePushToken(token, userId);
      }
    } catch (error) {
      console.error('Error getting push token:', error);
    }
  }

  return token;
}

  // Update push token in database
// services/NotificationService.ts
static async updatePushToken(token: string, userId: string) {  // Add userId parameter
  try {
    const { error } = await supabase
      .from('user_push_tokens')
      .upsert({
        user_id: userId,  // Add this
        token,
        device_type: Platform.OS,
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'token',  // Change this to handle token conflicts
      });

    if (error) throw error;
  } catch (error) {
    console.error('Error updating push token:', error);
  }
}

  // Create and store notification
  static async createNotification({
    userId,
    type,
    title,
    message,
    data
  }: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: NotificationData;
  }) {
    try {
      // Store in database
      const { error } = await supabase
        .from('notifications')
        .insert([{
          user_id: userId,
          type,
          title,
          message,
          data,
          is_read: false
        }]);

      if (error) throw error;

      // Schedule local notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body: message,
          data,
          sound: true,
          badge: 1
        },
        trigger: null
      });

      return true;
    } catch (error) {
      console.error('Error creating notification:', error);
      return false;
    }
  }

  // Daily reminder notifications
  static async scheduleDailyNotifications() {
    try {
      // Cancel existing notifications first
      await this.cancelAllNotifications();

      const notificationTimes = [
        { hour: 9, minute: 0, message: "🚗 Start your day with fresh car listings!" },
        { hour: 14, minute: 0, message: "🚙 New cars added! Take an afternoon browse" },
        { hour: 19, minute: 0, message: "🏎 End your day by finding your dream car" }
      ];

      for (const { hour, minute, message } of notificationTimes) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "New Cars Available! 🚗",
            body: message,
            data: {
              screen: '/(home)/(user)',
              type: 'daily_reminder'
            }
          },
          trigger: {
            hour,
            minute,
            repeats: true,
            channelId: 'default',
          },
        });
      }

      return true;
    } catch (error) {
      console.error('Error scheduling daily notifications:', error);
      return false;
    }
  }

static async checkViewsMilestones(userId: string) {
  try {
    // Get user's favorited cars
    const { data: favorites } = await supabase
      .from('users')
      .select('favorite')
      .eq('id', userId)
      .single();

    if (!favorites?.favorite?.length) return;

    // Get cars with their view counts
    const { data: cars } = await supabase
      .from('cars')
      .select('id, make, model, year, views')
      .in('id', favorites.favorite);

    if (!cars?.length) return;

    // Get already notified milestones
    const { data: existingNotifications } = await supabase
      .from('notifications')
      .select('data')
      .eq('user_id', userId)
      .eq('type', 'view_milestone')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours

    const notifiedMilestones = new Set(
      existingNotifications?.map(n => `${n.data.carId}-${n.data.milestone}`) || []
    );

    // Check each car's views against milestones
    for (const car of cars) {
      const milestone = VIEWS_MILESTONES.find(m => car.views >= m && car.views < m + 50);

      if (milestone && !notifiedMilestones.has(`${car.id}-${milestone}`)) {
        await this.createNotification({
          userId,
          type: 'view_milestone',
          title: "🎯 Popular Car Alert!",
          message: `Your favorite ${car.year} ${car.make} ${car.model} has reached ${milestone}+ views!`,
          data: {
            screen: '/(home)/(user)/Favorite',
            params: { carId: car.id },
            carId: car.id,
            milestone
          }
        });
      }
    }
  } catch (error) {
    console.error('Error checking views milestones:', error);
  }
}

static async checkSoldFavorites(userId: string) {
  try {
    // Get user's favorited cars
    const { data: favorites } = await supabase
      .from('users')
      .select('favorite')
      .eq('id', userId)
      .single();

    if (!favorites?.favorite?.length) return;

    // Get recently sold cars that haven't been notified about
    const { data: soldCars } = await supabase
      .from('cars')
      .select('id, make, model, year')
      .in('id', favorites.favorite)
      .eq('status', 'sold')
      .gt('date_sold', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (!soldCars?.length) return;

    // Check for existing notifications for these cars
    const { data: existingNotifications } = await supabase
      .from('notifications')
      .select('data')
      .eq('user_id', userId)
      .eq('type', 'car_sold')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const notifiedCarIds = new Set(
      existingNotifications?.flatMap(n => n.data.soldCarIds || []) || []
    );

    // Filter out cars that have already been notified about
    const newSoldCars = soldCars.filter(car => !notifiedCarIds.has(car.id));

    if (newSoldCars.length > 0) {
      await this.createNotification({
        userId,
        type: 'car_sold',
        title: "💫 Car Sold Update",
        message: `${newSoldCars.length === 1
          ? `The ${newSoldCars[0].year} ${newSoldCars[0].make} ${newSoldCars[0].model} you liked has been sold!`
          : `${newSoldCars.length} cars you liked have been sold!`}`,
        data: {
          screen: '/(home)/(user)/Favorite',
          soldCarIds: newSoldCars.map(car => car.id)
        }
      });
    }
  } catch (error) {
    console.error('Error checking sold favorites:', error);
  }
}

  // Subscribe to real-time notifications
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