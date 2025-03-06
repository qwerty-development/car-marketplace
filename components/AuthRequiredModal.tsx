// components/AuthRequiredModal.tsx
import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/utils/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useGuestUser } from '@/utils/GuestUserContext';
import { LinearGradient } from 'expo-linear-gradient';

interface AuthRequiredModalProps {
  isVisible: boolean;
  onClose: () => void;
  featureName: string;
}

const AuthRequiredModal: React.FC<AuthRequiredModalProps> = ({
  isVisible,
  onClose,
  featureName,
}) => {
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const { clearGuestMode } = useGuestUser();

  const handleSignIn = async () => {
    await clearGuestMode();
    onClose();
    router.push('/(auth)/sign-in');
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View
          style={[
            styles.modalContent,
            { backgroundColor: isDarkMode ? '#1c1c1c' : '#ffffff' },
          ]}
        >
          <Ionicons
            name="lock-closed-outline"
            size={56}
            color="#D55004"
            style={styles.icon}
          />

          <Text
            style={[
              styles.title,
              { color: isDarkMode ? '#ffffff' : '#000000' },
            ]}
          >
            Sign In Required
          </Text>

          <Text
            style={[
              styles.message,
              { color: isDarkMode ? '#cccccc' : '#666666' },
            ]}
          >
            You need to sign in to {featureName}.
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <LinearGradient
              colors={['#ff6a00', '#ee0979']}
              style={styles.signInButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <TouchableOpacity
                onPress={handleSignIn}
                style={styles.signInButtonTouchable}
              >
                <Text style={styles.signInButtonText}>Sign In</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '90%',
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  icon: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 1,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#D55004',
    borderRadius: 12,
    paddingVertical: 14,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#D55004',
  },
  signInButton: {
    flex: 1,
    borderRadius: 12,
    marginLeft: 8,
  },
  signInButtonTouchable: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
});

export default AuthRequiredModal;
