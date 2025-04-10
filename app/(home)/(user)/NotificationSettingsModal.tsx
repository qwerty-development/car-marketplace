import React, { useState, useEffect } from 'react'
import { View, Text, Modal, TouchableOpacity, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { NotificationSettingsModalProps, NotificationSettings } from './types/type'
import { supabase } from '@/utils/supabase'
import * as SecureStore from 'expo-secure-store'
import { useAuth } from '@/utils/AuthContext'

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  visible,
  onClose,
  isDarkMode,
  notificationSettings,
  onToggleNotification
}) => {
  const { user } = useAuth();
  const [isUpdatingToken, setIsUpdatingToken] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Handle push notification toggle with token status update
  const handlePushNotificationToggle = async (key: keyof NotificationSettings) => {
    // Only perform special handling for pushNotifications setting
    if (key !== 'pushNotifications') {
      onToggleNotification(key);
      return;
    }

    try {
      // Start loading state
      setIsUpdatingToken(true);
      setUpdateError(null);

      // Get the current value to toggle
      const newValue = !notificationSettings[key];

      // Get push token from secure storage
      const token = await SecureStore.getItemAsync('expoPushToken');

      if (!token) {
        console.error('No push token found in storage');
        setUpdateError('No push token found. Please restart the app.');
        return;
      }

      if (!user?.id) {
        console.error('No user ID available');
        setUpdateError('User not authenticated. Please sign in again.');
        return;
      }

      // Update token active status in database
      const { error } = await supabase
        .from('user_push_tokens')
        .update({ active: newValue })
        .eq('user_id', user.id)
        .eq('token', token);

      if (error) {
        console.error('Error updating token status:', error);
        setUpdateError('Failed to update notification settings');
        return;
      }

      // If database update successful, update local state
      onToggleNotification(key);

    } catch (error) {
      console.error('Error in push notification toggle:', error);
      setUpdateError('An unexpected error occurred');
    } finally {
      setIsUpdatingToken(false);
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        <View
          className={`${
            isDarkMode ? 'bg-neutral-900' : 'bg-white'
          } rounded-t-3xl p-6 shadow-lg`}
        >
          <View className="flex-row justify-between items-center mb-6">
            <Text className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-black'}`}>
              Notification Settings
            </Text>
            <TouchableOpacity onPress={onClose} disabled={isUpdatingToken}>
              <Ionicons name="close" size={24} color={isDarkMode ? '#fff' : '#000'} />
            </TouchableOpacity>
          </View>

          {updateError && (
            <View className={`p-3 mb-4 rounded-lg bg-red-500/20`}>
              <Text className={`text-red-500`}>{updateError}</Text>
            </View>
          )}

          {(Object.keys(notificationSettings) as Array<keyof NotificationSettings>).map((key) => (
            <TouchableOpacity
              key={key}
              onPress={() => handlePushNotificationToggle(key)}
              disabled={isUpdatingToken}
              className={`${isDarkMode ? 'bg-neutral-800' : 'bg-neutral-100'}
                p-4 rounded-xl flex-row items-center justify-between mb-4
                ${isUpdatingToken && key === 'pushNotifications' ? 'opacity-70' : 'opacity-100'}`}
            >
              <View className="flex-row items-center">
                <Ionicons
                  name={key === 'pushNotifications'
                    ? (notificationSettings[key] ? "notifications" : "notifications-off")
                    : (notificationSettings[key] ? "checkmark-circle" : "ellipse-outline")}
                  size={24}
                  color={isDarkMode ? '#fff' : '#000'}
                />
                <Text className={`ml-3 ${isDarkMode ? 'text-white' : 'text-black'}`}>
                  {key === 'pushNotifications'
                    ? 'Push Notifications'
                    : key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </Text>

                {/* Special indication for push notifications */}
                {key === 'pushNotifications' && (
                  <Text className={`ml-2 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    (Device)
                  </Text>
                )}
              </View>

              {isUpdatingToken && key === 'pushNotifications' ? (
                <ActivityIndicator size="small" color="#D55004" />
              ) : (
                <View
                  className={`w-6 h-6 rounded-full ${notificationSettings[key] ? 'bg-green-500' : 'bg-gray-400'}`}
                />
              )}
            </TouchableOpacity>
          ))}


        </View>
      </View>
    </Modal>
  )
}