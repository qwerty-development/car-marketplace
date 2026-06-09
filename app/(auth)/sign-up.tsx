import React, { useEffect, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { maybeCompleteAuthSession } from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';

import { safeLogEvent } from '@/utils/safeMetaLogger';
import { META_EVENTS } from '@/utils/metaEvents';
import { useAuth } from '@/utils/AuthContext';
import { useTheme } from '@/utils/ThemeContext';
import { supabase } from '@/utils/supabase';
import { logAuthEvent } from '@/utils/analytics';
import CustomPhoneInput, { ICountry, getCallingCode } from '@/components/PhoneInput';

import AuthScaffold from './_components/AuthScaffold';
import AuthInput from './_components/AuthInput';
import AuthButton from './_components/AuthButton';
import AuthDivider from './_components/AuthDivider';
import OAuthRow from './_components/OAuthRow';
import OtpInput from './_components/OtpInput';
import SegmentedToggle from './_components/SegmentedToggle';
import { Body, Caption, Subtitle, Title } from './_components/Display';
import { getAuthColors, motion, spacing, typography } from './_components/tokens';
import { registerPushTokenForUser } from './_lib/pushToken';

maybeCompleteAuthSession();

type AuthMethod = 'phone' | 'email';

const NEW_ACCOUNT_THRESHOLD_MS = 30_000;

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp, verifyOtp, googleSignIn, isLoaded } = useAuth();
  const { isDarkMode } = useTheme();
  const colors = getAuthColors(isDarkMode);

  const [authMethod, setAuthMethod] = useState<AuthMethod>('phone');

  // Email signup fields
  const [name, setName] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [code, setCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);

  // Phone signup fields
  const [phoneName, setPhoneName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<ICountry | null>(null);
  const [pendingPhoneVerification, setPendingPhoneVerification] = useState(false);

  const [errors, setErrors] = useState({
    name: '',
    email: '',
    password: '',
    code: '',
    general: '',
    phone: '',
    phoneName: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const contentOpacity = React.useRef(new Animated.Value(0)).current;
  const contentTranslate = React.useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: motion.med,
        delay: 80,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentTranslate, {
        toValue: 0,
        duration: motion.med,
        delay: 80,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [contentOpacity, contentTranslate]);

  const waitForSession = async (attempts = 6, delayMs = 500) => {
    for (let attempt = 0; attempt < attempts; attempt++) {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        return data.session;
      }
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    return null;
  };

  const validateEmailInputs = () => {
    let valid = true;
    const next = { name: '', email: '', password: '', code: '', general: '', phone: '', phoneName: '' };

    if (!name.trim()) {
      next.name = 'Name is required';
      valid = false;
    } else if (/\d/.test(name)) {
      next.name = 'Name must contain letters only';
      valid = false;
    }

    if (!emailAddress.trim()) {
      next.email = 'Email is required';
      valid = false;
    } else if (!/\S+@\S+\.\S+/.test(emailAddress)) {
      next.email = 'Invalid email format';
      valid = false;
    }

    if (!password) {
      next.password = 'Password is required';
      valid = false;
    } else if (password.length < 8) {
      next.password = 'Password must be at least 8 characters';
      valid = false;
    }

    setErrors(next);
    return valid;
  };

  const onSignUpPress = async () => {
    if (!isLoaded) return;
    if (!validateEmailInputs()) return;

    setIsLoading(true);
    try {
      const { error, needsEmailVerification } = await signUp({
        email: emailAddress,
        password,
        name,
      });

      if (error) {
        const msg = error.message || '';
        if (
          msg.includes('already exists') ||
          msg.includes('already registered') ||
          msg.includes('already in use')
        ) {
          setErrors((prev) => ({
            ...prev,
            email: msg || 'This email is already registered. Please try signing in.',
            general: '',
          }));
        } else {
          setErrors((prev) => ({
            ...prev,
            general: msg || 'Sign up failed. Please try again.',
          }));
        }
        return;
      }

      if (needsEmailVerification) {
        safeLogEvent('fb_mobile_complete_registration', {
          fb_registration_method: 'email',
        });
        setVerificationEmail(emailAddress);
        setPendingVerification(true);
        Alert.alert(
          'Verification code sent',
          'Please check your email for a verification code to complete your registration.',
          [{ text: 'OK' }],
        );
      } else {
        router.replace('/(home)' as never);
      }
    } catch (err) {
      console.error(JSON.stringify(err, null, 2));
      setErrors((prev) => ({
        ...prev,
        general: (err as Error)?.message || 'Sign up failed. Please try again.',
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const onPressVerify = async (codeOverride?: string) => {
    if (!isLoaded) return;
    const codeToUse = codeOverride ?? code;
    if (!codeToUse.trim() || codeToUse.length < 6) {
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await verifyOtp(verificationEmail, codeToUse);
      if (error) throw error;

      Alert.alert('Success', 'Your account has been verified successfully.', [
        {
          text: 'OK',
          onPress: () => router.replace('/(home)' as never),
        },
      ]);
    } catch (err) {
      const error = err as Error;
      console.error(JSON.stringify(error, null, 2));
      setErrors((prev) => ({
        ...prev,
        code: error?.message || 'Verification failed. Please try again.',
      }));
    } finally {
      setIsLoading(false);
    }
  };

  // Phone OTP send
  const handlePhoneSignUp = async () => {
    let hasError = false;
    const nextErrors = { ...errors, phoneName: '', phone: '' };

    if (!phoneName.trim() || phoneName.trim().length < 2) {
      nextErrors.phoneName = 'Full name must be at least 2 characters';
      hasError = true;
    } else if (/\d/.test(phoneName)) {
      nextErrors.phoneName = 'Name must contain letters only';
      hasError = true;
    }

    if (!phoneNumber) {
      nextErrors.phone = 'Phone number is required';
      hasError = true;
    }
    if (!selectedCountry) {
      nextErrors.phone = 'Please select a country';
      hasError = true;
    }

    setErrors(nextErrors);
    if (hasError) return;

    const cleanedPhone = phoneNumber.replace(/\D/g, '');
    const callingCode = getCallingCode(selectedCountry!).replace(/\D/g, '');
    const fullPhoneNumber = `+${callingCode}${cleanedPhone}`;

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: fullPhoneNumber,
        options: {
          shouldCreateUser: true,
          data: {
            full_name: phoneName.trim(),
            name: phoneName.trim(),
          },
        },
      });

      if (error) {
        setErrors((prev) => ({ ...prev, phone: error.message || 'Failed to send code' }));
        return;
      }

      setPendingPhoneVerification(true);
    } catch (err) {
      const error = err as Error;
      console.error('Phone OTP error:', error);
      setErrors((prev) => ({ ...prev, phone: error?.message || 'Failed to send code' }));
    } finally {
      setIsLoading(false);
    }
  };

  // Phone OTP verify
  const handlePhoneOtpVerify = async (codeOverride?: string) => {
    const codeToUse = codeOverride ?? code;
    if (!codeToUse.trim() || codeToUse.length < 6) {
      return;
    }

    setIsLoading(true);
    try {
      const callingCode =
        (selectedCountry ? getCallingCode(selectedCountry).replace(/\D/g, '') : '') || '';
      const cleanedPhone = phoneNumber.replace(/\D/g, '');
      const fullPhoneNumber = `+${callingCode}${cleanedPhone}`;

      const { data, error } = await supabase.auth.verifyOtp({
        phone: fullPhoneNumber,
        token: codeToUse,
        type: 'sms',
      });

      if (error) {
        setErrors((prev) => ({ ...prev, code: error.message || 'Invalid code' }));
        return;
      }

      const verifiedUser = data.user ?? data.session?.user;
      if (verifiedUser) {
        await supabase.auth.updateUser({
          data: {
            full_name: phoneName.trim(),
            name: phoneName.trim(),
            signup_completed: true,
          },
        });

        safeLogEvent('fb_mobile_complete_registration', {
          fb_registration_method: 'phone',
        });
        logAuthEvent('sign_up', 'phone');
      }
    } catch (err) {
      const error = err as Error;
      console.error('Phone OTP verification error:', error);
      setErrors((prev) => ({ ...prev, code: error?.message || 'Verification failed' }));
    } finally {
      setIsLoading(false);
    }
  };

  // OAuth
  const handleGoogleAuth = async () => {
    try {
      setGoogleLoading(true);
      await googleSignIn();

      const session = await waitForSession();
      if (session?.user) {
        const isNewUser =
          Date.now() - new Date(session.user.created_at).getTime() < NEW_ACCOUNT_THRESHOLD_MS;
        if (isNewUser) {
          safeLogEvent('fb_mobile_complete_registration', {
            fb_registration_method: 'google',
          });
        }
        router.replace('/(home)' as never);
        return;
      }
      console.warn('Google authentication completed but no active session was found yet');
    } catch (err) {
      console.error('Google OAuth error:', err);
      setGoogleLoading(false);
    }
  };

  const handleAppleAuth = async () => {
    try {
      setAppleLoading(true);

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.identityToken) {
        const { error, data } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
        });

        if (error) throw error;

        if (data?.user) {
          const isNewUser =
            Date.now() - new Date(data.user.created_at).getTime() < NEW_ACCOUNT_THRESHOLD_MS;
          if (isNewUser) {
            safeLogEvent(META_EVENTS.COMPLETE_REGISTRATION, {
              fb_registration_method: 'apple',
            });
          }
          console.log('[APPLE-AUTH] Sign-in successful, registering push token');

          const session = data.session ?? (await waitForSession());
          if (session?.user) {
            router.replace('/(home)' as never);
          }

          setTimeout(() => {
            registerPushTokenForUser(data.user!.id);
          }, 1000);
        }
      } else {
        throw new Error('No identity token received from Apple');
      }
    } catch (err) {
      const error = err as { code?: string; message?: string };
      if (error.code === 'ERR_REQUEST_CANCELED') {
        console.log('User canceled Apple sign-in');
      } else {
        console.error('Apple OAuth error:', error);
      }
    } finally {
      setAppleLoading(false);
    }
  };

  const headerTitle = pendingVerification
    ? 'Verify your email.'
    : pendingPhoneVerification
      ? 'Verify your phone.'
      : 'Create your account.';
  const headerSubtitle = pendingVerification
    ? `Enter the code we sent to ${verificationEmail}.`
    : pendingPhoneVerification
      ? `Enter the 6-digit code we sent to ${phoneNumber}.`
      : 'It only takes a minute.';

  return (
    <AuthScaffold showBack={router.canGoBack()} onBack={() => router.canGoBack() && router.back()}>
      <Animated.View
        style={{
          opacity: contentOpacity,
          transform: [{ translateY: contentTranslate }],
        }}
      >
        <View style={styles.titleBlock}>
          <Title>{headerTitle}</Title>
          <Subtitle style={{ marginTop: spacing.xs }}>{headerSubtitle}</Subtitle>
        </View>

        {pendingPhoneVerification || pendingVerification ? (
          <View>
            <OtpInput
              value={code}
              onChange={(v) => {
                setCode(v);
                if (errors.code) setErrors((prev) => ({ ...prev, code: '' }));
              }}
              onComplete={(v) => {
                setErrors((prev) => ({ ...prev, code: '' }));
                pendingPhoneVerification ? handlePhoneOtpVerify(v) : onPressVerify(v);
              }}
              error={errors.code || undefined}
              autoFocus
            />
            {errors.code && code.length !== 6 ? (
              <Caption tone="error" align="center" style={{ marginTop: spacing.sm }}>
                {errors.code}
              </Caption>
            ) : null}

            <View style={{ height: spacing.xl }} />

            <AuthButton
              title={pendingPhoneVerification ? 'Verify phone' : 'Verify email'}
              variant="primary"
              loading={isLoading}
              onPress={pendingPhoneVerification ? handlePhoneOtpVerify : onPressVerify}
            />

            <View style={{ height: spacing.base }} />

            <AuthButton
              title="Go back"
              variant="ghost"
              trailingIcon={null}
              onPress={() => {
                if (pendingPhoneVerification) {
                  setPendingPhoneVerification(false);
                } else {
                  setPendingVerification(false);
                }
                setCode('');
                setErrors((prev) => ({ ...prev, code: '', general: '' }));
              }}
            />
          </View>
        ) : (
          <>
            <SegmentedToggle
              value={authMethod}
              onChange={(v) => {
                setAuthMethod(v);
                setErrors((prev) => ({ ...prev, general: '' }));
              }}
              options={[
                { value: 'phone', label: 'Phone' },
                { value: 'email', label: 'Email' },
              ]}
            />

            <View style={{ height: spacing.lg }} />

            {authMethod === 'email' ? (
              <View>
                <AuthInput
                  variant="filled"
                  label="Full name"
                  value={name}
                  onChangeText={(t) => {
                    setName(t.replace(/\d/g, ''));
                    if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
                  }}
                  autoCapitalize="words"
                  autoComplete="name"
                  editable={!isLoading}
                  error={errors.name || undefined}
                  returnKeyType="next"
                />

                <View style={{ height: spacing.md }} />

                <AuthInput
                  variant="filled"
                  label="Email address"
                  value={emailAddress}
                  onChangeText={(t) => {
                    setEmailAddress(t);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  editable={!isLoading}
                  error={errors.email || undefined}
                  returnKeyType="next"
                />

                <View style={{ height: spacing.md }} />

                <AuthInput
                  variant="filled"
                  label="Password"
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
                  }}
                  secureTextEntry
                  showPasswordToggle
                  autoComplete="new-password"
                  editable={!isLoading}
                  error={errors.password || undefined}
                  hint={!errors.password && password.length > 0 && password.length < 8 ? 'Use at least 8 characters' : undefined}
                  returnKeyType="done"
                  onSubmitEditing={onSignUpPress}
                />

                {errors.general ? (
                  <Caption tone="error" align="center" style={{ marginTop: spacing.md }}>
                    {errors.general}
                  </Caption>
                ) : null}

                <View style={{ height: spacing.xl }} />

                <AuthButton
                  title="Create account"
                  variant="primary"
                  loading={isLoading}
                  onPress={onSignUpPress}
                />
              </View>
            ) : (
              <View>
                <AuthInput
                  variant="filled"
                  label="Full name"
                  value={phoneName}
                  onChangeText={(t) => {
                    setPhoneName(t.replace(/\d/g, ''));
                    if (errors.phoneName) setErrors((prev) => ({ ...prev, phoneName: '' }));
                  }}
                  autoCapitalize="words"
                  autoComplete="name"
                  editable={!isLoading}
                  error={errors.phoneName || undefined}
                  returnKeyType="next"
                />

                <View style={{ height: spacing.lg }} />

                <Caption
                  tone="tertiary"
                  style={{
                    ...(typography.label as object),
                    color: colors.textTertiary,
                    marginBottom: spacing.xs,
                  }}
                >
                  Phone number
                </Caption>
                <CustomPhoneInput
                  value={phoneNumber}
                  onChangePhoneNumber={(t) => {
                    setPhoneNumber(t);
                    if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
                  }}
                  selectedCountry={selectedCountry}
                  onChangeSelectedCountry={setSelectedCountry}
                />
                {errors.phone ? (
                  <Caption tone="error" style={{ marginTop: 6 }}>
                    {errors.phone}
                  </Caption>
                ) : null}

                <View style={{ height: spacing.xl }} />

                <AuthButton
                  title="Send code"
                  variant="primary"
                  loading={isLoading}
                  onPress={handlePhoneSignUp}
                />
              </View>
            )}

            <View style={{ height: spacing['2xl'] }} />

            <AuthDivider label="Or sign up with" />

            <View style={{ height: spacing.lg }} />

            <OAuthRow
              mode="sign_up"
              onApple={Platform.OS === 'ios' ? handleAppleAuth : undefined}
              onGoogle={handleGoogleAuth}
              appleLoading={appleLoading}
              googleLoading={googleLoading}
            />

            <View style={{ height: spacing['2xl'] }} />

            <View style={styles.bottomLinkRow}>
              <Body tone="secondary">Already have an account? </Body>
              <Pressable hitSlop={6} onPress={() => router.push('/sign-in')}>
                <Body tone="accent" style={{ fontWeight: '700' }}>
                  Sign in
                </Body>
              </Pressable>
            </View>
          </>
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
  bottomLinkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
