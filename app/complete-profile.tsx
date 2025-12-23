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
} from 'react-native';
import { useAuth } from '@/utils/AuthContext';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import CustomPhoneInput from '@/components/PhoneInput';

export default function CompleteProfileScreen() {
  const { user, profile, updateUserProfile, signOut } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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
      setEmail(profile?.email || user.email || '');
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

    setIsLoading(true);
    try {
      const { error } = await updateUserProfile({
        name,
        email: email.trim() ? email : null,
        phone_number: phone,
      });

      if (error) {
        throw error;
      }
      
      // Success is handled by the auth state listener in _layout which will unblock the user
      // But we can also manually push if needed, though relying on the state change is better.
      // For now, we will show success and let the main layout check proceed?
      // Actually, if we update the profile, the context should update, and the layout enforcement will automatically let them through.
      
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
                editable={!isLoading && !user?.email} // Disable if email comes from auth? Maybe valid to change here.
              />
               {errors.email ? (
                <Text style={{ color: '#EF4444', fontSize: 13, marginTop: 4 }}>
                  {errors.email}
                </Text>
              ) : null}
            </View>

            {/* Phone Input */}
            <View>
              <Text style={{ 
                color: isDark ? '#E5E7EB' : '#374151',
                marginBottom: 8,
                fontWeight: '600'
              }}>
                Phone Number *
              </Text>
              <TextInput
                style={{
                  height: 50,
                  paddingHorizontal: 16,
                  backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
                  color: isDark ? '#fff' : '#000',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: errors.phone ? '#EF4444' : (isDark ? '#374151' : '#E5E7EB'),
                }}
                value={phone}
                placeholder="+1234567890"
                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                onChangeText={(text) => {
                  setPhone(text);
                  if (errors.phone) setErrors(prev => ({ ...prev, phone: '' }));
                }}
                keyboardType="phone-pad"
                editable={!isLoading}
              />
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
    </SafeAreaView>
  );
}
