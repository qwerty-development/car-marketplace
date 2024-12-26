// hooks/useNotifications.ts
import { useEffect, useRef, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { NotificationService } from '@/services/NotificationService';
import { router } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';

export function useNotifications() {
  const { user } = useUser();
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();
  const lastNotificationResponse = useRef<Notifications.NotificationResponse>();
  const checkInterval = useRef<NodeJS.Timeout>();

  const handleNotification = useCallback(async (notification: Notifications.Notification) => {
    const currentBadgeCount = await NotificationService.getBadgeCount();
    await NotificationService.setBadgeCount(currentBadgeCount + 1);
  }, []);

  const handleNotificationResponse = useCallback(async (response: Notifications.NotificationResponse) => {
    if (lastNotificationResponse.current?.notification.request.identifier ===
        response.notification.request.identifier) {
      return;
    }
    lastNotificationResponse.current = response;

    try {
      const navigationData = await NotificationService.handleNotificationResponse(response);
      if (navigationData?.screen) {
        if (navigationData.params) {
          router.push({
            pathname: navigationData.screen,
            params: navigationData.params
          });
        } else {
          router.push(navigationData.screen);
        }
      }
    } catch (error) {
      console.error('Error handling notification response:', error);
    }
  }, []);

  const registerForNotifications = useCallback(async () => {
    try {
      const permissionStatus = await NotificationService.getPermissions();

      if (permissionStatus?.status !== 'granted') {
        const newPermission = await NotificationService.requestPermissions();
        if (newPermission?.status !== 'granted') {
          return;
        }
      }

      const token = await NotificationService.registerForPushNotificationsAsync();
      if (token) {
        console.log('Expo push token:', token);
      }
    } catch (error) {
      console.error('Error registering for notifications:', error);
    }
  }, []);

  const setupPeriodicChecks = useCallback(() => {
    if (!user?.id) return;

    // Run checks every hour
    clearInterval(checkInterval.current);
    checkInterval.current = setInterval(async () => {
      await Promise.all([
        NotificationService.checkViewsMilestones(user.id),
        NotificationService.checkSoldFavorites(user.id),

      ]);
    }, 60 * 60 * 1000); // Every hour
  }, [user?.id]);

  const setupInitialNotifications = useCallback(async () => {
    if (!user?.id) return;

    try {
      await NotificationService.cancelAllNotifications();
      await NotificationService.setBadgeCount(0);

      await Promise.all([
        NotificationService.scheduleDailyNotifications(),
        NotificationService.checkViewsMilestones(user.id),
        NotificationService.checkSoldFavorites(user.id),
      ]);
    } catch (error) {
      console.error('Error setting up notifications:', error);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    registerForNotifications();
    notificationListener.current = Notifications.addNotificationReceivedListener(handleNotification);
    responseListener.current = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

    setupInitialNotifications();
    setupPeriodicChecks();

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
      if (checkInterval.current) {
        clearInterval(checkInterval.current);
      }
    };
  }, [user?.id]);

  return null;
}