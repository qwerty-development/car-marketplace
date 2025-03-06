// components/AuthRequiredModal.tsx
import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet,TouchableWithoutFeedback } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/utils/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useGuestUser } from '@/utils/GuestUserContext';


const AuthRequiredModal = ({ isVisible, onClose, featureName }:any) => {
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
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={guestStyles.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={guestStyles.container}>
              <Ionicons
                name="lock-closed-outline"
                size={56}
                color="#ffffff"
                style={guestStyles.icon}
              />
              <Text style={guestStyles.title}>
                {featureName
                  ? `You need to sign in to ${featureName}`
                  : "Sign In Required"}
              </Text>
              <Text style={guestStyles.subtitle}>
                Please sign in to continue.
              </Text>
              <TouchableOpacity style={guestStyles.signInButton} onPress={handleSignIn}>
                <Text style={guestStyles.signInButtonText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};



// Common guest styles – can be placed in a separate file for reuse
const guestStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // semi-transparent overlay
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  container: {
    width: '80%',
    padding: 24,
    borderRadius: 16,
    backgroundColor: '#D55004', // unified orange background
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  icon: {
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 20,
    textAlign: 'center',
  },
  signInButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#D55004',
  },
});


export default AuthRequiredModal;
