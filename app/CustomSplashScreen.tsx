import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Dimensions, StyleSheet, useColorScheme, Image } from 'react-native';
import { Audio } from 'expo-av';
import { supabase } from '@/utils/supabase';

const { width } = Dimensions.get('window');

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

// FleetText component that reveals the "leet" text from left to right
const FleetText: React.FC<{ 
  opacity: Animated.Value, 
  revealWidth: Animated.Value,
  isDarkMode: boolean
}> = ({ opacity, revealWidth, isDarkMode }) => (
  <Animated.View
    style={[
      styles.fleetTextContainer,
      { opacity }
    ]}
  >
    <Animated.View
      style={[
        {
          width: revealWidth,
          overflow: 'hidden'
        }
      ]}
    >
      <Image
        source={require('../assets/logo-text.png')}
        style={[
          styles.fleetTextImage,
          isDarkMode && { tintColor: '#FFFFFF' } // Invert text color for dark mode
        ]}
        resizeMode="contain"
      />
    </Animated.View>
  </Animated.View>
);

interface SplashScreenProps {
  onAnimationComplete: () => void;
}

const EnhancedSplashScreen: React.FC<SplashScreenProps> = ({ 
  onAnimationComplete,
}) => {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  
  const [currentLogoIndex, setCurrentLogoIndex] = useState(0);
  const [showFleetLogo, setShowFleetLogo] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  
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
  
  // Right-to-left exit animation value
  const screenPositionX = useRef(new Animated.Value(0)).current;

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

  // Preload initial data
  useEffect(() => {
    const preloadData = async () => {
      try {
        const { data, error } = await supabase
          .from('cars')
          .select('*, dealerships (name,logo,phone,location,latitude,longitude)')
          .eq('status', 'available')
          .order('listed_at', { ascending: false })
          .range(0, 6);

        if (error) throw error;

        if (data) {
          const formattedCars = data.map(item => ({
            ...item,
            dealership_name: item.dealerships.name,
            dealership_logo: item.dealerships.logo,
            dealership_phone: item.dealerships.phone,
            dealership_location: item.dealerships.location,
            dealership_latitude: item.dealerships.latitude,
            dealership_longitude: item.dealerships.longitude
          }));
          setIsDataLoaded(true);
        }
      } catch (error) {
        console.error('Error preloading data:', error);
        setIsDataLoaded(true); // Continue even if there's an error
      }
    };

    preloadData();
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
        await Promise.all(carLogos.map(uri => Image.prefetch(uri)));
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

  const runSlotMachineAnimation = () => {
    const slotDuration = 3000;
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
    // 1. First, show the F logo in the center (exactly where car logos appear)
    const showFLogo = Animated.parallel([
      Animated.timing(fLogoOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(fLogoScale, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      })
    ]);
    
    // 2. Move the F logo to the left
    const moveFLogoToLeft = Animated.timing(fLogoPosition, {
      toValue: -width * 0.26, // Adjusted leftward movement for new sizes
      duration: 500,
      useNativeDriver: true,
    });
    
    // 3. Reveal the "leet" text from left to right
    const showText = Animated.timing(textOpacity, {
      toValue: 1,
      duration: 0,
      useNativeDriver: true,
    });
    
    // 4. Animate the text width to reveal "leet" from left to right
    const revealText = Animated.timing(textRevealWidth, {
      toValue: width * 0.5, // Width of the "leet" text
      duration: 800, // Longer duration for more visible letter-by-letter effect
      useNativeDriver: false, // Width animations can't use native driver
    });
    
    // 5. Exit animation - slide from right to left instead of fading out
    const slideOutToLeft = Animated.timing(screenPositionX, {
      toValue: -width, // Move the entire screen to the left (off-screen)
      duration: 700,
      delay: 800, // Give users time to see the final result
      useNativeDriver: true,
    });
    
    // Run the animation sequence
    Animated.sequence([
      showFLogo,
      Animated.delay(300),
      moveFLogoToLeft,
      Animated.delay(200),
      showText,
      Animated.parallel([
        revealText,
      ]),
      slideOutToLeft
    ]).start(() => {
      // Stop sound if it's still playing when animation ends
      if (sound) {
        sound.stopAsync();
      }
      onAnimationComplete();
    });
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: isDarkMode ? '#000000' : '#FFFFFF',
          opacity: screenOpacity,
          transform: [{ translateX: screenPositionX }] // Apply the right-to-left exit animation
        },
      ]}
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
              styles.logoContainer, // Use the same container style as car logos for width/height
              styles.fLogoContainer,
              {
                opacity: fLogoOpacity,
                position: 'absolute', // Position absolutely like car logos
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
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
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
    width: width * 0.2, // Adjust the size for the F logo
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
    left: width * -0.035, // Position at the right side of the F logo
    justifyContent: 'center',
  },
  
  leetText: {
    height: width * 0.14,
    width: width * 0.5,
    alignSelf: 'flex-start', // Align to left edge
  },
  fleetTextContainer: {
    flexDirection: 'row',
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fleetTextImage: {
    height: 60,
    width: width * 0.7,
  },
});

export default EnhancedSplashScreen;