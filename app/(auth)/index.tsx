import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  Animated,
  Image,
  ActivityIndicator,
  Alert,
  useColorScheme,
  Easing,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/utils/AuthContext';
import { useGuestUser } from '@/utils/GuestUserContext';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';

const { width, height } = Dimensions.get('window');

// Animated Blob Component
const AnimatedBlob = ({ position, size, delay, duration }:any) => {
  const translateY = new Animated.Value(0);
  const scale = new Animated.Value(1);
  const rotate = new Animated.Value(0);
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
          Animated.sequence([
            Animated.timing(rotate, {
              toValue: 1,
              duration: duration * 2,
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
          {
            rotate: rotate.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', '360deg'],
            }),
          },
        ],
      }}
    />
  );
};

// Animated Logo Component
const AnimatedLogo = () => {
  const logoScale = new Animated.Value(0.8);
  const logoOpacity = new Animated.Value(0);

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 1000,
          easing: Easing.elastic(1),
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={{
        transform: [{ scale: logoScale }],
        opacity: logoOpacity,
        alignItems: 'center',
      }}
    >
      <Image
        source={require('@/assets/logo.png')}
        style={{ width: 120, height: 120 }}
        resizeMode="contain"
      />
    </Animated.View>
  );
};

// Google Auth Button Component
const GoogleAuthButton = ({ onPress, isLoading }:any) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isLoading}
      style={{
        width: '100%',
        height: 56,
        borderRadius: 28,
        backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
        borderWidth: 1,
        borderColor: isDark ? '#374151' : '#E5E7EB',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
      }}
    >
      {isLoading ? (
        <ActivityIndicator color={isDark ? '#FFF' : '#000'} />
      ) : (
        <>
          <Ionicons
            name="logo-google"
            size={24}
            color={isDark ? '#FFF' : '#000'}
            style={{ marginRight: 12 }}
          />
          <Text
            style={{
              color: isDark ? '#FFF' : '#000',
              fontSize: 18,
              fontWeight: '600',
            }}
          >
            Continue with Google
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

// Custom Apple Button Component (for non-iOS or when native button is unavailable)
const CustomAppleButton = ({ onPress, isLoading, isAvailable }:any) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isLoading || !isAvailable}
      style={{
        width: '100%',
        height: 56,
        borderRadius: 28,
        backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
        borderWidth: 1,
        borderColor: isDark ? '#374151' : '#E5E7EB',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        opacity: isAvailable ? 1 : 0.5,
      }}
    >
      {isLoading ? (
        <ActivityIndicator color={isDark ? '#FFF' : '#000'} />
      ) : (
        <>
          <Ionicons
            name="logo-apple"
            size={24}
            color={isDark ? '#FFF' : '#000'}
            style={{ marginRight: 12 }}
          />
          <Text
            style={{
              color: isDark ? '#FFF' : '#000',
              fontSize: 18,
              fontWeight: '600',
            }}
          >
            Continue with Apple
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

export default function LandingPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState({
    google: false,
    apple: false,
    guest: false,
  });
  const { googleSignIn } = useAuth();
  const { setGuestMode } = useGuestUser();
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
      await googleSignIn();
    } catch (err) {
      console.error('Google OAuth error:', err);
      Alert.alert(
        'Authentication Error',
        'Failed to authenticate with Google'
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

  const handleGuestMode = async () => {
    try {
      setIsLoading(prev => ({ ...prev, guest: true }));
      await setGuestMode(true);
      router.replace('/(home)');
    } catch (error) {
      console.error('Error setting guest mode:', error);
      Alert.alert('Error', 'Failed to continue as guest');
    } finally {
      setIsLoading(prev => ({ ...prev, guest: false }));
    }
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: isDark ? '#000' : '#fff',
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

      <View style={{ flex: 1, justifyContent: 'space-between', padding: 32 }}>
        {/* Logo Section */}
        <View style={{ alignItems: 'center', marginTop: 48 }}>
          <AnimatedLogo />
          <Text
            style={{
              fontSize: 32,
              fontWeight: 'bold',
              color: '#D55004',
              marginTop: 16,
              textAlign: 'center',
            }}
          >
            Welcome to Fleet
          </Text>
          <Text
            style={{
              fontSize: 18,
              color: isDark ? '#9CA3AF' : '#6B7280',
              marginTop: 8,
              textAlign: 'center',
            }}
          >
            Your journey begins here
          </Text>
        </View>

        {/* Buttons Section */}
        <View style={{ width: '100%', gap: 16 }}>
          {/* Google Auth Button */}
          <GoogleAuthButton
            isLoading={isLoading.google}
            onPress={handleGoogleAuth}
          />

          {/* Apple Auth Button */}
          {Platform.OS === 'ios' && appleAuthAvailable ? (
            <View style={{
              width: '100%',
              height: 56,
              marginBottom: 16,
              borderRadius: 28,
              overflow: 'hidden',
              position: 'relative'
            }}>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={isDark
                  ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                  : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={28}
                style={{ width: '100%', height: 56 }}
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
            <CustomAppleButton
              isLoading={isLoading.apple}
              onPress={handleAppleAuth}
              isAvailable={appleAuthAvailable}
            />
          )}

          {/* Divider */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 16 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }} />
            <Text style={{ marginHorizontal: 16, color: isDark ? '#9CA3AF' : '#6B7280' }}>
              OR
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }} />
          </View>

          {/* Regular Auth Buttons */}
          <TouchableOpacity
            onPress={() => router.push('/sign-in')}
            style={{
              width: '100%',
              height: 56,
              borderRadius: 28,
              backgroundColor: '#D55004',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '600' }}>
              Sign In
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/sign-up')}
            style={{
              width: '100%',
              height: 56,
              borderRadius: 28,
              borderWidth: 2,
              borderColor: '#D55004',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#D55004', fontSize: 18, fontWeight: '600' }}>
              Create Account
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleGuestMode}
            disabled={isLoading.guest}
            style={{
              width: '100%',
              height: 56,
              borderRadius: 28,
              backgroundColor: isDark ? 'rgba(213, 80, 4, 0.2)' : 'rgba(213, 80, 4, 0.1)',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 8,
            }}
          >
            {isLoading.guest ? (
              <ActivityIndicator color="#D55004" />
            ) : (
              <Text style={{
                color: '#D55004',
                fontSize: 18,
                fontWeight: '600'
              }}>
                Continue as Guest
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/forgot-password')}
            style={{ marginTop: 16 }}
          >
            <Text
              style={{
                color: isDark ? '#fff' : '#000',
                textAlign: 'center',
                textDecorationLine: 'underline',
              }}
            >
              Forgot Password?
            </Text>
          </TouchableOpacity>
        </View>

        {/* Terms & Privacy */}
        <Text
          style={{
            color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
            textAlign: 'center',
            fontSize: 14,
            marginTop: 32,
          }}
        >
          By continuing, you agree to our{' '}
          <Text style={{ color: '#D55004' }}>Terms of Service</Text> and{' '}
          <Text style={{ color: '#D55004' }}>Privacy Policy</Text>
        </Text>
      </View>
    </View>
  );
}