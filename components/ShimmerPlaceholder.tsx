// components/ShimmerPlaceholder.tsx
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/utils/ThemeContext';

const ShimmerPlaceholder = ({ children, style }: { children?: React.ReactNode, style?: any }) => {
  const { isDarkMode } = useTheme();
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 1300, // The speed of the shimmer animation
        useNativeDriver: true,
      })
    ).start();
  }, [animatedValue]);

  // CHANGE 1: The animated value now controls vertical movement (translateY).
  // The output range is positive to negative to move from bottom to top.
  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-350, 350], // Moves from off-screen bottom to off-screen top
  });

  // Define colors for light and dark mode
  const baseColor = isDarkMode ? '#2D2D2D' : '#E0E0E0';
  const highlightColor = isDarkMode ? 'rgba(60, 60, 60, 0.1)' : 'rgba(255, 255, 255, 0.1)';

  return (
    // The base view that has the shape of your skeleton
    <View style={[{ backgroundColor: baseColor, overflow: 'hidden' }, style]}>
      {children}
      {/* The animated gradient view that creates the shimmer */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          // CHANGE 2: Apply translateY to the transform.
          { transform: [{ translateX }] },
        ]}
      >
        <LinearGradient
          colors={['transparent', highlightColor, 'transparent']}
          // CHANGE 3: The gradient is now horizontal (left-to-right) to form a "wave".
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
    </View>
  );
};

export default ShimmerPlaceholder;