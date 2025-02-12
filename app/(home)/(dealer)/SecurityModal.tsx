import React from 'react'
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet
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
      <View style={styles.modalOverlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.modalBackground} />
        </TouchableWithoutFeedback>
        
        <View 
          style={[
            styles.modalContent,
            { backgroundColor: isDarkMode ? '#1A1A1A' : 'white' }
          ]}
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
            onPress={onUpdatePassword}
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

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  modalContent: {
    width: '80%',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});