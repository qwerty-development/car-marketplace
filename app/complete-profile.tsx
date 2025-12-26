import React, { useState, useEffect, useCallback } from 'react';
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
import { useTheme } from '@/utils/ThemeContext';
import { supabase } from '@/utils/supabase';
import { DealerLogoPicker } from '@/components/DealerLogoPicker';
import { useImageUpload } from './(home)/(dealer)/hooks/useImageUpload';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';

export default function CompleteProfileScreen() {
  const { user, profile, dealership, updateUserProfile, updateDealershipProfile, signOut } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const isDark = theme.isDarkMode;

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

  // Dealership specific state
  const [logo, setLogo] = useState<string | null>(null);
  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  
  const { handleImageUpload, isUploading: isUploadingLogo } = useImageUpload(
    dealership?.id?.toString(),
    {
      onUploadComplete: (url) => {
        setLogo(url);
        if (errors.logo) setErrors(prev => ({ ...prev, logo: '' }));
      }
    }
  );

  const onPickLogo = useCallback(async () => {
    await handleImageUpload();
  }, [handleImageUpload]);

  const isPhoneSignUp = user?.app_metadata?.provider === 'phone';

  const isInputVerified = React.useMemo(() => {
    if (isPhoneSignUp) return true;

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
  }, [user, phone, verifiedPhone, selectedCountry, isPhoneSignUp]);
  const [errors, setErrors] = useState({
    name: '',
    email: '',
    phone: '',
    logo: '',
    location: '',
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
      
      if (profile?.role === 'dealer' && dealership) {
        setLogo(dealership.logo);
        setLocationName(dealership.location || '');
        
        // Convert to numbers and treat "0" or 0 as null to force re-selection if needed
        const lat = dealership.latitude ? parseFloat(String(dealership.latitude)) : null;
        const lng = dealership.longitude ? parseFloat(String(dealership.longitude)) : null;
        
        setLatitude(lat && lat !== 0 ? lat : null);
        setLongitude(lng && lng !== 0 ? lng : null);
      }
    }
  }, [user, profile, dealership]);

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

  const handleSendOtp = useCallback(async () => {
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
  }, [phone, selectedCountry]);

  const handleVerifyOtp = useCallback(async () => {
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
  }, [otp, verifyingPhone]);

  const validateInputs = useCallback(() => {
    let isValid = true;
    const newErrors = {
      name: '',
      email: '',
      phone: '',
      logo: '',
      location: '',
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

    if (!isPhoneSignUp) {
      if (!phone.trim()) {
        newErrors.phone = 'Phone number is required';
        isValid = false;
      } else if (phone.length < 8) { // Basic length check
        newErrors.phone = 'Invalid phone number';
        isValid = false;
      }
    }

    if (profile?.role === 'dealer') {
      if (!logo) {
        newErrors.logo = 'Logo is required';
        isValid = false;
      }
      
      // Strict check for non-zero coordinates
      const isLocationValid = locationName && 
                             latitude && latitude !== 0 && 
                             longitude && longitude !== 0;
                             
      if (!isLocationValid) {
        newErrors.location = 'Location is required';
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  }, [name, email, phone, isPhoneSignUp, profile?.role, logo, locationName, latitude, longitude]);

  const handleSubmit = useCallback(async () => {
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

      // Update dealership data if dealer
      if (profile?.role === 'dealer') {
        const { error: dealerError } = await updateDealershipProfile({
          logo,
          location: locationName,
          latitude,
          longitude,
          first_login: false, // Mark onboarding as complete
        });

        if (dealerError) {
          throw dealerError;
        }
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
  }, [validateInputs, isInputVerified, email, originalEmail, updateUserProfile, name, phone, profile?.role, updateDealershipProfile, logo, locationName, latitude, longitude, router]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      router.replace('/(auth)/sign-in');
    } catch (e) {
      console.error("Sign out failed", e);
    }
  }, [signOut, router]);

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
          keyboardShouldPersistTaps="handled"
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
            {!isPhoneSignUp && (
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
            )}

            {/* Dealership Specific Fields */}
            {profile?.role === 'dealer' && (
              <View style={{ gap: 20, marginTop: 10 }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{
                    color: isDark ? '#E5E7EB' : '#374151',
                    marginBottom: 12,
                    fontWeight: '600',
                    alignSelf: 'flex-start'
                  }}>
                    Dealership Logo *
                  </Text>
                  <DealerLogoPicker
                    logoUri={logo}
                    onPick={onPickLogo}
                    isUploading={isUploadingLogo}
                  />
                  {errors.logo ? (
                    <Text style={{ color: '#EF4444', fontSize: 13, marginTop: 4, alignSelf: 'flex-start' }}>
                      {errors.logo}
                    </Text>
                  ) : null}
                </View>

                <View>
                  <Text style={{
                    color: isDark ? '#E5E7EB' : '#374151',
                    marginBottom: 8,
                    fontWeight: '600'
                  }}>
                    Dealership Location *
                  </Text>
                  <TouchableOpacity
                    style={{
                      height: 50,
                      paddingHorizontal: 16,
                      backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: errors.location ? '#EF4444' : (isDark ? '#374151' : '#E5E7EB'),
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                    onPress={() => setShowLocationModal(true)}
                  >
                    <Text 
                      numberOfLines={1}
                      style={{ 
                        color: locationName ? (isDark ? '#fff' : '#000') : (isDark ? '#6B7280' : '#9CA3AF'),
                        flex: 1,
                        marginRight: 8
                      }}
                    >
                      {locationName || 'Select dealership location'}
                    </Text>
                    <Ionicons name="map-outline" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                  </TouchableOpacity>
                  {errors.location ? (
                    <Text style={{ color: '#EF4444', fontSize: 13, marginTop: 4 }}>
                      {errors.location}
                    </Text>
                  ) : null}
                </View>
              </View>
            )}
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
      {/* Location Picker Modal */}
      <Modal
        visible={showLocationModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowLocationModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#000' : '#fff' }}>
          <View style={{ flex: 1 }}>
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: isDark ? '#1F2937' : '#E5E7EB'
            }}>
              <TouchableOpacity onPress={() => setShowLocationModal(false)}>
                <Ionicons name="close" size={24} color={isDark ? '#fff' : '#000'} />
              </TouchableOpacity>
              <Text style={{ 
                flex: 1, 
                textAlign: 'center', 
                fontSize: 18, 
                fontWeight: 'bold',
                color: isDark ? '#fff' : '#000'
              }}>
                Select Location
              </Text>
              <TouchableOpacity onPress={() => setShowLocationModal(false)}>
                <Text style={{ color: '#D55004', fontWeight: 'bold' }}>Done</Text>
              </TouchableOpacity>
            </View>

            <View style={{ padding: 16 }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
                borderRadius: 12,
                paddingHorizontal: 12,
                height: 50
              }}>
                <Ionicons name="search-outline" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                <TextInput
                  style={{
                    flex: 1,
                    marginLeft: 8,
                    color: isDark ? '#fff' : '#000'
                  }}
                  placeholder="Enter address"
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  value={locationName}
                  onChangeText={(text) => {
                    setLocationName(text);
                    if (errors.location) setErrors(prev => ({ ...prev, location: '' }));
                  }}
                />
              </View>
            </View>

            <View style={{ flex: 1 }}>
              <MapView
                style={{ flex: 1 }}
                region={{
                  latitude: latitude || 25.2048,
                  longitude: longitude || 55.2708,
                  latitudeDelta: 0.1,
                  longitudeDelta: 0.1,
                }}
                onPress={(e) => {
                  const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate;
                  setLatitude(lat);
                  setLongitude(lng);
                  if (errors.location) setErrors(prev => ({ ...prev, location: '' }));
                }}
              >
                {latitude && longitude && (
                  <Marker coordinate={{ latitude, longitude }} pinColor="#D55004" />
                )}
              </MapView>

              <TouchableOpacity
                style={{
                  position: 'absolute',
                  bottom: 24,
                  right: 24,
                  backgroundColor: '#D55004',
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  justifyContent: 'center',
                  alignItems: 'center',
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 3.84,
                  elevation: 5,
                }}
                onPress={async () => {
                  const { status } = await Location.requestForegroundPermissionsAsync();
                  if (status !== 'granted') {
                    Alert.alert('Permission Denied', 'Location access is required.');
                    return;
                  }
                  const loc = await Location.getCurrentPositionAsync({});
                  setLatitude(loc.coords.latitude);
                  setLongitude(loc.coords.longitude);
                }}
              >
                <Ionicons name="locate" size={24} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView >
  );
}
