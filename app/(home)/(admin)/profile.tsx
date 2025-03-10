import 'react-native-get-random-values'
import React, { useState, useCallback, useRef } from 'react'
import {
  View,
  Text,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput
} from 'react-native'
import { useAuth } from '@/utils/AuthContext'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { useTheme } from '@/utils/ThemeContext'
import { NotificationBell } from '@/components/NotificationBell'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useScrollToTop } from '@react-navigation/native'
import { supabase } from '@/utils/supabase'
import { Buffer } from 'buffer'

export default function AdminProfilePage() {
  const { isDarkMode } = useTheme()
  const { user, profile, updatePassword, updateUserProfile, signOut } = useAuth()
  const router = useRouter()
  const scrollRef = useRef<ScrollView>(null)

  useScrollToTop(scrollRef)

  // State Management
  const [isLoading, setIsLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const [formData, setFormData] = useState({
    name: profile?.name || '',
    email: user?.email || profile?.email || '',
  })

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  // Modal States
  const [isSecurityModalVisible, setIsSecurityModalVisible] = useState(false)

  // Initialize form data when profile/user data is loaded
  React.useEffect(() => {
    if (user || profile) {
      setFormData({
        name: profile?.name || user?.user_metadata?.name || '',
        email: user?.email || profile?.email || '',
      })
    }
  }, [user, profile])

  // Image handling
  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please allow photo access.')
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1
      })

      if (!result.canceled && result.assets?.[0]) {
        setIsUploading(true)
        await handleImageUpload(result.assets[0].uri)
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image')
    } finally {
      setIsUploading(false)
    }
  }

  const handleImageUpload = async (imageUri: string) => {
    if (!user?.id) return

    try {
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`
      const filePath = `${user.id}/${fileName}`
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64
      })

      const { error: uploadError } = await supabase.storage
        .from('avatars') // Using avatars bucket for admin profiles
        .upload(filePath, Buffer.from(base64, 'base64'), {
          contentType: 'image/jpeg'
        })

      if (uploadError) throw uploadError

      const { data: publicURLData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      if (!publicURLData?.publicUrl) throw new Error('Failed to get public URL')

      // Update user_metadata with the avatar URL
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          avatar_url: publicURLData.publicUrl
        }
      })

      if (updateError) throw updateError

      // Also update the profile record in our users table
      await updateUserProfile({
        avatar_url: publicURLData.publicUrl
      })

      Alert.alert('Success', 'Profile picture updated successfully')
    } catch (error) {
      console.error('Image upload error:', error)
      Alert.alert('Error', 'Failed to upload image')
    }
  }

  // Form handlers
  const updateProfile = async () => {
    setIsLoading(true)
    try {
      // Update user metadata in auth
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          name: formData.name
        }
      })

      if (authError) throw authError

      // Update user record in database
      const { error: profileError } = await updateUserProfile({
        name: formData.name
      })

      if (profileError) throw profileError

      Alert.alert('Success', 'Profile updated successfully')
      setIsEditing(false)
    } catch (error) {
      console.error('Profile update error:', error)
      Alert.alert('Error', 'Failed to update profile')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match')
      return
    }

    try {
      const { error } = await updatePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      })

      if (error) throw error

      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
      setIsSecurityModalVisible(false)
      Alert.alert('Success', 'Password updated successfully')
    } catch (error) {
      Alert.alert('Error', 'Failed to update password')
    }
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    // Refresh user data
    const refreshUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          // Refresh local form data
          setFormData({
            name: user.user_metadata?.name || profile?.name || '',
            email: user.email || profile?.email || '',
          })
        }
      } catch (error) {
        console.error('Error refreshing user data:', error)
      } finally {
        setRefreshing(false)
      }
    }

    refreshUserData()
  }, [profile])

  // Get avatar URL from user metadata or profile
  const avatarUrl = user?.user_metadata?.avatar_url ||
                    profile?.avatar_url ||
                    'https://via.placeholder.com/150'

  return (
    <ScrollView
      ref={scrollRef}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      className={`flex-1 ${isDarkMode ? 'bg-black' : 'bg-white'}`}
    >
      {/* Profile Header */}
      <View className="relative">
        <LinearGradient
          colors={isDarkMode ? ['#D55004', '#1a1a1a'] : ['#D55004', '#ff8c00']}
          className="pt-12 pb-24 rounded-b-[40px]"
        >
          <View className="items-center mt-6">
            <View className="relative">
              <Image
                source={{
                  uri: avatarUrl
                }}
                className="w-32 h-32 rounded-full border-4 border-white/20"
              />
              <TouchableOpacity
                onPress={pickImage}
                disabled={isUploading}
                className="absolute bottom-0 right-0 bg-white/90 p-2 rounded-full shadow-lg"
              >
                {isUploading ? (
                  <ActivityIndicator color="#D55004" size="small" />
                ) : (
                  <Ionicons name="camera" size={20} color="#D55004" />
                )}
              </TouchableOpacity>
            </View>

            <Text className="text-white text-xl font-semibold mt-4">
              {formData.name}
            </Text>
            <Text className="text-white/80 text-sm">{formData.email}</Text>
            <View className="bg-red/20 rounded-full px-4 py-1 mt-2">
              <Text className="text-white font-medium">Administrator</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Settings Menu */}
      <View className="p-6 space-y-4">
        <Text className="text-neutral-500 font-medium uppercase text-xs tracking-wider mb-2">
          Account Settings
        </Text>

        {/* Profile Edit Section */}
        {isEditing ? (
          <View className="bg-neutral-800 p-4 rounded-xl">
            <Text className="text-white font-semibold text-lg mb-4">Edit Profile</Text>

            <View className="mb-4">
              <Text className="text-neutral-400 mb-1">Name</Text>
              <TextInput
                value={formData.name}
                onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                className="bg-neutral-700 text-white p-3 rounded-lg"
                placeholderTextColor="#666"
              />
            </View>

            <View className="mb-4">
              <Text className="text-neutral-400 mb-1">Email</Text>
              <TextInput
                value={formData.email}
                editable={false} // Email can't be changed
                className="bg-neutral-700 text-neutral-500 p-3 rounded-lg"
              />
            </View>

            <View className="flex-row space-x-4 mt-4">
              <TouchableOpacity
                onPress={() => setIsEditing(false)}
                className="flex-1 bg-neutral-700 p-3 rounded-lg"
              >
                <Text className="text-white text-center">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={updateProfile}
                disabled={isLoading}
                className="flex-1 bg-red p-3 rounded-lg"
              >
                {isLoading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="text-white text-center">Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => setIsEditing(true)}
            className={`${isDarkMode ? 'bg-neutral-800' : 'bg-neutral-200'}
                p-4 rounded-xl flex-row items-center`}
          >
            <View className="bg-red/10 p-3 rounded-xl">
              <Ionicons name="person" size={24} color="#D55004" />
            </View>
            <View className="ml-4 flex-1">
              <Text className={`${isDarkMode ? 'text-white' : 'text-black'} font-semibold`}>
                Edit Profile
              </Text>
              <Text className={`${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'} text-sm`}>
                Update your personal information
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={isDarkMode ? 'white' : 'black'} />
          </TouchableOpacity>
        )}

        {/* Security Settings */}
        <TouchableOpacity
          onPress={() => setIsSecurityModalVisible(true)}
          className={`${isDarkMode ? 'bg-neutral-800' : 'bg-neutral-200'}
              p-4 rounded-xl flex-row items-center`}
        >
          <View className="bg-indigo-500/10 p-3 rounded-xl">
            <Ionicons name="shield" size={24} color="#D55004" />
          </View>
          <View className="ml-4 flex-1">
            <Text className={`${isDarkMode ? 'text-white' : 'text-black'} font-semibold`}>
              Security
            </Text>
            <Text className={`${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'} text-sm`}>
              Change password and security settings
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={isDarkMode ? 'white' : 'black'} />
        </TouchableOpacity>

        {/* Admin Settings */}
        <TouchableOpacity
          onPress={() => router.push('/admin-settings')}
          className={`${isDarkMode ? 'bg-neutral-800' : 'bg-neutral-200'}
              p-4 rounded-xl flex-row items-center`}
        >
          <View className="bg-green-500/10 p-3 rounded-xl">
            <Ionicons name="settings" size={24} color="#D55004" />
          </View>
          <View className="ml-4 flex-1">
            <Text className={`${isDarkMode ? 'text-white' : 'text-black'} font-semibold`}>
              Admin Settings
            </Text>
            <Text className={`${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'} text-sm`}>
              System configuration and access controls
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={isDarkMode ? 'white' : 'black'} />
        </TouchableOpacity>

        {/* Sign Out */}
        <TouchableOpacity
          onPress={signOut}
          className={`${isDarkMode ? 'bg-red/10' : 'bg-red/10'}
              p-4 rounded-xl flex-row items-center mt-4`}
        >
          <View className="bg-red/20 p-3 rounded-xl">
            <Ionicons name="log-out" size={24} color="#D55004" />
          </View>
          <View className="ml-4 flex-1">
            <Text className="text-red font-semibold">
              Sign Out
            </Text>
            <Text className={`${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'} text-sm`}>
              Log out of your admin account
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Security Modal */}
      <Modal
        visible={isSecurityModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsSecurityModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View
            className={`${isDarkMode ? 'bg-neutral-900' : 'bg-white'}
                rounded-t-3xl p-6 h-2/3`}
          >
            <View className="flex-row justify-between items-center mb-6">
              <Text className={`${isDarkMode ? 'text-white' : 'text-black'} text-xl font-semibold`}>
                Security Settings
              </Text>
              <TouchableOpacity onPress={() => setIsSecurityModalVisible(false)}>
                <Ionicons
                  name="close"
                  size={24}
                  color={isDarkMode ? 'white' : 'black'}
                />
              </TouchableOpacity>
            </View>

            <View className="space-y-4">
              <Text className={`${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'} font-medium`}>
                Change Password
              </Text>

              <TextInput
                placeholder="Current Password"
                placeholderTextColor={isDarkMode ? '#666' : '#999'}
                secureTextEntry
                value={passwordData.currentPassword}
                onChangeText={(text) => setPasswordData(prev => ({ ...prev, currentPassword: text }))}
                className={`${isDarkMode ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-black'} p-4 rounded-xl`}
              />

              <TextInput
                placeholder="New Password"
                placeholderTextColor={isDarkMode ? '#666' : '#999'}
                secureTextEntry
                value={passwordData.newPassword}
                onChangeText={(text) => setPasswordData(prev => ({ ...prev, newPassword: text }))}
                className={`${isDarkMode ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-black'} p-4 rounded-xl`}
              />

              <TextInput
                placeholder="Confirm New Password"
                placeholderTextColor={isDarkMode ? '#666' : '#999'}
                secureTextEntry
                value={passwordData.confirmPassword}
                onChangeText={(text) => setPasswordData(prev => ({ ...prev, confirmPassword: text }))}
                className={`${isDarkMode ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-black'} p-4 rounded-xl`}
              />

              <TouchableOpacity
                onPress={handleChangePassword}
                className="bg-red p-4 rounded-xl mt-4"
              >
                <Text className="text-white text-center font-semibold">Update Password</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}