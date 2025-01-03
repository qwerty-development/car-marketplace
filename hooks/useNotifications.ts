// hooks/useNotifications.ts
import { useEffect, useRef, useCallback, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform, AppState } from 'react-native';
import { NotificationService, NotificationType } from '@/services/NotificationService';
import { router } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { RealtimeChannel } from '@supabase/supabase-js';

interface UseNotificationsReturn {
  unreadCount: number;
  isPermissionGranted: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  refreshNotifications: () => Promise<void>;
  loading: boolean;
}

export function useNotifications(): UseNotificationsReturn {
  const { user } = useUser();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();
  const lastNotificationResponse = useRef<Notifications.NotificationResponse>();
  const checkInterval = useRef<NodeJS.Timeout>(); // Not used anymore
  const realtimeSubscription = useRef<RealtimeChannel>();
  const initialCheckDone = useRef(false);
  const lastHandledNotification = useRef<string>();
  const pushTokenListener = useRef<any>();

  const handleTokenRefresh = useCallback(async (pushToken: Notifications.ExpoPushToken) => {
    if (!user) return;

    console.log('Expo push token refreshed:', pushToken.data);
    try {
      await NotificationService.updatePushToken(pushToken.data, user.id);
    } catch (error) {
      console.error('Error updating push token after refresh:', error);
    }
  }, [user]);

  // Modified to only handle received push notifications, not local ones
  const handleNotification = useCallback(async (notification: Notifications.Notification) => {
      if (!user) return;

    // Prevent duplicate handling
    if (lastHandledNotification.current === notification.request.identifier) {
      return;
    }
    lastHandledNotification.current = notification.request.identifier;

    // Since the badge count is handled by the push notification itself now,
    // we don't need to manually increment it here.

    try {
      // Update unread count
      const newUnreadCount = await NotificationService.getUnreadCount(user.id);
      setUnreadCount(newUnreadCount);
    } catch (error) {
      console.error('Error handling notification:', error);
    }
  }, [user]);

  // Kept the same
  const handleNotificationResponse = useCallback(async (response: Notifications.NotificationResponse) => {
    if (!user) return;

    // Prevent duplicate handling
    if (lastNotificationResponse.current?.notification.request.identifier ===
        response.notification.request.identifier) {
      return;
    }
    lastNotificationResponse.current = response;

    try {
      const navigationData = await NotificationService.handleNotificationResponse(response);
      if (navigationData?.screen) {
        // Mark notification as read if it has an ID
        const notificationId = response.notification.request.content.data?.notificationId;
        if (notificationId) {
          await NotificationService.markAsRead(notificationId);
          const newUnreadCount = await NotificationService.getUnreadCount(user.id);
          setUnreadCount(newUnreadCount);
        }

        // Navigate to the specified screen
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
  }, [user]);

  // Modified to only update unread count from real-time updates
  const setupRealtimeSubscription = useCallback(() => {
    if (!user) return;

    // Cleanup existing subscription
    if (realtimeSubscription.current) {
      realtimeSubscription.current.unsubscribe();
    }

    // Subscribe to real-time notifications
    realtimeSubscription.current = NotificationService.subscribeToRealtime(
      user.id,
      async (notification) => {
        // Update unread count
        const newUnreadCount = await NotificationService.getUnreadCount(user.id);
        setUnreadCount(newUnreadCount);

        // We are removing local notification scheduling as push notifications are handled by the backend
      }
    );
  }, [user]);

  // Kept the same
  const registerForNotifications = useCallback(async () => {
    if (!user) return;

    try {
      const permissionStatus = await NotificationService.getPermissions();

      if (permissionStatus?.status === 'granted') {
        setIsPermissionGranted(true);
      } else {
        const newPermission = await NotificationService.requestPermissions();
        if (newPermission?.status !== 'granted') {
          setIsPermissionGranted(false);
          return;
        }
        setIsPermissionGranted(true);
      }

      const token = await NotificationService.registerForPushNotificationsAsync(user.id);
      if (token) {
        console.log('Expo push token:', token);
        pushTokenListener.current = Notifications.addPushTokenListener(handleTokenRefresh);
      }
    } catch (error) {
      console.error('Error registering for notifications:', error);
      setIsPermissionGranted(false);
    }
  }, [user, handleTokenRefresh]);

  // Remove setupPeriodicChecks

  // Modified to only handle daily reminder notifications
  const setupInitialNotifications = useCallback(async () => {
    if (!user?.id || initialCheckDone.current) return;

    setLoading(true);
    try {
      await NotificationService.cancelAllNotifications();
      await NotificationService.setBadgeCount(0);

      // Schedule only daily notifications, other notifications are handled by triggers
      await NotificationService.scheduleDailyNotifications();

      const count = await NotificationService.getUnreadCount(user.id);
      setUnreadCount(count);

      initialCheckDone.current = true;
    } catch (error) {
      console.error('Error setting up notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Notification management functions - Kept the same
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user) return;
    try {
      await NotificationService.markAsRead(notificationId);
      const newUnreadCount = await NotificationService.getUnreadCount(user.id);
      setUnreadCount(newUnreadCount);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [user]);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    try {
      await NotificationService.markAllAsRead(user.id);
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, [user]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!user) return;
    try {
      await NotificationService.deleteNotification(notificationId);
      const newUnreadCount = await NotificationService.getUnreadCount(user.id);
      setUnreadCount(newUnreadCount);
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, [user]);

  const refreshNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const count = await NotificationService.getUnreadCount(user.id);
      setUnreadCount(count);
    } catch (error) {
      console.error('Error refreshing notifications:', error);
    }
  }, [user]);

  useEffect(() => {
    if (!user?.id) return;

    let mounted = true;

    const initialize = async () => {
      await registerForNotifications();
      if (!mounted) return;

      notificationListener.current = Notifications.addNotificationReceivedListener(handleNotification);
      responseListener.current = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

      setupRealtimeSubscription();
      await setupInitialNotifications();
      // Removed setupPeriodicChecks call
    };

    initialize();

    return () => {
      mounted = false;

      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
      if (pushTokenListener.current) {
        pushTokenListener.current.remove();
      }
      // if (checkInterval.current) { // Removed checkInterval
      //   clearInterval(checkInterval.current);
      // }
      if (realtimeSubscription.current) {
        realtimeSubscription.current.unsubscribe();
      }
    };
  }, [user?.id]);

  return {
    unreadCount,
    isPermissionGranted,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications,
    loading
  };
}