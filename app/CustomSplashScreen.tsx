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

// Updated FleetText component to handle theme-based color inversion
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
  const [textWidth, setTextWidth] = useState(0);
  
  const screenOpacity = useRef(new Animated.Value(0)).current;
  const carLogoOpacity = useRef(new Animated.Value(1)).current;
  const carLogoPosition = useRef(new Animated.Value(0)).current;
  const fleetLogoOpacity = useRef(new Animated.Value(0)).current;
  const fleetLogoScale = useRef(new Animated.Value(0.8)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textRevealWidth = useRef(new Animated.Value(0)).current;

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

    Animated.sequence([
      Animated.timing(carLogoPosition, {
        toValue: -width * 0.3,
        duration: slotDuration * 0.7,
        useNativeDriver: true,
      }),
      Animated.spring(carLogoPosition, {
        toValue: 0,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      })
    ]).start();
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
    // Set the text width once we know it (for reveal animation)
    setTextWidth(width * 0.7); // Assuming text image takes about 70% of screen width
    
    // Split animations into native-driven and JS-driven groups
    const nativeAnimations = Animated.sequence([
      Animated.parallel([
        Animated.timing(fleetLogoOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(fleetLogoScale, {
          toValue: 1,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        })
      ]),
      Animated.delay(400),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.delay(800),
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      })
    ]);
    
    // Separate animation for width reveal (JS-driven)
    const jsAnimations = Animated.sequence([
      Animated.delay(800), // Wait for logo animations and delay
      Animated.timing(textRevealWidth, {
        toValue: width * 0.7,
        duration: 400,
        useNativeDriver: false,
      })
    ]);
    
    // Start both animation groups
    nativeAnimations.start(() => {
      // Stop sound if it's still playing when animation ends
      if (sound) {
        sound.stopAsync();
      }
      onAnimationComplete();
    });
    
    jsAnimations.start();
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: isDarkMode ? '#000000' : '#FFFFFF',
          opacity: screenOpacity
        },
      ]}
    >
      <AnimatedLogo
        index={currentLogoIndex}
        opacity={carLogoOpacity}
        translateY={carLogoPosition}
      />
      {showFleetLogo && (
        <View style={styles.fleetContainer}>
          <Animated.View
            style={[
              styles.fleetLogoContainer,
              {
                opacity: fleetLogoOpacity,
                transform: [{ scale: fleetLogoScale }],
              },
            ]}
          >
            <Image
              source={getLogoSource()}
              style={styles.fleetLogo}
              resizeMode="contain"
            />
          </Animated.View>
          <FleetText 
            opacity={textOpacity} 
            revealWidth={textRevealWidth} 
            isDarkMode={isDarkMode} 
          />
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
    width: '100%',
    height: '100%',
  },
  fleetContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fleetLogoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  fleetLogo: {
    width: width * 0.7,
    height: width * 0.7,
  },
  fleetTextContainer: {
    height: 60, // Fixed height for the text image container
    justifyContent: 'center',
    alignItems: 'flex-start', // This ensures the image stays left-aligned during reveal
  },
  fleetTextImage: {
    height: 60,
    width: width * 0.7, // Same as the final width in the animation
  },
});

export default EnhancedSplashScreen;