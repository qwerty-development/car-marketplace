import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Dimensions, StyleSheet, useColorScheme, Image } from 'react-native';
import { Audio } from 'expo-av';
import { supabase } from '@/utils/supabase';

const { width, height } = Dimensions.get('window');

const carLogos = [
  'https://www.carlogos.org/car-logos/mercedes-benz-logo.png',
  'https://www.carlogos.org/car-logos/bmw-logo.png',
  'https://www.carlogos.org/car-logos/audi-logo.png',
  'https://www.carlogos.org/car-logos/porsche-logo.png',
  'https://www.carlogos.org/car-logos/ferrari-logo.png',
  'https://www.carlogos.org/car-logos/tesla-logo.png',
  'https://www.carlogos.org/car-logos/lamborghini-logo.png',
  'https://www.carlogos.org/car-logos/maserati-logo.png',
  'https://www.carlogos.org/car-logos/rolls-royce-logo.png',
  'https://www.carlogos.org/car-logos/bentley-logo.png'
];

interface AnimatedLogoProps {
  index: number;
  opacity: Animated.Value;
  translateY: Animated.Value;
}

const AnimatedLogo: React.FC<AnimatedLogoProps> = ({ index, opacity, translateY }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <Animated.View
      style={[
        styles.logoContainer,
        {
          opacity: isLoaded ? opacity : 0,
          transform: [{ translateY }],
          position: 'absolute',
        },
      ]}
    >
      <Image
        source={{ uri: carLogos[index] }}
        style={styles.carLogo}
        resizeMode="contain"
        onLoad={() => setIsLoaded(true)}
      />
    </Animated.View>
  );
};

interface SplashScreenProps {
  onAnimationComplete: () => void;
}

