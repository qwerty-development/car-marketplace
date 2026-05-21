import React, { useEffect, useRef } from 'react';
import {
  NativeSyntheticEvent,
  Platform,
  StyleSheet,
  TextInput,
  TextInputKeyPressEventData,
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
  const inputsRef = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => {
        inputsRef.current[0]?.focus();
      }, 200);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  const setDigit = (index: number, digit: string) => {
    const clean = digit.replace(/\D/g, '');
    let next = value;
    if (clean.length > 1) {
      // pasted multi-digit value — fill from this index
      const chars = clean.split('').slice(0, length - index);
      next = (value.substring(0, index) + chars.join('') + value.substring(index + chars.length)).substring(0, length);
      const newCursor = Math.min(index + chars.length, length - 1);
      inputsRef.current[newCursor]?.focus();
    } else if (clean.length === 1) {
      next = (value.substring(0, index) + clean + value.substring(index + 1)).substring(0, length);
      if (index < length - 1) {
        inputsRef.current[index + 1]?.focus();
      } else {
        inputsRef.current[index]?.blur();
      }
    } else {
      // empty/non-digit — keep value
    }
    onChange(next);
    if (next.length === length && next.replace(/\D/g, '').length === length) {
      onComplete?.(next);
    }
  };

  const handleKeyPress = (
    index: number,
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
  ) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (!value[index] && index > 0) {
        inputsRef.current[index - 1]?.focus();
        const trimmed = (value.substring(0, index - 1) + '' + value.substring(index)).substring(0, length);
        onChange(trimmed);
      } else if (value[index]) {
        const cleared = (value.substring(0, index) + '' + value.substring(index + 1)).substring(0, length);
        onChange(cleared);
      }
    }
  };

  const cells = Array.from({ length }, (_, i) => i);

  return (
    <View style={styles.row}>
      {cells.map((i) => {
        const ch = value[i] || '';
        const isActive = (value.length === i && editable) || (i === 0 && value.length === 0 && editable);
        const showError = !!error;
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
            <TextInput
              ref={(el) => {
                inputsRef.current[i] = el;
              }}
              value={ch}
              onChangeText={(t) => setDigit(i, t)}
              onKeyPress={(e) => handleKeyPress(i, e)}
              keyboardType="number-pad"
              maxLength={length}
              textContentType={Platform.OS === 'ios' ? 'oneTimeCode' : 'none'}
              autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
              editable={editable}
              selectTextOnFocus
              style={[
                styles.input,
                {
                  color: colors.textPrimary,
                },
                Platform.OS === 'android' ? { includeFontPadding: false } : null,
              ]}
              caretHidden
            />
          </View>
        );
      })}
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
  input: {
    width: '100%',
    height: '100%',
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: 0,
  },
});

export default OtpInput;
