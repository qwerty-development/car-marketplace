import React, { useState, useEffect } from 'react'
import { View, Text, Modal, TouchableOpacity, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { NotificationSettingsModalProps, NotificationSettings } from './types/type'
import { supabase } from '@/utils/supabase'
import * as SecureStore from 'expo-secure-store'
import { useAuth } from '@/utils/AuthContext'
import { Platform } from 'react-native'

// Define the same key used in NotificationService
const PUSH_TOKEN_STORAGE_KEY = 'expoPushToken';

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

      if (!user?.id) {
        console.error('No user ID available');
        setUpdateError('User not authenticated. Please sign in again.');
        return;
      }
      
      // First try to get ALL tokens for this user regardless of signed_in status
      const { data: tokens, error: tokensError } = await supabase
        .from('user_push_tokens')
        .select('id, token, signed_in, active')
        .eq('user_id', user.id)
        .order('last_updated', { ascending: false });
        
      if (tokensError) {
        console.error('Error fetching tokens from database:', tokensError);
        setUpdateError('Error retrieving notification tokens');
        return;
      }
      
      console.log(`Found ${tokens?.length || 0} tokens for user in database`);
      
      // Also check storage
      const storedToken = await SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY);
      console.log('Token in device storage:', storedToken ? 'Found' : 'Not found');
      
      // If we have no tokens at all, this is a real error
      if ((!tokens || tokens.length === 0) && !storedToken) {
        console.error('No push tokens found anywhere');
        setUpdateError('No notification tokens found. Please restart the app.');
        return;
      }
      
      // Set active status on ALL tokens for this user
      // This is the most aggressive approach - update everything
      const { error: updateError } = await supabase
        .from('user_push_tokens')
        .update({ 
          active: newValue,
          // Also set signed_in to true to fix potential issues
          signed_in: true,
          last_updated: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error updating tokens:', updateError);
        setUpdateError('Failed to update notification settings');
        return;
      }
      
      // If we have a stored token that's not in the database, add it
      if (storedToken && tokens && !tokens.some(t => t.token === storedToken)) {
        console.log('Adding stored token to database');
        await supabase
          .from('user_push_tokens')
          .insert({
            user_id: user.id,
            token: storedToken,
            device_type: Platform.OS,
            signed_in: true,
            active: newValue,
            last_updated: new Date().toISOString()
          });
      }

      // If database update successful, update local state
      onToggleNotification(key);
      console.log(`Successfully updated ${tokens?.length || 0} notification tokens to active=${newValue}`);

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