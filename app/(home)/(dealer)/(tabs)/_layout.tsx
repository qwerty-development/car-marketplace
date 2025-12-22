// (home)/(dealer)/(tabs)/_layout.tsx
import { Tabs } from 'expo-router'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { useColorScheme, View, Platform } from 'react-native'
import { BlurView } from 'expo-blur'
import { useDealershipProfile } from '../hooks/useDealershipProfile'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLanguage } from '@/utils/LanguageContext'
import { useTranslation } from 'react-i18next'
import CachedImage from '@/utils/CachedImage'

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
          <CachedImage
            source={{ uri: dealership.logo }}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: 15,
            }}
            contentFit="cover"
            cachePolicy="disk"
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
  const { language } = useLanguage()
  const { t } = useTranslation()
  const isRTL = language === 'ar'

  // Calculate tab bar height based on platform and safe area
  const tabBarHeight = Platform.OS === 'ios'
    ? 100 + (insets.bottom > 0 ? 0 : 15) // Increased height to accommodate labels
    : 85

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
          flexDirection: isRTL ? 'row-reverse' : 'row',
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
        tabBarShowLabel: true,
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
          headerTitle: t('navbar.inventory'),
          tabBarLabel: t('navbar.inventory')
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
          // Explicit href prevents accidental hiding and improves deep-linking stability
          href: '/(home)/(dealer)/(tabs)/create-autoclip',
          headerTitle: t('autoclips.create_autoclip'),
          tabBarLabel: t('autoclips.create_autoclip')
        }}
      />
      
      <Tabs.Screen
        name='messages'
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon 
              name="chatbubbles-outline" 
              color={color} 
              focused={focused}
            />
          ),
          headerTitle: t('navbar.messages'),
          tabBarLabel: t('navbar.messages')
        }}
      />

      <Tabs.Screen
        name='sales-history'
        options={{
          headerTitle: t('navbar.sales_history'),
          tabBarLabel: t('navbar.sales_history'),
          href: null,
        }}
      />

      <Tabs.Screen
        name='profile'
        options={{
          tabBarIcon: ({ color, focused }) => (
            <DealershipLogo color={color} focused={focused} />
          ),
          headerTitle: t('navbar.profile'),
          tabBarLabel: t('navbar.profile')
        }}
      />
    </Tabs>
  )}