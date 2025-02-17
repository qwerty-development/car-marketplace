import React, { useEffect, useCallback, useState } from 'react';
import { useSignUp } from '@clerk/clerk-expo';
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
import { useOAuth } from '@clerk/clerk-expo';
import { maybeCompleteAuthSession } from 'expo-web-browser';

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
  const { startOAuthFlow: googleAuth } = useOAuth({ strategy: 'oauth_google' });
  const { startOAuthFlow: appleAuth } = useOAuth({ strategy: 'oauth_apple' });
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const onSelectAuth = async (strategy: 'google' | 'apple') => {
    try {
      setIsLoading(prev => ({ ...prev, [strategy]: true }));
      const selectedAuth = strategy === 'google' ? googleAuth : appleAuth;
      const { createdSessionId, setActive } = await selectedAuth();

      if (createdSessionId) {
        setActive && (await setActive({ session: createdSessionId }));
        router.replace('/(home)');
      }
    } catch (err) {
      console.error('OAuth error:', err);
      Alert.alert(
        'Authentication Error',
        'Failed to authenticate with ' + strategy.charAt(0).toUpperCase() + strategy.slice(1)
      );
    } finally {
      setIsLoading(prev => ({ ...prev, [strategy]: false }));
    }
  };

  return (
    <View style={{ width: '100%', marginTop: 32, alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <TouchableOpacity
          onPress={() => onSelectAuth('google')}
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

        <TouchableOpacity
          onPress={() => onSelectAuth('apple')}
          disabled={isLoading.apple}
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
          {isLoading.apple ? (
            <ActivityIndicator size="small" color={isDark ? '#fff' : '#000'} />
          ) : (
            <Ionicons name="logo-apple" size={24} color={isDark ? '#fff' : '#000'} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function SignUpScreen() {
  const { isLoaded, signUp, setActive } = useSignUp();
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
      await signUp.create({
        emailAddress,
        password,
      });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err: any) {
      console.error(JSON.stringify(err, null, 2));
      setErrors(prev => ({
        ...prev,
        general: err.errors?.[0]?.message || 'Sign up failed. Please try again.',
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
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (completeSignUp.status !== 'complete') {
        setErrors(prev => ({
          ...prev,
          code: 'Verification failed. Please try again.',
        }));
        return;
      }

      const { createdSessionId, createdUserId } = completeSignUp;

      if (!createdSessionId || !createdUserId) {
        setErrors(prev => ({
          ...prev,
          general: 'Failed to complete sign up. Please try again.',
        }));
        return;
      }

      await setActive({ session: createdSessionId });

      const { error: supabaseError } = await supabase.from('users').insert({
        id: createdUserId,
        name: name,
        email: emailAddress,
        created_at: new Date().toISOString(),
      });

      if (supabaseError) {
        console.error('Error creating user in Supabase:', supabaseError);
        Alert.alert(
          'Account Created',
          'Your account was created successfully, but there was an issue saving additional information. You can update your profile later.'
        );
      }

      router.replace('/(home)');
    } catch (err: any) {
      console.error(JSON.stringify(err, null, 2));
      setErrors(prev => ({
        ...prev,
        general: err.errors?.[0]?.message || 'An error occurred. Please try again.',
      }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
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
    </KeyboardAvoidingView>
  );
}