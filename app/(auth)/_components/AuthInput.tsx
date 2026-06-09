import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/utils/ThemeContext';
import { getAuthColors, motion, spacing, typography } from './tokens';

export type AuthInputHandle = {
  focus: () => void;
  blur: () => void;
};

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  error?: string;
  hint?: string;
  rightSlot?: React.ReactNode;
  leftSlot?: React.ReactNode;
  containerStyle?: ViewStyle;
  showPasswordToggle?: boolean;
  secureTextEntry?: boolean;
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
  /** `filled` matches the phone tab rounded box; `underline` is the editorial style */
  variant?: 'filled' | 'underline';
};

const getFilledInputColors = (isDark: boolean) => ({
  background: isDark ? '#1f2937' : '#f3f4f6',
  border: isDark ? '#374151' : '#E5E7EB',
  text: isDark ? '#F9FAFB' : '#111827',
  placeholder: isDark ? '#6B7280' : '#9CA3AF',
});

const getFilledPlaceholder = (label: string): string => {
  const key = label.toLowerCase();
  if (key.includes('email')) return 'you@example.com';
  if (key.includes('password')) return 'Enter your password';
  if (key.includes('name')) return 'Your full name';
  return `Enter ${label.toLowerCase()}`;
};

const FLOAT_LABEL_FONT_SIZE_REST = 17;
const FLOAT_LABEL_FONT_SIZE_FLOATED = 11;

