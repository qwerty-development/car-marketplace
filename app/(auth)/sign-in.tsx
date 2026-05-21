import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { maybeCompleteAuthSession } from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';

import { safeLogEvent } from '@/utils/safeMetaLogger';
import { META_EVENTS } from '@/utils/metaEvents';
import { useAuth } from '@/utils/AuthContext';
import { useGuestUser } from '@/utils/GuestUserContext';
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

export default function SignInPage() {
  const router = useRouter();
  const { signIn, googleSignIn, isLoaded } = useAuth();
  const { setGuestMode } = useGuestUser();

  const [authMethod, setAuthMethod] = useState<AuthMethod>('phone');
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<ICountry | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [pendingPhoneVerification, setPendingPhoneVerification] = useState(false);

  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [otpError, setOtpError] = useState('');
  const [generalError, setGeneralError] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
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

  // Listen for Supabase SIGNED_IN once per mount (Google OAuth path)
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        console.log('[GOOGLE] Supabase session ready → navigating home');
        safeLogEvent(META_EVENTS.SIGN_IN, {
          fb_registration_method: 'google',
        });
        router.replace('/(home)' as never);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  // Email + password sign-in
  const handleEmailSubmit = useCallback(async () => {
    if (!isLoaded) return;

    let hasError = false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailAddress) {
      setEmailError('Email is required');
      hasError = true;
    } else if (!emailRegex.test(emailAddress)) {
      setEmailError('Please enter a valid email address');
      hasError = true;
    } else {
      setEmailError('');
    }

    if (!password) {
      setPasswordError('Password is required');
      hasError = true;
    } else {
      setPasswordError('');
    }

    if (hasError) return;

    setIsLoading(true);
    setGeneralError('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailAddress,
        password,
      });

      if (error) {
        const lower = error.message?.toLowerCase() || '';
        if (
          lower.includes('invalid login credentials') ||
          lower.includes('password') ||
          lower.includes('incorrect')
        ) {
          setPasswordError('Incorrect password. Please try again.');
        } else if (
          lower.includes('user not found') ||
          lower.includes('no user') ||
          lower.includes('email')
        ) {
          setEmailError('No account found with this email address.');
        } else {
          setGeneralError(error.message || 'Sign in failed. Please try again.');
        }
        return;
      }

      if (data.user) {
        safeLogEvent(META_EVENTS.SIGN_IN, {
          fb_registration_method: 'email',
        });
        await signIn({ email: emailAddress, password });
      }
    } catch (err) {
      console.error('Sign in error:', JSON.stringify(err, null, 2));
      setGeneralError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [isLoaded, signIn, emailAddress, password]);

  // Send phone OTP
  const handlePhoneOtpSend = async () => {
    if (!phoneNumber) {
      setPhoneError('Phone number is required');
      return;
    }
    if (!selectedCountry) {
      setPhoneError('Please select a country');
      return;
    }

    const cleanedPhone = phoneNumber.replace(/\D/g, '');
    const callingCode = getCallingCode(selectedCountry).replace(/\D/g, '');
    const fullPhoneNumber = `+${callingCode}${cleanedPhone}`;

    setIsLoading(true);
    setPhoneError('');
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: fullPhoneNumber,
        options: { shouldCreateUser: false },
      });

      if (error) {
        setPhoneError('No account found with this number. Please sign up first.');
        return;
      }

      setPendingPhoneVerification(true);
    } catch (err) {
      console.error('Phone OTP error:', err);
      setPhoneError('No account found with this number. Please sign up first.');
    } finally {
      setIsLoading(false);
    }
  };

  // Verify phone OTP
  const handlePhoneOtpVerify = async () => {
    if (!otpCode || otpCode.length < 6) {
      setOtpError('Enter the 6-digit code we sent you');
      return;
    }

    setIsLoading(true);
    setOtpError('');
    try {
      const callingCode =
        (selectedCountry ? getCallingCode(selectedCountry).replace(/\D/g, '') : '') || '';
      const cleanedPhone = phoneNumber.replace(/\D/g, '');
      const fullPhoneNumber = `+${callingCode}${cleanedPhone}`;

      const { data, error } = await supabase.auth.verifyOtp({
        phone: fullPhoneNumber,
        token: otpCode,
        type: 'sms',
      });

      if (error) {
        setOtpError(error.message || 'Invalid verification code');
        return;
      }

      if (data.user) {
        safeLogEvent(META_EVENTS.SIGN_IN, {
          fb_registration_method: 'phone',
        });
        logAuthEvent('sign_in', 'phone');

        const signupCompleted = data.user.user_metadata?.signup_completed;
        const accountAgeMs = Date.now() - new Date(data.user.created_at).getTime();
        const ONE_HOUR_MS = 60 * 60 * 1000;

        if (signupCompleted) {
          console.log('[PHONE-AUTH] Returning user, signup_completed=true');
        } else if (accountAgeMs > ONE_HOUR_MS) {
          console.log('[PHONE-AUTH] Pre-existing user, stamping signup_completed');
          await supabase.auth.updateUser({ data: { signup_completed: true } });
        } else {
          console.log('[PHONE-AUTH] Possible hijack attempt detected, clearing name');
          await supabase.auth.updateUser({ data: { name: null, full_name: null } });
          setTimeout(() => {
            router.replace('/complete-profile');
          }, 0);
        }
      }
    } catch (err) {
      const error = err as Error;
      console.error('Phone OTP verification error:', error);
      setOtpError(error.message || 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Google OAuth — navigation happens in onAuthStateChange listener above
  const handleGoogleAuth = useCallback(async () => {
    try {
      setGoogleLoading(true);
      console.log('[GOOGLE] Opening Google auth sheet');
      await googleSignIn();
      // Keep loading spinner visible until session is ready
    } catch (err) {
      const error = err as Error;
      console.error('[GOOGLE] OAuth error', error);
      Alert.alert('Google sign-in failed', error?.message ?? 'Please try again.');
      setGoogleLoading(false);
    }
  }, [googleSignIn]);

  // Apple Sign-In + push token registration (preserved verbatim from original)
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

        if (error) {
          throw error;
        }

        if (data?.user) {
          safeLogEvent(META_EVENTS.SIGN_IN, {
            fb_registration_method: 'apple',
          });
          console.log('[APPLE-AUTH] Sign-in successful, registering push token');

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

  const handleGuestSignIn = async () => {
    setIsGuestLoading(true);
    try {
      await setGuestMode(true);
    } catch (err) {
      console.error('[GuestMode] Guest mode error:', err);
      Alert.alert('Error', 'Failed to continue as guest. Please try again.');
    } finally {
      setIsGuestLoading(false);
    }
  };

  const headerTitle = pendingPhoneVerification ? 'Verify your phone' : 'Welcome back.';
  const headerSubtitle = pendingPhoneVerification
    ? `Enter the 6-digit code we sent to ${phoneNumber}.`
    : 'Sign in to continue.';

  return (
    <AuthScaffold showBack onBack={() => router.back()}>
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

        {pendingPhoneVerification ? (
          <View>
            <OtpInput
              value={otpCode}
              onChange={(v) => {
                setOtpCode(v);
                if (otpError) setOtpError('');
              }}
              onComplete={() => handlePhoneOtpVerify()}
              error={otpError || undefined}
              autoFocus
            />
            {otpError ? (
              <Caption tone="error" align="center" style={{ marginTop: spacing.sm }}>
                {otpError}
              </Caption>
            ) : null}

            <View style={{ height: spacing.xl }} />

            <AuthButton
              title="Verify"
              variant="primary"
              loading={isLoading}
              onPress={handlePhoneOtpVerify}
            />

            <View style={{ height: spacing.base }} />

            <AuthButton
              title="Change phone number"
              variant="ghost"
              trailingIcon={null}
              onPress={() => {
                setPendingPhoneVerification(false);
                setOtpCode('');
                setOtpError('');
              }}
            />
          </View>
        ) : (
          <>
            <SegmentedToggle
              value={authMethod}
              onChange={(v) => {
                setAuthMethod(v);
                setGeneralError('');
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
                  returnKeyType="next"
                />

                <View style={{ height: spacing.md }} />

                <AuthInput
                  label="Password"
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t);
                    if (passwordError) setPasswordError('');
                  }}
                  secureTextEntry
                  showPasswordToggle
                  autoComplete="password"
                  editable={!isLoading}
                  error={passwordError || undefined}
                  returnKeyType="done"
                  onSubmitEditing={() => handleEmailSubmit()}
                />

                {generalError ? (
                  <Caption tone="error" align="center" style={{ marginTop: spacing.md }}>
                    {generalError}
                  </Caption>
                ) : null}

                <View style={{ height: spacing.xl }} />

                <AuthButton
                  title="Sign in"
                  variant="primary"
                  loading={isLoading}
                  onPress={handleEmailSubmit}
                />

                <Pressable
                  onPress={() => router.push('/forgot-password')}
                  style={styles.forgotRow}
                  hitSlop={8}
                >
                  <Caption tone="accent">Forgot password?</Caption>
                </Pressable>
              </View>
            ) : (
              <View>
                <PhoneField
                  value={phoneNumber}
                  onChange={(v) => {
                    setPhoneNumber(v);
                    if (phoneError) setPhoneError('');
                  }}
                  country={selectedCountry}
                  onCountryChange={setSelectedCountry}
                  error={phoneError}
                />

                <View style={{ height: spacing.xl }} />

                <AuthButton
                  title="Send code"
                  variant="primary"
                  loading={isLoading}
                  onPress={handlePhoneOtpSend}
                />
              </View>
            )}

            <View style={{ height: spacing['2xl'] }} />

            <AuthDivider label="Or continue with" />

            <View style={{ height: spacing.lg }} />

            <OAuthRow
              mode="sign_in"
              onApple={Platform.OS === 'ios' ? handleAppleAuth : undefined}
              onGoogle={handleGoogleAuth}
              appleLoading={appleLoading}
              googleLoading={googleLoading}
            />

            <View style={{ height: spacing['2xl'] }} />

            <View style={styles.bottomLinkRow}>
              <Body tone="secondary">Don't have an account? </Body>
              <Link href="/sign-up" asChild>
                <Pressable hitSlop={6}>
                  <Body tone="accent" style={{ fontWeight: '700' }}>
                    Create one
                  </Body>
                </Pressable>
              </Link>
            </View>

            <View style={{ height: spacing.base }} />

            <Pressable
              onPress={handleGuestSignIn}
              disabled={isGuestLoading}
              style={styles.guestRow}
              hitSlop={8}
            >
              <Caption tone="tertiary" align="center">
                {isGuestLoading ? 'Loading…' : 'Continue as guest'}
              </Caption>
            </Pressable>
          </>
        )}
      </Animated.View>
    </AuthScaffold>
  );
}

/**
 * Phone field — wraps the existing CustomPhoneInput so the editorial design
 * gets the country picker without reimplementing it. Adds an uppercase label
 * above and an error line below to match AuthInput's visual language.
 */
function PhoneField({
  value,
  onChange,
  country,
  onCountryChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  country: ICountry | null;
  onCountryChange: (c: ICountry) => void;
  error?: string;
}) {
  const { isDarkMode } = useTheme();
  const colors = getAuthColors(isDarkMode);
  return (
    <View>
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
        value={value}
        onChangePhoneNumber={onChange}
        selectedCountry={country}
        onChangeSelectedCountry={onCountryChange}
      />
      {error ? (
        <Caption tone="error" style={{ marginTop: 6 }}>
          {error}
        </Caption>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  titleBlock: {
    marginTop: spacing.lg,
    marginBottom: spacing['2xl'],
  },
  forgotRow: {
    alignSelf: 'flex-end',
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
  },
  bottomLinkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestRow: {
    paddingVertical: spacing.sm,
  },
});
