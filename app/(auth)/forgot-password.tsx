import React, { useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/utils/AuthContext';
import { supabase } from '@/utils/supabase';

import AuthScaffold from './_components/AuthScaffold';
import AuthInput from './_components/AuthInput';
import AuthButton from './_components/AuthButton';
import OtpInput from './_components/OtpInput';
import { Caption, Subtitle, Title } from './_components/Display';
import { motion, spacing } from './_components/tokens';

type Stage = 'request' | 'reset';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { resetPassword } = useAuth();

  const [stage, setStage] = useState<Stage>('request');
  const [emailAddress, setEmailAddress] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [emailError, setEmailError] = useState('');
  const [codeError, setCodeError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');

  const [isLoading, setIsLoading] = useState(false);

  const stageOpacity = useRef(new Animated.Value(1)).current;
  const stageTranslate = useRef(new Animated.Value(0)).current;

  const fadeStage = (next: Stage) => {
    Animated.parallel([
      Animated.timing(stageOpacity, {
        toValue: 0,
        duration: motion.short,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(stageTranslate, {
        toValue: -8,
        duration: motion.short,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setStage(next);
      stageTranslate.setValue(8);
      Animated.parallel([
        Animated.timing(stageOpacity, {
          toValue: 1,
          duration: motion.base,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(stageTranslate, {
          toValue: 0,
          duration: motion.base,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const validateEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const onRequestReset = async () => {
    if (!emailAddress.trim() || !validateEmail(emailAddress)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    setEmailError('');
    setIsLoading(true);
    try {
      const { error } = await resetPassword(emailAddress.trim());
      if (error) throw error;

      fadeStage('reset');
      Alert.alert(
        'Check your email',
        'We sent a verification code to reset your password. Enter it on the next screen.',
        [{ text: 'OK' }],
      );
    } catch (err) {
      const error = err as Error;
      Alert.alert('Error', error?.message || 'Failed to request password reset');
    } finally {
      setIsLoading(false);
    }
  };

  const onReset = async () => {
    let hasError = false;
    if (!code.trim() || code.length < 6) {
      setCodeError('Enter the 6-digit code');
      hasError = true;
    } else {
      setCodeError('');
    }

    if (!password) {
      setPasswordError('Choose a new password');
      hasError = true;
    } else if (password.length < 8) {
      setPasswordError('Use at least 8 characters');
      hasError = true;
    } else {
      setPasswordError('');
    }

    if (!confirmPassword) {
      setConfirmError('Confirm your new password');
      hasError = true;
    } else if (password !== confirmPassword) {
      setConfirmError('Passwords don’t match');
      hasError = true;
    } else {
      setConfirmError('');
    }

    if (hasError) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: emailAddress.trim(),
        token: code,
        type: 'recovery',
      });
      if (error) throw error;

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) throw updateError;

      Alert.alert('Password updated', 'Your password has been reset successfully.', [
        {
          text: 'Sign in',
          onPress: () => router.replace('/sign-in'),
        },
      ]);
    } catch (err) {
      const error = err as Error;
      Alert.alert('Error', error?.message || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  const title = stage === 'request' ? 'Forgot password?' : 'Set a new password.';
  const subtitle =
    stage === 'request'
      ? 'Enter your email — we’ll send you a verification code.'
      : `Enter the code we sent to ${emailAddress.trim()} and choose a new password.`;

  return (
    <AuthScaffold showBack onBack={() => router.back()}>
      <Animated.View
        style={{
          opacity: stageOpacity,
          transform: [{ translateY: stageTranslate }],
        }}
      >
        <View style={styles.titleBlock}>
          <Title>{title}</Title>
          <Subtitle style={{ marginTop: spacing.xs }}>{subtitle}</Subtitle>
        </View>

        {stage === 'request' ? (
          <View>
            <AuthInput
              label="Email address"
              value={emailAddress}
              onChangeText={(t) => {
                setEmailAddress(t);
                if (emailError) setEmailError('');
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!isLoading}
              error={emailError || undefined}
              returnKeyType="send"
              onSubmitEditing={onRequestReset}
            />

            <View style={{ height: spacing['2xl'] }} />

            <AuthButton
              title="Send code"
              variant="primary"
              loading={isLoading}
              onPress={onRequestReset}
            />
          </View>
        ) : (
          <View>
            <OtpInput
              value={code}
              onChange={(v) => {
                setCode(v);
                if (codeError) setCodeError('');
              }}
              error={codeError || undefined}
              autoFocus
            />
            {codeError ? (
              <Caption tone="error" align="center" style={{ marginTop: spacing.sm }}>
                {codeError}
              </Caption>
            ) : null}

            <View style={{ height: spacing.xl }} />

            <AuthInput
              label="New password"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (passwordError) setPasswordError('');
              }}
              secureTextEntry
              showPasswordToggle
              autoComplete="new-password"
              editable={!isLoading}
              error={passwordError || undefined}
              hint={!passwordError && password.length > 0 && password.length < 8 ? 'Use at least 8 characters' : undefined}
              returnKeyType="next"
            />

            <View style={{ height: spacing.md }} />

            <AuthInput
              label="Confirm password"
              value={confirmPassword}
              onChangeText={(t) => {
                setConfirmPassword(t);
                if (confirmError) setConfirmError('');
              }}
              secureTextEntry
              showPasswordToggle
              autoComplete="new-password"
              editable={!isLoading}
              error={confirmError || undefined}
              returnKeyType="done"
              onSubmitEditing={onReset}
            />

            <View style={{ height: spacing['2xl'] }} />

            <AuthButton
              title="Reset password"
              variant="primary"
              loading={isLoading}
              onPress={onReset}
            />

            <View style={{ height: spacing.base }} />

            <AuthButton
              title="Back to email entry"
              variant="ghost"
              trailingIcon={null}
              onPress={() => {
                setCode('');
                setPassword('');
                setConfirmPassword('');
                setCodeError('');
                setPasswordError('');
                setConfirmError('');
                fadeStage('request');
              }}
            />
          </View>
        )}
      </Animated.View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  titleBlock: {
    marginTop: spacing.lg,
    marginBottom: spacing['2xl'],
  },
});
