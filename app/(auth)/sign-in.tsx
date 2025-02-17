import React, { useEffect, useCallback, useState } from "react";
import { useSignIn } from "@clerk/clerk-expo";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useOAuth } from "@clerk/clerk-expo";
import { maybeCompleteAuthSession } from "expo-web-browser";

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
  const { startOAuthFlow: googleAuth } = useOAuth({ strategy: "oauth_google" });
  const { startOAuthFlow: appleAuth } = useOAuth({ strategy: "oauth_apple" });
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const onSelectAuth = async (strategy: "google" | "apple") => {
    try {
      setIsLoading((prev) => ({ ...prev, [strategy]: true }));
      const selectedAuth = strategy === "google" ? googleAuth : appleAuth;
      const { createdSessionId, setActive } = await selectedAuth();

      if (createdSessionId) {
        setActive && (await setActive({ session: createdSessionId }));
        router.replace("/(home)");
      }
    } catch (err) {
      console.error("OAuth error:", err);
      Alert.alert(
        "Authentication Error",
        "Failed to authenticate with " + strategy.charAt(0).toUpperCase() + strategy.slice(1)
      );
    } finally {
      setIsLoading((prev) => ({ ...prev, [strategy]: false }));
    }
  };

  return (
    <View style={{ width: '100%', marginTop: 32, alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <TouchableOpacity
          onPress={() => onSelectAuth("google")}
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
          onPress={() => onSelectAuth("apple")}
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

// Main SignIn Component
export default function SignInPage() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  const onSignInPress = useCallback(async () => {
    if (!isLoaded || !signIn) return;

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
      const signInAttempt = await signIn.create({
        identifier: emailAddress,
        password,
      });

      if (signInAttempt.status === "complete") {
        await setActive({ session: signInAttempt.createdSessionId });
        router.replace("/(home)");
      } else {
        setEmailError("Sign in failed. Please try again.");
      }
    } catch (err: any) {
      console.error(JSON.stringify(err, null, 2));
      setEmailError(err.errors?.[0]?.message || "An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [isLoaded, signIn, emailAddress, password, setActive, router]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
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
          Sign In
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
          onPress={onSignInPress}
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
    </KeyboardAvoidingView>
  );
}