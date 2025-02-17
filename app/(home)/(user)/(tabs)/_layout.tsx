import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/utils/ThemeContext';
import { View, Animated, Platform } from 'react-native';

export default function TabLayout() {
  const { isDarkMode } = useTheme();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isDarkMode ? '#000' : 'rgba(255, 255, 255, 0.98)',
          height: Platform.OS === 'ios' ? 75 : 45, // Lower height on Android
          paddingBottom: Platform.OS === 'ios' ? 15 : 5, // Lower bottom padding on Android
          paddingTop: 5,
          borderTopWidth: 0,
          // Modern glass effect shadow
          shadowColor: isDarkMode ? '#000' : '#666',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: '#D55004',
        tabBarInactiveTintColor: isDarkMode
          ? 'rgba(255, 255, 255, 0.6)'
          : 'rgba(0, 0, 0, 0.6)',
        tabBarItemStyle: {
          height: 55, // Fixed height for all tab items
          padding: 0, // Remove default padding
        },
        headerStyle: {
          backgroundColor: isDarkMode ? '#121212' : '#FFFFFF',
          borderBottomWidth: 0,
        },
        headerTintColor: '#D55004',
        headerShown: route.name !== 'index',
        tabBarIcon: ({ color, size, focused }) => {
          let iconName = 'home';

          if (route.name === 'index')
            iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'autoclips') iconName = 'film';
          else if (route.name === 'dealerships')
            iconName = focused ? 'business' : 'business-outline';
          else if (route.name === 'Favorite')
            iconName = focused ? 'heart' : 'heart-outline';
          else if (route.name === 'profile')
            iconName = focused ? 'person' : 'person-outline';

          // Special styling for autoclips button
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
                color={color}
                style={{
                  opacity: focused ? 1 : 0.9,
                  transform: [{ scale: focused ? 1.1 : 1 }],
                }}
              />
              {focused && (
                <View
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: '#D55004',
                    marginTop: 4,
                  }}
                />
              )}
            </View>
          );
        },
      })}>
      <Tabs.Screen name='index' options={{ headerTitle: 'Home' }} />
      <Tabs.Screen
        name='dealerships'
        options={{ headerTitle: 'Dealerships', headerShown: false }}
      />
      <Tabs.Screen
        name='autoclips'
        options={{
          animation: 'fade',
          headerTitle: 'Autoclips',
          headerShown: false,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name='Favorite'
        options={{ headerTitle: 'Favorite', headerShown: false }}
      />
      <Tabs.Screen
        name='profile'
        options={{ headerTitle: 'Profile', headerShown: false }}
      />
    </Tabs>
  );
}
