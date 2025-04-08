// hooks/useNotifications.ts
import { useEffect, useRef, useCallback, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { NotificationService } from '@/services/NotificationService'; // Keep type import if needed elsewhere
import { router } from 'expo-router';
import { useAuth } from '@/utils/AuthContext';

import * as SecureStore from 'expo-secure-store';

interface UseNotificationsReturn {
  unreadCount: number;
  isPermissionGranted: boolean | null; // Use null for initial unknown state
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  refreshNotifications: () => Promise<void>;
  loading: boolean; // Indicates loading for initial setup/refresh
  requestPermissions: () => Promise<boolean>; // Expose explicit permission request
  registerPushToken: () => Promise<void>; // Expose explicit registration trigger
   registerForPushNotifications: any // Expose explicit registration trigger
}

export function useNotifications(): UseNotificationsReturn {
  const { user, session } = useAuth(); // Use session for a more definitive "logged in" state
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true); // Start loading true initially
  const [isPermissionGranted, setIsPermissionGranted] = useState<boolean | null>(null); // Initial state unknown
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();
  const pushTokenListener = useRef<Notifications.Subscription>(); // Listener for Expo token refreshes
  const appState = useRef<AppStateStatus>(AppState.currentState);
  // Refs to prevent duplicate handling
  const lastHandledNotificationId = useRef<string>();
  const lastHandledResponseId = useRef<string>();
  // Ref to track if initial registration attempt was made for the current session
  const initialRegistrationAttempted = useRef(false);


  // --- Core Logic ---

  // Request Permissions Manually


  // Handle Expo Token Refresh Events
  const handleTokenRefresh:any = useCallback(async (pushToken: Notifications.ExpoPushToken) => {

    if (!user?.id || !session) {
        console.log('[useNotifications] Skipping token refresh handling: No authenticated user/session.');
        return;
    }

    const timestamp = new Date().toISOString();
    const newToken = pushToken.data;
    console.log(`[${timestamp}] [useNotifications] ENTERING handleTokenRefresh for token ${newToken.substring(0,10)}...`);

    try {
        // Immediately save to SecureStore via Service (or directly if preferred)
        await SecureStore.setItemAsync('expoPushToken', newToken); // Use the constant if defined
        console.log('[useNotifications] Saved refreshed token to SecureStore.');

        // REMOVED: isSigningOut check. Update should happen if logged in.

        // Update token in database via Service
        console.log('[useNotifications] Updating refreshed token in database...');
        const success = await NotificationService.updatePushTokenInDatabase(newToken, user.id);

        if (success) {
            console.log('[useNotifications] Refreshed token successfully updated in database.');
        } else {
            console.warn('[useNotifications] Database update failed for refreshed token (token saved locally).');
            // Consider adding retry logic here if needed, though the Service might handle it
        }
    } catch (error) {
        console.error('[useNotifications] Error handling token refresh:', error);
        // Token is saved locally, but DB update failed.
    }
  }, [user?.id, session]); // Depends on user and session
  // Register Push Token (Called on login, permission grant, or app foreground)
  const registerPushToken = useCallback(async () => {
    // **Critical Check:** Only proceed if user is authenticated
    if (!user?.id || !session) {
        console.log('[useNotifications] Skipping token registration: No authenticated user/session.');
        return;
    }

    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [useNotifications] ENTERING registerPushToken`);
    setLoading(true);
     try {
        const token = await NotificationService.registerForPushNotificationsAsync(user.id);

        if (token) {
            console.log('[useNotifications] Push token registration successful (or using existing valid token).');
            setIsPermissionGranted(true); // If registration succeeded, permission must be granted

            // --- CORRECTED LISTENER LOGIC ---
            // 1. Remove any potentially existing listener before adding a new one.
            //    This prevents duplicates if registerPushToken is called multiple times.
            if (pushTokenListener.current) {
                console.log('[useNotifications] Removing existing push token listener.');
                Notifications.removePushTokenSubscription(pushTokenListener.current);
                pushTokenListener.current = undefined; // Explicitly clear the ref
            }

            // 2. Add the new listener for token refreshes from Expo.
            console.log('[useNotifications] Adding new Expo push token refresh listener.');
            pushTokenListener.current = Notifications.addPushTokenListener(handleTokenRefresh);
            // --- END CORRECTED LISTENER LOGIC ---

        } else {
            console.warn('[useNotifications] Push token registration ultimately failed after retries or permission denial.');
            // Check final permission status again, as it might have been denied during the process
            const finalPermissions = await NotificationService.getPermissions();
            setIsPermissionGranted(finalPermissions?.status === 'granted');
        }
    } catch (error) {
        console.error('[useNotifications] Unexpected error during registerPushToken call:', error);
        // Log the specific error details if possible
        if (error instanceof Error) {
            console.error(`[useNotifications] Error Details: Name=${error.name}, Message=${error.message}, Stack=${error.stack}`);
        }
        setIsPermissionGranted(false); // Assume failure means no permission or other critical error
    } finally {
        setLoading(false);
        initialRegistrationAttempted.current = true; // Mark that an attempt was made for this session
    }
  }, [user?.id, session, handleTokenRefresh]); // Depends on user, session, and the refresh handler



  const requestPermissions = useCallback(async (): Promise<boolean> => {
    console.log('[useNotifications] Explicitly requesting permissions...');
    const permissions = await NotificationService.requestPermissions();
    const granted = permissions?.status === 'granted';
    setIsPermissionGranted(granted);
    if (granted) {
        console.log('[useNotifications] Permissions granted via explicit request.');
        // If permissions are granted, attempt registration immediately
        await registerPushToken();
    } else {
        console.warn('[useNotifications] Permissions denied via explicit request.');
    }
    return granted;
  }, [registerPushToken]); // Depends on registerPushToken

  // Handle Incoming Notifications (App in foreground/background)
  const handleNotification = useCallback(async (notification: Notifications.Notification) => {
    const notificationId = notification.request.identifier;

    // Prevent duplicate handling
    if (lastHandledNotificationId.current === notificationId) {
      return;
    }
    lastHandledNotificationId.current = notificationId;

    console.log('[useNotifications] Notification received:', {
        id: notificationId,
        title: notification.request.content.title,
        body: notification.request.content.body,
        data: notification.request.content.data
    });

    // Refresh unread count when a notification arrives
    if (user?.id) {
        try {
            const newUnreadCount = await NotificationService.getUnreadCount(user.id);
            setUnreadCount(newUnreadCount);
            await NotificationService.setBadgeCount(newUnreadCount); // Update badge
        } catch (error) {
            console.error('[useNotifications] Error updating count/badge on notification received:', error);
        }
    } else {
         console.warn('[useNotifications] Received notification but user ID unavailable to refresh count.');
    }
  }, [user?.id]); // Depends on user ID to refresh count


  // Handle User Tapping Notification
  const handleNotificationResponse = useCallback(async (response: Notifications.NotificationResponse) => {
    const responseId = response.notification.request.identifier;

    // Prevent duplicate handling
    if (lastHandledResponseId.current === responseId) {
      return;
    }
    lastHandledResponseId.current = responseId;

    console.log('[useNotifications] User responded to notification:', {
        id: responseId,
        action: response.actionIdentifier, // e.g., 'default'
        title: response.notification.request.content.title,
        data: response.notification.request.content.data
    });

    try {
        const navigationData = await NotificationService.handleNotificationResponse(response);

        // Mark as read if the notification came from our system (has notificationId in data)
        const backendNotificationId = response.notification.request.content.data?.notificationId as string | undefined;
        if (backendNotificationId && user?.id) {
            console.log(`[useNotifications] Marking notification ${backendNotificationId} as read.`);
            await NotificationService.markAsRead(backendNotificationId);
            // Refresh count after marking read
            const newUnreadCount = await NotificationService.getUnreadCount(user.id);
            setUnreadCount(newUnreadCount);
            await NotificationService.setBadgeCount(newUnreadCount);
        }

        // Navigate if screen data is present
        if (navigationData?.screen) {
            console.log(`[useNotifications] Navigating to ${navigationData.screen}`, navigationData.params);
            // Use appropriate navigation method (push or replace)
            router.push({
                pathname: navigationData.screen,
                params: navigationData.params
            });
        }
    } catch (error) {
        console.error('[useNotifications] Error handling notification response:', error);
    }
  }, [user?.id]); // Depends on user ID for marking read


  // --- Data Fetching and Actions ---

  // Refresh Unread Count (and check permissions)
  const refreshNotifications = useCallback(async () => {
    if (!user?.id || !session) {
        console.log("[useNotifications] Skipping refresh: No authenticated user.");
        setUnreadCount(0); // Reset count if logged out
        setIsPermissionGranted(null); // Reset permission state
        setLoading(false);
        return;
    }

    console.log('[useNotifications] Refreshing notification status...');
    setLoading(true);
    try {
        // Check permissions first
        const permissions = await NotificationService.getPermissions();
        const granted = permissions?.status === 'granted';
        setIsPermissionGranted(granted);
        console.log(`[useNotifications] Permission status on refresh: ${granted}`);

        // Fetch unread count
        const count = await NotificationService.getUnreadCount(user.id);
        setUnreadCount(count);
        console.log(`[useNotifications] Unread count: ${count}`);

        // Update badge count
        await NotificationService.setBadgeCount(count);

    } catch (error) {
        console.error('[useNotifications] Error refreshing notifications:', error);
        // Set default/error states
        setUnreadCount(0);
        setIsPermissionGranted(false);
    } finally {
        setLoading(false);
    }
  }, [user?.id, session]); // Depends on user and session


  // Mark Single Notification as Read
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user?.id) return;
    console.log(`[useNotifications] Marking notification ${notificationId} as read via action.`);
    try {
        const success = await NotificationService.markAsRead(notificationId);
        if (success) {
            // Optimistic update or refresh
            // setUnreadCount(prev => Math.max(0, prev - 1)); // Optimistic
            await refreshNotifications(); // More reliable
        }
    } catch (error) {
        console.error('[useNotifications] Error marking notification as read:', error);
    }
  }, [user?.id, refreshNotifications]);


  // Mark All Notifications as Read
  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return;
    console.log(`[useNotifications] Marking all notifications as read for user ${user.id}.`);
    try {
        const success = await NotificationService.markAllAsRead(user.id);
        if (success) {
            setUnreadCount(0); // Update state directly
            await NotificationService.setBadgeCount(0); // Update badge
        } else {
             await refreshNotifications(); // Refresh if failed
        }
    } catch (error) {
        console.error('[useNotifications] Error marking all notifications as read:', error);
    }
  }, [user?.id, refreshNotifications]);


  // Delete Notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!user?.id) return;
     console.log(`[useNotifications] Deleting notification ${notificationId}.`);
    try {
        const success = await NotificationService.deleteNotification(notificationId);
        if (success) {
            // Refresh count after deletion
            await refreshNotifications();
        }
    } catch (error) {
        console.error('[useNotifications] Error deleting notification:', error);
    }
  }, [user?.id, refreshNotifications]);


  // --- Effects ---

  // Effect for App State Changes (Foregrounding)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
        const previousState = appState.current;
        appState.current = nextAppState;

        console.log(`[useNotifications] App state changed from ${previousState} to ${nextAppState}`);

        if (
            previousState.match(/inactive|background/) &&
            nextAppState === 'active' &&
            user?.id && // Only refresh/re-register if logged in
            session
        ) {
            console.log('[useNotifications] App has come to foreground.');
            // Refresh notification count and status
            refreshNotifications();

            // Check if registration should be attempted/verified
            // e.g., if permissions were granted but maybe token failed previously
            if (isPermissionGranted === true && initialRegistrationAttempted.current) {
                 console.log('[useNotifications] Re-validating/attempting token registration on foreground...');
                 // Use registerPushToken as it handles all checks internally
                 registerPushToken();
            } else if (isPermissionGranted === null) {
                // If permission state is unknown, check it on foreground
                 console.log('[useNotifications] Checking permission status on foreground...');
                 NotificationService.getPermissions().then(p => setIsPermissionGranted(p?.status === 'granted'));
            }
        }
    });

    return () => {
      subscription.remove();
    };
  }, [user?.id, session, isPermissionGranted, refreshNotifications, registerPushToken]); // Dependencies


  // Effect for User Authentication Changes & Initial Setup
  useEffect(() => {
    // Reset state if user logs out
    if (!user?.id || !session) {
        console.log('[useNotifications] User logged out or session invalid. Resetting state.');
        setUnreadCount(0);
        setLoading(false);
        setIsPermissionGranted(null);
        initialRegistrationAttempted.current = false; // Reset attempt flag
        // Cleanup listeners specific to a user session
        if (notificationListener.current) Notifications.removeNotificationSubscription(notificationListener.current);
        if (responseListener.current) Notifications.removeNotificationSubscription(responseListener.current);
        if (pushTokenListener.current) Notifications.removePushTokenSubscription(pushTokenListener.current);
        notificationListener.current = undefined;
        responseListener.current = undefined;
        pushTokenListener.current = undefined;
        // Cleanup token from DB/Storage is handled by the logout flow calling NotificationService.cleanupPushToken
        return;
    }

    // --- User is logged in ---
    let mounted = true;
    console.log(`[useNotifications] User ${user.id} authenticated. Initializing notifications.`);
    setLoading(true);
    initialRegistrationAttempted.current = false; // Reset attempt flag for new session

    const initialize = async () => {
        if (!mounted) return;

        // 1. Refresh counts and check initial permission status
        await refreshNotifications(); // This also sets initial isPermissionGranted and loading states

        // 2. Attempt registration if permissions seem granted or unknown (let Service handle checks)
        // We fetch permissions again *inside* registerPushToken if needed
        // Only attempt registration automatically once per session start
        if (!initialRegistrationAttempted.current) {
           await registerPushToken(); // This now handles permissions, token, db, retries
        }


        // 3. Setup listeners (only if not already setup for this session)
        if (mounted && !notificationListener.current) {
            console.log('[useNotifications] Setting up notification listeners...');
            notificationListener.current = Notifications.addNotificationReceivedListener(handleNotification);
            responseListener.current = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
            // pushTokenListener is setup inside registerPushToken upon success
        }
    };

    initialize();

    // Cleanup function for when user changes or component unmounts
    return () => {
        mounted = false;
        console.log('[useNotifications] Cleaning up listeners for user change or unmount.');
        // Remove listeners added in this effect
          if (notificationListener.current) {
            Notifications.removeNotificationSubscription(notificationListener.current);
            notificationListener.current = undefined;
         }
         if (responseListener.current) {
            Notifications.removeNotificationSubscription(responseListener.current);
            responseListener.current = undefined;
         }

         if (pushTokenListener.current) {
            console.log('[useNotifications] Cleaning up push token listener on effect cleanup.');
            Notifications.removePushTokenSubscription(pushTokenListener.current);
            pushTokenListener.current = undefined;
         }
    };
    // Rerun when user.id or session changes
  }, [user?.id, session, refreshNotifications, registerPushToken, handleNotification, handleNotificationResponse]);


  return {
    unreadCount,
    isPermissionGranted,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications,
    loading,
    requestPermissions,
    registerForPushNotifications: registerPushToken,
    registerPushToken
  };
}