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
  const [isCheckingDeepLink, setIsCheckingDeepLink] = useState(true);
  const [isActual404, setIsActual404] = useState(false);
  const deepLinkCheckTimeoutRef = useRef<NodeJS.Timeout>();
  const hasCheckedRef = useRef(false);

  // ENHANCED: Better deep link detection and coordination
  useEffect(() => {
    // Wait for auth to be loaded
    if (!isLoaded) return;

    const isEffectivelySignedIn = isSignedIn || isGuest;
    
    // ENHANCED: Check if this might be a deep link navigation issue
    const mightBeDeepLink = params.unmatched && (
      params.unmatched.includes('CarDetails') ||
      params.unmatched.includes('autoclips') ||
      params.unmatched.includes('cars') ||
      params.unmatched.includes('clips')
    );
    
    // Clear any existing timeout
    if (deepLinkCheckTimeoutRef.current) {
      clearTimeout(deepLinkCheckTimeoutRef.current);
      deepLinkCheckTimeoutRef.current = undefined;
    }
    
    if (!hasCheckedRef.current) {
      hasCheckedRef.current = true;
      
      if (mightBeDeepLink) {
        console.log('[NotFound] Possible deep link navigation issue detected, waiting for processing...');
        
        // ENHANCED: Wait longer for deep link processing to complete
        deepLinkCheckTimeoutRef.current = setTimeout(() => {
          console.log('[NotFound] Deep link processing timeout, checking global state');
          
          // Check if deep link is currently being processed
          if (global.deepLinkProcessing) {
            console.log('[NotFound] Deep link still processing, waiting more...');
            
            // Wait additional time if still processing
            setTimeout(() => {
              if (!global.deepLinkProcessing) {
                setIsCheckingDeepLink(false);
                setIsActual404(true);
              } else {
                // If still processing after extended wait, try manual recovery
                console.log('[NotFound] Deep link processing seems stuck, offering manual recovery');
                setIsCheckingDeepLink(false);
                setIsActual404(false); // Allow manual navigation
              }
            }, 2000);
          } else {
            // Deep link processing completed but we're still here - actual 404
            console.log('[NotFound] Deep link processing completed, this is a real 404');
            setIsCheckingDeepLink(false);
            setIsActual404(true);
          }
        }, Platform.OS === 'ios' ? 2500 : 2000); // Longer timeout for iOS
      } else {
        // Not a deep link pattern - this is likely a real 404
        console.log('[NotFound] Not a deep link pattern, treating as actual 404');
        setIsCheckingDeepLink(false);
        setIsActual404(true);
      }
    }
    
    // Cleanup
    return () => {
      if (deepLinkCheckTimeoutRef.current) {
        clearTimeout(deepLinkCheckTimeoutRef.current);
        deepLinkCheckTimeoutRef.current = undefined;
      }
    };
  }, [isLoaded, isSignedIn, isGuest, params]);

  // ENHANCED: Manual navigation handler with deep link retry
  const handleGoHome = () => {
    console.log(`[NotFound - ${Platform.OS}] Manual navigation to home`);
    
    const isEffectivelySignedIn = isSignedIn || isGuest;
    
    try {
      if (isEffectivelySignedIn) {
        router.replace('/(home)/(user)');
      } else {
        router.replace('/(auth)/sign-in');
      }
    } catch (error) {
      console.error('[NotFound] Manual navigation failed:', error);
      // Force reload if navigation fails
      setTimeout(() => {
        router.replace('/(auth)/sign-in');
      }, 500);
    }
  };

  // ENHANCED: Retry deep link processing
  const handleRetryDeepLink = () => {
    console.log('[NotFound] Manually retrying deep link processing');
    
    const mightBeDeepLink = params.unmatched && (
      params.unmatched.includes('CarDetails') ||
      params.unmatched.includes('autoclips') ||
      params.unmatched.includes('cars') ||
      params.unmatched.includes('clips')
    );
    
    if (mightBeDeepLink) {
      // Extract potential ID from the unmatched path
      const pathSegments = params.unmatched.split('/');
      const lastSegment = pathSegments[pathSegments.length - 1];
      
      if (lastSegment && !isNaN(Number(lastSegment))) {
        // Reconstruct the deep link URL
        let reconstructedUrl = '';
        
        if (params.unmatched.includes('CarDetails') || params.unmatched.includes('cars')) {
          reconstructedUrl = `fleet://cars/${lastSegment}`;
        } else if (params.unmatched.includes('autoclips') || params.unmatched.includes('clips')) {
          reconstructedUrl = `fleet://clips/${lastSegment}`;
        }
        
        if (reconstructedUrl) {
          console.log('[NotFound] Reconstructed deep link:', reconstructedUrl);
          
          // Reset global state
          global.deepLinkProcessing = false;
          global.lastProcessedDeepLink = null;
          
          // Trigger a new deep link processing
          import('expo-linking').then(Linking => {
            // Simulate a new deep link event
            setTimeout(() => {
              handleGoHome(); // Fallback navigation
            }, 3000);
          });
          
          return;
        }
      }
    }
    
    // If we can't retry the deep link, just go home
    handleGoHome();
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

  // ENHANCED: Show checking state for potential deep links
  if (isCheckingDeepLink) {
    const mightBeDeepLink = params.unmatched && (
      params.unmatched.includes('CarDetails') ||
      params.unmatched.includes('autoclips') ||
      params.unmatched.includes('cars') ||
      params.unmatched.includes('clips')
    );
    
    return (
      <View style={[styles.container, { backgroundColor: isDarkMode ? "#000000" : "#FFFFFF" }]}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#D55004" />
          <Text style={{ 
            color: isDarkMode ? "#FFFFFF" : "#000000", 
            fontSize: 18,
            marginTop: 16,
            textAlign: 'center'
          }}>
            {mightBeDeepLink ? 'Loading content...' : 'Checking navigation...'}
          </Text>
          <Text style={{ 
            color: isDarkMode ? "#FFFFFF60" : "#00000060", 
            fontSize: 14,
            marginTop: 8,
            textAlign: 'center'
          }}>
            Please wait a moment
          </Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ 
        title: isActual404 ? "Page Not Found" : "Navigation Issue",
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
          {/* Icon with gradient background */}
          <View style={styles.iconContainer}>
            <LinearGradient
              colors={isDarkMode ? ["#D55004", "#FF6B35"] : ["#D55004", "#FF8A65"]}
              style={styles.iconGradient}
            >
              <Ionicons 
                name={isActual404 ? "help-outline" : "refresh-outline"} 
                size={80} 
                color="white"
              />
            </LinearGradient>
          </View>

          {/* Error Message */}
          {isActual404 ? (
            <>
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
            </>
          ) : (
            <>
              <Text style={[
                styles.title,
                { color: isDarkMode ? "#FFFFFF" : "#000000" }
              ]}>
                Navigation Issue
              </Text>
              
              <Text style={[
                styles.subtitle,
                { color: isDarkMode ? "#FFFFFF80" : "#00000080" }
              ]}>
                There seems to be a temporary navigation issue. This sometimes happens with deep links.
              </Text>
            </>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            {/* Primary Action Button */}
            <TouchableOpacity 
              style={[styles.primaryButton, { backgroundColor: "#D55004" }]}
              onPress={isActual404 ? handleGoHome : handleRetryDeepLink}
            >
              <Ionicons 
                name={isActual404 ? "home-outline" : "refresh-outline"} 
                size={20} 
                color="white" 
                style={styles.buttonIcon} 
              />
              <Text style={styles.primaryButtonText}>
                {isActual404 ? "Go to Home" : "Try Again"}
              </Text>
            </TouchableOpacity>

            {/* Go Home Button (for navigation issues) */}
            {!isActual404 && (
              <TouchableOpacity 
                style={[
                  styles.secondaryButton,
                  { 
                    borderColor: isDarkMode ? "#FFFFFF40" : "#00000040",
                    backgroundColor: isDarkMode ? "#FFFFFF10" : "#00000010" 
                  }
                ]}
                onPress={handleGoHome}
              >
                <Ionicons 
                  name="home-outline" 
                  size={20} 
                  color={isDarkMode ? "#FFFFFF" : "#000000"} 
                  style={styles.buttonIcon} 
                />
                <Text style={[
                  styles.secondaryButtonText,
                  { color: isDarkMode ? "#FFFFFF" : "#000000" }
                ]}>
                  Go to Home
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
                Deep Link Processing: {global.deepLinkProcessing ? 'Yes' : 'No'}
              </Text>
              <Text style={[
                styles.debugText,
                { color: isDarkMode ? "#FFFFFF40" : "#00000040" }
              ]}>
                Last Processed: {global.lastProcessedDeepLink || 'None'}
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