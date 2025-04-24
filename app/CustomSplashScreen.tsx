import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Dimensions, StyleSheet, useColorScheme, Image } from 'react-native';

const { width } = Dimensions.get('window');

interface SplashScreenProps {
  onAnimationComplete: () => void;
}

const CustomSplashScreen: React.FC<SplashScreenProps> = ({ 
  onAnimationComplete,
}) => {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  
  // Animation values
  const screenOpacity = useRef(new Animated.Value(0)).current;
  
  // F logo animation values
  const fLogoOpacity = useRef(new Animated.Value(0)).current;
  const fLogoScale = useRef(new Animated.Value(0.8)).current;
  const fLogoPosition = useRef(new Animated.Value(0)).current; // 0 = center, negative = left
  
  // Text animation values
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textRevealWidth = useRef(new Animated.Value(0)).current;

  // Get the appropriate logo based on theme
  const getLogoSource = () => {
    return isDarkMode 
      ? require('../assets/images/light-logo.png')  // White logo for dark mode
      : require('../assets/images/dark-logo.png');  // Dark logo for light mode
  };

  // Main animation sequence
  useEffect(() => {
    // Initial fade in
    Animated.timing(screenOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Run animation sequence immediately
    runLogoAnimation();
  }, []);

  const runLogoAnimation = () => {
    // F Logo appearance
    const showFLogo = Animated.parallel([
      Animated.timing(fLogoOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(fLogoScale, {
        toValue: 1,
        friction: 4,
        tension: 50,
        useNativeDriver: true,
      }),
    ]);

    // Move F logo to left
    const moveFLogoToLeft = Animated.timing(fLogoPosition, {
      toValue: -width * 0.26,
      duration: 300,
      useNativeDriver: true,
    });

    // Show "leet" text
    const showText = Animated.timing(textOpacity, {
      toValue: 1,
      duration: 0,
      useNativeDriver: true,
    });

    // Reveal "leet" text animation
    const revealText = Animated.timing(textRevealWidth, {
      toValue: width * 0.5,
      duration: 400,
      useNativeDriver: false,
    });

    // Short pause at the end
    const holdFinalState = Animated.delay(300);

    // Fade out entire screen
    const fadeOutScreen = Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    });
    
    // Run the animation sequence
    Animated.sequence([
      showFLogo,
      Animated.delay(150), 
      moveFLogoToLeft,
      Animated.delay(100),
      showText,
      revealText,
      holdFinalState,
      fadeOutScreen
    ]).start(() => {
      // Animation complete
      onAnimationComplete();
    });
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDarkMode ? '#000000' : '#FFFFFF',
        },
      ]}
    >
      {/* Main content container */}
      <Animated.View 
        style={{ 
          opacity: screenOpacity, 
          flex: 1, 
          alignItems: 'center', 
          justifyContent: 'center',
          width: '100%',
          height: '100%'
        }}
      >
        {/* Fleet logo animation */}
        <View style={styles.fleetContainer}>
          {/* F Logo */}
          <Animated.View
            style={[
              styles.logoContainer,
              styles.fLogoContainer,
              {
                opacity: fLogoOpacity,
                position: 'absolute',
                transform: [
                  { scale: fLogoScale },
                  { translateX: fLogoPosition }
                ],
              },
            ]}
          >
            <Image
              source={getLogoSource()}
              style={styles.fLogo}
              resizeMode="contain"
            />
          </Animated.View>
          
          {/* "leet" text that appears after F moves to the left */}
          <Animated.View
            style={[
              styles.leetTextPosition,
              { opacity: textOpacity }
            ]}
          >
            <Animated.View
              style={{
                width: textRevealWidth,
                overflow: 'hidden',
              }}
            >
              <Image
                source={require('../assets/logo-text.png')}
                style={[
                  styles.leetText,
                  isDarkMode && { tintColor: '#FFFFFF' }
                ]}
                resizeMode="contain"
              />
            </Animated.View>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  logoContainer: {
    width: width * 0.3,
    height: width * 0.3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fleetContainer: {
    position: 'relative', 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: width * 0.3,
    height: width * 0.3, 
  },
  fLogoContainer: {
    width: width * 0.2,
    height: width * 0.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fLogo: {
    width: '100%',
    height: '63.5%',
  },
  leetTextPosition: {
    height: width * 0.15,
    position: 'absolute',
    left: width * -0.035,
    justifyContent: 'center',
  },
  leetText: {
    height: width * 0.14,
    width: width * 0.5,
    alignSelf: 'flex-start',
  },
});

export default CustomSplashScreen;