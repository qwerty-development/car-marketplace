import React, { useState } from 'react';
import { Modal, Platform, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/utils/ThemeContext';
import { usePathname, useSegments } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import EnhancedChatScreen from './ChatAssistantScreen';

export default function FloatingChatFab() {
  const { isDarkMode } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [shouldHide, setShouldHide] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const pathname = usePathname();
  const segments = useSegments();
  const insets = useSafeAreaInsets();

  // FAB must float above the tab bar. Tab bar height = 65 + insets.bottom (Android)
  // or Math.max(90, 65 + insets.bottom) (iOS). Add 12px breathing room on top.
  const bottomOffset = Platform.OS === 'ios'
    ? Math.max(90, 65 + insets.bottom) + 12
    : 65 + insets.bottom + 12;

  // Since we're now only in user tabs, we only need to check for autoclips
  useFocusEffect(
    React.useCallback(() => {
      const isAutoclipsPage = pathname.includes('autoclips') || 
                             pathname.includes('autoclip') || 
                             segments.some(segment => segment === 'autoclips') ||
                             segments.some(segment => segment === 'autoclip') ||
                             segments[segments.length - 1] === 'autoclips';
      
      console.log('FloatingChatFab - pathname:', pathname);
      console.log('FloatingChatFab - segments:', segments);
      console.log('FloatingChatFab - isAutoclipsPage:', isAutoclipsPage);
      
      setShouldHide(isAutoclipsPage);
    }, [pathname, segments])
  );

  // Hide the chat button on autoclips page
  if (shouldHide) {
    console.log('Hiding chat button for autoclips page');
    return null;
  }

  const handleOpenModal = () => {
    setIsOpen(true);
    // Trigger a refresh of the conversation when opening
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <>
      {/* Floating Action Button */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handleOpenModal}
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
          shadowColor: '#D55004',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 6,
          elevation: 8,
          zIndex: 1000, // Ensure it appears above other content
        }}
      >
        <FontAwesome5 name="robot" size={22} color="#fff" />
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
              top: 22, // lowered for vertical alignment with header icons
              right: 20,
              zIndex: 10,
              backgroundColor: isDarkMode ? '#1F1F1F' : 'rgba(0,0,0,0.05)',
              borderRadius: 18,
              paddingHorizontal: 6,
              paddingVertical: 6,
            }}
          >
            <Ionicons name="close" size={22} color={isDarkMode ? '#fff' : '#000'} />
          </TouchableOpacity>

          {/* Chat Screen */}
          <EnhancedChatScreen 
            onClose={() => setIsOpen(false)} 
            refreshTrigger={refreshTrigger}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}