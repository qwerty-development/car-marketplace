import { Tabs, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { useTheme } from '@/utils/ThemeContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function UserLayout() {
  const { isDarkMode } = useTheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: isDarkMode ? 'black' : 'white' }}>
        <Stack>
          <Stack.Screen
            name="(tabs)"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="filter"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="CarsByBrand"
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="AllBrandsPage"
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="DealershipDetails"
            options={{
              animation: 'slide_from_right',
            }}
          />
        </Stack>
      </View>
    </GestureHandlerRootView>
  );
}

export function TabLayout() {
  const { isDarkMode } = useTheme();

  return (
    <Tabs
      screenOptions={({ route }: { route: { name: string } }) => ({
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isDarkMode ? 'black' : 'white',
          height: 50,
          paddingBottom: 5,
          borderWidth: 0,
          borderColor: '#D55004',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.3,
          shadowRadius: 5,
          borderTopWidth: 0,
          borderTopColor: '#D55004'
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: '#D55004',
        tabBarInactiveTintColor: isDarkMode ? 'white' : 'black',
        tabBarItemStyle: {
          paddingTop: 5
        },
        headerStyle: {
          backgroundColor: isDarkMode ? 'black' : 'white',
          borderBottomWidth: 0,
          borderTopWidth: 0,
          borderWidth: 0
        },
        headerTintColor: '#D55004',
        headerShown: route.name !== 'index', // This line hides the header for the 'index' (home) screen
      })}>
      <Tabs.Screen
        name='index'
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name='home-outline' size={size} color={color} />
          ),
          headerTitle: 'Home',
        }}
      />
      <Tabs.Screen
        name='dealerships'
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name='business-outline' size={size} color={color} />
          ),
          headerTitle: 'Dealerships'
        }}
      />
      <Tabs.Screen
        name='favorites'
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name='heart-outline' size={size} color={color} />
          ),
          headerTitle: 'Favorites'
        }}
      />
      <Tabs.Screen
        name='profile'
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name='person-outline' size={size} color={color} />
          ),
          headerTitle: 'Profile',
          headerShown: false
        }}
      />
    </Tabs>
  );
}