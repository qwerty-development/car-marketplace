import React, { useEffect, useRef } from 'react';
import { useSignUp } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView, Platform, Animated, Dimensions } from 'react-native';
import { supabase } from '@/utils/supabase';

const { width, height } = Dimensions.get('window');

const AnimatedLine: React.FC<{ startPos: { x: number; y: number }; duration: number }> = ({ startPos, duration }) => {
  const position = useRef(new Animated.Value(0)).current;

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

const FadingCircle: React.FC<{ position: { x: number; y: number }; size: number }> = ({ position, size }) => {
  const opacity = useRef(new Animated.Value(0)).current;

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

export default function SignUpScreen() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();

  const [name, setName] = React.useState('');
  const [emailAddress, setEmailAddress] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [pendingVerification, setPendingVerification] = React.useState(false);
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState('');

  const onSignUpPress = async () => {
    if (!isLoaded) return;

    try {
      await signUp.create({
        emailAddress,
        password
      });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err: any) {
      console.error(JSON.stringify(err, null, 2));
      setError('Sign up failed. Please try again.');
    }
  };

  const onPressVerify = async () => {
    if (!isLoaded) return;

    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code
      });

      if (completeSignUp.status !== 'complete') {
        setError('Verification failed. Please try again.');
        return;
      }

      const { createdSessionId, createdUserId } = completeSignUp;

      if (!createdSessionId || !createdUserId) {
        setError('Failed to complete sign up. Please try again.');
        return;
      }

      await setActive({ session: createdSessionId });

      const { error: supabaseError } = await supabase
        .from('users')
        .insert({
          id: createdUserId,
          name: name,
          email: emailAddress,
          created_at: new Date().toISOString()
        });

      if (supabaseError) {
        console.error('Error creating user in Supabase:', supabaseError);
        setError('An error occurred while creating your account. Please try again.');
        return;
      }

      router.replace('/');
    } catch (err: any) {
      console.error(JSON.stringify(err, null, 2));
      setError('An error occurred. Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-black"
    >
      <View style={{ position: 'absolute', width: '100%', height: '100%' }}>
        <AnimatedLine startPos={{ x: width * 0.2, y: -100 }} duration={15000} />
        <AnimatedLine startPos={{ x: width * 0.5, y: -100 }} duration={20000} />
        <AnimatedLine startPos={{ x: width * 0.8, y: -100 }} duration={18000} />

        <FadingCircle position={{ x: width * 0.1, y: height * 0.1 }} size={100} />
        <FadingCircle position={{ x: width * 0.7, y: height * 0.3 }} size={150} />
        <FadingCircle position={{ x: width * 0.3, y: height * 0.8 }} size={120} />
      </View>

      <View className="flex-1 justify-center px-8">
        <Text className="text-4xl font-bold mb-8 text-[#D55004] text-center">
          {pendingVerification ? 'Verify Email' : 'Sign Up'}
        </Text>
        <View className="space-y-4">
          {!pendingVerification ? (
            <>
              <TextInput
                className="w-full h-12 px-4 bg-gray-800 text-white rounded-lg border border-gray-700"
                value={name}
                placeholder="Full Name"
                placeholderTextColor="#6B7280"
                onChangeText={setName}
              />
              <TextInput
                className="w-full h-12 px-4 bg-gray-800 text-white rounded-lg border border-gray-700"
                autoCapitalize="none"
                value={emailAddress}
                placeholder="Email"
                placeholderTextColor="#6B7280"
                onChangeText={setEmailAddress}
                keyboardType="email-address"
              />
              <TextInput
                className="w-full h-12 px-4 bg-gray-800 text-white rounded-lg border border-gray-700"
                value={password}
                placeholder="Password"
                placeholderTextColor="#6B7280"
                secureTextEntry={true}
                onChangeText={setPassword}
              />
            </>
          ) : (
            <TextInput
              className="w-full h-12 px-4 bg-gray-800 text-white rounded-lg border border-gray-700"
              value={code}
              placeholder="Verification Code"
              placeholderTextColor="#6B7280"
              onChangeText={setCode}
              keyboardType="number-pad"
            />
          )}
        </View>
        {error ? <Text className="text-[#D55004] mt-4 text-center">{error}</Text> : null}
        <TouchableOpacity
          className="bg-[#D55004] py-3 rounded-lg mt-8"
          onPress={pendingVerification ? onPressVerify : onSignUpPress}
        >
          <Text className="text-white font-bold text-lg text-center">
            {pendingVerification ? 'Verify Email' : 'Sign Up'}
          </Text>
        </TouchableOpacity>
        {!pendingVerification && (
          <View className="flex-row justify-center mt-6">
            <Text className="text-gray-400">Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/sign-in')}>
              <Text className="text-[#D55004] font-bold">Sign in</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}