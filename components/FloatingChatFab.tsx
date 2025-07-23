import React, { useState } from 'react';
import { Modal, Platform, SafeAreaView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/utils/ThemeContext';
import EnhancedChatScreen from './ChatAssistantScreen';

/**
 * FloatingChatFab
 * ----------------
 * Global floating action button that opens the AI chat assistant in a modal.
 * This component is intended to be rendered once at the root of the `(home)` layout
 * so it appears on both user and dealer home stacks.
 */
export default function FloatingChatFab() {
  const { isDarkMode } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  // Dimensions: adjust vertical offset so the FAB floats above the tab bar
  const bottomOffset = Platform.OS === 'ios' ? 100 : 70;

  return (
    <>
      {/* Floating Action Button */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setIsOpen(true)}
        style={{
          position: 'absolute',
          bottom: bottomOffset,
          right: 24,
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: '#D55004',
          justifyContent: 'center',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 6,
          elevation: 8,
        }}
      >
        <Ionicons name="chatbubbles-outline" size={30} color="#fff" />
      </TouchableOpacity>

      {/* Chat Modal */}
      <Modal
        animationType={Platform.OS === 'ios' ? 'slide' : 'fade'}
        visible={isOpen}
        onRequestClose={() => setIsOpen(false)}
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: isDarkMode ? '#000' : '#fff' }}>
          {/* Close Button */}
          <TouchableOpacity
            accessible={true}
            accessibilityLabel="Close chat assistant"
            onPress={() => setIsOpen(false)}
            style={{
              position: 'absolute',
              top: 16,
              right: 20,
              zIndex: 10,
              backgroundColor: isDarkMode ? '#1F1F1F' : 'rgba(0,0,0,0.03)',
              borderRadius: 20,
              padding: 4,
            }}
          >
            <Ionicons name="close" size={28} color={isDarkMode ? '#fff' : '#000'} />
          </TouchableOpacity>

          {/* Chat Screen */}
          <EnhancedChatScreen onClose={() => setIsOpen(false)} />
        </SafeAreaView>
      </Modal>
    </>
  );
} 