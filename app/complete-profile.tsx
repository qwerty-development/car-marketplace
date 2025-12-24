import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  BackHandler,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { useAuth } from '@/utils/AuthContext';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import CustomPhoneInput, { ICountry, getCallingCode } from '@/components/PhoneInput';
import { supabase } from '@/utils/supabase';

export default function CompleteProfileScreen() {
  const { user, profile, updateUserProfile, signOut } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [originalEmail, setOriginalEmail] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<ICountry | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [otp, setOtp] = useState('');
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const [verifyingPhone, setVerifyingPhone] = useState('');

  const isInputVerified = React.useMemo(() => {
    let cleanPhoneInput = phone.replace(/\D/g, '');
    let fullInputPhone = cleanPhoneInput;

    if (selectedCountry) {
      const callingCode = getCallingCode(selectedCountry).replace(/\D/g, '');
      fullInputPhone = `+${callingCode}${cleanPhoneInput}`;
    } else {
      // If no country selected, assume phone might have it or not, but usually we should depend on country code.
      // For backward compatibility or if pre-filled with +:
      if (phone.trim().startsWith('+')) {
        fullInputPhone = phone.trim();
      }
    }

    // If fullInputPhone is just empty or just +, ignore
    if (fullInputPhone.length < 5) return false;

    if (verifiedPhone === fullInputPhone) return true;

    // Check if user already has this phone confirmed
    if (user?.phone_confirmed_at && user.phone === fullInputPhone) return true;

    return false;
  }, [user, phone, verifiedPhone, selectedCountry]);
  const [errors, setErrors] = useState({
    name: '',
    email: '',
    phone: '',
    general: '',
  });

  // Pre-fill data
  useEffect(() => {
    if (user) {
      setName(profile?.name || user.user_metadata?.name || '');
      const currentEmail = profile?.email || user.email || '';
      setEmail(currentEmail);
      setOriginalEmail(currentEmail || null);
      setPhone(profile?.phone_number || user.phone || '');
    }
  }, [user, profile]);

  // Block hardware back button on Android
  useEffect(() => {
    const backAction = () => {
      // Prevent going back
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, []);

  const handleSendOtp = async () => {
    if (!phone.trim() || phone.length < 6) {
      setErrors(prev => ({ ...prev, phone: 'Please enter a valid phone number' }));
      return;
    }

    if (!selectedCountry) {
      setErrors(prev => ({ ...prev, phone: 'Please select a country' }));
      return;
    }

    setIsVerifying(true);
    setErrors(prev => ({ ...prev, phone: '', general: '' }));

    try {
      const callingCode = getCallingCode(selectedCountry).replace(/\D/g, '');
      const cleanedPhone = phone.replace(/\D/g, '');
      const fullPhoneNumber = `+${callingCode}${cleanedPhone}`;

      console.log('[CompleteProfile] Sending OTP to:', fullPhoneNumber);
      const { error } = await supabase.auth.updateUser({
        phone: fullPhoneNumber,
      });

      if (error) {
        if (error.message.includes('already registered') ||
          error.message.includes('already been registered')) {
          throw new Error('This phone number is already in use by another account.');
        } else if (error.message.includes('rate limit')) {
          throw new Error('Too many requests. Please wait a moment and try again.');
        } else {
          throw error;
        }
      }

      setVerifyingPhone(fullPhoneNumber);
      setShowOtpModal(true);
      setOtp(''); // Reset OTP input
    } catch (error: any) {
      console.error('Send OTP failed:', error);
      Alert.alert('Error', error.message || 'Failed to send verification code.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length < 6) {
      Alert.alert('Invalid Code', 'Please enter the 6-digit code sent to your phone.');
      return;
    }
    if (!verifyingPhone) {
      Alert.alert('Error', 'Phone number is missing. Please close and try again.');
      return;
    }

    setIsVerifying(true);
    try {
      console.log('[CompleteProfile] Verifying OTP for:', verifyingPhone);
      const { data, error } = await supabase.auth.verifyOtp({
        phone: verifyingPhone,
        token: otp,
        type: 'phone_change',
      });

      if (error) throw error;

      console.log('[CompleteProfile] Phone verified successfully');
      setVerifiedPhone(verifyingPhone);
      setShowOtpModal(false);
      setOtp('');
      Alert.alert('Success', 'Phone number verified successfully!');

    } catch (error: any) {
      console.error('Verify OTP failed:', error);
      Alert.alert('Verification Failed', error.message || 'Invalid code. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const validateInputs = () => {
    let isValid = true;
    const newErrors = {
      name: '',
      email: '',
      phone: '',
      general: '',
    };

    if (!name.trim()) {
      newErrors.name = 'Name is required';
      isValid = false;
    }

    // Email is optional, but validate format if provided
    if (email.trim() && !/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Invalid email format';
      isValid = false;
    }

    if (!phone.trim()) {
      newErrors.phone = 'Phone number is required';
      isValid = false;
    } else if (phone.length < 8) { // Basic length check
      newErrors.phone = 'Invalid phone number';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async () => {
    if (!validateInputs()) return;

    if (!isInputVerified) {
      Alert.alert('Verification Required', 'Please verify your phone number to continue.');
      return;
    }

    setIsLoading(true);
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const hasNewEmail = trimmedEmail && trimmedEmail !== originalEmail?.toLowerCase();

      // Update profile data
      const { error } = await updateUserProfile({
        name,
        email: hasNewEmail ? undefined : (trimmedEmail || undefined),
        phone_number: phone.trim(),
      });

      if (error) {
        throw error;
      }

      // If user is adding/changing email, trigger verification flow
      if (hasNewEmail) {
        try {
          // Trigger email change verification
          const { error: emailError } = await supabase.auth.updateUser({
            email: trimmedEmail,
          });

          if (emailError) {
            if (emailError.message.includes('already registered') ||
              emailError.message.includes('already been registered')) {
              throw new Error('This email is already in use by another account.');
            } else if (emailError.message.includes('rate limit')) {
              throw new Error('Too many requests. Please wait a moment and try again.');
            } else {
              throw emailError;
            }
          }

          // Navigate to OTP verification screen
          Alert.alert(
            'Verify Your Email',
            'We\'ve sent a verification code to your email address. Please verify it to complete your profile.',
            [
              {
                text: 'Continue',
                onPress: () => {
                  router.push({
                    pathname: '/(home)/(user)/VerifyEmailOtp',
                    params: {
                      email: trimmedEmail,
                      isChange: 'false',
                    },
                  });
                },
              },
            ]
          );
        } catch (emailError: any) {
          console.error('Email verification trigger failed:', emailError);
          // Profile was saved successfully, but email verification failed
          // Show error but don't block the user - they can add email later
          Alert.alert(
            'Email Verification Failed',
            emailError.message || 'Unable to send verification email. You can add your email later from your profile settings.',
            [{ text: 'OK' }]
          );
        }
      }
      // Success is handled by the auth state listener in _layout which will unblock the user
      // If no verification needed, the profile update is complete

    } catch (error: any) {
      console.error('Profile completion failed:', error);
      setErrors(prev => ({
        ...prev,
        general: error.message || 'Failed to update profile. Please try again.',
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/(auth)/sign-in');
    } catch (e) {
      console.error("Sign out failed", e);
    }
  }

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: isDark ? '#000' : '#fff',
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            padding: 24,
            justifyContent: 'center'
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <Text
              style={{
                fontSize: 28,
                fontWeight: 'bold',
                color: '#D55004',
                textAlign: 'center',
                marginBottom: 12,
              }}
            >
              Complete Your Profile
            </Text>
            <Text
              style={{
                color: isDark ? '#9CA3AF' : '#6B7280',
                textAlign: 'center',
                fontSize: 16
              }}
            >
              Please provide your details to continue using the app.
            </Text>
          </View>

          <View style={{ gap: 20 }}>
            {/* Name Input */}
            <View>
              <Text style={{
                color: isDark ? '#E5E7EB' : '#374151',
                marginBottom: 8,
                fontWeight: '600'
              }}>
                Full Name *
              </Text>
              <TextInput
                style={{
                  height: 50,
                  paddingHorizontal: 16,
                  backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
                  color: isDark ? '#fff' : '#000',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: errors.name ? '#EF4444' : (isDark ? '#374151' : '#E5E7EB'),
                }}
                value={name}
                placeholder="Enter your full name"
                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                onChangeText={(text) => {
                  setName(text);
                  if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
                }}
                editable={!isLoading}
              />
              {errors.name ? (
                <Text style={{ color: '#EF4444', fontSize: 13, marginTop: 4 }}>
                  {errors.name}
                </Text>
              ) : null}
            </View>

            {/* Email Input */}
            <View>
              <Text style={{
                color: isDark ? '#E5E7EB' : '#374151',
                marginBottom: 8,
                fontWeight: '600'
              }}>
                Email Address (Optional)
              </Text>
              {!originalEmail && (
                <Text style={{
                  color: isDark ? '#9CA3AF' : '#6B7280',
                  marginBottom: 8,
                  fontSize: 13,
                }}>
                  Adding an email will require verification
                </Text>
              )}
              <TextInput
                style={{
                  height: 50,
                  paddingHorizontal: 16,
                  backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
                  color: isDark ? '#fff' : '#000',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: errors.email ? '#EF4444' : (isDark ? '#374151' : '#E5E7EB'),
                }}
                value={email}
                placeholder="Enter your email"
                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading}
              />
              {errors.email ? (
                <Text style={{ color: '#EF4444', fontSize: 13, marginTop: 4 }}>
                  {errors.email}
                </Text>
              ) : null}
            </View>

            {/* Phone Input */}
            <View>
              <CustomPhoneInput
                label="Phone Number *"
                value={phone}
                onChangePhoneNumber={(text) => {
                  setPhone(text);
                  if (errors.phone) setErrors(prev => ({ ...prev, phone: '' }));
                }}
                selectedCountry={selectedCountry}
                onChangeSelectedCountry={setSelectedCountry}
              />

              {/* Verify Button */}
              {!isInputVerified && (
                <TouchableOpacity
                  style={{
                    marginTop: 10,
                    width: '100%',
                    height: 50,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: '#D55004',
                    borderRadius: 12,
                    opacity: isLoading || !phone.trim() ? 0.6 : 1,
                  }}
                  onPress={handleSendOtp}
                  disabled={isLoading || !phone.trim()}
                >
                  {isVerifying ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text style={{ color: 'white', fontWeight: 'bold' }}>
                      Verify Phone Number
                    </Text>
                  )}
                </TouchableOpacity>
              )}
              {isInputVerified && (
                <View style={{
                  marginTop: 10,
                  width: '100%',
                  height: 50,
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: '#10B981',
                  borderRadius: 12,
                }}>
                  <Text style={{ color: 'white', fontWeight: 'bold' }}>
                    Phone Verified
                  </Text>
                </View>
              )}

              {errors.phone ? (
                <Text style={{ color: '#EF4444', fontSize: 13, marginTop: 4 }}>
                  {errors.phone}
                </Text>
              ) : null}
            </View>
          </View>

          {errors.general ? (
            <Text style={{ color: '#EF4444', textAlign: 'center', marginTop: 16 }}>
              {errors.general}
            </Text>
          ) : null}

          <TouchableOpacity
            style={{
              backgroundColor: '#D55004',
              paddingVertical: 16,
              borderRadius: 24,
              marginTop: 32,
              opacity: isLoading ? 0.7 : 1,
            }}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={{
                color: 'white',
                fontWeight: 'bold',
                fontSize: 18,
                textAlign: 'center'
              }}>
                Save & Continue
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              marginTop: 16,
              padding: 12,
            }}
            onPress={handleSignOut}
            disabled={isLoading}
          >
            <Text style={{
              color: isDark ? '#9CA3AF' : '#6B7280',
              textAlign: 'center',
              fontSize: 14
            }}>
              Sign Out
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* OTP Modal */}
      <Modal
        visible={showOtpModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOtpModal(false)}
      >
        <View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.5)',
          padding: 24,
        }}>
          <View style={{
            width: '100%',
            backgroundColor: isDark ? '#1F2937' : 'white',
            borderRadius: 24,
            padding: 24,
            alignItems: 'center',
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 5,
          }}>
            <Text style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: isDark ? 'white' : 'black',
              marginBottom: 8,
            }}>
              Enter Verification Code
            </Text>
            <Text style={{
              fontSize: 14,
              color: isDark ? '#9CA3AF' : '#6B7280',
              textAlign: 'center',
              marginBottom: 24,
            }}>
              We sent a 6-digit code to {verifyingPhone}
            </Text>

            <TextInput
              style={{
                width: '100%',
                height: 50,
                backgroundColor: isDark ? '#374151' : '#F3F4F6',
                borderRadius: 12,
                paddingHorizontal: 16,
                fontSize: 18,
                textAlign: 'center',
                letterSpacing: 4,
                color: isDark ? 'white' : 'black',
                marginBottom: 24,
              }}
              value={otp}
              onChangeText={setOtp}
              placeholder="000000"
              placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />

            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: isDark ? '#374151' : '#E5E7EB',
                }}
                onPress={() => setShowOtpModal(false)}
                disabled={isVerifying}
              >
                <Text style={{
                  color: isDark ? 'white' : 'black',
                  textAlign: 'center',
                  fontWeight: '600',
                }}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#D55004',
                  paddingVertical: 14,
                  borderRadius: 16,
                  opacity: isVerifying ? 0.7 : 1,
                }}
                onPress={handleVerifyOtp}
                disabled={isVerifying}
              >
                {isVerifying ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={{
                    color: 'white',
                    textAlign: 'center',
                    fontWeight: 'bold',
                  }}>
                    Verify
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView >
  );
}
