// (home)/(dealer)/(tabs)/_layout.tsx
import { Tabs } from 'expo-router'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { useColorScheme, View, Image, Platform } from 'react-native'
import { BlurView } from 'expo-blur'
import { useDealershipProfile } from '../hooks/useDealershipProfile'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

// Custom Dealership Logo Component
const DealershipLogo = ({ color, focused }: { color: string; focused: boolean }) => {
  const { dealership } = useDealershipProfile()
  
  return (
    <View style={{ 
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      {/* Glow effect when focused */}
      {focused && (
        <View style={{
          position: 'absolute',
          width: 45,
          height: 45,
          borderRadius: 22.5,
          backgroundColor: '#D55004',
          opacity: 0.2,
          transform: [{ scale: 1.2 }]
        }} />
      )}
      
      {/* Logo container with border */}
      <View style={{
        width: 35,
        height: 35,
        borderRadius: 17.5,
        borderWidth: focused ? 2.5 : 2,
        borderColor: focused ? '#D55004' : color,
        overflow: 'hidden',
        backgroundColor: 'white',
        ...Platform.select({
          ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
          },
          android: {
            elevation: 5,
          },
        }),
      }}>
        {dealership?.logo ? (
          <Image
            source={{ uri: dealership.logo }}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: 15,
            }}
            resizeMode="cover"
          />
        ) : (
          <View style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#f3f4f6',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 15,
          }}>
            <Ionicons 
              name="business" 
              size={20} 
              color={focused ? '#D55004' : '#9ca3af'} 
            />
          </View>
        )}
      </View>
      
      {/* Active indicator dot */}
      {focused && (
        <View style={{
          position: 'absolute',
          bottom: -8,
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: '#D55004',
        }} />
      )}
    </View>
  )
}

// Custom Tab Bar Icon Component
const TabIcon = ({ 
  name, 
  color, 
  focused, 
  type = 'ionicons' 
}: { 
  name: string; 
  color: string; 
  focused: boolean;
  type?: 'ionicons' | 'material';
}) => {
  const IconComponent = type === 'material' ? MaterialCommunityIcons : Ionicons
  
  return (
    <View style={{ 
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative'
    }}>
      {/* Background glow effect for focused state */}
      {focused && (
        <View style={{
          position: 'absolute',
          width: 45,
          height: 45,
          borderRadius: 22.5,
          backgroundColor: '#D55004',
          opacity: 0.1,
        }} />
      )}
      
      <IconComponent 
        name={name as any} 
        size={focused ? 28 : 26} 
        color={color}
      />
      
      {/* Active indicator dot */}
      {focused && (
        <View style={{
          position: 'absolute',
          bottom: -12,
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: '#D55004',
        }} />
      )}
    </View>
  )
}

// Custom Tab Bar Background Component
const TabBarBackground = ({ isDarkMode }: { isDarkMode: boolean }) => {
  return (
    <View style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflow: 'hidden',
    }}>
      {/* Main solid background as fallback */}
      <View style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
        borderTopLeftRadius: Platform.OS === 'ios' ? 25 : 20,
        borderTopRightRadius: Platform.OS === 'ios' ? 25 : 20,
      }} />
      
      {/* Gradient overlay */}
      <LinearGradient
        colors={
          isDarkMode 
            ? ['#1a1a1a', '#0f0f0f']
            : ['#ffffff', '#f8fafc']
        }
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderTopLeftRadius: Platform.OS === 'ios' ? 25 : 20,
          borderTopRightRadius: Platform.OS === 'ios' ? 25 : 20,
        }}
      />
      
      {/* Blur overlay for iOS only */}
      {Platform.OS === 'ios' && (
        <BlurView
          intensity={isDarkMode ? 20 : 40}
          tint={isDarkMode ? 'dark' : 'light'}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderTopLeftRadius: 25,
            borderTopRightRadius: 25,
          }}
        />
      )}
      
      {/* Top border accent */}
      <View style={{
        position: 'absolute',
        top: 0,
        left: '20%',
        right: '20%',
        height: 4,
        backgroundColor: '#D55004',
        borderRadius: 2,
        opacity: 0.6,
      }} />
      
      {/* Border for Android to prevent white bleeding */}
      {Platform.OS === 'android' && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: isDarkMode ? '#333333' : '#e5e7eb',
        }} />
      )}
    </View>
  )
}

export default function TabsLayout() {
  const colorScheme = useColorScheme()
  const isDarkMode = colorScheme === 'dark'
  const insets = useSafeAreaInsets()

  // Calculate tab bar height based on platform and safe area
  const tabBarHeight = Platform.OS === 'ios' 
    ? 85 + (insets.bottom > 0 ? 0 : 15) // Account for home indicator
    : 75

  const paddingBottom = Platform.OS === 'ios'
    ? Math.max(insets.bottom, 25)
    : 15

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: tabBarHeight,
          paddingBottom: paddingBottom,
          paddingTop: 10,
          paddingHorizontal: 10,
          borderTopWidth: 0,
          backgroundColor: 'transparent',
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -5 },
              shadowOpacity: isDarkMode ? 0.3 : 0.1,
              shadowRadius: 15,
            },
            android: {
              elevation: 20,
              borderTopColor: 'transparent',
            },
          }),
        },
        tabBarBackground: () => <TabBarBackground isDarkMode={isDarkMode} />,
        tabBarShowLabel: false,
        tabBarActiveTintColor: '#D55004',
        tabBarInactiveTintColor: isDarkMode ? '#9ca3af' : '#6b7280',
        tabBarItemStyle: {
          paddingTop: 8,
          paddingBottom: Platform.OS === 'android' ? 8 : 5,
        },
        headerShown: false,
      }}>
      
      <Tabs.Screen
        name='index'
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon 
              name="car-sport-outline" 
              color={color} 
              focused={focused}
            />
          ),
          headerTitle: 'My Inventory'
        }}
      />
      
      <Tabs.Screen
        name='create-autoclip'
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon 
              name="play-outline" 
              color={color} 
              focused={focused}
            />
          ),
          headerTitle: 'Create Content'
        }}
      />
      
      <Tabs.Screen
        name='sales-history'
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon 
              name="analytics-outline" 
              color={color} 
              focused={focused}
            />
          ),
          headerTitle: 'Sales Analytics'
        }}
      />

      <Tabs.Screen
        name='profile'
        options={{
          tabBarIcon: ({ color, focused }) => (
            <DealershipLogo color={color} focused={focused} />
          ),
          headerTitle: 'Dealership Profile'
        }}
      />
    </Tabs>
  )}