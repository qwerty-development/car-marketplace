import React, { useState, useRef } from 'react';
import { Modal, Platform, SafeAreaView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/utils/ThemeContext';
import { usePathname, useSegments } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import EnhancedChatScreen from './ChatAssistantScreen';

/**
 * FloatingChatFab
 * ----------------
 * Global floating action button that opens the AI chat assistant in a modal.
 * This component is intended to be rendered once at the root of the `(home)` layout
 * so it appears on both user and dealer home stacks.
 * Hidden on autoclips page and car detail modals to avoid interfering with video playback and overlapping.
 */
export default function FloatingChatFab() {
  const { isDarkMode } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [shouldHide, setShouldHide] = useState(false);
  const pathname = usePathname();
  const segments = useSegments();

  // Check multiple ways to detect autoclips page and car detail modals
  useFocusEffect(
    React.useCallback(() => {
      const isAutoclipsPage = pathname.includes('autoclips') || 
                             pathname.includes('autoclip') || // for individual autoclip pages
                             segments.some(segment => segment === 'autoclips') ||
                             segments.some(segment => segment === 'autoclip') ||
                             segments[segments.length - 1] === 'autoclips';
      
      const isCarDetailModal = pathname.includes('CarDetails') || 
                              pathname.includes('CarDetailModal') ||
                              segments.some(segment => segment === 'CarDetails') ||
                              segments.some(segment => segment === 'CarDetailModal');
      
      console.log('FloatingChatFab - pathname:', pathname);
      console.log('FloatingChatFab - segments:', segments);
      console.log('FloatingChatFab - isAutoclipsPage:', isAutoclipsPage);
      console.log('FloatingChatFab - isCarDetailModal:', isCarDetailModal);
      
      setShouldHide(isAutoclipsPage || isCarDetailModal);
    }, [pathname, segments])
  );

  // Hide the chat button on autoclips page and car detail modals
  if (shouldHide) {
    console.log('Hiding chat button for autoclips page or car detail modal');
    return null;
  }

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