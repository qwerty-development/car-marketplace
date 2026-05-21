import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/utils/ThemeContext';
import { getAuthColors, radius, spacing } from './tokens';

type Mode = 'sign_in' | 'sign_up';

type Props = {
  mode: Mode;
  onApple?: () => void | Promise<void>;
  onGoogle?: () => void | Promise<void>;
  appleLoading?: boolean;
  googleLoading?: boolean;
};

const CHIP_SIZE = 56;

const OAuthRow: React.FC<Props> = ({
  mode,
  onApple,
  onGoogle,
  appleLoading = false,
  googleLoading = false,
}) => {
  const { isDarkMode } = useTheme();
  const colors = getAuthColors(isDarkMode);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const available = await AppleAuthentication.isAvailableAsync();
        setAppleAvailable(available);
      } catch {
        setAppleAvailable(false);
      }
    };
    check();
  }, []);

  const chipStyle = {
    width: CHIP_SIZE,
    height: CHIP_SIZE,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderWidth: 1,
  };

  const handleApple = () => {
    if (!onApple) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onApple();
  };

  const handleGoogle = () => {
    if (!onGoogle) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onGoogle();
  };

  return (
    <View style={styles.row}>
      {Platform.OS === 'ios' && appleAvailable && onApple ? (
        <View style={[chipStyle, styles.appleNativeWrap]}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={
              mode === 'sign_in'
                ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                : AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
            }
            buttonStyle={
              isDarkMode
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={CHIP_SIZE / 2}
            style={styles.appleNative}
            onPress={handleApple}
          />
          {appleLoading ? (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator color={isDarkMode ? '#000' : '#fff'} />
            </View>
          ) : null}
        </View>
      ) : (
        <Pressable
          onPress={handleApple}
          disabled={appleLoading || !appleAvailable || !onApple}
          accessibilityRole="button"
          accessibilityLabel={mode === 'sign_in' ? 'Sign in with Apple' : 'Sign up with Apple'}
          style={({ pressed }) => [
            chipStyle,
            styles.chip,
            { opacity: !appleAvailable ? 0.45 : pressed ? 0.7 : 1 },
          ]}
        >
          {appleLoading ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <Ionicons name="logo-apple" size={24} color={colors.textPrimary} />
          )}
        </Pressable>
      )}

      <Pressable
        onPress={handleGoogle}
        disabled={googleLoading || !onGoogle}
        accessibilityRole="button"
        accessibilityLabel={mode === 'sign_in' ? 'Sign in with Google' : 'Sign up with Google'}
        style={({ pressed }) => [
          chipStyle,
          styles.chip,
          { opacity: pressed ? 0.7 : 1 },
        ]}
      >
        {googleLoading ? (
          <ActivityIndicator color={colors.textPrimary} />
        ) : (
          <Ionicons name="logo-google" size={24} color={colors.textPrimary} />
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.base,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  appleNativeWrap: {
    overflow: 'hidden',
    position: 'relative',
  },
  appleNative: {
    width: CHIP_SIZE,
    height: CHIP_SIZE,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: CHIP_SIZE / 2,
  },
});

export default OAuthRow;
