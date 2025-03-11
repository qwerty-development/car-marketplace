import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Dimensions,
  Animated
} from 'react-native'
import { useAuth } from '@/utils/AuthContext'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/utils/ThemeContext'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/utils/supabase'

const { width, height } = Dimensions.get('window')

const AnimatedLine = ({ startPos, duration }: any) => {
  const position = new Animated.Value(0)

  useEffect(() => {
    Animated.loop(
      Animated.timing(position, {
        toValue: 1,
        duration: duration,
        useNativeDriver: true
      })
    ).start()
  }, [duration])

  return (
    <Animated.View
      className='absolute w-[1px] h-[100px] bg-red'
      style={{
        left: startPos.x,
        top: startPos.y,
        transform: [
          {
            translateY: position.interpolate({
              inputRange: [0, 1],
              outputRange: [0, height + 100]
            })
          }
        ]
      }}
    />
  )
}

const CustomHeader = ({ title, onBack }: any) => {
  const { isDarkMode } = useTheme()
  return (
    <SafeAreaView
      edges={['top']}
      className={`${isDarkMode ? 'bg-black' : 'bg-black'}`}>
      <View className='flex-row items-center py-4 px-4'>
        <TouchableOpacity onPress={onBack}>
          <Ionicons
            name='chevron-back'
            size={24}
            color='white'
          />
        </TouchableOpacity>
        <Text className='text-xl font-bold text-white ml-4'>{title}</Text>
      </View>
    </SafeAreaView>
  )
}

export default function ForgotPasswordPage() {
  const { isDarkMode } = useTheme()
  const router = useRouter()
  const { resetPassword } = useAuth()
  const [emailAddress, setEmailAddress] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [code, setCode] = useState('')
  const [successfulCreation, setSuccessfulCreation] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const onRequestReset = async () => {
    if (!emailAddress.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await resetPassword(emailAddress);

      if (error) throw error;

      setSuccessfulCreation(true);
      Alert.alert(
        'Reset Password',
        'Check your email for a verification code.',
        [{ text: 'OK' }]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to request password reset');
    } finally {
      setIsLoading(false);
    }
  }

  const onReset = async () => {
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return;
    }

    setIsLoading(true);
    try {
      // Verify the OTP token and set the new password
      const { error } = await supabase.auth.verifyOtp({
        email: emailAddress,
        token: code,
        type: 'recovery',
      });

      if (error) throw error;

      // Update the user's password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) throw updateError;

      Alert.alert(
        'Success',
        'Password has been reset successfully',
        [
          {
            text: 'Sign In',
            onPress: () => router.replace('/sign-in')
          }
        ]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <View className={`flex-1 ${isDarkMode ? 'bg-black' : 'bg-white'}`}>
      <CustomHeader title='Forgot Password' onBack={() => router.back()} />
      <AnimatedLine startPos={{ x: width * 0.2, y: -100 }} duration={15000} />
      <AnimatedLine startPos={{ x: width * 0.5, y: -100 }} duration={20000} />
      <AnimatedLine startPos={{ x: width * 0.8, y: -100 }} duration={18000} />

      <View className='flex-1 justify-center -mt-64 items-center px-8'>
        {!successfulCreation ? (
          <>
            <TextInput
              className={`w-full h-12 px-4 mb-4 rounded-lg ${
                isDarkMode ? 'bg-gray text-white' : 'bg-white text-black'
              }`}
              placeholder='Enter your email'
              placeholderTextColor={isDarkMode ? '#A0AEC0' : '#718096'}
              value={emailAddress}
              onChangeText={setEmailAddress}
              keyboardType='email-address'
              autoCapitalize='none'
              editable={!isLoading}
            />
            <TouchableOpacity
              className={`bg-red py-3 rounded-lg w-full ${isLoading ? 'opacity-70' : 'opacity-100'}`}
              onPress={onRequestReset}
              disabled={isLoading}>
              <Text className='text-white text-center font-bold'>
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TextInput
              className={`w-full h-12 px-4 mb-4 rounded-lg ${
                isDarkMode ? 'bg-gray text-white' : 'bg-white text-black'
              }`}
              placeholder='Reset code'
              placeholderTextColor={isDarkMode ? '#A0AEC0' : '#718096'}
              value={code}
              onChangeText={setCode}
              editable={!isLoading}
            />
            <View className='relative mb-4 w-full'>
              <TextInput
                className={`w-full h-12 px-4 pr-12 rounded-lg ${
                  isDarkMode ? 'bg-gray text-white' : 'bg-white text-black'
                }`}
                placeholder='New password'
                placeholderTextColor={isDarkMode ? '#A0AEC0' : '#718096'}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!isLoading}
              />
              <TouchableOpacity
                className='absolute right-4 top-3'
                onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={24}
                  color={isDarkMode ? '#A0AEC0' : '#718096'}
                />
              </TouchableOpacity>
            </View>
            <View className='relative mb-4 w-full'>
              <TextInput
                className={`w-full h-12 px-4 pr-12 rounded-lg ${
                  isDarkMode ? 'bg-gray text-white' : 'bg-white text-black'
                }`}
                placeholder='Confirm new password'
                placeholderTextColor={isDarkMode ? '#A0AEC0' : '#718096'}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                editable={!isLoading}
              />
            </View>
            <TouchableOpacity
              className={`bg-red py-3 rounded-lg w-full ${isLoading ? 'opacity-70' : 'opacity-100'}`}
              onPress={onReset}
              disabled={isLoading}>
              <Text className='text-white text-center font-bold'>
                {isLoading ? 'Resetting...' : 'Reset Password'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  )
}