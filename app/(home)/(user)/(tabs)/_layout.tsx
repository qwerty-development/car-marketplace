import React from 'react'
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/utils/ThemeContext'
import { View } from 'react-native'

export default function TabLayout() {
  const { isDarkMode } = useTheme()

  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isDarkMode ? '#1A1A1A' : 'white',
          height: 60,
          paddingBottom: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.3,
          shadowRadius: 5,
          borderTopWidth: 0,
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: '#D55004',
        tabBarInactiveTintColor: isDarkMode ? 'white' : 'black',
        tabBarItemStyle: route.name === 'autoclips' ? {
          marginBottom: 30,
        } : {
          paddingTop: 5
        },
        headerStyle: {
          backgroundColor: isDarkMode ? '#1A1A1A' : 'white',
          borderBottomWidth: 0,
        },
        headerTintColor: '#D55004',
        headerShown: route.name !== 'index',
        tabBarIcon: ({ color, size, focused }) => {
          let iconName = 'home-outline'

          if (route.name === 'index') iconName = 'home-outline'
          else if (route.name === 'autoclips') iconName = 'film-outline'
          else if (route.name === 'dealerships') iconName = 'business-outline'
          else if (route.name === 'chat') iconName = 'chatbubbles-outline'
          else if (route.name === 'profile') iconName = 'person-outline'

          if (route.name === 'autoclips') {
            return (
              <View style={{
                backgroundColor: '#D55004',
                borderRadius: 30,
                width: 60,
                height: 60,
                justifyContent: 'center',
                alignItems: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 3.84,
                elevation: 5,
              }}>
                <Ionicons name={iconName} size={35} color="white" />
              </View>
            )
          }

          return <Ionicons name={iconName} size={size} color={color} />
        }
      })}>
      <Tabs.Screen
        name='index'
        options={{ headerTitle: 'Home' }}
      />
      <Tabs.Screen
        name='dealerships'
        options={{ headerTitle: 'Dealerships', headerShown: false }}
      />
      <Tabs.Screen
        name='autoclips'
        options={{
          headerTitle: 'Autoclips',
          headerShown: false,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name='chat'
        options={{ headerTitle: 'Chat', headerShown: false }}
      />
      <Tabs.Screen
        name='profile'
        options={{ headerTitle: 'Profile', headerShown: false }}
      />
    </Tabs>
  )
}