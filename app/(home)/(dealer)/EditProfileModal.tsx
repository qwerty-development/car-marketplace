import React from 'react'
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'

interface EditProfileModalProps {
  visible: boolean
  onClose: () => void
  isDarkMode: boolean
  formData: {
    name: string
    phone: string
  }
  setFormData: (data: any) => void
  onUpdate: () => Promise<void>
  isLoading: boolean
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  visible,
  onClose,
  isDarkMode,
  formData,
  setFormData,
  onUpdate,
  isLoading
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
              Edit Dealership Profile
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
              value={formData.name}
              onChangeText={text => setFormData((prev: any) => ({ ...prev, name: text }))}
              placeholder="Dealership Name"
              placeholderTextColor={isDarkMode ? '#999' : '#666'}
              cursorColor="#D55004"
            />

            <TextInput
              className={`${
                isDarkMode ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-black'
              } p-4 rounded-xl`}
              value={formData.phone}
              onChangeText={text => setFormData((prev: any) => ({ ...prev, phone: text }))}
              placeholder="Contact Number"
              keyboardType="phone-pad"
              placeholderTextColor={isDarkMode ? '#999' : '#666'}
              cursorColor="#D55004"
            />
          </View>

          <TouchableOpacity
            className="bg-red mt-6 p-4 rounded-xl flex-row justify-center items-center"
            onPress={onUpdate}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="white" style={{ marginRight: 8 }} />
                <Text className="text-white font-semibold">
                  Update Profile
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}
  