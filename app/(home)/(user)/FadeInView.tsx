import React, { useEffect, ReactNode, useState } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
  WithTimingConfig,
} from 'react-native-reanimated';

interface FadeViewProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  duration?: number;
  delay?: number;
  initialOpacity?: number;
  finalOpacity?: number;
  easing?: (value: number) => number;
  visible?: boolean;
  onAnimationComplete?: () => void;
  slideDistance?: number;
  slideDirection?: 'up' | 'down' | 'left' | 'right' | 'none';
}

export const FadeView: React.FC<FadeViewProps> = ({
  children,
  style,
  duration = 300,
  delay = 0,
  initialOpacity = 0,
  finalOpacity = 1,
  easing = Easing.ease,
  visible = true,
  onAnimationComplete,
  slideDistance = 20,
  slideDirection = 'none',
}) => {
  const opacity = useSharedValue(initialOpacity);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const [isRendered, setIsRendered] = useState(visible || initialOpacity > 0);
  
  // Set initial slide position
  useEffect(() => {
    if (slideDirection !== 'none') {
      switch (slideDirection) {
        case 'up':
          translateY.value = slideDistance;
          break;
        case 'down':
          translateY.value = -slideDistance;
          break;
        case 'left':
          translateX.value = slideDistance;
          break;
        case 'right':
          translateX.value = -slideDistance;
          break;
      }
    }
  }, [slideDirection, slideDistance, translateX, translateY]);
  
  useEffect(() => {
    const animationConfig: WithTimingConfig = {
      duration,
      easing,
    };
    
    // Setup animation based on visibility
    if (visible) {
      setIsRendered(true);
      
      const timeoutId = setTimeout(() => {
        // Animate opacity
        opacity.value = withTiming(finalOpacity, animationConfig);
        
        // Animate position if using slide
        if (slideDirection !== 'none') {
          translateX.value = withTiming(0, animationConfig);
          translateY.value = withTiming(0, animationConfig);
        }
        
        // Call completion handler after animation finishes
        if (onAnimationComplete) {
          setTimeout(onAnimationComplete, duration);
        }
      }, delay);
      
      return () => clearTimeout(timeoutId);
    } else {
      // Fade out
      opacity.value = withTiming(initialOpacity, animationConfig);
      
      // Slide out if using slide
      if (slideDirection !== 'none') {
        switch (slideDirection) {
          case 'up':
            translateY.value = withTiming(slideDistance, animationConfig);
            break;
          case 'down':
            translateY.value = withTiming(-slideDistance, animationConfig);
            break;
          case 'left':
            translateX.value = withTiming(slideDistance, animationConfig);
            break;
          case 'right':
            translateX.value = withTiming(-slideDistance, animationConfig);
            break;
        }
      }
      
      // Remove from DOM after fade out completes
      const timeoutId = setTimeout(() => {
        setIsRendered(false);
        if (onAnimationComplete) {
          onAnimationComplete();
        }
      }, duration + delay);
      
      return () => clearTimeout(timeoutId);
    }
  }, [visible, opacity, translateX, translateY, duration, delay, initialOpacity, finalOpacity, easing, onAnimationComplete, slideDirection, slideDistance]);
  
  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
      ],
    };
  });
  
  if (!isRendered) {
    return null;
  }
  
  return (
    <Animated.View style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
};

// For backward compatibility
export const FadeInView: React.FC<FadeViewProps> = (props) => {
  return <FadeView {...props} visible={true} />;
};

// Example usage:
// <FadeInView 
//   duration={300} 
//   delay={100} 
//   slideDirection="up" 
//   slideDistance={30}
//   onAnimationComplete={() => console.log('Animation done!')}
// >
//   <Text>Content that fades in with a slide effect</Text>
// </FadeInView>
//
// Use with conditional rendering and visible prop:
// <FadeView visible={showContent} duration={200}>
//   <Text>This content will fade in/out based on showContent state</Text>
// </FadeView>