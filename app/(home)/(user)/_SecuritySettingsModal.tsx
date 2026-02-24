import React from 'react'
import { View, Text, Modal, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { SecuritySettingsModalProps } from './_types/type'

export const SecuritySettingsModal: React.FC<SecuritySettingsModalProps> = ({
  visible,
  onClose,
  isDarkMode,
  onChangePassword,
  onPrivacyPolicy,
  onSecuritySettings
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
              Security & Privacy
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={isDarkMode ? '#fff' : '#000'} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={onChangePassword}
            className={`${isDarkMode ? 'bg-neutral-800' : 'bg-neutral-100'} 
              p-4 rounded-xl flex-row items-center mb-4`}
          >
            <Ionicons name="key-outline" size={24} color={isDarkMode ? '#fff' : '#000'} />
            <Text className={`ml-3 ${isDarkMode ? 'text-white' : 'text-black'}`}>
              Change Password
            </Text>
            <Ionicons 
              name="chevron-forward" 
              size={24} 
              color={isDarkMode ? '#fff' : '#000'} 
              style={{ marginLeft: 'auto' }}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onPrivacyPolicy}
            className={`${isDarkMode ? 'bg-neutral-800' : 'bg-neutral-100'} 
              p-4 rounded-xl flex-row items-center mb-4`}
          >
            <Ionicons name="shield-outline" size={24} color={isDarkMode ? '#fff' : '#000'} />
            <Text className={`ml-3 ${isDarkMode ? 'text-white' : 'text-black'}`}>
              Privacy Policy
            </Text>
            <Ionicons 
              name="chevron-forward" 
              size={24} 
              color={isDarkMode ? '#fff' : '#000'} 
              style={{ marginLeft: 'auto' }}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onSecuritySettings}
            className={`${isDarkMode ? 'bg-neutral-800' : 'bg-neutral-100'} 
              p-4 rounded-xl flex-row items-center`}
          >
            <Ionicons name="lock-closed-outline" size={24} color={isDarkMode ? '#fff' : '#000'} />
            <Text className={`ml-3 ${isDarkMode ? 'text-white' : 'text-black'}`}>
              Security Settings
            </Text>
            <Ionicons 
              name="chevron-forward" 
              size={24} 
              color={isDarkMode ? '#fff' : '#000'} 
              style={{ marginLeft: 'auto' }}
            />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}