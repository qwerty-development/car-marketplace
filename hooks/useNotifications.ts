// hooks/useNotifications.ts
import { useEffect, useRef, useCallback, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
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
  const checkInterval = useRef<NodeJS.Timeout>();
  const realtimeSubscription = useRef<RealtimeChannel>();
  const initialCheckDone = useRef(false);
  const lastHandledNotification = useRef<string>();

  const handleNotification = useCallback(async (notification: Notifications.Notification) => {
    if (!user || !notification.request.trigger) return;

    // Only handle new push notifications, not scheduled ones
    if (notification.request.trigger.type !== 'push') {
      return;
    }

    // Check for duplicate notifications
    const notificationId = notification.request.identifier;
    if (lastHandledNotification.current === notificationId) {
      return;
    }
    lastHandledNotification.current = notificationId;

    try {
      const currentBadgeCount = await NotificationService.getBadgeCount();
      await NotificationService.setBadgeCount(currentBadgeCount + 1);

      // Update unread count
      const newUnreadCount = await NotificationService.getUnreadCount(user.id);
      setUnreadCount(newUnreadCount);
    } catch (error) {
      console.error('Error handling notification:', error);
    }
  }, [user]);

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

        // Schedule local notification
        await Notifications.scheduleNotificationAsync({
          content: {
            title: notification.title,
            body: notification.message,
            data: {
              ...notification.data,
              notificationId: notification.id
            }
          },
          trigger: null
        });
      }
    );
  }, [user]);

  const registerForNotifications = useCallback(async () => {
    if (!user) return;

    try {
      const permissionStatus = await NotificationService.getPermissions();

      if (permissionStatus?.status !== 'granted') {
        const newPermission = await NotificationService.requestPermissions();
        if (newPermission?.status !== 'granted') {
          setIsPermissionGranted(false);
          return;
        }
      }

      setIsPermissionGranted(true);
      const token = await NotificationService.registerForPushNotificationsAsync(user.id);
      if (token) {
        console.log('Expo push token:', token);
      }
    } catch (error) {
      console.error('Error registering for notifications:', error);
      setIsPermissionGranted(false);
    }
  }, [user]);

  const setupPeriodicChecks = useCallback(() => {
    if (!user?.id) return;

    // Clear existing interval
    if (checkInterval.current) {
      clearInterval(checkInterval.current);
    }

    // Set up new interval for periodic checks
    checkInterval.current = setInterval(async () => {
      if (!initialCheckDone.current) return;

      try {
        await Promise.all([
          NotificationService.checkViewsMilestones(user.id),
          NotificationService.checkSoldFavorites(user.id)
        ]);
      } catch (error) {
        console.error('Error in periodic checks:', error);
      }
    }, 60 * 60 * 1000); // Every hour
  }, [user?.id]);

  const setupInitialNotifications = useCallback(async () => {
    if (!user?.id || initialCheckDone.current) return;

    setLoading(true);
    try {
      await NotificationService.cancelAllNotifications();
      await NotificationService.setBadgeCount(0);

      // Perform initial checks
      await Promise.all([
        NotificationService.scheduleDailyNotifications(),
        NotificationService.checkViewsMilestones(user.id),
        NotificationService.checkSoldFavorites(user.id)
      ]);

      const count = await NotificationService.getUnreadCount(user.id);
      setUnreadCount(count);

      initialCheckDone.current = true;
    } catch (error) {
      console.error('Error setting up notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Notification management functions
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
      setupPeriodicChecks();
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
      if (checkInterval.current) {
        clearInterval(checkInterval.current);
      }
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