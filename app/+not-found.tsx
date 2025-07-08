// app/+not-found.tsx - Fixed infinite loop issue
import { Link, Stack, useRouter, useLocalSearchParams } from "expo-router";
import { StyleSheet, View, Text, TouchableOpacity, Alert, useColorScheme, ActivityIndicator, Platform } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from "@/utils/ThemeContext";
import { useAuth } from "@/utils/AuthContext";
import { useGuestUser } from "@/utils/GuestUserContext";
import { coordinateSignOut } from "@/app/(home)/_layout";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState, useRef } from "react";

export default function NotFoundScreen() {
  const { isDarkMode } = useTheme();
  const { user, signOut, isLoaded, isSignedIn } = useAuth();
  const { isGuest, clearGuestMode } = useGuestUser();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const hasAttemptedRedirect = useRef(false);
  const isMounted = useRef(true);

  // CRITICAL FIX: Simplified redirect with proper guards
  useEffect(() => {
    // Guard: Component unmounted
    if (!isMounted.current) return;
    
    // Guard: Already redirecting or attempted
    if (isRedirecting || hasAttemptedRedirect.current) return;
    
    // Guard: Auth not loaded
    if (!isLoaded) return;

    const isEffectivelySignedIn = isSignedIn || isGuest;
    
    // Only redirect authenticated users once
    if (isEffectivelySignedIn) {
      hasAttemptedRedirect.current = true;
      setIsRedirecting(true);
      
      console.log(`[NotFound] Authenticated user detected, redirecting to home`);
      
      // Simple redirect without complex logic
      const redirectTimer = setTimeout(() => {
        if (isMounted.current) {
          router.replace('/(home)/(user)');
        }
      }, 100);

      return () => clearTimeout(redirectTimer);
    }
  }, [isLoaded, isSignedIn, isGuest]); // Removed router from dependencies to prevent loops

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Manual navigation handler
  const handleGoHome = () => {
    if (isRedirecting) return;
    
    console.log(`[NotFound] Manual navigation to home`);
    
    const isEffectivelySignedIn = isSignedIn || isGuest;
    
    setIsRedirecting(true);
    
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
          }
        },
      },
    ]);
  };

  // Show loading state while auth is loading
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

  // Show redirecting state
  if (isRedirecting) {
    return (
      <View style={[styles.container, { backgroundColor: isDarkMode ? "#000000" : "#FFFFFF" }]}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#D55004" />
          <Text style={{ 
            color: isDarkMode ? "#FFFFFF" : "#000000", 
            fontSize: 18,
            marginTop: 16 
          }}>
            Taking you home...
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
            Sorry, we couldn't find the page you're looking for.
          </Text>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            {/* Go Home Button */}
            <TouchableOpacity 
              style={[styles.primaryButton, { backgroundColor: "#D55004" }]}
              onPress={handleGoHome}
              disabled={isRedirecting}
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
                if (isRedirecting) return;
                
                try {
                  if (router.canGoBack()) {
                    router.back();
                  } else {
                    handleGoHome();
                  }
                } catch (error) {
                  console.error('[NotFound] Back navigation failed:', error);
                  handleGoHome();
                }
              }}
              disabled={isRedirecting}
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
        </View>

        {/* Sign Out Button - only show if user is signed in */}
        {(user || isGuest) && !isRedirecting && (
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
});