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
import Constants from 'expo-constants';

// Storage key for push token
const PUSH_TOKEN_STORAGE_KEY = 'expoPushToken';

// Maximum registration attempts
const MAX_REGISTRATION_ATTEMPTS = 3;

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
  const registrationAttempts = useRef(0);
  const registrationTimer = useRef<NodeJS.Timeout | null>(null);

  // Handler for token refresh events with improved error handling
  const handleTokenRefresh = useCallback(async (pushToken: Notifications.ExpoPushToken) => {
    if (!user?.id) return;

    console.log('Expo push token refreshed:', pushToken.data);

    try {
      // Save token to secure storage immediately for resilience
      await SecureStore.setItemAsync(PUSH_TOKEN_STORAGE_KEY, pushToken.data);
      console.log('Saved refreshed token to secure storage');

      // Skip database update during sign-out
      if (isSigningOut) {
        console.log('Skipping database update during sign-out');
        return;
      }

      // Try to update token in database
      const success = await NotificationService.updatePushToken(pushToken.data, user.id);

      if (!success) {
        console.warn('Token database update failed, but token is preserved in storage');
      } else {
        console.log('Token successfully updated in database and storage');
      }
    } catch (error) {
      console.error('Error handling token refresh:', error);
      // Even if there's an error, we've already saved to SecureStore
    }
  }, [user?.id]);

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

  // Simplified registration function with automatic retry and fallback mechanisms
  const registerForNotifications = useCallback(async () => {
    if (!user?.id) {
      console.log('No user ID available, skipping notification registration');
      return;
    }

    // Clear any existing registration timer
    if (registrationTimer.current) {
      clearTimeout(registrationTimer.current);
      registrationTimer.current = null;
    }

    // Prevent excessive registration attempts
    if (registrationAttempts.current >= MAX_REGISTRATION_ATTEMPTS) {
      console.log(`Max registration attempts (${MAX_REGISTRATION_ATTEMPTS}) reached, stopping`);
      return;
    }

    registrationAttempts.current++;
    console.log(`Push notification registration attempt ${registrationAttempts.current}/${MAX_REGISTRATION_ATTEMPTS}`);

    try {
      setLoading(true);

      // Check if we have project ID or fallback
      let projectId = process.env.EXPO_PUBLIC_PROJECT_ID;

      // Try to get from Constants if env var is missing
      if (!projectId) {
        try {
          // @ts-ignore - Accessing potentially undefined properties
          const expoConfig = Constants.expoConfig || Constants.manifest;
          projectId = expoConfig?.extra?.projectId || expoConfig?.id || expoConfig?.slug;

          if (projectId) {
            console.log('Using project ID from Constants:', projectId);
          } else {
            console.error('Project ID not found in environment or Constants');
          }
        } catch (constError) {
          console.error('Error accessing Constants:', constError);
        }
      }

      if (!projectId) {
        console.error('No project ID available, push notifications will not work');
        // Continue anyway to attempt with default or hardcoded project ID
      }

      // 1. Check permission status
      const permissionStatus = await NotificationService.getPermissions();
      console.log('Current permission status:', permissionStatus?.status);

      if (permissionStatus?.status !== 'granted') {
        console.log('Permission not granted, requesting...');
        const newPermission = await NotificationService.requestPermissions();

        if (newPermission?.status !== 'granted') {
          console.log('Permission denied by user');
          setIsPermissionGranted(false);
          setLoading(false);
          return;
        }
      }

      setIsPermissionGranted(true);
      console.log('Notification permissions granted');

      // 2. Get token - simplified flow directly using NotificationService
      console.log('Getting Expo push token...');
      const token = await NotificationService.registerForPushNotificationsAsync(user.id);

      if (token) {
        console.log('Successfully registered push token:', token);

        // Remove any existing listener before adding a new one
        if (pushTokenListener.current) {
          pushTokenListener.current.remove();
        }

        pushTokenListener.current = Notifications.addPushTokenListener(handleTokenRefresh);

        // Registration successful, reset attempt counter
        registrationAttempts.current = 0;
      } else {
        console.warn('Failed to get push token');

        // Schedule retry with exponential backoff (max 1 minute)
        const delay = Math.min(5000 * Math.pow(2, registrationAttempts.current - 1), 60000);
        console.log(`Scheduling retry in ${delay}ms`);

        registrationTimer.current = setTimeout(() => {
          registerForNotifications();
        }, delay);
      }
    } catch (error) {
      console.error('Error registering for notifications:', error);

      // Log detailed error information
      if (error instanceof Error) {
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }

      setIsPermissionGranted(false);

      // Schedule retry with exponential backoff (max 1 minute)
      const delay = Math.min(5000 * Math.pow(2, registrationAttempts.current - 1), 60000);
      console.log(`Scheduling retry after error in ${delay}ms`);

      registrationTimer.current = setTimeout(() => {
        registerForNotifications();
      }, delay);
    } finally {
      setLoading(false);
    }
  }, [user?.id, handleTokenRefresh]);

  // Cleanup push token on logout with improved reliability
  const cleanupPushToken = useCallback(async () => {
    console.log('Starting push token cleanup process');

    try {
      // Clear any pending registration timer
      if (registrationTimer.current) {
        clearTimeout(registrationTimer.current);
        registrationTimer.current = null;
      }

      // Get token from secure storage
      const token = await SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY);

      if (token) {
        console.log('Found push token to clean up:', token);

        // If we have a user ID, use it for targeted deletion
        if (user?.id) {
          try {
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
          } catch (dbError) {
            console.error('Database error during token cleanup:', dbError);
          }
        } else {
          // If no user ID, try deletion by token only
          try {
            const { error } = await supabase
              .from('user_push_tokens')
              .delete()
              .eq('token', token);

            if (error) {
              console.error('Error deleting token without user ID:', error);
            }
          } catch (tokenError) {
            console.error('Error in token-only deletion:', tokenError);
          }
        }

        // Always remove from secure storage regardless of database success
        await SecureStore.deleteItemAsync(PUSH_TOKEN_STORAGE_KEY);
        console.log('Token removed from secure storage');
      } else {
        console.log('No push token found in secure storage to cleanup');
      }

      // Reset registration attempts counter
      registrationAttempts.current = 0;
    } catch (error) {
      console.error('Error cleaning up push token:', error);

      // Attempt storage cleanup regardless
      try {
        await SecureStore.deleteItemAsync(PUSH_TOKEN_STORAGE_KEY);
      } catch (storageError) {
        console.error('Failed to clean token from storage:', storageError);
      }
    }
  }, [user?.id]);

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
      const previousState = appState.current;
      appState.current = nextAppState;

      // App coming to foreground from background or inactive
      if (
        (previousState.match(/inactive|background/) || previousState === 'unknown') &&
        nextAppState === 'active' &&
        user?.id
      ) {
        console.log('App has come to foreground, refreshing notifications');
        refreshNotifications();

        // Check/retry token registration if permission is granted
        if (isPermissionGranted && registrationAttempts.current < MAX_REGISTRATION_ATTEMPTS) {
          console.log('Checking push token on app foreground');

          // Check if we have a valid token in storage and database
          SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY).then(async (storedToken) => {
            if (!storedToken) {
              console.log('No stored token found on app foreground, initiating registration');
              registerForNotifications();
              return;
            }

            // Verify token exists in database
            try {
              const { data } = await supabase
                .from('user_push_tokens')
                .select('token')
                .eq('user_id', user.id)
                .eq('token', storedToken)
                .single();

              if (!data) {
                console.log('Token in storage but not in database, re-registering');
                registerForNotifications();
              }
            } catch (error) {
              console.error('Error verifying token on app foreground:', error);
            }
          }).catch(error => {
            console.error('Error checking token on app foreground:', error);
          });
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refreshNotifications, user, isPermissionGranted, registerForNotifications]);

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
        const storedToken = await SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY);
        if (storedToken) {
          console.log('Found stored push token:', storedToken);

          // Verify token is still valid in database
          try {
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

              // Add token listener even if token already exists
              if (pushTokenListener.current) {
                pushTokenListener.current.remove();
              }
              pushTokenListener.current = Notifications.addPushTokenListener(handleTokenRefresh);
            }
          } catch (dbError) {
            console.error('Error verifying token in database:', dbError);
            // Continue with registration anyway
            await registerForNotifications();
          }
        } else {
          console.log('No stored token found, registering for notifications');
          // Auto-register here for better reliability
          await registerForNotifications();
        }
      } catch (error) {
        console.error('Error during token verification:', error);
        // Try registration despite the error
        await registerForNotifications();
      }
    };

    initialize();

    return () => {
      mounted = false;
      console.log('Cleaning up notification listeners and subscriptions');

      // Clear any pending registration timer
      if (registrationTimer.current) {
        clearTimeout(registrationTimer.current);
        registrationTimer.current = null;
      }

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
  }, [user?.id, handleNotification, handleNotificationResponse, refreshNotifications, registerForNotifications, handleTokenRefresh]);

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