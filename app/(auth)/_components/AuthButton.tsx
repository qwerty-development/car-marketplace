import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  GestureResponderEvent,
  Platform,
  Pressable,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/utils/ThemeContext';
import { getAuthColors, radius, spacing, typography } from './tokens';

type Variant = 'primary' | 'secondary' | 'ghost';

type Props = {
  title: string;
  onPress: (e?: GestureResponderEvent) => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  trailingIcon?: keyof typeof Ionicons.glyphMap | null;
  leadingIcon?: keyof typeof Ionicons.glyphMap | null;
  style?: ViewStyle;
  fullWidth?: boolean;
};

const AuthButton: React.FC<Props> = ({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  trailingIcon = variant === 'primary' ? 'arrow-forward' : null,
  leadingIcon = null,
  style,
  fullWidth = true,
}) => {
  const { isDarkMode } = useTheme();
  const colors = getAuthColors(isDarkMode);
  const scale = useRef(new Animated.Value(1)).current;
  const isInteractive = !disabled && !loading;

  const handlePressIn = () => {
    if (!isInteractive) return;
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      bounciness: 0,
      speed: 24,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      bounciness: 4,
      speed: 24,
    }).start();
  };

  const handlePress = (e: GestureResponderEvent) => {
    if (!isInteractive) return;
    if (variant === 'primary') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } else if (variant === 'secondary') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } else {
      Haptics.selectionAsync().catch(() => {});
    }
    onPress(e);
  };

  const baseHeight = variant === 'ghost' ? 44 : 52;

  let backgroundColor = 'transparent';
  let borderColor: string | undefined;
  let borderWidth = 0;
  let textColor = colors.textPrimary;

  if (variant === 'primary') {
    backgroundColor = colors.accent;
    textColor = colors.onAccent;
  } else if (variant === 'secondary') {
    backgroundColor = 'transparent';
    borderColor = colors.borderStrong;
    borderWidth = StyleSheet.hairlineWidth > 0.5 ? 1.5 : 1;
    textColor = colors.textPrimary;
  } else {
    backgroundColor = 'transparent';
    textColor = colors.accent;
  }

  const containerStyle: ViewStyle = {
    height: baseHeight,
    borderRadius: radius.pill,
    backgroundColor,
    borderColor,
    borderWidth,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    width: fullWidth ? '100%' : undefined,
    opacity: disabled ? 0.45 : 1,
    overflow: 'hidden',
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, fullWidth && { width: '100%' }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !isInteractive, busy: loading }}
        accessibilityLabel={title}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        hitSlop={6}
        style={({ pressed }) => [
          containerStyle,
          variant === 'ghost' && pressed && { backgroundColor: colors.accentSoft },
          variant === 'primary' && pressed && { backgroundColor: colors.accentPressed },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={variant === 'primary' ? colors.onAccent : colors.accent} />
        ) : (
          <View style={styles.row}>
            {leadingIcon ? (
              <Ionicons
                name={leadingIcon}
                size={18}
                color={textColor}
                style={{ marginRight: spacing.sm }}
              />
            ) : null}
            <Animated.Text
              style={[
                typography.button,
                { color: textColor },
                Platform.OS === 'android' ? { includeFontPadding: false } : null,
              ]}
            >
              {title}
            </Animated.Text>
            {trailingIcon ? (
              <Ionicons
                name={trailingIcon}
                size={18}
                color={textColor}
                style={{ marginLeft: spacing.sm }}
              />
            ) : null}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AuthButton;
