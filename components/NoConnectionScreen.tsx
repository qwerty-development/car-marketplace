import React, { useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  useColorScheme,
  Animated,
  Easing,
  Dimensions
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { RectButton } from 'react-native-gesture-handler';
import * as Updates from 'expo-updates';

interface NoConnectionScreenProps {
  onRetry: () => void;
}

const { width } = Dimensions.get('window');

const NoConnectionScreen: React.FC<NoConnectionScreenProps> = ({ onRetry }) => {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  
  // Animation values
  const iconAnimation = useRef(new Animated.Value(0)).current;
  const textAnimation = useRef(new Animated.Value(0)).current;
  const buttonAnimation = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(0)).current;
  
  // Handle app reload
  const handleRetry = async () => {
    try {
      // Provide haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Call the onRetry prop - This will trigger connection check in the parent
      if (onRetry) {
        onRetry();
      }
      
      // Reload the app
      await Updates.reloadAsync();
    } catch (error) {
      console.log('Error reloading app:', error);
    }
  };

  // Run animations when component mounts
  useEffect(() => {
    // Create the animation sequence
    const animationSequence = Animated.stagger(250, [
      // Icon drops down with a bounce
      Animated.spring(iconAnimation, {
        toValue: 1,
        tension: 40,
        friction: 7,
        useNativeDriver: true
      }),
      // Text fades in
      Animated.timing(textAnimation, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      }),
      // Button slides up
      Animated.spring(buttonAnimation, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true
      })
    ]);

    // Start the animation sequence
    animationSequence.start();

    // Setup continuous pulse animation for the signal icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        }),
        Animated.timing(pulseAnimation, {
          toValue: 0.5,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        })
      ])
    ).start();

    return () => {
      // Clean up animations if needed
      iconAnimation.stopAnimation();
      textAnimation.stopAnimation();
      buttonAnimation.stopAnimation();
      pulseAnimation.stopAnimation();
    };
  }, []);

  // Icon animation styles
  const iconScale = iconAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1]
  });
  
  const iconTranslateY = iconAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 0]
  });

  // Pulse animation for the icon
  const iconOpacity = pulseAnimation.interpolate({
    inputRange: [0.5, 1],
    outputRange: [0.7, 1]
  });

  // Text animation styles
  const textOpacity = textAnimation;
  const textTranslateY = textAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0]
  });

  // Button animation styles
  const buttonTranslateY = buttonAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [50, 0]
  });
  
  const buttonScale = buttonAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1]
  });

  return (
    <View style={[
      styles.container,
      { backgroundColor: isDarkMode ? '#000000' : '#FFFFFF' }
    ]}>
      {/* Animated WiFi icon */}
      <Animated.View style={[
        styles.iconContainer,
        {
          transform: [
            { scale: iconScale },
            { translateY: iconTranslateY }
          ],
          opacity: iconOpacity
        }
      ]}>
        <Feather 
          name="wifi-off" 
          size={90} 
          color={isDarkMode ? '#FFFFFF' : '#333333'} 
        />
        
        {/* Small animated dots around the icon */}
        <Animated.View 
          style={[
            styles.dot, 
            styles.dot1,
            {
              backgroundColor: isDarkMode ? '#555555' : '#DDDDDD',
              opacity: pulseAnimation
            }
          ]} 
        />
        <Animated.View 
          style={[
            styles.dot, 
            styles.dot2,
            {
              backgroundColor: isDarkMode ? '#555555' : '#DDDDDD',
              opacity: pulseAnimation.interpolate({
                inputRange: [0.5, 1],
                outputRange: [0.8, 0.3]
              })
            }
          ]} 
        />
        <Animated.View 
          style={[
            styles.dot, 
            styles.dot3,
            {
              backgroundColor: isDarkMode ? '#555555' : '#DDDDDD',
              opacity: pulseAnimation.interpolate({
                inputRange: [0.5, 1],
                outputRange: [0.3, 0.8]
              })
            }
          ]} 
        />
      </Animated.View>
      
      {/* Animated Text */}
      <Animated.View style={{
        opacity: textOpacity,
        transform: [{ translateY: textTranslateY }]
      }}>
        <Text style={[
          styles.title,
          { color: isDarkMode ? '#FFFFFF' : '#333333' }
        ]}>
          No Internet Connection
        </Text>
        
        <Text style={[
          styles.message,
          { color: isDarkMode ? '#CCCCCC' : '#666666' }
        ]}>
          Please check your internet connection and try again
        </Text>
      </Animated.View>
      
      {/* Animated Button */}
      <Animated.View style={{
        opacity: buttonAnimation,
        transform: [
          { translateY: buttonTranslateY },
          { scale: buttonScale }
        ],
        width: width * 0.6
      }}>
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={handleRetry}
          activeOpacity={0.7}
        >
          <Feather name="refresh-cw" size={18} color="#FFFFFF" style={styles.buttonIcon} />
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: '#D55004',
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  buttonIcon: {
    marginRight: 8,
  },
  dot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dot1: {
    top: 10,
    right: 20,
  },
  dot2: {
    bottom: 15,
    left: 20,
  },
  dot3: {
    top: 40,
    left: 15,
  }
});

export default NoConnectionScreen;