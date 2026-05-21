import React, { useEffect, useRef } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme } from '@/utils/ThemeContext';
import { getAuthColors, radius, spacing } from './tokens';

type Props = {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (full: string) => void;
  length?: number;
  error?: string;
  autoFocus?: boolean;
  editable?: boolean;
};

const OtpInput: React.FC<Props> = ({
  value,
  onChange,
  onComplete,
  length = 6,
  error,
  autoFocus = false,
  editable = true,
}) => {
  const { isDarkMode } = useTheme();
  const colors = getAuthColors(isDarkMode);
  const hiddenInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => {
        hiddenInputRef.current?.focus();
      }, 200);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  // Re-focus whenever value is cleared (e.g. after resend code)
  useEffect(() => {
    if (value === '' && editable) {
      const t = setTimeout(() => {
        hiddenInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(t);
    }
  }, [value, editable]);

  const handleChange = (text: string) => {
    const clean = text.replace(/\D/g, '').substring(0, length);
    onChange(clean);
    if (clean.length === length) {
      onComplete?.(clean);
      hiddenInputRef.current?.blur();
    }
  };

  const cells = Array.from({ length }, (_, i) => i);
  const cursorIndex = value.length < length ? value.length : length - 1;
  // Don't show error once all digits are filled
  const isComplete = value.replace(/\D/g, '').length === length;

  return (
    <View style={styles.row}>
      {/* Visual cells — rendered underneath */}
      {cells.map((i) => {
        const ch = value[i] || '';
        const isActive = i === cursorIndex && editable;
        const showError = !!error && !isComplete;
        return (
          <View
            key={i}
            style={[
              styles.cell,
              {
                backgroundColor: colors.bgElevated,
                borderColor: showError
                  ? colors.error
                  : isActive
                    ? colors.accent
                    : colors.border,
                borderWidth: showError || isActive ? 1.5 : 1,
              },
            ]}
          >
            <Text style={[styles.cellText, { color: colors.textPrimary }]}>
              {ch}
            </Text>
          </View>
        );
      })}

      {/*
       * Transparent TextInput covering the full row — sits ON TOP so Android's
       * autofill framework sees a real, "visible" input. opacity:0 makes Android
       * consider the view gone; color/bg transparent keeps it visible to the OS.
       */}
      <TextInput
        ref={hiddenInputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={length}
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        importantForAutofill="yes"
        editable={editable}
        caretHidden
        style={styles.transparentInput}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cell: {
    flex: 1,
    aspectRatio: 0.78,
    maxWidth: 56,
    minWidth: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  transparentInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // opacity:0.01 keeps the view "alive" in Android's view hierarchy (opacity:0
    // would make Android ignore it for autofill), but is imperceptible to the user
    opacity: 0.01,
    fontSize: 18,
    zIndex: 10,
  },
});

export default OtpInput;
