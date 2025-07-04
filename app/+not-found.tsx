import { Link, Stack, useRouter, useLocalSearchParams } from "expo-router";
import { StyleSheet, View, Text, TouchableOpacity, Alert, useColorScheme, ActivityIndicator, Platform } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from "@/utils/ThemeContext";
import { useAuth } from "@/utils/AuthContext";
import { useGuestUser } from "@/utils/GuestUserContext";
import { coordinateSignOut } from "@/app/(home)/_layout";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";

export default function NotFoundScreen() {
  const { isDarkMode } = useTheme();
  const { user, signOut, isLoaded, isSignedIn } = useAuth();
  const { isGuest, clearGuestMode } = useGuestUser();
  const router = useRouter();
  const params = useLocalSearchParams(); // ANDROID FIX: Add parameter debugging
  const [redirectAttempts, setRedirectAttempts] = useState(0);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // ANDROID FIX: Enhanced Android-specific deep link handling
  useEffect(() => {
    if (Platform.OS === 'android') {
      // Enhanced logging for Android deep link debugging
      console.log('[NotFound - Android] 404 encountered - Route params:', params);
      console.log('[NotFound - Android] Auth state:', { isSignedIn, isGuest, isLoaded });
      
      // Wait for auth to be loaded
      if (!isLoaded) return;

      const isEffectivelySignedIn = isSignedIn || isGuest;
      
      if (isEffectivelySignedIn) {
        console.log('[NotFound - Android] User authenticated - attempting immediate redirect');
        
        // More aggressive Android redirect for authenticated users
        setIsRedirecting(true);
        
        try {
          // Try multiple redirect strategies for Android
          router.replace('/(home)/(user)');
          
          // Backup redirect with slight delay
          setTimeout(() => {
            router.replace('/(home)');
          }, 100);
          
          // Final fallback
          setTimeout(() => {
            router.push('/(home)/(user)');
          }, 300);
          
        } catch (error) {
          console.error('[NotFound - Android] All redirect attempts failed:', error);
        }
      } else {
        console.log('[NotFound - Android] User not authenticated - redirecting to sign-in');
        router.replace('/(auth)/sign-in');
      }
    }
  }, [isLoaded, isSignedIn, isGuest, router, params]);

  // ENHANCED: Original redirect logic with Android awareness
  useEffect(() => {
    // Skip if we already handled Android-specific redirect
    if (Platform.OS === 'android') return;
    
    // Wait for auth to be loaded
    if (!isLoaded) return;

    const effectivelySignedIn = isSignedIn || isGuest;

    // If user is signed in and we haven't redirected yet
    if (effectivelySignedIn && !isRedirecting && redirectAttempts < 3) {
      setIsRedirecting(true);
      
      // Log for debugging
      console.log('[NotFound] User is authenticated, attempting redirect. Attempt:', redirectAttempts + 1);
      console.log('[NotFound] Route params for debugging:', params);
      
      // Try immediate redirect first
      try {
        router.replace('/(home)');
        console.log('[NotFound] Immediate redirect attempted');
      } catch (error) {
        console.error('[NotFound] Immediate redirect failed:', error);
      }

      // Fallback: Try again with delay
      const timeouts = [100, 500, 1000]; // Increasing delays for each attempt
      const delay = timeouts[redirectAttempts] || 1000;
      
      setTimeout(() => {
        try {
          // Force navigation to home
          router.replace('/(home)/(user)');
          console.log('[NotFound] Delayed redirect attempted after', delay, 'ms');
        } catch (error) {
          console.error('[NotFound] Delayed redirect failed:', error);
          
          // Last resort: force refresh
          if (redirectAttempts === 2) {
            console.log('[NotFound] Final attempt - forcing navigation');
            // Use push instead of replace as last resort
            router.push('/(home)');
          }
        }
        
        setIsRedirecting(false);
        setRedirectAttempts(prev => prev + 1);
      }, delay);
    }
  }, [isLoaded, isSignedIn, isGuest, router, redirectAttempts, isRedirecting, params]);

  // ENHANCED: Refresh button with Android-specific handling
  const handleRefresh = () => {
    console.log('[NotFound] Manual refresh triggered - Platform:', Platform.OS);
    console.log('[NotFound] Current params:', params);
    
    const isEffectivelySignedIn = isSignedIn || isGuest;
    
    if (Platform.OS === 'android') {
      // Android-specific navigation recovery
      if (isEffectivelySignedIn) {
        // Try multiple navigation paths for Android
        router.replace('/(home)/(user)');
        setTimeout(() => router.replace('/(home)'), 100);
      } else {
        router.replace('/(auth)/sign-in');
      }
    } else {
      // iOS/other platforms - use original logic
      if (isEffectivelySignedIn) {
        router.replace('/(home)');
        setTimeout(() => {
          router.push('/(home)/(user)');
        }, 100);
      } else {
        router.replace('/(auth)/sign-in');
      }
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
          {Platform.OS === 'android' && (
            <Text style={{ 
              color: isDarkMode ? "#FFFFFF80" : "#00000080", 
              fontSize: 14,
              marginTop: 8,
              textAlign: "center"
            }}>
              Checking navigation status...
            </Text>
          )}
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

          {/* Android-specific messaging */}
          {Platform.OS === 'android' && (isSignedIn || isGuest) && (
            <Text style={[
              styles.redirectMessage,
              { color: "#D55004" }
            ]}>
              Attempting automatic navigation recovery...
            </Text>
          )}

          {/* Show redirect message if user is authenticated */}
          {Platform.OS !== 'android' && (isSignedIn || isGuest) && redirectAttempts > 0 && (
            <Text style={[
              styles.redirectMessage,
              { color: "#D55004" }
            ]}>
              Redirecting you to the home page...
            </Text>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            {/* Go Home Button */}
            <TouchableOpacity 
              style={[styles.primaryButton, { backgroundColor: "#D55004" }]}
              onPress={handleRefresh}
            >
              <Ionicons name="home-outline" size={20} color="white" style={styles.buttonIcon} />
              <Text style={styles.primaryButtonText}>
                {Platform.OS === 'android' ? 'Fix Navigation' : 'Go to Home'}
              </Text>
            </TouchableOpacity>

            {/* Platform-specific refresh button */}
            {(isSignedIn || isGuest) && (
              <TouchableOpacity 
                style={[
                  styles.secondaryButton,
                  { 
                    borderColor: "#D55004",
                    backgroundColor: isDarkMode ? "#D5500410" : "#D5500405" 
                  }
                ]}
                onPress={handleRefresh}
              >
                <Ionicons name="refresh-outline" size={20} color="#D55004" style={styles.buttonIcon} />
                <Text style={[styles.secondaryButtonText, { color: "#D55004" }]}>
                  {Platform.OS === 'android' ? 'Reset Navigation' : 'Refresh Navigation'}
                </Text>
              </TouchableOpacity>
            )}

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
                  // Fallback to home
                  handleRefresh();
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