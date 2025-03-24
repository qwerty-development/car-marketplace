import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Dimensions,
  Animated,
  Easing,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native'
import { useAuth } from '@/utils/AuthContext'
import { useRouter } from 'expo-router'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { useTheme } from '@/utils/ThemeContext'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/utils/supabase'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'

const { width, height } = Dimensions.get('window')

// Floating particles animation
const Particle = ({ delay = 0, size = 2, speed = 15000, color = 'rgba(255, 0, 0, 0.15)' }) => {
  const position = useRef(new Animated.ValueXY({
    x: Math.random() * width,
    y: -size
  })).current

  const opacity = useRef(new Animated.Value(0)).current
  const scale = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    // Random horizontal drift
    const driftX = Math.random() * width/3 - width/6

    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(position, {
          toValue: {
            x: position.x._value + driftX,
            y: height + size
          },
          duration: speed,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start(() => {
      position.setValue({
        x: Math.random() * width,
        y: -size
      })
      scale.setValue(0.3)

      // Restart animation
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(position, {
          toValue: {
            x: position.x._value + driftX,
            y: height + size
          },
          duration: speed,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start()
    })
  }, [])

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity,
        transform: [
          ...position.getTranslateTransform(),
          { scale }
        ]
      }}
    />
  )
}

// Animated grid line
const GridLine = ({ horizontal = false, index = 0, total = 10, color = 'rgba(255, 0, 0, 0.1)' }) => {
  const opacity = useRef(new Animated.Value(0)).current
  const position = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // Staggered animation for grid lines
    Animated.sequence([
      Animated.delay(index * 150),
      Animated.timing(opacity, {
        toValue: 0.4,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(position, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    ]).start()
  }, [])

  const positionStyle = horizontal
    ? {
        width: width * 2,
        height: 1,
        left: -width/2,
        top: height * (index / total),
        transform: [
          {
            translateX: position.interpolate({
              inputRange: [0, 1],
              outputRange: [-width/2, 0]
            })
          }
        ]
      }
    : {
        width: 1,
        height: height * 2,
        left: width * (index / total),
        top: -height/2,
        transform: [
          {
            translateY: position.interpolate({
              inputRange: [0, 1],
              outputRange: [-height/2, 0]
            })
          }
        ]
      }

  return (
    <Animated.View
      style={{
        position: 'absolute',
        backgroundColor: color,
        opacity,
        ...positionStyle
      }}
    />
  )
}

const AnimatedPulse = ({ x, y, size = 50, color = 'rgba(255, 0, 0, 0.2)' }) => {
  const scale = useRef(new Animated.Value(0.2)).current
  const opacity = useRef(new Animated.Value(0.7)).current

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 1.5,
          duration: 2000,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ])
    ).start()
  }, [])

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        left: x - size/2,
        top: y - size/2,
        opacity,
        transform: [{ scale }]
      }}
    />
  )
}

const CustomHeader = ({ title, onBack }) => {
  const { isDarkMode } = useTheme()
  const translateX = useRef(new Animated.Value(-50)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onBack()
  }

  return (
    <LinearGradient
      colors={['rgba(0, 0, 0, 0.9)', 'rgba(0, 0, 0, 0.7)', 'rgba(0, 0, 0, 0)']}
      style={{ position: 'absolute', left: 0, right: 0, zIndex: 10 }}>
      <SafeAreaView edges={['top']}>
        <View className='flex-row items-center justify-between py-4 px-4'>
          <TouchableOpacity
            onPress={handleBack}
            className='w-10 h-10 rounded-full flex items-center justify-center'
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
            <Ionicons
              name='chevron-back'
              size={24}
              color='white'
            />
          </TouchableOpacity>
          <Animated.Text
            className='text-xl font-bold text-white'
            style={{
              opacity,
              transform: [{ translateX }]
            }}>
            {title}
          </Animated.Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>
    </LinearGradient>
  )
}