const AuthInput = forwardRef<AuthInputHandle, Props>(
  (
    {
      label,
      error,
      hint,
      rightSlot,
      leftSlot,
      containerStyle,
      showPasswordToggle = false,
      secureTextEntry,
      value,
      variant = 'underline',
      placeholder,
      onFocus,
      onBlur,
      ...rest
    },
    ref,
  ) => {
    const { isDarkMode } = useTheme();
    const colors = getAuthColors(isDarkMode);
    const filledColors = getFilledInputColors(isDarkMode);
    const inputRef = useRef<TextInput>(null);
    const [isFocused, setIsFocused] = useState(false);
    const [showSecret, setShowSecret] = useState(!secureTextEntry);

    const float = useRef(new Animated.Value(value ? 1 : 0)).current;
    const borderHighlight = useRef(new Animated.Value(0)).current;

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      blur: () => inputRef.current?.blur(),
    }));

    useEffect(() => {
      const shouldFloat = isFocused || !!value;
      Animated.timing(float, {
        toValue: shouldFloat ? 1 : 0,
        duration: motion.short,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }, [isFocused, value, float]);

    useEffect(() => {
      Animated.timing(borderHighlight, {
        toValue: isFocused || !!error ? 1 : 0,
        duration: motion.short,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }, [isFocused, error, borderHighlight]);

    const labelTop = float.interpolate({
      inputRange: [0, 1],
      outputRange: [22, 2],
    });
    const labelFontSize = float.interpolate({
      inputRange: [0, 1],
      outputRange: [FLOAT_LABEL_FONT_SIZE_REST, FLOAT_LABEL_FONT_SIZE_FLOATED],
    });
    const labelLetterSpacing = float.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1.2],
    });
    const labelColor = borderHighlight.interpolate({
      inputRange: [0, 1],
      outputRange: [colors.textTertiary, error ? colors.error : colors.accent],
    });
    const borderColor = borderHighlight.interpolate({
      inputRange: [0, 1],
      outputRange: [colors.border, error ? colors.error : colors.accent],
    });
    const borderWidth = borderHighlight.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.5],
    });

    const isSecureField = !!secureTextEntry;
    const effectiveSecure = isSecureField && !showSecret;

    const filledBorderColor = error
      ? colors.error
      : isFocused
        ? colors.accent
        : filledColors.border;

    if (variant === 'filled') {
      return (
        <View style={[styles.wrapper, containerStyle]}>
          <Text
            style={[
              typography.label,
              styles.filledLabel,
              { color: colors.textTertiary },
              Platform.OS === 'android' ? { includeFontPadding: false } : null,
            ]}
          >
            {label}
          </Text>

          <Pressable
            onPress={() => inputRef.current?.focus()}
            accessibilityRole="none"
            style={[
              styles.filledBox,
              {
                backgroundColor: filledColors.background,
                borderColor: filledBorderColor,
                opacity: rest.editable === false ? 0.6 : 1,
              },
            ]}
          >
            {leftSlot ? <View style={styles.leftSlot}>{leftSlot}</View> : null}

            <TextInput
              ref={inputRef}
              {...rest}
              value={value}
              placeholder={placeholder ?? getFilledPlaceholder(label)}
              secureTextEntry={effectiveSecure}
              onFocus={(e) => {
                setIsFocused(true);
                onFocus?.(e);
              }}
              onBlur={(e) => {
                setIsFocused(false);
                onBlur?.(e);
              }}
              placeholderTextColor={filledColors.placeholder}
              style={[
                styles.filledInput,
                { color: filledColors.text },
                Platform.OS === 'android' ? { includeFontPadding: false } : null,
              ]}
              selectionColor={colors.accent}
            />

            {showPasswordToggle && isSecureField ? (
              <Pressable
                onPress={() => setShowSecret((v) => !v)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={showSecret ? 'Hide password' : 'Show password'}
                style={styles.rightSlot}
              >
                <Ionicons
                  name={showSecret ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textSecondary}
                />
              </Pressable>
            ) : null}

            {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
          </Pressable>

          {error ? (
            <Text style={[typography.caption, { color: colors.error, marginTop: 6 }]}>{error}</Text>
          ) : hint ? (
            <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 6 }]}>{hint}</Text>
          ) : null}
        </View>
      );
    }

    return (
      <View style={[styles.wrapper, containerStyle]}>
        <Pressable
          onPress={() => inputRef.current?.focus()}
          accessibilityRole="none"
          style={styles.field}
        >
          <Animated.Text
            pointerEvents="none"
            style={[
              styles.label,
              {
                top: labelTop,
                fontSize: labelFontSize,
                letterSpacing: labelLetterSpacing,
                color: labelColor,
                left: leftSlot ? spacing.xl + 28 : 0,
                fontWeight: '500',
              },
              Platform.OS === 'android' ? { includeFontPadding: false } : null,
            ]}
          >
            {label.toUpperCase()}
          </Animated.Text>

          <View style={styles.inputRow}>
            {leftSlot ? <View style={styles.leftSlot}>{leftSlot}</View> : null}

            <TextInput
              ref={inputRef}
              {...rest}
              value={value}
              secureTextEntry={effectiveSecure}
              onFocus={(e) => {
                setIsFocused(true);
                onFocus?.(e);
              }}
              onBlur={(e) => {
                setIsFocused(false);
                onBlur?.(e);
              }}
              placeholderTextColor={colors.textTertiary}
              style={[
                styles.input,
                {
                  color: colors.textPrimary,
                  paddingLeft: 0,
                },
                Platform.OS === 'android' ? { includeFontPadding: false } : null,
              ]}
              selectionColor={colors.accent}
            />

            {showPasswordToggle && isSecureField ? (
              <Pressable
                onPress={() => setShowSecret((v) => !v)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={showSecret ? 'Hide password' : 'Show password'}
                style={styles.rightSlot}
              >
                <Ionicons
                  name={showSecret ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textSecondary}
                />
              </Pressable>
            ) : null}

            {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
          </View>

          <Animated.View style={[styles.underline, { backgroundColor: borderColor, height: borderWidth }]} />
        </Pressable>

        {error ? (
          <Text style={[typography.caption, { color: colors.error, marginTop: 6 }]}>{error}</Text>
        ) : hint ? (
          <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 6 }]}>{hint}</Text>
        ) : null}
      </View>
    );
  },
);

AuthInput.displayName = 'AuthInput';

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  field: {
    paddingTop: 18,
    paddingBottom: 8,
    position: 'relative',
  },
  label: {
    position: 'absolute',
    left: 0,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 28,
  },
  leftSlot: {
    marginRight: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rightSlot: {
    marginLeft: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 17,
    lineHeight: Platform.OS === 'ios' ? 22 : 24,
    paddingVertical: 0,
  },
  underline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  filledLabel: {
    marginBottom: spacing.xs,
  },
  filledBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.base,
    height: 50,
  },
  filledInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: Platform.OS === 'ios' ? 20 : 22,
    paddingVertical: 0,
  },
});

export default AuthInput;
