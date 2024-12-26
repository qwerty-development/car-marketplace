// services/NotificationService.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '@/utils/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const VIEWS_MILESTONES = [50, 100, 500, 1000];

export class NotificationService {
  static async registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#D55004',
        sound: 'default',
      });
    }

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
        token = (await Notifications.getExpoPushTokenAsync({
          projectId: process.env.EXPO_PUBLIC_PROJECT_ID
        })).data;
      } catch (error) {
        console.error('Error getting push token:', error);
      }
    }

    return token;
  }

  // Daily reminder notifications
  static async scheduleDailyNotifications() {
    try {
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
            sound: true,
            badge: 1,
            data: { screen: '/(home)/(user)' }
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour,
            minute,
            channelId: 'default',
          },
        });
      }
    } catch (error) {
      console.error('Error scheduling daily notifications:', error);
    }
  }

  // Check views milestones for favorited cars
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

      // Check each car's views against milestones
      for (const car of cars) {
        const milestone = VIEWS_MILESTONES.find(m => car.views >= m && car.views < m + 50);

        if (milestone) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "🎯 Popular Car Alert!",
              body: `Your favorite ${car.year} ${car.make} ${car.model} has reached ${milestone}+ views!`,
              data: { screen: '/(home)/(user)/favorites' }
            },
            trigger: null
          });
        }
      }
    } catch (error) {
      console.error('Error checking views milestones:', error);
    }
  }

  // Check for sold favorited cars
  static async checkSoldFavorites(userId: string) {
    try {
      // Get user's favorited cars
      const { data: favorites } = await supabase
        .from('users')
        .select('favorite')
        .eq('id', userId)
        .single();

      if (!favorites?.favorite?.length) return;

      // Get recently sold cars from favorites
      const { data: soldCars } = await supabase
        .from('cars')
        .select('id, make, model, year')
        .in('id', favorites.favorite)
        .eq('status', 'sold')
        .gt('date_sold', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (soldCars?.length) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "💫 Car Sold Update",
            body: `${soldCars.length === 1
              ? `The ${soldCars[0].year} ${soldCars[0].make} ${soldCars[0].model} you liked has been sold!`
              : `${soldCars.length} cars you liked have been sold!`}`,
            data: { screen: '/(home)/(user)/favorites' }
          },
          trigger: null
        });
      }
    } catch (error) {
      console.error('Error checking sold favorites:', error);
    }
  }


  static async handleNotificationResponse(response: Notifications.NotificationResponse) {
    const data = response.notification.request.content.data;
    if (data?.screen) {
      return {
        screen: data.screen,
        params: data.params
      };
    }
    return null;
  }

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
   static async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      return true;
    } catch (error) {
      console.error('Error canceling notifications:', error);
      return false;
    }
  }
}

