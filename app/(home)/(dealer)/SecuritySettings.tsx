import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native'
import { useTheme } from '@/utils/ThemeContext'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAuth } from '@/utils/AuthContext'

export default function SecuritySettingsScreen() {
  const { isDarkMode } = useTheme()
  const router = useRouter()
  const { updatePassword } = useAuth()
  
  const [isLoading, setIsLoading] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  // Password strength check
  const getPasswordStrength = (password: string | any[]) => {
    if (!password) return { level: 0, label: 'None', color: isDarkMode ? '#666' : '#999' }
    
    if (password.length < 6) {
      return { level: 1, label: 'Weak', color: '#ef4444' }
    } else if (password.length < 8) {
      return { level: 2, label: 'Moderate', color: '#f59e0b' }
    } else if (
      password.length >= 8 && 
      /[A-Z]/.test(password) && 
      /[a-z]/.test(password) && 
      /[0-9]/.test(password)
    ) {
      return { level: 4, label: 'Strong', color: '#10b981' }
    } else {
      return { level: 3, label: 'Good', color: '#3b82f6' }
    }
  }

  const strengthInfo = getPasswordStrength(passwordData.newPassword)

  // Form validation
  const canSubmit = () => {
    return (
      passwordData.currentPassword.trim().length > 0 &&
      passwordData.newPassword.trim().length >= 6 &&
      passwordData.newPassword === passwordData.confirmPassword
    )
  }

  const handleChangePassword = async () => {
    if (!canSubmit()) {
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        Alert.alert('Error', 'New passwords do not match')
      } else if (passwordData.newPassword.length < 6) {
        Alert.alert('Error', 'Password must be at least 6 characters')
      }
      return
    }

    setIsLoading(true)
    try {
      // Using the updatePassword method from AuthContext
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
      
      Alert.alert('Success', 'Password updated successfully', [
        { text: 'OK', onPress: () => router.back() }
      ])
    } catch (error) {
      console.error('Error changing password:', error)
      Alert.alert('Error', 'Failed to update password. Please ensure your current password is correct.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      className={isDarkMode ? 'bg-black' : 'bg-white'}
    >
      <ScrollView className="flex-1 p-4">
        <View className="mb-6">
          <Text className={`text-sm mb-1 font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Current Password
          </Text>
          <View 
            className={`flex-row items-center px-4 py-3 rounded-xl ${
              isDarkMode ? 'bg-gray-900' : 'bg-gray-100'
            }`}
          >
            <Ionicons 
              name="lock-closed-outline" 
              size={20} 
              color="#D55004" 
              style={{ marginRight: 10 }}
            />
            <TextInput
              value={passwordData.currentPassword}
              onChangeText={(text) => setPasswordData({ ...passwordData, currentPassword: text })}
              placeholder="Enter current password"
              placeholderTextColor={isDarkMode ? '#666' : '#999'}
              secureTextEntry={!showCurrentPassword}
              className={isDarkMode ? 'text-white flex-1' : 'text-black flex-1'}
            />
            <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)}>
              <Ionicons 
                name={showCurrentPassword ? "eye-off-outline" : "eye-outline"} 
                size={20} 
                color={isDarkMode ? '#666' : '#999'} 
              />
            </TouchableOpacity>
          </View>
        </View>
        
        <View className="mb-6">
          <Text className={`text-sm mb-1 font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            New Password
          </Text>
          <View 
            className={`flex-row items-center px-4 py-3 rounded-xl ${
              isDarkMode ? 'bg-gray-900' : 'bg-gray-100'
            }`}
          >
            <Ionicons 
              name="lock-open-outline" 
              size={20} 
              color="#D55004" 
              style={{ marginRight: 10 }}
            />
            <TextInput
              value={passwordData.newPassword}
              onChangeText={(text) => setPasswordData({ ...passwordData, newPassword: text })}
              placeholder="Enter new password"
              placeholderTextColor={isDarkMode ? '#666' : '#999'}
              secureTextEntry={!showNewPassword}
              className={isDarkMode ? 'text-white flex-1' : 'text-black flex-1'}
            />
            <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
              <Ionicons 
                name={showNewPassword ? "eye-off-outline" : "eye-outline"} 
                size={20} 
                color={isDarkMode ? '#666' : '#999'} 
              />
            </TouchableOpacity>
          </View>
          
          {/* Password strength indicator */}
          {passwordData.newPassword && (
            <View className="mt-2">
              <View className="flex-row items-center justify-between mb-1">
                <Text className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                  Password Strength:
                </Text>
                <Text style={{ color: strengthInfo.color }}>
                  {strengthInfo.label}
                </Text>
              </View>
              <View className="flex-row h-1 bg-gray-300 rounded overflow-hidden">
                <View 
                  style={{ 
                    width: `${(strengthInfo.level / 4) * 100}%`,
                    backgroundColor: strengthInfo.color
                  }} 
                />
              </View>
              <Text className={`text-xs mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Use at least 8 characters with uppercase letters, lowercase letters, and numbers
              </Text>
            </View>
          )}
        </View>
        
        <View className="mb-8">
          <Text className={`text-sm mb-1 font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Confirm New Password
          </Text>
          <View 
            className={`flex-row items-center px-4 py-3 rounded-xl ${
              isDarkMode ? 'bg-gray-900' : 'bg-gray-100'
            } ${passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword
              ? 'border border-red-500'
              : ''
            }`}
          >
            <Ionicons 
              name="lock-closed-outline" 
              size={20} 
              color={passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword 
                ? '#ef4444'
                : '#D55004'
              } 
              style={{ marginRight: 10 }}
            />
            <TextInput
              value={passwordData.confirmPassword}
              onChangeText={(text) => setPasswordData({ ...passwordData, confirmPassword: text })}
              placeholder="Confirm new password"
              placeholderTextColor={isDarkMode ? '#666' : '#999'}
              secureTextEntry={!showConfirmPassword}
              className={isDarkMode ? 'text-white flex-1' : 'text-black flex-1'}
            />
            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
              <Ionicons 
                name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} 
                size={20} 
                color={isDarkMode ? '#666' : '#999'} 
              />
            </TouchableOpacity>
          </View>
          
          {passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
            <Text className="text-red-500 text-xs mt-1 ml-1">
              Passwords do not match
            </Text>
          )}
        </View>
        
        <View className="p-4 rounded-xl bg-blue-500/10 mb-4">
          <View className="flex-row items-start">
            <Ionicons name="information-circle-outline" size={20} color="#3b82f6" style={{ marginRight: 8, marginTop: 1 }} />
            <View className="flex-1">
              <Text className={isDarkMode ? 'text-blue-400 font-medium' : 'text-blue-600 font-medium'}>
                Password Security Tips
              </Text>
              <Text className={`mt-1 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                • Use a unique password you don't use elsewhere
              </Text>
              <Text className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                • Mix uppercase and lowercase letters
              </Text>
              <Text className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                • Include numbers and special characters
              </Text>
              <Text className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                • Avoid using easily guessable information
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
      
      <View className="px-4 pb-6 pt-2">
        <TouchableOpacity
          onPress={handleChangePassword}
          disabled={isLoading || !canSubmit()}
          className={`py-3 rounded-xl flex-row justify-center items-center ${
            isLoading || !canSubmit() ? 'bg-gray-500' : 'bg-[#D55004]'
          }`}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="shield-checkmark-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text className="text-white font-semibold text-lg">Update Password</Text>
            </>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => router.back()}
          className="mt-3 py-3 rounded-xl flex-row justify-center items-center bg-transparent"
        >
          <Text className={isDarkMode ? "text-white" : "text-gray-700"}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}