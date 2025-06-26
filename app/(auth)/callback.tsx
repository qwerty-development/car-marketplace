import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useEffect } from 'react';
import { router } from 'expo-router';

/**
 * This screen is a "no-op". It exists to capture the /auth/callback route
 * so that Expo Router doesn't throw a 404 error. The actual session handling
 * is done by a global Linking listener in the root layout (_layout.tsx), 
 * which is more robust for handling OAuth redirects.
 * * Once the session is handled, the onAuthStateChange listener in AuthContext
 * will trigger the RootLayoutNav to redirect the user to the correct screen.
 */
export default function AuthCallback() {

  useEffect(() => {
    // As a fallback, if the user somehow lands here and stays for more than
    // 3 seconds, redirect them to the sign-in screen. This prevents
    // the user from getting stuck on a blank screen in an edge case.
    const fallbackTimeout = setTimeout(() => {
        if(router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(auth)/sign-in');
        }
    }, 3000);

    return () => clearTimeout(fallbackTimeout);
  }, []);

  // Render a simple loading indicator while the auth flow completes in the background.
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