const CustomSplashScreen: React.FC<SplashScreenProps> = ({ 
  onAnimationComplete,
}) => {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  
  const [currentLogoIndex, setCurrentLogoIndex] = useState(0);
  const [showFleetLogo, setShowFleetLogo] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [animationComplete, setAnimationComplete] = useState(false);
  
  const screenOpacity = useRef(new Animated.Value(0)).current;
  const carLogoOpacity = useRef(new Animated.Value(1)).current;
  const carLogoPosition = useRef(new Animated.Value(0)).current;
  
  // F logo animation values
  const fLogoOpacity = useRef(new Animated.Value(0)).current;
  const fLogoScale = useRef(new Animated.Value(0.8)).current;
  const fLogoPosition = useRef(new Animated.Value(0)).current; // 0 = center, negative = left
  
  // Text animation values
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textRevealWidth = useRef(new Animated.Value(0)).current;

  // Curtain animation value - starts from right side of screen (width)
  const curtainPosition = useRef(new Animated.Value(width)).current;

  // Get the appropriate logo based on theme
  const getLogoSource = () => {
    return isDarkMode 
      ? require('../assets/images/light-logo.png')  // White logo for dark mode
      : require('../assets/images/dark-logo.png');  // Dark logo for light mode
  };

  // Load sound
  useEffect(() => {
    const loadSound = async () => {
      try {
        const { sound: carSound } = await Audio.Sound.createAsync(
          require('../assets/car-sound.wav'),
          { shouldPlay: false }
        );
        setSound(carSound);
      } catch (error) {
        console.error('Error loading sound:', error);
      }
    };

    loadSound();

    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  // Preload initial data - Optimized to be faster
  useEffect(() => {
    const preloadData = async () => {
      try {
        // Simplified data fetch - just enough to warm up the connection
        const { data, error } = await supabase
          .from('cars')
          .select('id, make, model, year')
          .eq('status', 'available')
          .limit(3); // Just get minimal data to warm up connection
        
        if (error) {
          console.warn('Preload warning:', error);
        }
        
        // We set data loaded to true regardless
        setIsDataLoaded(true);
      } catch (error) {
        console.error('Error preloading data:', error);
        setIsDataLoaded(true); // Continue even if there's an error
      }
    };

    // Start preload immediately, but don't wait indefinitely
    const timeout = setTimeout(() => {
      setIsDataLoaded(true); // Force continue after timeout
    }, 2000); // Shorter timeout

    preloadData();
    
    return () => clearTimeout(timeout);
  }, []);

  // Main animation sequence
  useEffect(() => {
    // Initial fade in
    Animated.timing(screenOpacity, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    const preloadImages = async () => {
      try {
        // Create an array of promises for image prefetching
        const prefetchPromises = carLogos.map(uri => Image.prefetch(uri));
        
        // Start prefetching, but set a timeout to continue regardless
        const timeoutPromise = new Promise(resolve => {
          setTimeout(resolve, 1500); // Shorter timeout for image prefetching
        });
        
        // Wait for prefetching or timeout, whichever comes first
        await Promise.race([
          Promise.all(prefetchPromises),
          timeoutPromise
        ]);
        
        if (isDataLoaded) {
          runSlotMachineAnimation();
        }
      } catch (error) {
        console.warn('Failed to preload images:', error);
        if (isDataLoaded) {
          runSlotMachineAnimation();
        }
      }
    };

    preloadImages();
  }, [isDataLoaded]);

  // Curtain animation effect
  useEffect(() => {
    if (animationComplete) {
      // Run the curtain animation - sliding from right to left
      Animated.timing(curtainPosition, {
        toValue: 0, // Move to the left edge of the screen
        duration: 500, // Duration of the slide animation
        useNativeDriver: true,
      }).start(() => {
        // Wait a moment before completing
        setTimeout(() => {
          onAnimationComplete();
        }, 200);
      });
    }
  }, [animationComplete, onAnimationComplete]);

  const runSlotMachineAnimation = () => {
    // Slightly faster slot machine animation
    const slotDuration = 1800; // Reduced from 3000ms
    const logoChangeInterval = slotDuration / (carLogos.length * 2);
    let currentIndex = 0;

    const interval = setInterval(() => {
      currentIndex++;
      setCurrentLogoIndex(currentIndex % carLogos.length);
      
      if (currentIndex >= carLogos.length - 1) {
        clearInterval(interval);
        Animated.timing(carLogoOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setShowFleetLogo(true);
          // Play sound when Fleet logo appears
          playSound();
          showFinalAnimation();
        });
      }
    }, logoChangeInterval);

    // No vertical movement for car logos, keep them in the middle
    Animated.timing(carLogoPosition, {
      toValue: 0,
      duration: slotDuration,
      useNativeDriver: true,
    }).start();
  };

  const playSound = async () => {
    try {
      if (sound) {
        await sound.setPositionAsync(0); // Reset to beginning in case it was played before
        await sound.playAsync();
      }
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  };

  const showFinalAnimation = () => {
    // Slightly faster animations
// F Logo and text
const showFLogo = Animated.parallel([
  Animated.timing(fLogoOpacity, {
    toValue: 1,
    duration: 200, // WAS 250
    useNativeDriver: true,
  }),
  Animated.spring(fLogoScale, {
    toValue: 1,
    friction: 4,
    tension: 50, // WAS 40
    useNativeDriver: true,
  }),
]);

const moveFLogoToLeft = Animated.timing(fLogoPosition, {
  toValue: -width * 0.26,
  duration: 300, // WAS 400
  useNativeDriver: true,
});

const revealText = Animated.timing(textRevealWidth, {
  toValue: width * 0.5,
  duration: 400, // WAS 600
  useNativeDriver: false,
});

const holdFinalState = Animated.delay(300); // WAS 500

    
    const showText = Animated.timing(textOpacity, {
      toValue: 1,
      duration: 0,
      useNativeDriver: true,
    });
    
    
    
    // Run the animation sequence
    Animated.sequence([
      showFLogo,
      Animated.delay(200), 
      moveFLogoToLeft,
      Animated.delay(150),
      showText,
      revealText,
      holdFinalState
    ]).start(() => {
      // Signal that we're ready for the curtain effect
      if (sound) {
        sound.stopAsync();
      }
      setAnimationComplete(true);
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
        {/* Car logos for the slot machine effect */}
        {!showFleetLogo && (
          <AnimatedLogo
            index={currentLogoIndex}
            opacity={carLogoOpacity}
            translateY={carLogoPosition}
          />
        )}
        
        {/* Fleet logo animation */}
        {showFleetLogo && (
          <View style={styles.fleetContainer}>
            {/* F Logo - positioned in the same place as car logos initially */}
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
        )}
      </Animated.View>

      {/* The sliding curtain - will slide from right to left */}
      <Animated.View
        style={[
          styles.curtain,
          {
            transform: [{ translateX: curtainPosition }],
            backgroundColor: isDarkMode ? '#000000' : '#FFFFFF',
          }
        ]}
      />
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
  carLogo: {
    width: '80%',
    height: '63.5%',
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
  // Curtain styles
  curtain: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: width * 2, // Make it wider than the screen to ensure complete coverage
    height: height,
    zIndex: 1000, // Make sure it's on top of everything
  },
});

export default CustomSplashScreen;