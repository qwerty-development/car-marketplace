// app/(home)/(user)/DeepLinkTest.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import DeepLinkTester from '@/components/DeepLinkTester';
import { useTheme } from '@/utils/ThemeContext';

export default function DeepLinkTestScreen() {
  const { isDarkMode } = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDarkMode ? '#121212' : '#f5f5f5' }
      ]}
    >
      <DeepLinkTester />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
});