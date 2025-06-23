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
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';


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

// OAuth Component
const SignInWithOAuth = () => {
  const [isLoading, setIsLoading] = useState<{
    google: boolean;
    apple: boolean;
  }>({ google: false, apple: false });
  const { googleSignIn } = useAuth();
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
        console.log('Apple Authentication not available on this device');
        setAppleAuthAvailable(false);
      }
    };

    checkAppleAuthAvailability();
  }, []);

  const handleGoogleAuth = async () => {
    try {
      setIsLoading(prev => ({ ...prev, google: true }));
  
      // Step 1: Call googleSignIn with detailed logging
      console.log("Initiating Google sign-in flow");
      const result = await googleSignIn();
      console.log("Google sign-in result:", JSON.stringify(result));
  
      // The navigation is now handled by the auth context and root layout
      // The 3-second delay we added will show the LogoLoader
    } catch (err) {
      console.error("Google OAuth error:", err);

    } finally {
      setIsLoading(prev => ({ ...prev, google: false }));
    }
  };

// For Apple Sign-In:
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

// Main SignIn Component
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

  const handleSubmit = useCallback(async () => {
    if (!isLoaded) {
      return;
    }
  
    let hasError = false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
    if (!emailAddress) {
      setEmailError("Email is required");
      hasError = true;
    } else if (!emailRegex.test(emailAddress)) {
      setEmailError("Please enter a valid email address");
      hasError = true;
    } else {
      setEmailError("");
    }
  
    if (!password) {
      setPasswordError("Password is required");
      hasError = true;
    } else {
      setPasswordError("");
    }
  
    if (hasError) return;
  
    setIsLoading(true);
    try {
      // Use a manual approach instead of the signIn method from auth context
      // This ensures we can handle errors before any navigation happens
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailAddress,
        password,
      });
  
      if (error) {
        // Handle specific error types
        if (error.message?.toLowerCase().includes('invalid login credentials') || 
            error.message?.toLowerCase().includes('password') ||
            error.message?.toLowerCase().includes('incorrect')) {
          setPasswordError("Incorrect password. Please try again.");
        } else if (error.message?.toLowerCase().includes('user not found') || 
                   error.message?.toLowerCase().includes('no user') ||
                   error.message?.toLowerCase().includes('email')) {
          setEmailError("No account found with this email address.");
        } else {
          // General error handling
          setError(error.message || "Sign in failed. Please try again.");
        }
        return; // Return early to prevent any navigation
      }
  
      // Only if authentication is successful, use the auth context's signIn
      // which might handle additional logic like setting up the user session
      if (data.user) {
        await signIn({
          email: emailAddress,
          password,
        });
        // No need to navigate - let auth context handle it
      }
    } catch (err) {
      console.error("Sign in error:", JSON.stringify(err, null, 2));
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [isLoaded, signIn, emailAddress, password, supabase.auth]);

  // Handle guest login
  const handleGuestSignIn = async () => {
    setIsGuestLoading(true);
    try {
      // Set guest mode which will be detected by auth context
      await setGuestMode(true);
      
      // Let the auth routing handle navigation instead of doing it here
      // The root layout will detect the guest mode and navigate appropriately
    } catch (err) {
      console.error("Guest mode error:", err);
      Alert.alert(
        "Error",
        "Failed to continue as guest. Please try again."
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
            {emailError && (
              <Text style={{ color: '#D55004', fontSize: 14, marginTop: 4 }}>
                {emailError}
              </Text>
            )}
          </View>

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

        {error && (
          <Text style={{ color: '#D55004', textAlign: 'center', marginBottom: 16 }}>
            {error}
          </Text>
        )}

        <TouchableOpacity
          style={{
            backgroundColor: '#D55004',
            paddingVertical: 12,
            borderRadius: 24,
            opacity: isLoading ? 0.7 : 1,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
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




        <SignInWithOAuth />

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

        <TouchableOpacity
          onPress={() => router.push("/forgot-password")}
          style={{ marginTop: 16, alignSelf: 'center' }}
        >
          <Text style={{ color: isDark ? '#fff' : '#000', textDecorationLine: 'underline', textAlign: 'center' }}>
            Forgot Password?
          </Text>
        </TouchableOpacity>
      </View>

<Text className="text-center text-red" style={{ fontSize: 12, }}>
  Version {Constants.expoConfig?.version }
</Text>
    </View>
  );
}
