// hooks/useNotifications.ts
import { useEffect, useRef, useCallback, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform, AppState } from 'react-native';
import { NotificationService, NotificationType } from '@/services/NotificationService';
import { router } from 'expo-router';
import { useAuth } from '@/utils/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '@/utils/supabase';

interface UseNotificationsReturn {
  unreadCount: number;
  isPermissionGranted: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  refreshNotifications: () => Promise<void>;
  loading: boolean;
  cleanupPushToken: () => Promise<void>;
  registerForPushNotifications: () => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();
  const lastNotificationResponse = useRef<Notifications.NotificationResponse>();
  const realtimeSubscription = useRef<RealtimeChannel>();
  const initialCheckDone = useRef(false);
  const lastHandledNotification = useRef<string>();
  const pushTokenListener = useRef<any>();
  const appState = useRef(AppState.currentState);

  // Handler for token refresh events
const handleTokenRefresh = useCallback(async (pushToken: Notifications.ExpoPushToken) => {
  if (!user) return;

  console.log('Expo push token refreshed:', pushToken.data);
  try {
    // Add verification that user exists in database
    const { data: userExists, error: userCheckError } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single();

    if (userCheckError || !userExists) {
      console.warn(`User ${user.id} does not exist in database yet, token refresh delayed`);
      return; // Exit gracefully
    }

    // Update token in Supabase
    const success = await NotificationService.updatePushToken(pushToken.data, user.id);

    if (success) {
      // Only update local storage if database update succeeded
      await SecureStore.setItemAsync('expoPushToken', pushToken.data);
    }
  } catch (error) {
    console.error('Error updating push token after refresh:', error);
  }
}, [user]);

  // Handler for received notifications
  const handleNotification = useCallback(async (notification: Notifications.Notification) => {
    if (!user) return;

    // Avoid duplicate handling
    if (lastHandledNotification.current === notification.request.identifier) {
      return;
    }
    lastHandledNotification.current = notification.request.identifier;

    try {
      console.log('Notification received:', {
        title: notification.request.content.title,
        body: notification.request.content.body,
        data: notification.request.content.data
      });

      // Update unread count
      const newUnreadCount = await NotificationService.getUnreadCount(user.id);
      setUnreadCount(newUnreadCount);

      // Update badge count
      await NotificationService.setBadgeCount(newUnreadCount);
    } catch (error) {
      console.error('Error handling notification:', error);
    }
  }, [user]);

