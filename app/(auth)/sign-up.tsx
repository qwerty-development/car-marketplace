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
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import CustomPhoneInput from '@/components/PhoneInput';

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
  const { googleSignIn, appleSignIn } = useAuth();
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
  
        // CRITICAL: Force token registration AFTER successful sign-in
        if (data?.user) {
          console.log("[APPLE-AUTH] Sign-in successful, registering push token");
          
          // Wait briefly for auth session to stabilize (important)
          setTimeout(async () => {
            try {
              // THIS IS THE CRITICAL PART - Direct database operation
              const projectId = Constants.expoConfig?.extra?.projectId || 'aaf80aae-b9fd-4c39-a48a-79f2eac06e68';
              const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
              const token = tokenResponse.data;
              
              // 1. Save to storage
              await SecureStore.setItemAsync('expoPushToken', token);
              
              // 2. Check if token exists for this user
              const { data: existingToken } = await supabase
                .from('user_push_tokens')
                .select('id')
                .eq('user_id', data.user.id)
                .eq('token', token)
                .maybeSingle();
                
              if (existingToken) {
                // 3a. Update if exists
                await supabase
                  .from('user_push_tokens')
                  .update({
                    signed_in: true,
                    active: true,
                    last_updated: new Date().toISOString()
                  })
                  .eq('id', existingToken.id);
                  
                console.log("[APPLE-AUTH] Updated existing token");
              } else {
                // 3b. Insert if doesn't exist
                const { error: insertError } = await supabase
                  .from('user_push_tokens')
                  .insert({
                    user_id: data.user.id,
                    token: token,
                    device_type: Platform.OS,
                    signed_in: true,
                    active: true,
                    last_updated: new Date().toISOString()
                  });
                  
                if (insertError) {
                  console.error("[APPLE-AUTH] Token insert error:", insertError);
                } else {
                  console.log("[APPLE-AUTH] Inserted new token");
                }
              }
            } catch (tokenError) {
              console.error("[APPLE-AUTH] Token registration error:", tokenError);
            }
          }, 1000);
        }
      } else {
        throw new Error('No identity token received from Apple');
      }
    } catch (err: any) {
      if (err.code === 'ERR_REQUEST_CANCELED') {
        console.log('User canceled Apple sign-in');
      } else {
        console.error("Apple OAuth error:", err);
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
  const { signUp, verifyOtp, isLoaded } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [name, setName] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [code, setCode] = useState('');
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pendingPhoneVerification, setPendingPhoneVerification] = useState(false);
  const [errors, setErrors] = useState({
    name: '',
    email: '',
    password: '',
    code: '',
    general: '',
    phone: '',
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
      phone: '',
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

  // Phone OTP send handler
  const handlePhoneSignUp = async () => {
    if (!name.trim()) {
      setErrors(prev => ({ ...prev, name: 'Name is required' }));
      return;
    }

    if (!phoneNumber) {
      setErrors(prev => ({ ...prev, phone: 'Phone number is required' }));
      return;
    }

    if (!phoneNumber.startsWith('+')) {
      setErrors(prev => ({ ...prev, phone: 'Phone number must include country code (e.g., +961...)' }));
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: phoneNumber,
      });

      if (error) {
        setErrors(prev => ({ ...prev, phone: error.message || 'Failed to send OTP' }));
        return;
      }

      setPendingPhoneVerification(true);
      Alert.alert(
        'OTP Sent',
        'Please check your phone for the verification code.',
        [{ text: 'OK' }]
      );
    } catch (err: any) {
      console.error('Phone OTP error:', err);
      setErrors(prev => ({ ...prev, phone: err.message || 'Failed to send OTP' }));
    } finally {
      setIsLoading(false);
    }
  };

  // Phone OTP verify handler
  const handlePhoneOtpVerify = async () => {
    if (!code.trim()) {
      setErrors(prev => ({ ...prev, code: 'Verification code is required' }));
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: phoneNumber,
        token: code,
        type: 'sms',
      });

      if (error) {
        setErrors(prev => ({ ...prev, code: error.message || 'Invalid verification code' }));
        return;
      }

      if (data.user) {
        // Update profile with name
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ name: name })
          .eq('id', data.user.id);

        if (updateError) {
          console.error('Error updating profile:', updateError);
        }

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
      }
    } catch (err: any) {
      console.error('Phone OTP verification error:', err);
      setErrors(prev => ({ ...prev, code: err.message || 'Verification failed' }));
    } finally {
      setIsLoading(false);
    }
  };

  const onSignUpPress = async () => {
    if (!isLoaded) return;
    if (!validateInputs()) return;

    setIsLoading(true);
    try {
      const { error, needsEmailVerification, email } = await signUp({
        email: emailAddress,
        password,
        name,
  });

      if (error) {
        // Check for specific email-exists errors and display them in the email field
        if (error.message.includes('already exists') ||
            error.message.includes('already registered') ||
            error.message.includes('already in use')) {
          setErrors(prev => ({
            ...prev,
            email: error.message || 'This email is already registered. Please try signing in.',
            general: '', // Clear general error since we're showing it in the email field
          }));
        } else {
          // Other errors go to the general error field
          setErrors(prev => ({
            ...prev,
            general: error.message || 'Sign up failed. Please try again.',
          }));
        }
        return; // Exit early - don't proceed with the rest of the function
      }

      if (needsEmailVerification) {
        setVerificationEmail(email || emailAddress);
        setPendingVerification(true);
        Alert.alert(
          'Verification Code Sent',
          'Please check your email for a verification code to complete your registration.',
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
      const { error, data } = await verifyOtp(verificationEmail, code);

      if (error) {
        throw error;
      }

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
            {pendingVerification ? 'Verify Email' : pendingPhoneVerification ? 'Verify Phone' : 'Create Account'}
          </Text>

          {!pendingVerification && !pendingPhoneVerification && (
            <View style={{ flexDirection: 'row', backgroundColor: isDark ? '#1F2937' : '#F3F4F6', borderRadius: 12, padding: 4 }}>
              <TouchableOpacity
                onPress={() => setAuthMethod('email')}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: 8,
                  backgroundColor: authMethod === 'email' ? '#D55004' : 'transparent',
                }}
              >
                <Text style={{ color: authMethod === 'email' ? 'white' : (isDark ? '#9CA3AF' : '#6B7280'), textAlign: 'center', fontWeight: '600' }}>
                  Email
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setAuthMethod('phone')}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: 8,
                  backgroundColor: authMethod === 'phone' ? '#D55004' : 'transparent',
                }}
              >
                <Text style={{ color: authMethod === 'phone' ? 'white' : (isDark ? '#9CA3AF' : '#6B7280'), textAlign: 'center', fontWeight: '600' }}>
                  Phone
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {!pendingVerification && !pendingPhoneVerification ? (
            authMethod === 'email' ? (
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
                  <CustomPhoneInput
                    value={phoneNumber}
                    onChangeFormattedText={(text) => {
                      setPhoneNumber(text);
                      if (errors.phone) setErrors(prev => ({ ...prev, phone: '' }));
                    }}
                    defaultCode="LB"
                    layout="first"
                    placeholder="Phone number"
                  />
                  {errors.phone && (
                    <Text style={{ color: '#D55004', fontSize: 14, marginTop: 4 }}>
                      {errors.phone}
                    </Text>
                  )}
                </View>
              </View>

              <TouchableOpacity
                style={{
                  backgroundColor: '#D55004',
                  paddingVertical: 12,
                  borderRadius: 24,
                  opacity: isLoading ? 0.7 : 1,
                  marginTop: 8,
                }}
                onPress={handlePhoneSignUp}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18, textAlign: 'center' }}>
                    Send Code
                  </Text>
                )}
              </TouchableOpacity>

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
          )
          ) : pendingPhoneVerification ? (
            <View style={{ gap: 16 }}>
              <Text style={{
                color: isDark ? '#E5E7EB' : '#4B5563',
                textAlign: 'center',
                marginBottom: 8
              }}>
                Enter the verification code sent to {phoneNumber}
              </Text>

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
                    fontSize: 16,
                    letterSpacing: 2,
                    textAlign: 'center',
                  }}
                  value={code}
                  placeholder="Enter 6-digit code"
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  onChangeText={(text) => setCode(text.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!isLoading}
                />
                {errors.code && (
                  <Text style={{ color: '#D55004', fontSize: 14, marginTop: 4, textAlign: 'center' }}>
                    {errors.code}
          </Text>
                )}
              </View>

              <TouchableOpacity
                style={{
                  backgroundColor: '#D55004',
                  paddingVertical: 12,
                  borderRadius: 24,
                  opacity: isLoading ? 0.7 : 1,
                  marginTop: 8,
                }}
                onPress={handlePhoneOtpVerify}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18, textAlign: 'center' }}>
                    Verify Phone
          </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setPendingPhoneVerification(false);
                  setCode('');
                  setErrors(prev => ({ ...prev, code: '' }));
                }}
                style={{ alignSelf: 'center', marginTop: 8 }}
              >
                <Text style={{ color: '#D55004', fontWeight: '500' }}>
                  Go Back
            </Text>
          </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 16 }}>
              <Text style={{
                color: isDark ? '#E5E7EB' : '#4B5563',
                textAlign: 'center',
                marginBottom: 8
              }}>
                We've sent a verification code to {verificationEmail}.
                Please enter it below to complete your registration.
          </Text>

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
                    fontSize: 16,
                    letterSpacing: 1
                  }}
                  value={code}
                  placeholder="Verification Code"
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  onChangeText={(text) => setCode(text.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  maxLength={6}
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

              <TouchableOpacity
                onPress={() => setPendingVerification(false)}
                style={{ alignSelf: 'center', marginTop: 8 }}
              >
                <Text style={{ color: '#D55004', fontWeight: '500' }}>
                  Go Back
            </Text>
          </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}