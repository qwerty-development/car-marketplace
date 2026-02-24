import React from 'react'
import { View, Text, Modal, TextInput, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { EditProfileModalProps } from './_types/type'

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  visible,
  onClose,
  firstName,
  lastName,
  email,
  setFirstName,
  setLastName,
  onUpdate,
  isDarkMode
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
              Edit Profile
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={isDarkMode ? '#fff' : '#000'} />
            </TouchableOpacity>
          </View>

          <View className="space-y-4">
            <TextInput
             textAlignVertical="center"
              className={`${
                isDarkMode ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-black'
              } p-4 rounded-xl`}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First Name"
              placeholderTextColor={isDarkMode ? '#999' : '#666'}
            />
            <TextInput
             textAlignVertical="center"
              className={`${
                isDarkMode ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-black'
              } p-4 rounded-xl`}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last Name"
              placeholderTextColor={isDarkMode ? '#999' : '#666'}
            />
            <TextInput
             textAlignVertical="center"
              className={`${
                isDarkMode ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-black'
              } p-4 rounded-xl`}
              value={email}
              editable={false}
              placeholder="Email"
              placeholderTextColor={isDarkMode ? '#999' : '#666'}
            />
          </View>

          <TouchableOpacity
            className="bg-red mt-6 p-4 rounded-xl"
            onPress={onUpdate}
          >
            <Text className="text-white text-center font-semibold">
              Update Profile
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}
