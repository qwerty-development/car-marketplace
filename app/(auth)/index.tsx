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
} from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/utils/AuthContext';
import { useGuestUser } from '@/utils/GuestUserContext'
import { Ionicons } from '@expo/vector-icons';

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

// Social Auth Button Component
const SocialAuthButton = ({ onPress, isLoading, platform }:any) => {
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
            name={`logo-${platform}`}
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
            Continue with {platform.charAt(0).toUpperCase() + platform.slice(1)}
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
  });
// ADD
const { googleSignIn, appleSignIn } = useAuth();
const { setGuestMode } = useGuestUser();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

const handleSocialAuth = async (platform: 'google' | 'apple') => {
  try {
    setIsLoading(prev => ({ ...prev, [platform]: true }));

    if (platform === 'google') {
      await googleSignIn();
    } else {
      await appleSignIn();
    }

    // Successful authentication will be handled by the AuthContext
    // which will update the app state and navigate accordingly
  } catch (err) {
    console.error(`${platform} OAuth error:`, err);
    Alert.alert(
      'Authentication Error',
      `Failed to authenticate with ${
        platform.charAt(0).toUpperCase() + platform.slice(1)
      }`
    );
  } finally {
    setIsLoading(prev => ({ ...prev, [platform]: false }));
  }
};

const handleGuestMode = async () => {
  try {
    await setGuestMode(true);
    router.replace('/(home)');
  } catch (error) {
    console.error('Error setting guest mode:', error);
    Alert.alert('Error', 'Failed to continue as guest');
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
          {/* Social Auth Buttons */}
          <SocialAuthButton
            platform="google"
            isLoading={isLoading.google}
            onPress={() => handleSocialAuth('google')}
          />
          <SocialAuthButton
            platform="apple"
            isLoading={isLoading.apple}
            onPress={() => handleSocialAuth('apple')}
          />

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
  <Text style={{
    color: '#D55004',
    fontSize: 18,
    fontWeight: '600'
  }}>
    Continue as Guest
  </Text>
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