const FuturisticInput = ({
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  toggleSecure,
  keyboardType = 'default',
  autoCapitalize = 'none',
  isValid = null,
  editable = true
}) => {
  const { isDarkMode } = useTheme()
  const inputRef = useRef(null)
  const [isFocused, setIsFocused] = useState(false)
  const focusAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: isFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start()
  }, [isFocused])

  // Border color based on state
  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      '#FF3B30'
    ]
  })

  // Status indicator color
  const getStatusColor = () => {
    if (isValid === null) return 'transparent'
    return isValid ? '#4CD964' : '#FF3B30'
  }

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => inputRef.current?.focus()}
      className='mb-4 w-full'>
      <Animated.View
        className='rounded-xl overflow-hidden'
        style={{
          borderWidth: 1,
          borderColor,
          backgroundColor: isDarkMode
            ? 'rgba(30, 30, 30, 0.8)'
            : 'rgba(255, 255, 255, 0.9)',
        }}>
        <BlurView intensity={10} tint={isDarkMode ? 'dark' : 'light'} className='overflow-hidden'>
          <View className='flex-row items-center'>
            <TextInput
              ref={inputRef}
              className='flex-1 px-4 py-3.5 text-base'
              style={{ color: isDarkMode ? 'white' : 'black' }}
              placeholder={placeholder}
              placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
              value={value}
              onChangeText={onChangeText}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              secureTextEntry={secureTextEntry}
              keyboardType={keyboardType}
              autoCapitalize={autoCapitalize}
              editable={editable}
            />

            <View className='flex-row items-center pr-3'>
              {isValid !== null && (
                <View
                  className='w-2 h-2 rounded-full mr-2'
                  style={{ backgroundColor: getStatusColor() }}
                />
              )}

              {toggleSecure && (
                <TouchableOpacity onPress={toggleSecure}>
                  <Ionicons
                    name={secureTextEntry ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color={isDarkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </BlurView>
      </Animated.View>
    </TouchableOpacity>
  )
}

const FuturisticButton = ({ title, onPress, isLoading = false, style = {} }) => {
  const buttonScale = useRef(new Animated.Value(1)).current

  const handlePressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start()
  }

  const handlePressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      useNativeDriver: true,
    }).start()
  }

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onPress()
  }

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={isLoading}
      className='w-full'>
      <Animated.View
        className='overflow-hidden rounded-lg'
        style={{
          transform: [{ scale: buttonScale }],
          ...style
        }}>
        <LinearGradient
          colors={['#FF3B30', '#FF9500']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className='py-4 px-6 rounded-lg'>
          <View className='flex-row justify-center items-center'>
            {isLoading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <Text className='text-white font-bold text-center text-base'>
                  {title}
                </Text>
                <MaterialCommunityIcons
                  name="arrow-right"
                  size={20}
                  color="white"
                  style={{ marginLeft: 8 }}
                />
              </>
            )}
          </View>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
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
  const [stage, setStage] = useState('request') // 'request' or 'reset'
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Validation states
  const [emailValid, setEmailValid] = useState(null)
  const [passwordValid, setPasswordValid] = useState(null)
  const [confirmValid, setConfirmValid] = useState(null)
  const [codeValid, setCodeValid] = useState(null)

  // Fade in animation for content
  const contentOpacity = useRef(new Animated.Value(0)).current
  const contentTranslateY = useRef(new Animated.Value(20)).current

  // Scale animation for stage switch
  const stageScale = useRef(new Animated.Value(1)).current
  const stageOpacity = useRef(new Animated.Value(1)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(contentTranslateY, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  useEffect(() => {
    // Email validation
    if (emailAddress.length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      setEmailValid(emailRegex.test(emailAddress))
    } else {
      setEmailValid(null)
    }

    // Password validation
    if (password.length > 0) {
      setPasswordValid(password.length >= 8)
    } else {
      setPasswordValid(null)
    }

    // Confirm password validation
    if (confirmPassword.length > 0) {
      setConfirmValid(password === confirmPassword)
    } else {
      setConfirmValid(null)
    }

    // Code validation (simple non-empty check)
    if (code.length > 0) {
      setCodeValid(code.length >= 6)
    } else {
      setCodeValid(null)
    }
  }, [emailAddress, password, confirmPassword, code])

  const animateStageChange = (newStage) => {
    // Animate content out
    Animated.parallel([
      Animated.timing(stageScale, {
        toValue: 0.95,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(stageOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Change stage
      setStage(newStage)

      // Animate new content in
      Animated.parallel([
        Animated.timing(stageScale, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(stageOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start()
    })
  }

  const onRequestReset = async () => {
    if (!emailAddress.trim() || !emailValid) {
      Alert.alert('Error', 'Please enter a valid email address')
      return
    }

    setIsLoading(true)
    try {
      const { error } = await resetPassword(emailAddress)

      if (error) throw error

      animateStageChange('reset')
      Alert.alert(
        'Password Reset',
        'Check your email for the verification code to reset your password.',
        [{ text: 'OK' }]
      )
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to request password reset')
    } finally {
      setIsLoading(false)
    }
  }

  const onReset = async () => {
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match')
      return
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long')
      return
    }

    if (!code.trim()) {
      Alert.alert('Error', 'Please enter the verification code')
      return
    }

    setIsLoading(true)
    try {
      // Verify the OTP token and set the new password
      const { error } = await supabase.auth.verifyOtp({
        email: emailAddress,
        token: code,
        type: 'recovery',
      })

      if (error) throw error

      // Update the user's password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      })

      if (updateError) throw updateError

      Alert.alert(
        'Success',
        'Your password has been reset successfully',
        [
          {
            text: 'Sign In',
            onPress: () => router.replace('/sign-in')
          }
        ]
      )
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to reset password')
    } finally {
      setIsLoading(false)
    }
  }

  // Create background animation particles
  const particles = Array.from({ length: 20 }, (_, i) => (
    <Particle
      key={`particle-${i}`}
      delay={i * 500}
      size={Math.random() * 5 + 1}
      speed={Math.random() * 10000 + 15000}
      color={`rgba(255, ${Math.floor(Math.random() * 100)}, ${Math.floor(Math.random() * 50)}, ${Math.random() * 0.2 + 0.1})`}
    />
  ))

  // Create grid lines
  const gridLinesH = Array.from({ length: 8 }, (_, i) => (
    <GridLine key={`grid-h-${i}`} horizontal index={i} total={8} />
  ))

  const gridLinesV = Array.from({ length: 8 }, (_, i) => (
    <GridLine key={`grid-v-${i}`} horizontal={false} index={i} total={8} />
  ))

  return (
    <View className="flex-1" style={{ backgroundColor: isDarkMode ? '#010101' : '#f5f5f7' }}>
      {/* Background effects */}
      <View className="absolute inset-0 overflow-hidden">
        {/* Grid lines */}
        {gridLinesH}
        {gridLinesV}

        {/* Particles */}
        {particles}

        {/* Accent circles */}
        <AnimatedPulse x={width * 0.8} y={height * 0.2} size={100} />
        <AnimatedPulse x={width * 0.2} y={height * 0.7} size={150} />
      </View>

      {/* Header */}
      <CustomHeader
        title="Reset Password"
        onBack={() => router.back()}
      />

      {/* Content */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            className="flex-1 justify-center items-center px-6"
            style={{
              opacity: contentOpacity,
              transform: [{ translateY: contentTranslateY }]
            }}
          >
            <Animated.View
              className="w-full max-w-sm"
              style={{
                opacity: stageOpacity,
                transform: [{ scale: stageScale }]
              }}
            >
              {stage === 'request' ? (
                <>
                  <Text className={`text-2xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-black'}`}>
                    Forgot Password
                  </Text>
                  <Text className={`text-base mb-6 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                    Enter your email to receive a verification code
                  </Text>

                  <FuturisticInput
                    value={emailAddress}
                    onChangeText={setEmailAddress}
                    placeholder="Email Address"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    isValid={emailValid}
                    editable={!isLoading}
                  />

                  <FuturisticButton
                    title="Send Verification Code"
                    onPress={onRequestReset}
                    isLoading={isLoading}
                    style={{ marginTop: 10 }}
                  />
                </>
              ) : (
                <>
                  <Text className={`text-2xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-black'}`}>
                    Create New Password
                  </Text>
                  <Text className={`text-base mb-6 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                    Enter the verification code sent to your email
                  </Text>

                  <FuturisticInput
                    value={code}
                    onChangeText={setCode}
                    placeholder="Verification Code"
                    isValid={codeValid}
                    editable={!isLoading}
                  />

                  <FuturisticInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="New Password"
                    secureTextEntry={!showPassword}
                    toggleSecure={() => setShowPassword(!showPassword)}
                    isValid={passwordValid}
                    editable={!isLoading}
                  />

                  <FuturisticInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm New Password"
                    secureTextEntry={!showPassword}
                    isValid={confirmValid}
                    editable={!isLoading}
                  />

                  <FuturisticButton
                    title="Reset Password"
                    onPress={onReset}
                    isLoading={isLoading}
                    style={{ marginTop: 10 }}
                  />

                  <TouchableOpacity
                    className="mt-4 p-2"
                    onPress={() => animateStageChange('request')}>
                    <Text className="text-center text-rose-500">
                      ← Back to Email Entry
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </Animated.View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}