import React, { useEffect, useCallback } from "react";
import { useSignIn } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView, Platform, Animated, Dimensions } from "react-native";

const { width, height } = Dimensions.get('window');

interface AnimatedLineProps {
  startPos: { x: number; y: number };
  duration: number;
}

const AnimatedLine: React.FC<AnimatedLineProps> = ({ startPos, duration }) => {
  const position = new Animated.Value(0);

  useEffect(() => {
    Animated.loop(
      Animated.timing(position, {
        toValue: 1,
        duration: duration,
        useNativeDriver: true,
      })
    ).start();
  }, [duration]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: startPos.x,
        top: startPos.y,
        width: 1,
        height: 100,
        backgroundColor: '#D55004',
        transform: [
          {
            translateY: position.interpolate({
              inputRange: [0, 1],
              outputRange: [0, height + 100],
            }),
          },
        ],
      }}
    />
  );
};

interface FadingCircleProps {
  position: { x: number; y: number };
  size: number;
}

const FadingCircle: React.FC<FadingCircleProps> = ({ position, size }) => {
  const opacity = new Animated.Value(0);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
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
        backgroundColor: '#D55004',
        opacity: opacity,
      }}
    />
  );
};

export default function SignInPage() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");

  const onSignInPress = useCallback(async () => {
    if (!isLoaded || !signIn) return;

    try {
      const signInAttempt = await signIn.create({
        identifier: emailAddress,
        password,
      });

      if (signInAttempt.status === "complete") {
        await setActive({ session: signInAttempt.createdSessionId });
        router.replace("/");
      } else {
        setError("Sign in failed. Please try again.");
      }
    } catch (err: any) {
      console.error(JSON.stringify(err, null, 2));
      setError(err.errors?.[0]?.message || "An error occurred. Please try again.");
    }
  }, [isLoaded, signIn, emailAddress, password, setActive, router]);

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: 'black' }}
    >
      <AnimatedLine startPos={{ x: width * 0.2, y: -100 }} duration={15000} />
      <AnimatedLine startPos={{ x: width * 0.5, y: -100 }} duration={20000} />
      <AnimatedLine startPos={{ x: width * 0.8, y: -100 }} duration={18000} />

      <FadingCircle position={{ x: width * 0.1, y: height * 0.1 }} size={100} />
      <FadingCircle position={{ x: width * 0.7, y: height * 0.3 }} size={150} />
      <FadingCircle position={{ x: width * 0.3, y: height * 0.8 }} size={120} />

      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 32 }}>
        <Text style={{ fontSize: 36, fontWeight: 'bold', marginBottom: 32, color: '#D55004', textAlign: 'center' }}>Sign In</Text>
        <View style={{ marginBottom: 16 }}>
          <TextInput
            style={{
              width: '100%',
              height: 48,
              paddingHorizontal: 16,
              backgroundColor: '#1F2937',
              color: 'white',
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#374151',
              marginBottom: 16,
            }}
            autoCapitalize="none"
            value={emailAddress}
            placeholder="Email"
            placeholderTextColor="#6B7280"
            onChangeText={setEmailAddress}
            keyboardType="email-address"
          />
          <TextInput
            style={{
              width: '100%',
              height: 48,
              paddingHorizontal: 16,
              backgroundColor: '#1F2937',
              color: 'white',
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#374151',
            }}
            value={password}
            placeholder="Password"
            placeholderTextColor="#6B7280"
            secureTextEntry={true}
            onChangeText={setPassword}
          />
        </View>
        {error ? <Text style={{ color: '#D55004', marginTop: 16, textAlign: 'center' }}>{error}</Text> : null}
        <TouchableOpacity
          style={{
            backgroundColor: '#D55004',
            paddingVertical: 12,
            borderRadius: 8,
            marginTop: 32,
          }}
          onPress={onSignInPress}
        >
          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18, textAlign: 'center' }}>Sign In</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24 }}>
          <Text style={{ color: '#9CA3AF' }}>Don't have an account? </Text>
          <Link href="/sign-up">
            <Text style={{ color: '#D55004', fontWeight: 'bold' }}>Sign up</Text>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}