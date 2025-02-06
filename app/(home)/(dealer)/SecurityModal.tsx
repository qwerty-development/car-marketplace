import React from 'react'
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'

interface SecurityModalProps {
  visible: boolean
  onClose: () => void
  isDarkMode: boolean
  passwordData: {
    currentPassword: string
    newPassword: string
    confirmPassword: string
  }
  setPasswordData: (data: any) => void
  onUpdatePassword: () => Promise<void>
}

export const SecurityModal: React.FC<SecurityModalProps> = ({
  visible,
  onClose,
  isDarkMode,
  passwordData,
  setPasswordData,
  onUpdatePassword
}) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
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
              Security Settings
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={isDarkMode ? '#fff' : '#000'} />
            </TouchableOpacity>
          </View>

          <View className="space-y-4">
            <TextInput
              className={`${
                isDarkMode ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-black'
              } p-4 rounded-xl`}
              value={passwordData.currentPassword}
              onChangeText={text => setPasswordData((prev: any) => ({ ...prev, currentPassword: text }))}
              placeholder="Current Password"
              placeholderTextColor={isDarkMode ? '#999' : '#666'}
              secureTextEntry
              cursorColor="#D55004"
            />

            <TextInput
              className={`${
                isDarkMode ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-black'
              } p-4 rounded-xl`}
              value={passwordData.newPassword}
              onChangeText={text => setPasswordData((prev: any) => ({ ...prev, newPassword: text }))}
              placeholder="New Password"
              placeholderTextColor={isDarkMode ? '#999' : '#666'}
              secureTextEntry
              cursorColor="#D55004"
            />

            <TextInput
              className={`${
                isDarkMode ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-black'
              } p-4 rounded-xl`}
              value={passwordData.confirmPassword}
              onChangeText={text => setPasswordData((prev: any) => ({ ...prev, confirmPassword: text }))}
              placeholder="Confirm New Password"
              placeholderTextColor={isDarkMode ? '#999' : '#666'}
              secureTextEntry
              cursorColor="#D55004"
            />
          </View>

          <TouchableOpacity
            className="bg-red mt-6 p-4 rounded-xl flex-row justify-center items-center"
            onPress={() => {
              onUpdatePassword()
              onClose()
            }}
          >
            <Ionicons name="key-outline" size={20} color="white" style={{ marginRight: 8 }} />
            <Text className="text-white font-semibold">
              Update Password
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}