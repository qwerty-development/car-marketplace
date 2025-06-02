import React, { useEffect, useRef, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
} from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { useColorScheme } from "react-native";
import { useGuestUser } from "@/utils/GuestUserContext";

const { width, height } = Dimensions.get("window");

// Use high quality, horizontal car images
const carImages = [
  require("@/assets/cars/car1.jpg"),
  require("@/assets/cars/car2.jpg"),
  require("@/assets/cars/car3.jpg"),
  require("@/assets/cars/car4.jpg"),
  require("@/assets/cars/car5.jpg"),
  require("@/assets/cars/car6.jpg"),
  require("@/assets/cars/car7.jpg"),
  require("@/assets/cars/car8.jpg"),
  require("@/assets/cars/car9.jpg"),
  require("@/assets/cars/car10.jpg"),
  require("@/assets/cars/car11.jpg"),
  require("@/assets/cars/car12.jpg"),
  require("@/assets/cars/car13.jpg"),
];

export default function LandingPage() {
  const router = useRouter();
  const { setGuestMode } = useGuestUser();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [isLoading, setIsLoading] = useState(false);

  // Animation values
  const panelTranslateY = useRef(new Animated.Value(300)).current; // Start further down
  const panelOpacity = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current; // For logo fade-in
  const scrollX1 = useRef(new Animated.Value(0)).current;
  const scrollX2 = useRef(new Animated.Value(-width)).current; // Start off-screen to the left

  // Split images into two rows
  const carRow1 = carImages.slice(0, 7); // car1 to car7
  const carRow2 = carImages.slice(7); // car8 to car13

  // Calculate total width of a single set of images
  const row1Width = (width / 2) * carRow1.length;
  const row2Width = (width / 2) * carRow2.length;

  useEffect(() => {
    // Create our animation sequence
    const startAnimationSequence = () => {
      // 1. Start car animations first
      const row1Animation = Animated.loop(
        Animated.timing(scrollX1, {
          toValue: -row1Width,
          duration: 30000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );

      const row2Animation = Animated.loop(
        Animated.timing(scrollX2, {
          toValue: 0,
          duration: 30000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );

      // Start car animations immediately
      row1Animation.start();
      row2Animation.start();

      // 2. After a delay, animate the panel
      setTimeout(() => {
        Animated.timing(panelTranslateY, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
          easing: Easing.out(Easing.back(1.5)), // Slight bounce effect
        }).start();

        Animated.timing(panelOpacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }).start();
      }, 500); // Start panel animation after 500ms

      // 3. Finally, fade in the logo
      setTimeout(() => {
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 1000, 
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }).start();
      }, 1300); // Start logo animation after panel is almost done
    };

    // Start the animation sequence
    startAnimationSequence();

    // Clean up animations on unmount
    return () => {
      scrollX1.stopAnimation();
      scrollX2.stopAnimation();
      panelTranslateY.stopAnimation();
      panelOpacity.stopAnimation();
      logoOpacity.stopAnimation();
    };
  }, []);

  const handleGuestMode = async () => {
    try {
      setIsLoading(true);
      await setGuestMode(true);
      router.replace("/(home)");
    } catch (error) {
      console.error("Error setting guest mode:", error);
      Alert.alert("Error", "Failed to continue as guest");
    } finally {
      setIsLoading(false);
    }
  };

  // Get the appropriate logo based on theme
  const getLogoSource = () => {
    // Use white logo for dark mode, black logo for light mode
    return isDark
      ? require("../../assets/images/light-logo.png")
      : require("../../assets/images/dark-logo.png"); // Black logo for light mode
  };

  return (
    <SafeAreaView style={[styles.container, isDark ? styles.darkContainer : styles.lightContainer]}>
  

      {/* Fullscreen Car Background */}
      <View style={styles.wallWrapper}>
        {/* Row 1: Left to Right - Top Row */}
        <View style={[styles.wallRow, { top: 0 }]}>
          <Animated.View
            style={[
              styles.row,
              {
                transform: [{ translateX: scrollX1 }],
              },
            ]}
          >
            {/* First set of images */}
            {carRow1.map((img, i) => (
              <Image
                key={`row1-first-${i}`}
                source={img}
                style={styles.car}
                resizeMode="cover"
              />
            ))}
            {/* Duplicate set for seamless loop */}
            {carRow1.map((img, i) => (
              <Image
                key={`row1-second-${i}`}
                source={img}
                style={styles.car}
                resizeMode="cover"
              />
            ))}
          </Animated.View>
        </View>

        {/* Row 2: Right to Left - Second Row (below the first) */}
        <View style={[styles.wallRow, { top: height / 3 }]}>
          <Animated.View
            style={[
              styles.row,
              {
                transform: [{ translateX: scrollX2 }],
              },
            ]}
          >
            {/* First set of images */}
            {carRow2.map((img, i) => (
              <Image
                key={`row2-first-${i}`}
                source={img}
                style={styles.car}
                resizeMode="cover"
              />
            ))}
            {/* Duplicate set for seamless loop */}
            {carRow2.map((img, i) => (
              <Image
                key={`row2-second-${i}`}
                source={img}
                style={styles.car}
                resizeMode="cover"
              />
            ))}
            {/* Triple the images to ensure no blank spaces */}
            {carRow2.map((img, i) => (
              <Image
                key={`row2-third-${i}`}
                source={img}
                style={styles.car}
                resizeMode="cover"
              />
            ))}
          </Animated.View>
        </View>
      </View>

      {/* Overlay to darken or lighten based on theme */}
      <View 
        style={[
          styles.overlay, 
          isDark ? styles.darkOverlay : styles.lightOverlay
        ]} 
      />

      {/* Large Static Logo in Center - Now animated */}
      <Animated.View 
        style={[
          styles.logoCenter,
          { opacity: logoOpacity }
        ]}
      >
        <Image source={getLogoSource()} style={styles.logoImage} />
      </Animated.View>

      {/* Bottom Panel */}
      <Animated.View
        style={[
          styles.bottomPanelContainer,
          {
            opacity: panelOpacity,
            transform: [{ translateY: panelTranslateY }],
          },
        ]}
      >
        <View style={[
          styles.bottomPanel,
          isDark ? styles.darkBottomPanel : styles.lightBottomPanel
        ]}>
          <Text style={[
            styles.bottomSubtitle,
            isDark ? styles.darkText : styles.lightText
          ]}>Your journey begins here</Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push("/sign-in")}
          >
            <Text style={styles.primaryButtonText}>Sign In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: "#D55004" }]}
            onPress={() => router.push("/sign-up")}
          >
            <Text style={styles.secondaryButtonText}>Create Account</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.guestButton}
            onPress={handleGuestMode}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#D55004" />
            ) : (
              <Text style={styles.guestButtonText}>Continue as Guest</Text>
            )}
          </TouchableOpacity>

          <Text style={[
            styles.termsText,
            isDark ? styles.darkLightText : styles.lightDarkText
          ]}>
            By continuing, you agree to our{" "}
            <Text
              style={styles.link}
              onPress={() => router.push("/terms-of-service")}
            >
              Terms
            </Text>{" "}
            and{" "}
            <Text
              style={styles.link}
              onPress={() => router.push("/privacy-policy")}
            >
              Privacy Policy
            </Text>
          </Text>

          <Text style={[
            styles.version,
            isDark ? styles.darkLightText : styles.lightDarkText
          ]}>
            Version {Constants.expoConfig?.version || "1.0.0"}
          </Text>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
  },
  darkContainer: {
    backgroundColor: "#000"
  },
  lightContainer: {
    backgroundColor: "#fff"
  },

  // Car Wall
  wallWrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    overflow: "hidden",
  },
  wallRow: {
    position: "absolute",
    width: "100%",
    height: height / 3,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
  },
  car: {
    width: width/2,
    height: height / 3,
  },

  // Overlay + Center Logo
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  darkOverlay: {
    backgroundColor: "#000",
    opacity: 0.7,
  },
  lightOverlay: {
    backgroundColor: "#fff", // White overlay for light mode
    opacity: 0.5, // Semi-transparent white overlay
  },
  logoCenter: {
    position: "absolute",
    zIndex: 2,
    top: height / 3 - 80,
    left: width / 2 - 150,
    width: 300,
    height: 300,
    justifyContent: "center",
    alignItems: "center",
  },
  logoImage: {
    width: 280,
    height: 300,
  },

  // Bottom Panel
  bottomPanelContainer: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    zIndex: 3,
  },
  bottomPanel: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    alignItems: "center",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  lightBottomPanel: {
    backgroundColor: "rgba(255,255,255,0.95)",
    shadowColor: "#000",
  },
  darkBottomPanel: {
    backgroundColor: "rgba(30,30,30,0.95)", // Dark gray with opacity
    shadowColor: "#000",
  },

  // Text styles
  darkText: {
    color: "#fff",
  },
  lightText: {
    color: "#333",
  },
  darkLightText: {
    color: "rgba(255,255,255,0.7)", // Light text in dark mode with some opacity
  },
  lightDarkText: {
    color: "#555", // Dark text in light mode
  },
  
  bottomTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: "#D55004",
    marginBottom: 4,
  },
  bottomSubtitle: {
    fontSize: 16,
    marginBottom: 16,
  },

  // Buttons
  primaryButton: {
    backgroundColor: "#D55004",
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
    width: "100%",
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  secondaryButton: {
    borderWidth: 2,
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
    width: "100%",
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#D55004",
  },
  guestButton: {
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 12,
  },
  guestButtonText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#D55004",
  },

  // Terms + Version
  termsText: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 8,
  },
  link: {
    textDecorationLine: "underline",
    color: "#D55004",
  },
  version: {
    fontSize: 10,
    textAlign: "center",
    marginTop: 6,
  },
});