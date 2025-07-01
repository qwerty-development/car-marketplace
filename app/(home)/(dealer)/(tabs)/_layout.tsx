// (home)/(dealer)/(tabs)/_layout.tsx
import { Tabs } from 'expo-router'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { useColorScheme, View, Image } from 'react-native'
import { BlurView } from 'expo-blur'
import { useDealershipProfile } from '../hooks/useDealershipProfile'
import { LinearGradient } from 'expo-linear-gradient'

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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
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
        style={{
          textShadowColor: focused ? 'rgba(213, 80, 4, 0.3)' : 'transparent',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 3,
        }}
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

export default function TabsLayout() {
  const colorScheme = useColorScheme()
  const isDarkMode = colorScheme === 'dark'

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 85,
          paddingBottom: 25,
          paddingTop: 10,
          paddingHorizontal: 10,
          borderTopWidth: 0,
          elevation: 0,
          backgroundColor: 'transparent',
        },
        tabBarBackground: () => (
          <View style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}>
            {/* Main background with gradient */}
            <LinearGradient
              colors={
                isDarkMode 
                  ? ['rgba(0, 0, 0, 0.95)', 'rgba(20, 20, 20, 0.98)']
                  : ['rgba(255, 255, 255, 0.95)', 'rgba(248, 250, 252, 0.98)']
              }
              style={{
                flex: 1,
                borderTopLeftRadius: 25,
                borderTopRightRadius: 25,
              }}
            />
            
            {/* Blur overlay for glassmorphism */}
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
            
            {/* Subtle shadow overlay */}
            <View style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderTopLeftRadius: 25,
              borderTopRightRadius: 25,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -5 },
              shadowOpacity: isDarkMode ? 0.3 : 0.1,
              shadowRadius: 15,
              elevation: 20,
            }} />
          </View>
        ),
        tabBarShowLabel: false,
        tabBarActiveTintColor: '#D55004',
        tabBarInactiveTintColor: isDarkMode ? '#9ca3af' : '#6b7280',
        tabBarItemStyle: {
          paddingTop: 8,
          paddingBottom: 5,
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
  )
}