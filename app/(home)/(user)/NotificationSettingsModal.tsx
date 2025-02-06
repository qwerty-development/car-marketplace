import React from 'react'
import { View, Text, Modal, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { NotificationSettingsModalProps, NotificationSettings } from './types/type'

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  visible,
  onClose,
  isDarkMode,
  notificationSettings,
  onToggleNotification
}) => {
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
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={isDarkMode ? '#fff' : '#000'} />
            </TouchableOpacity>
          </View>

          {(Object.keys(notificationSettings) as Array<keyof NotificationSettings>).map((key) => (
            <TouchableOpacity
              key={key}
              onPress={() => onToggleNotification(key)}
              className={`${isDarkMode ? 'bg-neutral-800' : 'bg-neutral-100'} 
                p-4 rounded-xl flex-row items-center justify-between mb-4`}
            >
              <View className="flex-row items-center">
                <Ionicons 
                  name={notificationSettings[key] ? "notifications" : "notifications-off"} 
                  size={24} 
                  color={isDarkMode ? '#fff' : '#000'} 
                />
                <Text className={`ml-3 ${isDarkMode ? 'text-white' : 'text-black'}`}>
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </Text>
              </View>
              <View 
                className={`w-6 h-6 rounded-full ${notificationSettings[key] ? 'bg-green-500' : 'bg-gray-400'}`}
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  )
}