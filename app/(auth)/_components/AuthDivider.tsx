import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/utils/ThemeContext';
import { getAuthColors, spacing, typography } from './tokens';

type Props = {
  label?: string;
};

const AuthDivider: React.FC<Props> = ({ label = 'Or continue with' }) => {
  const { isDarkMode } = useTheme();
  const colors = getAuthColors(isDarkMode);

  return (
    <View style={styles.row}>
      <View style={[styles.line, { backgroundColor: colors.border }]} />
      <Text
        style={[
          typography.label,
          {
            color: colors.textTertiary,
            marginHorizontal: spacing.base,
            letterSpacing: 1.4,
          },
        ]}
      >
        {label.toUpperCase()}
      </Text>
      <View style={[styles.line, { backgroundColor: colors.border }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  line: {
    flex: 1,
    height: 1,
  },
});

export default AuthDivider;
