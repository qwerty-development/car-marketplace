import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Dimensions, StyleSheet, useColorScheme, Image } from 'react-native';
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

const FleetText: React.FC<{ opacity: Animated.Value }> = ({ opacity }) => (
  <Animated.Text
    style={[
      styles.fleetText,
      {
        color: '#D55004',
        opacity,
      },
    ]}
  >
    FLEET
  </Animated.Text>
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
  
  const screenOpacity = useRef(new Animated.Value(0)).current;
  const carLogoOpacity = useRef(new Animated.Value(1)).current;
  const carLogoPosition = useRef(new Animated.Value(0)).current;
  const fleetLogoOpacity = useRef(new Animated.Value(0)).current;
  const fleetLogoScale = useRef(new Animated.Value(0.8)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

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

  const showFinalAnimation = () => {
    Animated.sequence([
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
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.delay(800),
      // Final fade out of entire screen
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      })
    ]).start(() => {
      onAnimationComplete();
    });
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
              source={require('../assets/logo.png')}
              style={styles.fleetLogo}
              resizeMode="contain"
            />
          </Animated.View>
          <FleetText opacity={textOpacity} />
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
  fleetText: {
    fontSize: 56,
    fontWeight: 'bold',
    letterSpacing: 12,
  },
});

export default EnhancedSplashScreen;