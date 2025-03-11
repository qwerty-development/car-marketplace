import React, { useEffect, useCallback, useState } from 'react';
import { useAuth } from '@/utils/AuthContext';
import { useRouter } from 'expo-router';
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  ScrollView,
  Alert,
  ActivityIndicator,
  useColorScheme,
  Easing,
} from 'react-native';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { maybeCompleteAuthSession } from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';

maybeCompleteAuthSession();

const { width, height } = Dimensions.get('window');

// Animated background blob component
interface BlobProps {
  position: { x: number; y: number };
  size: number;
  delay: number;
  duration: number;
}

const AnimatedBlob: React.FC<BlobProps> = ({ position, size, delay, duration }) => {
  const translateY = new Animated.Value(0);
  const scale = new Animated.Value(1);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.sequence([
            Animated.timing(translateY, {
              toValue: 20,
              duration: duration,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(translateY, {
              toValue: 0,
              duration: duration,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(scale, {
              toValue: 1.1,
              duration: duration * 1.2,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(scale, {
              toValue: 1,
              duration: duration * 1.2,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
        ]),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: isDark ? 'rgba(213, 80, 4, 0.08)' : 'rgba(213, 80, 4, 0.05)',
        transform: [
          { translateY },
          { scale },
        ],
      }}
    />
  );
};

const SignUpWithOAuth = () => {
  const [isLoading, setIsLoading] = useState<{
    google: boolean;
    apple: boolean;
  }>({ google: false, apple: false });
  const { googleSignIn } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);

  // Check if Apple Authentication is available
  useEffect(() => {
    const checkAppleAuthAvailability = async () => {
      try {
        const isAvailable = await AppleAuthentication.isAvailableAsync();
        setAppleAuthAvailable(isAvailable);
      } catch (error) {
        console.log('Apple Authentication not available on this device');
        setAppleAuthAvailable(false);
      }
    };

    checkAppleAuthAvailability();
  }, []);

const handleGoogleAuth = async () => {
  try {
    setIsLoading(prev => ({ ...prev, google: true }));

    // Step 1: Call googleSignIn and capture the result
    const result = await googleSignIn();
    console.log("Google sign-in result:", JSON.stringify(result));

    // Step 2: Evaluate success and navigate accordingly
    if (result && result.success === true) {
      console.log("Google authentication successful, navigating to home");
      router.replace("/(home)");
    } else {
      console.log("Google authentication unsuccessful:",
                 result ? `Result received but success=${result.success}` : "No result returned");

      // Step 3: Fallback session check
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user) {
        console.log("Session found despite unsuccessful result, navigating to home");
        router.replace("/(home)");
      }
    }
  } catch (err) {
    console.error("Google OAuth error:", err);
    Alert.alert(
      "Authentication Error",
      "Failed to authenticate with Google"
    );
  } finally {
    setIsLoading(prev => ({ ...prev, google: false }));
  }
};

  const handleAppleAuth = async () => {
    try {
      setIsLoading(prev => ({ ...prev, apple: true }));

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // Sign in via Supabase Auth
      if (credential.identityToken) {
        const { error, data } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
        });

        if (error) {
          throw error;
        }

        // If successful, navigate to home
        router.replace('/(home)');
      } else {
        throw new Error('No identity token received from Apple');
      }
    } catch (err: any) {
      if (err.code === 'ERR_REQUEST_CANCELED') {
        // User canceled the sign-in flow, no need to show an error
        console.log('User canceled Apple sign-in');
      } else {
        console.error('Apple OAuth error:', err);
        Alert.alert(
          'Authentication Error',
          err.message || 'Failed to authenticate with Apple'
        );
      }
    } finally {
      setIsLoading(prev => ({ ...prev, apple: false }));
    }
  };

  return (
    <View style={{ width: '100%', marginTop: 32, alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', gap: 16 }}>
        {/* Google Authentication Button */}
        <TouchableOpacity
          onPress={handleGoogleAuth}
          disabled={isLoading.google}
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
            borderWidth: 1,
            borderColor: isDark ? '#374151' : '#E5E7EB',
            width: 56,
            height: 56,
            borderRadius: 28,
          }}
        >
          {isLoading.google ? (
            <ActivityIndicator size="small" color={isDark ? '#fff' : '#000'} />
          ) : (
            <Ionicons name="logo-google" size={24} color={isDark ? '#fff' : '#000'} />
          )}
        </TouchableOpacity>

        {/* Apple Authentication Button */}
        {Platform.OS === 'ios' && appleAuthAvailable ? (
          // On iOS, use native Apple Authentication button if available
          <View style={{ width: 56, height: 56, overflow: 'hidden', borderRadius: 28 }}>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
              buttonStyle={isDark
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={28}
              style={{
                width: 56,
                height: 56,
                borderWidth: 1,
                borderColor: isDark ? '#374151' : '#E5E7EB',
              }}
              onPress={handleAppleAuth}
            />
            {isLoading.apple && (
              <View style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.4)',
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: 28,
              }}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            )}
          </View>
        ) : (
          // On Android or if Apple Authentication is not available, show a custom button
          <TouchableOpacity
            onPress={handleAppleAuth}
            disabled={isLoading.apple || !appleAuthAvailable}
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
              borderWidth: 1,
              borderColor: isDark ? '#374151' : '#E5E7EB',
              width: 56,
              height: 56,
              borderRadius: 28,
              opacity: appleAuthAvailable ? 1 : 0.5,
            }}
          >
            {isLoading.apple ? (
              <ActivityIndicator size="small" color={isDark ? '#fff' : '#000'} />
            ) : (
              <Ionicons name="logo-apple" size={24} color={isDark ? '#fff' : '#000'} />
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default function SignUpScreen() {
  const { signUp, isLoaded } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [name, setName] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState({
    name: '',
    email: '',
    password: '',
    code: '',
    general: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  const validateInputs = () => {
    let isValid = true;
    const newErrors = {
      name: '',
      email: '',
      password: '',
      code: '',
      general: '',
    };

    if (!name.trim()) {
      newErrors.name = 'Name is required';
      isValid = false;
    }

    if (!emailAddress.trim()) {
      newErrors.email = 'Email is required';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(emailAddress)) {
      newErrors.email = 'Invalid email format';
      isValid = false;
    }

    if (!password) {
      newErrors.password = 'Password is required';
      isValid = false;
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const onSignUpPress = async () => {
    if (!isLoaded) return;
    if (!validateInputs()) return;

    setIsLoading(true);
    try {
      const { error, needsEmailVerification } = await signUp({
        email: emailAddress,
        password,
        name,
      });

      if (error) throw error;

      if (needsEmailVerification) {
        setPendingVerification(true);
        Alert.alert(
          'Verification Email Sent',
          'Please check your email for a verification link to complete your registration.',
          [{ text: 'OK' }]
        );
      } else {
        // If email verification not required, registration is complete
        router.replace('/(home)');
      }
    } catch (error: any) {
      console.error(JSON.stringify(error, null, 2));
      setErrors(prev => ({
        ...prev,
        general: error.message || 'Sign up failed. Please try again.',
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const onPressVerify = async () => {
    if (!isLoaded) return;
    if (!code.trim()) {
      setErrors(prev => ({ ...prev, code: 'Verification code is required' }));
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: emailAddress,
        token: code,
        type: 'signup',
      });

      if (error) throw error;

      Alert.alert(
        'Success',
        'Your account has been verified successfully.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(home)'),
          },
        ]
      );
    } catch (error: any) {
      console.error(JSON.stringify(error, null, 2));
      setErrors(prev => ({
        ...prev,
        code: error.message || 'Verification failed. Please try again.',
      }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{
        flex: 1,
        backgroundColor: isDark ? '#000' : '#fff',
      }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: 24
        }}
      >
        {/* Animated Background */}
        <AnimatedBlob
          position={{ x: width * 0.1, y: height * 0.1 }}
          size={200}
          delay={0}
          duration={4000}
        />
        <AnimatedBlob
          position={{ x: width * 0.6, y: height * 0.2 }}
          size={300}
          delay={1000}
          duration={5000}
        />
        <AnimatedBlob
          position={{ x: width * 0.2, y: height * 0.7 }}
          size={250}
          delay={2000}
          duration={4500}
        />

        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 32, gap: 24 }}>
          <Text
            style={{
              fontSize: 32,
              fontWeight: 'bold',
              color: '#D55004',
              textAlign: 'center',
              marginBottom: 8,
            }}
          >
            {pendingVerification ? 'Verify Email' : 'Sign Up'}
          </Text>

          {!pendingVerification ? (
            <>
              <View style={{ gap: 16 }}>
                <View>
                  <TextInput
                    style={{
                      height: 48,
                      paddingHorizontal: 16,
                      backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
                      color: isDark ? '#fff' : '#000',
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: isDark ? '#374151' : '#E5E7EB',
                    }}
                    value={name}
                    placeholder="Full Name"
                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                    onChangeText={setName}
                    autoCapitalize="words"
                    autoComplete="name"
                    editable={!isLoading}
                  />
                  {errors.name && (
                    <Text style={{ color: '#D55004', fontSize: 14, marginTop: 4 }}>
                      {errors.name}
                    </Text>
                  )}
                </View>

                <View>
                  <TextInput
                    style={{
                      height: 48,
                      paddingHorizontal: 16,
                      backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
                      color: isDark ? '#fff' : '#000',
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: isDark ? '#374151' : '#E5E7EB',
                    }}
                    autoCapitalize="none"
                    value={emailAddress}
                    placeholder="Email"
                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                    onChangeText={setEmailAddress}
                    keyboardType="email-address"
                    autoComplete="email"
                    editable={!isLoading}
                  />
                  {errors.email && (
                    <Text style={{ color: '#D55004', fontSize: 14, marginTop: 4 }}>
                      {errors.email}
                    </Text>
                  )}
                </View>

                <View>
                  <View style={{ position: 'relative' }}>
                    <TextInput
                      style={{
                        height: 48,
                        paddingHorizontal: 16,
                        paddingRight: 48,
                        backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
                        color: isDark ? '#fff' : '#000',
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: isDark ? '#374151' : '#E5E7EB',
                      }}
                      value={password}
                      placeholder="Password"
                      placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                      secureTextEntry={!showPassword}
                      onChangeText={setPassword}
                      autoComplete="password"
                      editable={!isLoading}
                    />
                    <TouchableOpacity
                      style={{
                        position: 'absolute',
                        right: 16,
                        top: 12,
                      }}
                      onPress={togglePasswordVisibility}
                      disabled={isLoading}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off' : 'eye'}
                        size={24}
                        color={isDark ? '#6B7280' : '#9CA3AF'}
                      />
                    </TouchableOpacity>
                  </View>
                  {errors.password && (
                    <Text style={{ color: '#D55004', fontSize: 14, marginTop: 4 }}>
                      {errors.password}
                    </Text>
                  )}
                </View>
              </View>

              {errors.general && (
                <Text style={{ color: '#D55004', textAlign: 'center' }}>
                  {errors.general}
                </Text>
              )}

              <View style={{ gap: 16 }}>
                <TouchableOpacity
                  style={{
                    backgroundColor: '#D55004',
                    paddingVertical: 12,
                    borderRadius: 24,
                    opacity: isLoading ? 0.7 : 1,
                    marginTop: 8,
                  }}
                  onPress={onSignUpPress}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18, textAlign: 'center' }}>
                      Sign Up
                    </Text>
                  )}
                </TouchableOpacity>

                <SignUpWithOAuth />
              </View>

              <View style={{ alignItems: 'center', marginTop: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
                    Already have an account?{' '}
                  </Text>
                  <TouchableOpacity onPress={() => router.push('/sign-in')}>
                    <Text style={{ color: '#D55004', fontWeight: 'bold' }}>
                      Sign in
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          ) : (
            <View style={{ gap: 16 }}>
              <View>
                <TextInput
                  style={{
                    height: 48,
                    paddingHorizontal: 16,
                    backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
                    color: isDark ? '#fff' : '#000',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: isDark ? '#374151' : '#E5E7EB',
                  }}
                  value={code}
                  placeholder="Verification Code"
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  editable={!isLoading}
                />
                {errors.code && (
                  <Text style={{ color: '#D55004', fontSize: 14, marginTop: 4 }}>
                    {errors.code}
                  </Text>
                )}
              </View>

              {errors.general && (
                <Text style={{ color: '#D55004', textAlign: 'center' }}>
                  {errors.general}
                </Text>
              )}

              <TouchableOpacity
                style={{
                  backgroundColor: '#D55004',
                  paddingVertical: 12,
                  borderRadius: 24,
                  opacity: isLoading ? 0.7 : 1,
                  marginTop: 8,
                }}
                onPress={onPressVerify}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18, textAlign: 'center' }}>
                    Verify Email
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}