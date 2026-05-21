import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useTheme } from '@/utils/ThemeContext';
import { useGuestUser } from '@/utils/GuestUserContext';
import HeroBackdrop from './_components/HeroBackdrop';
import AuthButton from './_components/AuthButton';
import {
  Brand,
  Caption,
  Display,
  Mono,
  Subtitle,
} from './_components/Display';
import { getAuthColors, motion, spacing } from './_components/tokens';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const HERO_HEIGHT = Math.min(Math.max(SCREEN_HEIGHT * 0.56, 360), 620);

export default function WelcomeScreen() {
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const { setGuestMode } = useGuestUser();
  const colors = getAuthColors(isDarkMode);
  const insets = useSafeAreaInsets();
  const [isGuestLoading, setIsGuestLoading] = useState(false);

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headlineOpacity = useRef(new Animated.Value(0)).current;
  const headlineTranslate = useRef(new Animated.Value(16)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleTranslate = useRef(new Animated.Value(16)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;
  const buttonsTranslate = useRef(new Animated.Value(24)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const stagger = (
      opacity: Animated.Value,
      translate: Animated.Value | null,
      delay: number,
      duration = motion.med,
    ): Animated.CompositeAnimation => {
      const animations: Animated.CompositeAnimation[] = [
        Animated.timing(opacity, {
          toValue: 1,
          duration,
          delay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ];
      if (translate) {
        animations.push(
          Animated.timing(translate, {
            toValue: 0,
            duration,
            delay,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        );
      }
      return Animated.parallel(animations);
    };

    Animated.parallel([
      stagger(headerOpacity, null, 200, motion.med),
      stagger(headlineOpacity, headlineTranslate, 350),
      stagger(subtitleOpacity, subtitleTranslate, 450),
      stagger(buttonsOpacity, buttonsTranslate, 600),
      stagger(footerOpacity, null, 800),
    ]).start();
  }, [
    headerOpacity,
    headlineOpacity,
    headlineTranslate,
    subtitleOpacity,
    subtitleTranslate,
    buttonsOpacity,
    buttonsTranslate,
    footerOpacity,
  ]);

  const handleGuestMode = async () => {
    try {
      setIsGuestLoading(true);
      await setGuestMode(true);
      router.replace('/(home)' as never);
    } catch (error) {
      console.error('[GuestMode] Error setting guest mode:', error);
      Alert.alert('Error', 'Failed to continue as guest');
    } finally {
      setIsGuestLoading(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isDarkMode ? 'light-content' : 'light-content'}
      />

      <HeroBackdrop height={HERO_HEIGHT} />

      <SafeAreaView edges={['top']} style={styles.headerSafe} pointerEvents="box-none">
        <Animated.View
          style={[styles.header, { opacity: headerOpacity }]}
          pointerEvents="box-none"
        >
          <Brand tone="onAccent" style={styles.brandShadow}>
            Fleet
          </Brand>
          <Mono tone="onAccent" style={styles.brandShadow}>
            v{Constants.expoConfig?.version || '1.0.0'}
          </Mono>
        </Animated.View>
      </SafeAreaView>

      <View style={[styles.panel, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Animated.View
          style={{
            opacity: headlineOpacity,
            transform: [{ translateY: headlineTranslate }],
          }}
        >
          <Display tone="primary">Drive what{'\n'}moves you.</Display>
        </Animated.View>

        <Animated.View
          style={{
            opacity: subtitleOpacity,
            transform: [{ translateY: subtitleTranslate }],
            marginTop: spacing.base,
          }}
        >
          <Subtitle tone="secondary">
            Buy, sell, and explore Lebanon's most trusted car marketplace.
          </Subtitle>
        </Animated.View>

        <Animated.View
          style={[
            styles.actions,
            {
              opacity: buttonsOpacity,
              transform: [{ translateY: buttonsTranslate }],
            },
          ]}
        >
          <AuthButton
            title="Sign in"
            variant="primary"
            onPress={() => router.push('/sign-in')}
          />
          <View style={{ height: spacing.md }} />
          <AuthButton
            title="Create account"
            variant="secondary"
            trailingIcon={null}
            onPress={() => router.push('/sign-up')}
          />
          <View style={{ height: spacing.sm }} />
          <AuthButton
            title="Continue as guest"
            variant="ghost"
            trailingIcon={null}
            onPress={handleGuestMode}
            loading={isGuestLoading}
            fullWidth
          />
        </Animated.View>

        <Animated.View style={[styles.footer, { opacity: footerOpacity }]}>
          <Caption tone="tertiary" align="center">
            By continuing you agree to our{' '}
            <Caption
              tone="accent"
              onPress={() => router.push('/terms-of-service')}
              style={{ textDecorationLine: 'underline' }}
            >
              Terms
            </Caption>
            {' and '}
            <Caption
              tone="accent"
              onPress={() => router.push('/privacy-policy')}
              style={{ textDecorationLine: 'underline' }}
            >
              Privacy Policy
            </Caption>
            .
          </Caption>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerSafe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    height: 56,
  },
  brandShadow: {
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['2xl'],
  },
  actions: {
    marginTop: spacing['2xl'],
  },
  footer: {
    marginTop: spacing.lg,
  },
});