  // Handler for when user taps on a notification
  const handleNotificationResponse = useCallback(async (response: Notifications.NotificationResponse) => {
    if (!user) return;

    // Avoid duplicate handling
    if (lastNotificationResponse.current?.notification.request.identifier ===
        response.notification.request.identifier) {
      return;
    }
    lastNotificationResponse.current = response;

    try {
      console.log('User responded to notification:', {
        title: response.notification.request.content.title,
        data: response.notification.request.content.data
      });

      const navigationData = await NotificationService.handleNotificationResponse(response);
      if (navigationData?.screen) {
        // Mark notification as read if it has an ID
        const notificationId = response.notification.request.content.data?.notificationId;
        if (notificationId) {
          await NotificationService.markAsRead(notificationId);
          const newUnreadCount = await NotificationService.getUnreadCount(user.id);
          setUnreadCount(newUnreadCount);

          // Update badge count
          await NotificationService.setBadgeCount(newUnreadCount);
        }

        // Navigate to the specified screen
        console.log(`Navigating to ${navigationData.screen}`, navigationData.params);
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



  // Register for push notifications
const registerForNotifications = useCallback(async () => {
  if (!user) return;

  // Add verification step to ensure user exists in database
  try {
    const { data: userExists, error: userCheckError } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single();

    if (userCheckError || !userExists) {
      console.warn(`User ${user.id} not yet fully created in database, delaying notification registration`);
      // Schedule a retry after a short delay
      setTimeout(() => {
        console.log('Retrying notification registration after delay');
        registerForNotifications();
      }, 3000);
      return;
    }
  } catch (error) {
    console.error('Error checking user existence:', error);
    setIsPermissionGranted(false);
    setLoading(false);
    return;
  }

  setLoading(true);
  console.log('Starting notification registration process');

    try {
      // Check if we have project ID
      const projectId = process.env.EXPO_PUBLIC_PROJECT_ID;
      if (!projectId) {
        console.error('EXPO_PUBLIC_PROJECT_ID is not defined in environment variables');
        console.error('Push notifications will not work without this value');
        setLoading(false);
        return;
      }

      // 1. Check permission status
      const permissionStatus = await NotificationService.getPermissions();
      console.log('Current permission status:', permissionStatus?.status);

      if (permissionStatus?.status !== 'granted') {
        console.log('Permission not granted, requesting...');
        const newPermission = await NotificationService.requestPermissions();

        if (newPermission?.status !== 'granted') {
          console.log('Permission denied');
          setIsPermissionGranted(false);
          setLoading(false);
          return;
        }
      }

      setIsPermissionGranted(true);
      console.log('Notification permissions granted');

      // 2. Get token
      console.log('Getting Expo push token...');
      const token = await NotificationService.registerForPushNotificationsAsync(user.id);

      if (token) {
        console.log('Successfully registered push token:', token);
        await SecureStore.setItemAsync('expoPushToken', token);

        // Remove any existing listener before adding a new one
        if (pushTokenListener.current) {
          pushTokenListener.current.remove();
        }

        pushTokenListener.current = Notifications.addPushTokenListener(handleTokenRefresh);
      } else {
        console.warn('Failed to get push token');
      }
    } catch (error) {
      console.error('Error registering for notifications:', error);

      // Additional error logging
      if (error instanceof Error) {
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }

      setIsPermissionGranted(false);
    } finally {
      setLoading(false);
    }
  }, [user, handleTokenRefresh]);

  // Cleanup push token on logout
  const cleanupPushToken = useCallback(async () => {
    if (!user) return;

    console.log('Starting push token cleanup process');
    try {
      // Get token from secure storage
      const token = await SecureStore.getItemAsync('expoPushToken');

      if (token) {
        console.log('Cleaning up push token:', token);

        // Delete token from database
        const { error } = await supabase
          .from('user_push_tokens')
          .delete()
          .match({ user_id: user.id, token });

        if (error) {
          console.error('Error deleting push token from database:', error);
        } else {
          console.log('Token successfully removed from database');
        }

        // Remove token from secure storage
        await SecureStore.deleteItemAsync('expoPushToken');
        console.log('Token removed from secure storage');
      } else {
        console.warn('No push token found in secure storage to cleanup');
      }
    } catch (error) {
      console.error('Error cleaning up push token:', error);
    }
  }, [user]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user) return;

    try {
      await NotificationService.markAsRead(notificationId);
      const newUnreadCount = await NotificationService.getUnreadCount(user.id);
      setUnreadCount(newUnreadCount);

      // Update badge count
      await NotificationService.setBadgeCount(newUnreadCount);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [user]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    try {
      await NotificationService.markAllAsRead(user.id);
      setUnreadCount(0);

      // Update badge count
      await NotificationService.setBadgeCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, [user]);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!user) return;

    try {
      await NotificationService.deleteNotification(notificationId);
      const newUnreadCount = await NotificationService.getUnreadCount(user.id);
      setUnreadCount(newUnreadCount);

      // Update badge count
      await NotificationService.setBadgeCount(newUnreadCount);
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, [user]);

  // Refresh notifications (update unread count)
  const refreshNotifications = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const count = await NotificationService.getUnreadCount(user.id);
      setUnreadCount(count);

      // Update badge count
      await NotificationService.setBadgeCount(count);
    } catch (error) {
      console.error('Error refreshing notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Handle app state changes (refresh when app comes to foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        user?.id
      ) {
        console.log('App has come to foreground, refreshing notifications');
        refreshNotifications();
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [refreshNotifications, user]);

  // Set up notification listeners and initial data fetch
  useEffect(() => {
    if (!user?.id) return;

    let mounted = true;

    const initialize = async () => {
      if (!mounted) return;

      console.log('Setting up notification listeners for user:', user.id);

      // Set up notification listeners
      notificationListener.current = Notifications.addNotificationReceivedListener(handleNotification);
      responseListener.current = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);



      // Get initial unread count
      await refreshNotifications();

      // Check if we have a token stored and validate it
      try {
        const storedToken = await SecureStore.getItemAsync('expoPushToken');
        if (storedToken) {
          console.log('Found stored push token:', storedToken);

          // Verify token is still valid in database
          const { data } = await supabase
            .from('user_push_tokens')
            .select('token')
            .eq('user_id', user.id)
            .eq('token', storedToken)
            .single();

          if (!data) {
            console.log('Stored token not found in database, re-registering...');
            await registerForNotifications();
          } else {
            console.log('Token validated in database');
            setIsPermissionGranted(true);
          }
        } else {
          console.log('No stored token found, will need to register');
          // Don't auto-register here, let the app call registerForPushNotifications
        }
      } catch (error) {
        console.error('Error verifying token:', error);
      }
    };

    initialize();

 return () => {
  mounted = false;
  console.log('Cleaning up notification listeners and subscriptions');

  if (notificationListener.current) {
    Notifications.removeNotificationSubscription(notificationListener.current);
  }
  if (responseListener.current) {
    Notifications.removeNotificationSubscription(responseListener.current);
  }
  if (pushTokenListener.current) {
    pushTokenListener.current.remove();
  }
  if (realtimeSubscription.current) {
    try {
      console.log('Unsubscribing from realtime notifications');
      realtimeSubscription.current.unsubscribe();
    } catch (error) {
      console.error('Error during subscription cleanup:', error);
    }
  }
};
  }, [user?.id, handleNotification, handleNotificationResponse, refreshNotifications, registerForNotifications]);

  return {
    unreadCount,
    isPermissionGranted,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications,
    loading,
    cleanupPushToken,
    registerForPushNotifications: registerForNotifications
  };
}