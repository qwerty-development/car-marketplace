import { View, ActivityIndicator, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/utils/ThemeContext';

export default function AutoClipDeepLinkHandler() {
  const { isDarkMode } = useTheme();
  
  // This screen exists solely to prevent a 404 while the 
  // global deep link handler in _layout.tsx processes the URL.
  
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDarkMode ? '#000' : '#fff' }}>
      <ActivityIndicator size="large" color="#D55004" />
      <Text style={{ marginTop: 20, color: isDarkMode ? '#fff' : '#000' }}>Redirecting to clip...</Text>
    </View>
  );
}
