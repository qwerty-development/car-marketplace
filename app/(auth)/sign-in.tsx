import React, { useEffect, useCallback, useState } from "react";
import { useAuth } from "@/utils/AuthContext";
import { Link, useRouter } from "expo-router";
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  ActivityIndicator,
  Alert,
  useColorScheme,
  Easing,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { maybeCompleteAuthSession } from "expo-web-browser";
import { useGuestUser } from '@/utils/GuestUserContext';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '@/utils/supabase';
import Constants from "expo-constants";

maybeCompleteAuthSession();

const { width, height } = Dimensions.get("window");

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
    // Float animation
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

// PRODUCTION-ENHANCED OAuth Component
const SignInWithOAuth = () => {
  const [isLoading, setIsLoading] = useState<{
    google: boolean;
    apple: boolean;
  }>({ google: false, apple: false });
  const { googleSignIn, appleSignIn } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);

  // Check if Apple Authentication is available on this device
  useEffect(() => {
    const checkAppleAuthAvailability = async () => {
      try {
        const isAvailable = await AppleAuthentication.isAvailableAsync();
        setAppleAuthAvailable(isAvailable);
      } catch (error) {
        console.log('[SIGNIN] Apple Authentication not available on this device');
        setAppleAuthAvailable(false);
      }
    };

    checkAppleAuthAvailability();
  }, []);

  // PRODUCTION-ENHANCED Google Authentication
  const handleGoogleAuth = async () => {
    try {
      setIsLoading(prev => ({ ...prev, google: true }));
      
      console.log("[SIGNIN-GOOGLE] Initiating Google sign-in flow");
      
      // Use the enhanced GoogleSignIn from AuthContext
      // This now includes production-hardened token registration
      await googleSignIn();
      
      console.log("[SIGNIN-GOOGLE] Google sign-in completed successfully");
      
      // Navigation is handled by AuthContext and RootLayout
      // No manual navigation needed
      
    } catch (err) {
      console.error("[SIGNIN-GOOGLE] Google OAuth error:", err);
      
      // Production error handling
      Alert.alert(
        "Sign In Error",
        "Unable to sign in with Google. Please try again or use email/password.",
        [{ text: "OK" }]
      );
    } finally {
      setIsLoading(prev => ({ ...prev, google: false }));
    }
  };

  // PRODUCTION-ENHANCED Apple Authentication
  // CRITICAL FIX: Removed custom token registration - now handled by AuthContext
  const handleAppleAuth = async () => {
    try {
      setIsLoading(prev => ({ ...prev, apple: true }));
      
      console.log("[SIGNIN-APPLE] Initiating Apple sign-in flow");
      
      // CRITICAL CHANGE: Use the enhanced appleSignIn from AuthContext
      // This ensures consistent token registration with the production system
      await appleSignIn();
      
      console.log("[SIGNIN-APPLE] Apple sign-in completed successfully");
      
      // Navigation is handled by AuthContext and RootLayout
      // No manual navigation needed
      
    } catch (err: any) {
      console.error("[SIGNIN-APPLE] Apple OAuth error:", err);
      
      if (err.code === 'ERR_REQUEST_CANCELED') {
        console.log('[SIGNIN-APPLE] User canceled Apple sign-in');
        // Don't show error for user cancellation
      } else {
        // Production error handling
        Alert.alert(
          "Sign In Error",
          "Unable to sign in with Apple. Please try again or use email/password.",
          [{ text: "OK" }]
        );
      }
    } finally {
      setIsLoading(prev => ({ ...prev, apple: false }));
    }
  };

  return (
    <View style={{ width: '100%', marginTop: 32, alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', gap: 16 }}>
        {Platform.OS === 'ios' && appleAuthAvailable ? (
          <View style={{ width: 56, height: 56, overflow: 'hidden', borderRadius: 28 }}>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
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
      </View>
    </View>
  );
};

// PRODUCTION-ENHANCED Main SignIn Component
export default function SignInPage() {
  const { signIn, isLoaded } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { setGuestMode } = useGuestUser();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  // PRODUCTION-ENHANCED Email/Password Sign-In
  // CRITICAL FIX: Simplified to use only the enhanced AuthContext
  const handleSubmit = useCallback(async () => {
    if (!isLoaded) {
      return;
    }
  
    let hasError = false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
    // Clear previous errors
    setError("");
    setEmailError("");
    setPasswordError("");
  
    // Validation
    if (!emailAddress) {
      setEmailError("Email is required");
      hasError = true;
    } else if (!emailRegex.test(emailAddress)) {
      setEmailError("Please enter a valid email address");
      hasError = true;
    }
  
    if (!password) {
      setPasswordError("Password is required");
      hasError = true;
    }
  
    if (hasError) return;
  
    setIsLoading(true);
    
    try {
      console.log("[SIGNIN-EMAIL] Starting email/password sign-in");
      
      // CRITICAL CHANGE: Use ONLY the enhanced signIn from AuthContext
      // This ensures consistent token registration with the production system
      const { error } = await signIn({
        email: emailAddress,
        password,
      });
  
      if (error) {
        console.error("[SIGNIN-EMAIL] Sign-in error:", error);
        
        // PRODUCTION-ENHANCED error handling
        const errorMessage = error.message?.toLowerCase() || '';
        
        if (errorMessage.includes('invalid login credentials') || 
            errorMessage.includes('password') ||
            errorMessage.includes('incorrect')) {
          setPasswordError("Incorrect password. Please try again.");
        } else if (errorMessage.includes('user not found') || 
                   errorMessage.includes('no user') ||
                   errorMessage.includes('email')) {
          setEmailError("No account found with this email address.");
        } else if (errorMessage.includes('too many requests')) {
          setError("Too many sign-in attempts. Please wait a few minutes and try again.");
        } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
          setError("Network error. Please check your connection and try again.");
        } else {
          // Generic error with more helpful message
          setError("Sign in failed. Please check your credentials and try again.");
        }
        return;
      }
      
      console.log("[SIGNIN-EMAIL] Email/password sign-in completed successfully");
      
      // Clear form on success
      setEmailAddress("");
      setPassword("");
      
      // Navigation is handled by AuthContext and RootLayout
      // No manual navigation needed
      
    } catch (err) {
      console.error("[SIGNIN-EMAIL] Unexpected error:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [isLoaded, signIn, emailAddress, password]);

  // PRODUCTION-ENHANCED Guest Sign-In
  const handleGuestSignIn = async () => {
    setIsGuestLoading(true);
    
    try {
      console.log("[SIGNIN-GUEST] Starting guest mode");
      
      // Set guest mode - AuthContext and RootLayout will handle the rest
      await setGuestMode(true);
      
      console.log("[SIGNIN-GUEST] Guest mode activated successfully");
      
      // Navigation is handled by AuthContext and RootLayout
      // No manual navigation needed
      
    } catch (err) {
      console.error("[SIGNIN-GUEST] Guest mode error:", err);
      Alert.alert(
        "Error",
        "Failed to continue as guest. Please try again.",
        [{ text: "OK" }]
      );
    } finally {
      setIsGuestLoading(false);
    }
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: isDark ? '#000' : '#fff',
      }}
    >
      {/* Animated Background Blobs */}
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

      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 32 }}>
        <Text
          style={{
            fontSize: 32,
            fontWeight: 'bold',
            marginBottom: 32,
            color: '#D55004',
            textAlign: 'center',
          }}
        >
          Welcome Back! 👋
        </Text>

        <View style={{ marginBottom: 16, gap: 16 }}>
          {/* Email Input */}
          <View>
            <TextInput
              style={{
                width: '100%',
                height: 48,
                paddingHorizontal: 16,
                backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
                color: isDark ? '#fff' : '#000',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: emailError ? '#D55004' : (isDark ? '#374151' : '#E5E7EB'),
              }}
              autoCapitalize="none"
              value={emailAddress}
              placeholder="Email"
              placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              onChangeText={(text) => {
                setEmailAddress(text);
                if (emailError) setEmailError(""); // Clear error on input
              }}
              keyboardType="email-address"
              autoComplete="email"
              editable={!isLoading}
            />
            {emailError && (
              <Text style={{ color: '#D55004', fontSize: 14, marginTop: 4 }}>
                {emailError}
              </Text>
            )}
          </View>

          {/* Password Input */}
          <View>
            <View style={{ position: 'relative' }}>
              <TextInput
                style={{
                  width: '100%',
                  height: 48,
                  paddingHorizontal: 16,
                  paddingRight: 48,
                  backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
                  color: isDark ? '#fff' : '#000',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: passwordError ? '#D55004' : (isDark ? '#374151' : '#E5E7EB'),
                }}
                value={password}
                placeholder="Password"
                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                secureTextEntry={!showPassword}
                onChangeText={(text) => {
                  setPassword(text);
                  if (passwordError) setPasswordError(""); // Clear error on input
                }}
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
                  name={showPassword ? "eye-off" : "eye"}
                  size={24}
                  color={isDark ? '#6B7280' : '#9CA3AF'}
                />
              </TouchableOpacity>
            </View>
            {passwordError && (
              <Text style={{ color: '#D55004', fontSize: 14, marginTop: 4 }}>
                {passwordError}
              </Text>
            )}
          </View>
        </View>

        {/* General Error Display */}
        {error && (
          <Text style={{ color: '#D55004', textAlign: 'center', marginBottom: 16, fontSize: 14 }}>
            {error}
          </Text>
        )}

        {/* Sign In Button */}
        <TouchableOpacity
          style={{
            backgroundColor: '#D55004',
            paddingVertical: 12,
            borderRadius: 24,
            opacity: isLoading ? 0.7 : 1,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 16,
          }}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18, textAlign: 'center' }}>
              Sign In
            </Text>
          )}
        </TouchableOpacity>

        {/* Guest Sign In Button */}
        <TouchableOpacity
          onPress={handleGuestSignIn}
          disabled={isGuestLoading || isLoading}
          style={{
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderColor: '#D55004',
            paddingVertical: 12,
            borderRadius: 24,
            opacity: (isGuestLoading || isLoading) ? 0.7 : 1,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          {isGuestLoading ? (
            <ActivityIndicator color="#D55004" />
          ) : (
            <Text style={{ color: '#D55004', fontWeight: 'bold', fontSize: 16 }}>
              Continue as Guest
            </Text>
          )}
        </TouchableOpacity>

        {/* OAuth Sign-In Options */}
        <SignInWithOAuth />

        {/* Sign Up Link */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24 }}>
          <Text style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
            Don't have an account?{' '}
          </Text>
          <Link href="/sign-up" asChild>
            <TouchableOpacity>
              <Text style={{ color: '#D55004', fontWeight: 'bold' }}>Sign up</Text>
            </TouchableOpacity>
          </Link>
        </View>

        {/* Forgot Password Link */}
        <TouchableOpacity
          onPress={() => router.push("/forgot-password")}
          style={{ marginTop: 16, alignSelf: 'center' }}
        >
          <Text style={{ color: isDark ? '#fff' : '#000', textDecorationLine: 'underline', textAlign: 'center' }}>
            Forgot Password?
          </Text>
        </TouchableOpacity>
      </View>

      {/* Version Display */}
      <Text style={{ 
        fontSize: 12, 
        textAlign: 'center', 
        color: isDark ? '#6B7280' : '#9CA3AF',
        paddingBottom: 16 
      }}>
        Version {Constants.expoConfig?.version}
      </Text>
    </View>
  );
}