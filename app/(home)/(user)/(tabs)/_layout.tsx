import React, { useMemo } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/utils/ThemeContext';
import { View, Platform, Text, TouchableOpacity } from 'react-native';
import FloatingChatFab from '@/components/FloatingChatFab';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/utils/AuthContext';
import { useGuestUser } from '@/utils/GuestUserContext';
import { useConversations } from '@/hooks/useConversations';

export default function TabLayout() {
  const { isDarkMode } = useTheme();
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const { isGuest } = useGuestUser();

  const isDealer = (profile?.role ?? user?.user_metadata?.role) === 'dealer';
  const { data: conversations } = useConversations({
    userId: user?.id ?? null,
    enabled: !!user && !isGuest && !isDealer,
  });

  // Memoize with stable dependency to prevent unnecessary recalculations
  const totalUnread = useMemo(() => {
    if (!conversations || conversations.length === 0) return 0;
    return conversations.reduce(
      (count, convo) => count + (convo.user_unread_count ?? 0),
      0
    );
  }, [conversations?.length, conversations?.map(c => c.user_unread_count).join(',')]);

  return (
    <>
      <Tabs
        screenOptions={({ route }) => ({
          tabBarStyle: {
            position: 'absolute',
            backgroundColor: isDarkMode ? '#000' : 'rgba(255, 255, 255, 0.98)',
            height: Platform.OS === 'ios' ? 90 : 65, // Increased height to accommodate labels
            paddingBottom: Platform.OS === 'ios' ? 15 : 5, // Lower bottom padding on Android
            paddingTop: 5,
            borderTopWidth: isDarkMode ? 1 : 0,
            borderTopColor: isDarkMode ? '#333' : 'transparent',
            // Modern glass effect shadow
            shadowColor: isDarkMode ? '#000' : '#666',
            shadowOffset: { width: 0, height: -3 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
          },
          tabBarShowLabel: true,
          tabBarActiveTintColor: isDarkMode ? '#FFFFFF' : '#000000',
          tabBarInactiveTintColor: isDarkMode ? '#888888' : '#666666',
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '500',
          },
          tabBarItemStyle: {
            height: 55, // Fixed height for all tab items
            padding: 0, // Remove default padding
          },
          tabBarButton: (props) => {
            // Expo may pass null for some props (e.g., delayLongPress), which conflicts with TouchableOpacityProps types.
            const { delayLongPress, disabled, ...rest } = props as typeof props & {
              delayLongPress?: number | null;
              disabled?: boolean | null;
            };
            const touchableProps = {
              ...rest,
              delayLongPress: delayLongPress ?? undefined,
              disabled: disabled ?? undefined,
            };

            // Skip custom button for autoclips (it has its own special styling)
            if (route.name === 'autoclips') {
              return <TouchableOpacity {...(touchableProps as any)} />;
            }
            
            const isSelected = props.accessibilityState?.selected;
            
            return (
              <TouchableOpacity
                {...(touchableProps as any)}
                style={[
                  props.style,
                  {
                    position: 'relative',
                  },
                ]}
              >
                {props.children}
                {isSelected && (
                  <View
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: '20%',
                      right: '20%',
                      height: 3,
                      backgroundColor: '#D55004',
                      alignSelf: 'center',
                    }}
                  />
                )}
              </TouchableOpacity>
            );
          },
          headerStyle: {
            backgroundColor: isDarkMode ? '#121212' : '#FFFFFF',
            borderBottomWidth: 0,
          },
          headerTintColor: '#D55004',
          headerShown: route.name !== 'index',
          tabBarIcon: ({ color, size, focused }) => {
            let iconName: keyof typeof Ionicons.glyphMap = 'home';

            if (route.name === 'index')
              iconName = focused ? 'home' : 'home-outline';
            else if (route.name === 'autoclips') iconName = 'film';
            else if (route.name === 'dealerships')
              iconName = focused ? 'business' : 'business-outline';
            else if (route.name === 'chat')
              iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
            else if (route.name === 'favorites')
              iconName = focused ? 'heart' : 'heart-outline';
            else if (route.name === 'MyListings')
              iconName = focused ? 'list' : 'list-outline';
            else if (route.name === 'profile')
              iconName = focused ? 'person' : 'person-outline';

            // Special styling for autoclips button - no orange dot
            if (route.name === 'autoclips') {
              return (
                <View
                  style={{
                    backgroundColor: '#D55004',
                    borderRadius: 25,
                    width: 56,
                    height: 56,
                    justifyContent: 'center',
                    alignItems: 'center',
                    // Modern shadow
                    shadowColor: '#D55004',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 8,
                    borderWidth: isDarkMode ? 0 : 1,
                    borderColor: 'rgba(213, 80, 4, 0.1)',
                    transform: [{ translateY: -15 }],
                  }}>
                  <Ionicons name={iconName} size={32} color='white' />
                </View>
              );
            }

            // Chat tab with unread badge
            if (route.name === 'chat') {
              return (
                <View
                  style={{
                    height: 55,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                  <View style={{ position: 'relative' }}>
                    <Ionicons
                      name={iconName}
                      size={28}
                      color={focused ? (isDarkMode ? '#FFFFFF' : '#000000') : (isDarkMode ? '#888888' : '#666666')}
                      style={{
                        opacity: focused ? 1 : 0.9,
                      }}
                    />
                    {totalUnread > 0 && (
                      <View
                        style={{
                          position: 'absolute',
                          top: -4,
                          right: -8,
                          minWidth: 18,
                          height: 18,
                          paddingHorizontal: 4,
                          borderRadius: 9,
                          backgroundColor: '#D55004',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          style={{
                            color: '#FFFFFF',
                            fontSize: 10,
                            fontWeight: '700',
                          }}
                        >
                          {totalUnread > 99 ? '99+' : totalUnread}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            }

            return (
              <View
                style={{
                  height: 55,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                <Ionicons
                  name={iconName}
                  size={28}
                  color={focused ? (isDarkMode ? '#FFFFFF' : '#000000') : (isDarkMode ? '#888888' : '#666666')}
                  style={{
                    opacity: focused ? 1 : 0.9,
                  }}
                />
              </View>
            );
          },
        })}>
        <Tabs.Screen 
          name='index' 
          options={{ 
            headerTitle: t('navbar.home'),
            tabBarLabel: t('navbar.home')
          }} 
        />
        <Tabs.Screen
          name='dealerships'
          options={{ 
            headerTitle: t('navbar.dealerships'), 
            headerShown: false,
            tabBarLabel: t('navbar.dealerships')
          }}
        />
        <Tabs.Screen
          name='autoclips'
          options={{
            animation: 'fade',
            headerTitle: t('navbar.autoclips'),
            headerShown: false,
            tabBarStyle: { display: 'none' },
            tabBarLabel: ''
          }}
        />
        <Tabs.Screen
          name='chat'
          options={{
            headerTitle: t('navbar.chat'),
            headerShown: false,
            tabBarLabel: t('navbar.chat'),
            href: isDealer ? null : undefined,
          }}
        />

        <Tabs.Screen
          name='favorites'
          options={{
            headerTitle: t('navbar.favorites'),
            headerShown: false,
            tabBarLabel: t('navbar.favorites'),
            href: isDealer ? undefined : null,
          }}
        />
        <Tabs.Screen
          name='MyListings'
          options={{
            headerTitle: t('navbar.listings'),
            headerShown: false,
            tabBarLabel: t('navbar.listings'),
            href: isDealer ? null : undefined,
          }}
        />
        <Tabs.Screen
          name='profile'
          options={{ 
            headerTitle: t('navbar.profile'), 
            headerShown: false,
            tabBarLabel: t('navbar.profile'),
            href: isDealer ? undefined : null  // Show profile tab for dealers
          }}
        />
      </Tabs>

      {/* ADDED: AI Chat Floating Action Button - Only appears in user tab screens */}
      <FloatingChatFab />
    </>
  );
}
