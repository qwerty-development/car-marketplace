
import { Link, Stack, useRouter, useLocalSearchParams } from "expo-router";
import { StyleSheet, View, Text, TouchableOpacity, Alert, useColorScheme, ActivityIndicator, Platform } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from "@/utils/ThemeContext";
import { useAuth } from "@/utils/AuthContext";
import { useGuestUser } from "@/utils/GuestUserContext";
import { coordinateSignOut } from "@/utils/signOutState";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState, useRef } from "react";

export default function NotFoundScreen() {
  const { isDarkMode } = useTheme();
  const { user, signOut, isLoaded, isSignedIn } = useAuth();
  const { isGuest, clearGuestMode } = useGuestUser();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const redirectTimeoutRef = useRef<NodeJS.Timeout>();
  const hasAttemptedRedirect = useRef(false);

  // FIXED: Enhanced redirect handling for deep links
  useEffect(() => {
    // Wait for auth to be loaded
    if (!isLoaded) return;

    const isEffectivelySignedIn = isSignedIn || isGuest;
    
    // FIXED: Check if this might be a deep link navigation issue
    const mightBeDeepLink = params.unmatched && (
      params.unmatched.includes('CarDetails') ||
      params.unmatched.includes('autoclips') ||
      params.unmatched.includes('cars') ||
      params.unmatched.includes('clips')
    );
    
    // Clear any existing timeout
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
      redirectTimeoutRef.current = undefined;
    }
    
    // FIXED: Handle iOS deep link navigation timing issue
    if (Platform.OS === 'ios' && mightBeDeepLink && !hasAttemptedRedirect.current) {
      console.log('[NotFound - iOS] Possible deep link navigation issue detected');
      hasAttemptedRedirect.current = true;
      
      // Give the deep link handler more time to process
      redirectTimeoutRef.current = setTimeout(() => {
        if (isEffectivelySignedIn) {
          console.log('[NotFound - iOS] Redirecting to home after deep link timeout');
          router.replace('/(home)/(user)');
        } else {
          console.log('[NotFound - iOS] Redirecting to sign-in after deep link timeout');
          router.replace('/(auth)/sign-in');
        }
      }, 1500); // Give deep link handler time to process
      
      return;
    }
    
    // Regular redirect logic for non-deep link scenarios
    if (!mightBeDeepLink && !isRedirecting && !hasAttemptedRedirect.current) {
      hasAttemptedRedirect.current = true;
      
      // Android auto-redirect
      if (Platform.OS === 'android' && isEffectivelySignedIn) {
        console.log('[NotFound - Android] User authenticated - attempting redirect');
        console.log('[NotFound - Android] Route params:', params);
        
        setIsRedirecting(true);
        
        // Android-specific redirect strategy
        redirectTimeoutRef.current = setTimeout(() => {
          try {
            router.replace('/(home)/(user)');
          } catch (error) {
            console.error('[NotFound - Android] Redirect failed:', error);
          }
          setIsRedirecting(false);
        }, 500);
      }
      
      // iOS sign-in redirect
      if (Platform.OS === 'ios' && !isEffectivelySignedIn) {
        console.log('[NotFound - iOS] User not authenticated - redirecting to sign-in');
        router.replace('/(auth)/sign-in');
      }
    }
    
    // Cleanup
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = undefined;
      }
    };
  }, [isLoaded, isSignedIn, isGuest, router, params, isRedirecting]);

  // Manual navigation handler
  const handleGoHome = () => {
    console.log(`[NotFound - ${Platform.OS}] Manual navigation to home`);
    
    const isEffectivelySignedIn = isSignedIn || isGuest;
    
    if (isEffectivelySignedIn) {
      router.replace('/(home)/(user)');
    } else {
      router.replace('/(auth)/sign-in');
    }
  };

  const handleSignOut = async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            if (isGuest) {
              await coordinateSignOut(router, async () => {
                await clearGuestMode();
              });
            } else {
              await coordinateSignOut(router, async () => {
                await signOut();
              });
            }
          } catch (error) {
            console.error("Error during sign out:", error);
            router.replace("/(auth)/sign-in");
            Alert.alert(
              "Sign Out Issue",
              "There was a problem signing out, but we've redirected you to the sign-in screen."
            );
          }
        },
      },
    ]);
  };

  // Show loading state while checking auth
  if (!isLoaded) {
    return (
      <View style={[styles.container, { backgroundColor: isDarkMode ? "#000000" : "#FFFFFF" }]}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#D55004" />
          <Text style={{ 
            color: isDarkMode ? "#FFFFFF" : "#000000", 
            fontSize: 18,
            marginTop: 16 
          }}>
            Loading...
          </Text>
        </View>
      </View>
    );
  }

  // FIXED: Show loading for potential deep link redirects
  const mightBeDeepLink = params.unmatched && (
    params.unmatched.includes('CarDetails') ||
    params.unmatched.includes('autoclips') ||
    params.unmatched.includes('cars') ||
    params.unmatched.includes('clips')
  );
  
  if (mightBeDeepLink && Platform.OS === 'ios' && hasAttemptedRedirect.current) {
    return (
      <View style={[styles.container, { backgroundColor: isDarkMode ? "#000000" : "#FFFFFF" }]}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#D55004" />
          <Text style={{ 
            color: isDarkMode ? "#FFFFFF" : "#000000", 
            fontSize: 18,
            marginTop: 16 
          }}>
            Loading content...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ 
        title: "Oops!",
        headerStyle: {
          backgroundColor: isDarkMode ? "#000000" : "#FFFFFF",
        },
        headerTintColor: isDarkMode ? "#FFFFFF" : "#000000",
      }} />
      
      <View style={[
        styles.container,
        { backgroundColor: isDarkMode ? "#000000" : "#FFFFFF" }
      ]}>
        {/* Main Content */}
        <View style={styles.content}>
          {/* 404 Icon with gradient background */}
          <View style={styles.iconContainer}>
            <LinearGradient
              colors={isDarkMode ? ["#D55004", "#FF6B35"] : ["#D55004", "#FF8A65"]}
              style={styles.iconGradient}
            >
              <Ionicons 
                name="help-outline" 
                size={80} 
                color="white"
              />
            </LinearGradient>
          </View>

          {/* Error Message */}
          <Text style={[
            styles.errorCode,
            { color: isDarkMode ? "#FFFFFF" : "#000000" }
          ]}>
            404
          </Text>
          
          <Text style={[
            styles.title,
            { color: isDarkMode ? "#FFFFFF" : "#000000" }
          ]}>
            Page Not Found
          </Text>
          
          <Text style={[
            styles.subtitle,
            { color: isDarkMode ? "#FFFFFF80" : "#00000080" }
          ]}>
            Sorry, we couldn't find the page you're looking for. It might have been moved or doesn't exist.
          </Text>

          {/* Platform-specific messaging */}
          {Platform.OS === 'android' && (isSignedIn || isGuest) && isRedirecting && (
            <Text style={[
              styles.redirectMessage,
              { color: "#D55004" }
            ]}>
              Redirecting to home...
            </Text>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            {/* Go Home Button */}
            <TouchableOpacity 
              style={[styles.primaryButton, { backgroundColor: "#D55004" }]}
              onPress={handleGoHome}
            >
              <Ionicons name="home-outline" size={20} color="white" style={styles.buttonIcon} />
              <Text style={styles.primaryButtonText}>Go to Home</Text>
            </TouchableOpacity>

            {/* Go Back Button */}
            <TouchableOpacity 
              style={[
                styles.secondaryButton,
                { 
                  borderColor: isDarkMode ? "#FFFFFF40" : "#00000040",
                  backgroundColor: isDarkMode ? "#FFFFFF10" : "#00000010" 
                }
              ]}
              onPress={() => {
                try {
                  router.back();
                } catch (error) {
                  console.error('[NotFound] Back navigation failed:', error);
                  handleGoHome();
                }
              }}
            >
              <Ionicons 
                name="arrow-back-outline" 
                size={20} 
                color={isDarkMode ? "#FFFFFF" : "#000000"} 
                style={styles.buttonIcon} 
              />
              <Text style={[
                styles.secondaryButtonText,
                { color: isDarkMode ? "#FFFFFF" : "#000000" }
              ]}>
                Go Back
              </Text>
            </TouchableOpacity>
          </View>

          {/* Debug info for development */}
          {__DEV__ && Object.keys(params).length > 0 && (
            <View style={styles.debugContainer}>
              <Text style={[
                styles.debugTitle,
                { color: isDarkMode ? "#FFFFFF60" : "#00000060" }
              ]}>
                Debug Info:
              </Text>
              <Text style={[
                styles.debugText,
                { color: isDarkMode ? "#FFFFFF40" : "#00000040" }
              ]}>
                Platform: {Platform.OS}
              </Text>
              <Text style={[
                styles.debugText,
                { color: isDarkMode ? "#FFFFFF40" : "#00000040" }
              ]}>
                Params: {JSON.stringify(params, null, 2)}
              </Text>
            </View>
          )}
        </View>

        {/* Sign Out Button - only show if user is signed in */}
        {(user || isGuest) && (
          <View style={styles.signOutContainer}>
            <TouchableOpacity 
              style={[
                styles.signOutButton,
                { 
                  borderColor: "#D55004",
                  backgroundColor: isDarkMode ? "#D5500410" : "#D5500405" 
                }
              ]}
              onPress={handleSignOut}
            >
              <Ionicons name="log-out-outline" size={20} color="#D55004" style={styles.buttonIcon} />
              <Text style={[styles.signOutButtonText, { color: "#D55004" }]}>
                Sign Out
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    marginBottom: 32,
  },
  iconGradient: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#D55004",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  errorCode: {
    fontSize: 72,
    fontWeight: "900",
    marginBottom: 16,
    opacity: 0.8,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    marginBottom: 48,
    paddingHorizontal: 20,
  },
  redirectMessage: {
    fontSize: 14,
    fontStyle: "italic",
    marginBottom: 20,
    textAlign: "center",
  },
  buttonContainer: {
    width: "100%",
    gap: 12,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: "#D55004",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  buttonIcon: {
    marginRight: 8,
  },
  signOutContainer: {
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#FFFFFF20",
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  debugContainer: {
    marginTop: 24,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "rgba(128, 128, 128, 0.1)",
    width: "100%",
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  debugText: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});