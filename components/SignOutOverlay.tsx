// components/SignOutOverlay.tsx
import React from 'react';
import { Modal, View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/utils/ThemeContext';

interface SignOutOverlayProps {
  visible: boolean;
}

export const SignOutOverlay: React.FC<SignOutOverlayProps> = ({ visible }) => {
  const { isDarkMode } = useTheme();

  if (!visible) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={() => {}}
    >
      <View style={styles.container}>
        <View style={[
          styles.content,
          { backgroundColor: isDarkMode ? '#222' : '#fff' }
        ]}>
          <ActivityIndicator size="large" color="#D55004" />
          <Text style={[
            styles.text,
            { color: isDarkMode ? '#fff' : '#000' }
          ]}>
            Signing out...
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  content: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    minWidth: 200,
  },
  text: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
  },
});