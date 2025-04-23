import React, { useEffect, useRef } from 'react'
import { Animated, Image, View, useColorScheme, StyleSheet, Easing } from 'react-native'

export default function LogoLoader() {
  // Use multiple animation values for more complex and stable animation
  const pulseAnim = useRef(new Animated.Value(1)).current
  const scaleAnim = useRef(new Animated.Value(1)).current
  const colorScheme = useColorScheme()
  
  useEffect(() => {
    // Initialize animations immediately to remove any delay in first render
    // This helps prevent the "patchy" first flicker
    
    // Create and start pulse animation with an initial delay for stability
    const pulseAnimation = () => {
      // Reset value to ensure consistent starting point
      pulseAnim.setValue(1);
      
      // Create sequence of animations
      Animated.sequence([
        // Initial delay to stabilize
        Animated.delay(50),
        // Fade out
        Animated.timing(pulseAnim, {
          toValue: 0.6,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        // Fade in
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        // Only continue the loop if component is still mounted
        if (finished) {
          pulseAnimation();
        }
      });
    };
    
    // Create and start scale animation
    const scaleAnimation = () => {
      // Reset value to ensure consistent starting point
      scaleAnim.setValue(1);
      
      // Create sequence of animations
      Animated.sequence([
        // Initial delay to stabilize and offset from pulse
        Animated.delay(200),
        // Scale up
        Animated.timing(scaleAnim, {
          toValue: 1.05,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        // Scale down
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        // Only continue the loop if component is still mounted
        if (finished) {
          scaleAnimation();
        }
      });
    };
    
    // Start both animations immediately
    pulseAnimation();
    scaleAnimation();
    
    // Clean up animations when component unmounts
    return () => {
      pulseAnim.stopAnimation();
      scaleAnim.stopAnimation();
    };
  }, []);

  const logo = colorScheme === 'dark'
    ? require('@/assets/images/light-logo.png')
    : require('@/assets/images/dark-logo.png')

  return (
    <View style={[styles.container, {
      backgroundColor: colorScheme === 'dark' ? '#000' : '#fff'
    }]}>
      <Animated.Image
        source={logo}
        style={[
          styles.logo, 
          { 
            opacity: pulseAnim,
            transform: [{ scale: scaleAnim }]
          }
        ]}
        resizeMode="contain"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 160,
    height: 160,
  },
})
