import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Platform,
  Alert,
  StyleSheet,
  Share,
  Animated as RNAnimated,
  PanResponder,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { FontAwesome, Ionicons, MaterialCommunityIcons, AntDesign, Feather, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInUp,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
  interpolateColor,
  interpolate,
  withSequence,
  withDelay,
  withSpring,
  useAnimatedScrollHandler,
  SlideInDown,
} from 'react-native-reanimated';
import { supabase } from '@/utils/supabase';
import { useFavorites } from '@/utils/useFavorites';
import { useTheme } from '@/utils/ThemeContext';
import { useAuth } from '@/utils/AuthContext';
import { useGuestUser } from '@/utils/GuestUserContext';
import * as Haptics from 'expo-haptics';

import {

  TextInput as RNTextInput
} from 'react-native';
import { ChevronLeft } from 'lucide-react-native';




// Get screen dimensions
const { width, height } = Dimensions.get('window');

// Types for car data
interface Car {
  id: number;
  make: string;
  model: string;
  year: number;
  price: number;
  condition: string;
  transmission: string;
  color: string;
  mileage: number;
  drivetrain: string;
  type: string; // Fuel type
  category: string;
  description: string;
  images: string[];
  views: number;
  likes: number;
  features: string[];
  dealership_id: number;
  dealership_name?: string;
  dealership_logo?: string;
  dealership_phone?: string;
  dealership_location?: string;
  dealership_latitude?: number;
  dealership_longitude?: number;
  status: string;
  source?: string;
}

// Feature metadata with enhanced descriptions and icons
interface FeatureMetadata {
  [key: string]: {
    label: string;
    icon: string;
    description: string;
    importance: 'high' | 'medium' | 'low';
    category: 'comfort' | 'safety' | 'technology' | 'convenience' | 'performance';
  };
}

// Enhanced feature metadata
const FEATURE_METADATA: FeatureMetadata = {
  "heated_seats": {
    label: "Heated Seats",
    icon: "car-seat-heater",
    description: "Seats with built-in heating elements for added comfort in cold weather conditions",
    importance: "medium",
    category: "comfort"
  },
  "keyless_entry": {
    label: "Keyless Entry",
    icon: "key-wireless",
    description: "Ability to unlock doors without using a traditional key, enhancing convenience",
    importance: "medium",
    category: "convenience"
  },
  "keyless_start": {
    label: "Keyless Start",
    icon: "power",
    description: "Start the vehicle with the push of a button without inserting a key",
    importance: "medium",
    category: "convenience"
  },
  "power_mirrors": {
    label: "Power Mirrors",
    icon: "car-side",
    description: "Electrically adjustable side mirrors controlled from inside the vehicle",
    importance: "low",
    category: "convenience"
  },
  "power_steering": {
    label: "Power Steering",
    icon: "steering",
    description: "System that helps drivers steer the vehicle with reduced effort",
    importance: "high",
    category: "performance"
  },
  "power_windows": {
    label: "Power Windows",
    icon: "window-maximize",
    description: "Electrically operated windows controlled by switches",
    importance: "low",
    category: "convenience"
  },
  "backup_camera": {
    label: "Backup Camera",
    icon: "camera",
    description: "Camera providing rear view when reversing to improve safety and visibility",
    importance: "high",
    category: "safety"
  },
  "bluetooth": {
    label: "Bluetooth",
    icon: "bluetooth",
    description: "Wireless connectivity for phone calls and audio streaming from mobile devices",
    importance: "medium",
    category: "technology"
  },
  "cruise_control": {
    label: "Cruise Control",
    icon: "speedometer",
    description: "System maintaining a constant vehicle speed set by the driver for comfort on long journeys",
    importance: "medium",
    category: "convenience"
  },
  "navigation": {
    label: "Navigation System",
    icon: "map-marker",
    description: "Built-in GPS navigation system with real-time directions and mapping",
    importance: "medium",
    category: "technology"
  },
  "sunroof": {
    label: "Sunroof",
    icon: "weather-sunny",
    description: "Operable roof panel that allows light and fresh air into the vehicle",
    importance: "low",
    category: "comfort"
  },
  "leather_seats": {
    label: "Leather Seats",
    icon: "car-seat",
    description: "Premium seating surfaces upholstered with leather material for comfort and luxury",
    importance: "medium",
    category: "comfort"
  },
  "third_row_seats": {
    label: "Third Row Seats",
    icon: "seat-passenger",
    description: "Additional row of seating for more passengers, increasing vehicle capacity",
    importance: "high",
    category: "convenience"
  },
  "parking_sensors": {
    label: "Parking Sensors",
    icon: "parking",
    description: "Sensors that alert driver of obstacles when parking to prevent collisions",
    importance: "medium",
    category: "safety"
  },
  "lane_assist": {
    label: "Lane Departure Warning",
    icon: "road-variant",
    description: "System alerting driver when vehicle begins to move out of its lane without signaling",
    importance: "high",
    category: "safety"
  },
  "blind_spot": {
    label: "Blind Spot Monitoring",
    icon: "eye-off",
    description: "System detecting vehicles in driver's blind spot and providing visual or audible alerts",
    importance: "high",
    category: "safety"
  },
  "apple_carplay": {
    label: "Apple CarPlay",
    icon: "apple",
    description: "Interface allowing iPhone functionality through the car's display with optimized controls",
    importance: "medium",
    category: "technology"
  },
  "android_auto": {
    label: "Android Auto",
    icon: "android",
    description: "Interface allowing Android device functionality through the car's display with optimized controls",
    importance: "medium",
    category: "technology"
  },
  "premium_audio": {
    label: "Premium Audio",
    icon: "speaker",
    description: "High-quality audio system with enhanced speakers and sound processing",
    importance: "low",
    category: "technology"
  },
  "remote_start": {
    label: "Remote Start",
    icon: "remote",
    description: "Ability to start the vehicle remotely to pre-condition the interior temperature",
    importance: "medium",
    category: "convenience"
  },
  "adaptive_cruise": {
    label: "Adaptive Cruise Control",
    icon: "shield-car",
    description: "Advanced cruise control that maintains safe following distance from vehicles ahead",
    importance: "high",
    category: "safety"
  },
  "auto_emergency_braking": {
    label: "Auto Emergency Braking",
    icon: "car-brake-alert",
    description: "System that automatically applies brakes to prevent or reduce severity of collisions",
    importance: "high",
    category: "safety"
  },
  "heads_up_display": {
    label: "Heads-Up Display",
    icon: "monitor-dashboard",
    description: "Projects important driving information onto the windshield in driver's line of sight",
    importance: "medium",
    category: "technology"
  },
  "wireless_charging": {
    label: "Wireless Charging",
    icon: "battery-charging-wireless",
    description: "Allows compatible devices to charge without plugging in",
    importance: "low",
    category: "technology"
  },
  "panoramic_roof": {
    label: "Panoramic Roof",
    icon: "car-convertible",
    description: "Extended sunroof that spans much of the vehicle roof for open-air experience",
    importance: "low",
    category: "comfort"
  }
};

// Market segment data for comparisons
const MARKET_SEGMENT_AVERAGES:any = {
  "Sedan": {
    price: 32000,
    mileage: 35000,
    features: 8,
    yearModel: 2020,
  },
  "SUV": {
    price: 39000,
    mileage: 30000,
    features: 10,
    yearModel: 2021,
  },
  "Coupe": {
    price: 42000,
    mileage: 25000,
    features: 9,
    yearModel: 2020,
  },
  "Hatchback": {
    price: 28000,
    mileage: 32000,
    features: 7,
    yearModel: 2020,
  },
  "Truck": {
    price: 45000,
    mileage: 28000,
    features: 8,
    yearModel: 2021,
  },
};

// Annual cost estimates
const ANNUAL_COST_ESTIMATES:any = {
  "maintenance": {
    "New": 500,
    "Used": 1200
  },
  "insurance": {
    "Sedan": 1200,
    "SUV": 1400,
    "Coupe": 1500,
    "Hatchback": 1100,
    "Truck": 1600
  },
  "fuelConsumption": {
    "Benzine": {
      "Sedan": 1500,
      "SUV": 2000,
      "Coupe": 1700,
      "Hatchback": 1400,
      "Truck": 2500
    },
    "Diesel": {
      "Sedan": 1200,
      "SUV": 1700,
      "Coupe": 1400,
      "Hatchback": 1100,
      "Truck": 2200
    },
    "Hybrid": {
      "Sedan": 1000,
      "SUV": 1300,
      "Coupe": 1100,
      "Hatchback": 900,
      "Truck": 1800
    },
    "Electric": {
      "Sedan": 500,
      "SUV": 700,
      "Coupe": 600,
      "Hatchback": 450,
      "Truck": 1000
    }
  },
  "depreciation": {
    "rates": {
      "1": 15, // 1 year: 15% depreciation
      "2": 13,
      "3": 10,
      "4": 8,
      "5": 7,
      "6": 5,
      "7": 4,
      "8": 3,
      "9": 2,
      "10+": 1.5
    }
  }
};

// Enhanced helper function to determine which value is better
const getBetterValue = (attr: string, value1: any, value2: any): number => {
  if (value1 === null || value1 === undefined) return 2;
  if (value2 === null || value2 === undefined) return 1;

  switch (attr) {
    case 'price':
      return value1 < value2 ? 1 : value1 > value2 ? 2 : 0;
    case 'mileage':
      return value1 < value2 ? 1 : value1 > value2 ? 2 : 0;
    case 'year':
      return value1 > value2 ? 1 : value1 < value2 ? 2 : 0;
    case 'features':
      return (value1?.length || 0) > (value2?.length || 0) ? 1 : (value1?.length || 0) < (value2?.length || 0) ? 2 : 0;
    case 'safety_features':
      const safetyFeatures1 = value1?.filter((f: string) => FEATURE_METADATA[f]?.category === 'safety').length || 0;
      const safetyFeatures2 = value2?.filter((f: string) => FEATURE_METADATA[f]?.category === 'safety').length || 0;
      return safetyFeatures1 > safetyFeatures2 ? 1 : safetyFeatures1 < safetyFeatures2 ? 2 : 0;
    case 'comfort_features':
      const comfortFeatures1 = value1?.filter((f: string) => FEATURE_METADATA[f]?.category === 'comfort').length || 0;
      const comfortFeatures2 = value2?.filter((f: string) => FEATURE_METADATA[f]?.category === 'comfort').length || 0;
      return comfortFeatures1 > comfortFeatures2 ? 1 : comfortFeatures1 < comfortFeatures2 ? 2 : 0;
    case 'tech_features':
      const techFeatures1 = value1?.filter((f: string) => FEATURE_METADATA[f]?.category === 'technology').length || 0;
      const techFeatures2 = value2?.filter((f: string) => FEATURE_METADATA[f]?.category === 'technology').length || 0;
      return techFeatures1 > techFeatures2 ? 1 : techFeatures1 < techFeatures2 ? 2 : 0;
    case 'value_score':
      return value1 > value2 ? 1 : value1 < value2 ? 2 : 0;
    case 'total_cost':
      return value1 < value2 ? 1 : value1 > value2 ? 2 : 0;
    case 'depreciation':
      return value1 < value2 ? 1 : value1 > value2 ? 2 : 0;
    default:
      return 0; // Equal or not comparable
  }
};



// Calculate total cost of ownership (5-year estimate)
const calculateTotalCostOfOwnership = (car: Car): number => {
  // Base variables
  const carAge = new Date().getFullYear() - car.year;
  const category = car.category || 'Sedan';
  const condition = car.condition || 'Used';
  const fuelType = car.type || 'Benzine';

  // Calculate depreciation
  let depreciation = 0;
  const currentValue = car.price;
  let futureValue = currentValue;

  for (let year = 1; year <= 5; year++) {
    const yearsSinceNew = carAge + year;
    let rate = 0;

    if (yearsSinceNew <= 10) {
      rate = ANNUAL_COST_ESTIMATES.depreciation.rates[yearsSinceNew.toString()];
    } else {
      rate = ANNUAL_COST_ESTIMATES.depreciation.rates['10+'];
    }

    const yearlyDepreciation = futureValue * (rate / 100);
    depreciation += yearlyDepreciation;
    futureValue -= yearlyDepreciation;
  }

  // Calculate 5-year maintenance cost
  const annualMaintenance = ANNUAL_COST_ESTIMATES.maintenance[condition];
  const maintenanceCost = annualMaintenance * 5;

  // Calculate 5-year insurance cost
  const annualInsurance = ANNUAL_COST_ESTIMATES.insurance[category] || ANNUAL_COST_ESTIMATES.insurance['Sedan'];
  const insuranceCost = annualInsurance * 5;

  // Calculate 5-year fuel cost
  const fuelCategoryData = ANNUAL_COST_ESTIMATES.fuelConsumption[fuelType] || ANNUAL_COST_ESTIMATES.fuelConsumption['Benzine'];
  const annualFuel = fuelCategoryData[category] || fuelCategoryData['Sedan'];
  const fuelCost = annualFuel * 5;

  // Total cost of ownership
  return depreciation + maintenanceCost + insuranceCost + fuelCost;
};

// Calculate value score (higher is better)
const calculateValueScore = (car: Car): number => {
  // Base factors
  const featureCount = car.features?.length || 0;
  const safetyFeatures = car.features?.filter(f => FEATURE_METADATA[f]?.category === 'safety').length || 0;
  const highImportanceFeatures = car.features?.filter(f => FEATURE_METADATA[f]?.importance === 'high').length || 0;

  // Age factor (newer is better)
  const ageInYears = new Date().getFullYear() - car.year;
  const ageFactor = Math.max(0.5, 1 - (ageInYears * 0.05)); // 5% reduction per year, minimum 0.5

  // Mileage factor (lower is better)
  const mileageFactor = Math.max(0.6, 1 - (car.mileage / 200000)); // Linear reduction, minimum 0.6

  // Feature value (weighted by importance)
  const featureValue = featureCount * 1 + safetyFeatures * 2 + highImportanceFeatures * 1.5;

  // Price factor (lower is better)
  const priceFactor = Math.max(0.5, 1 - (car.price / 150000)); // Linear reduction, minimum 0.5

  // Calculate final score (0-100)
  const rawScore = ((featureValue * 40) + (ageFactor * 25) + (mileageFactor * 20) + (priceFactor * 15));

  // Normalize to 0-100 range
  return Math.min(100, Math.max(0, rawScore));
};

// Calculate environmental score (higher is better)
const calculateEnvironmentalScore = (car: Car): number => {
  // Base score by fuel type
  let baseScore = 0;
  switch(car.type?.toLowerCase()) {
    case 'electric':
      baseScore = 90;
      break;
    case 'hybrid':
      baseScore = 70;
      break;
    case 'diesel':
      baseScore = 40;
      break;
    case 'benzine':
    default:
      baseScore = 30;
      break;
  }

  // Age adjustment (newer cars tend to be more efficient)
  const ageInYears = new Date().getFullYear() - car.year;
  const ageAdjustment = Math.min(0, -1 * (ageInYears * 1.5)); // -1.5 points per year

  // Category/size adjustment
  let categoryAdjustment = 0;
  switch(car.category?.toLowerCase()) {
    case 'coupe':
    case 'compact':
    case 'hatchback':
      categoryAdjustment = 10;
      break;
    case 'sedan':
      categoryAdjustment = 5;
      break;
    case 'suv':
      categoryAdjustment = -5;
      break;
    case 'truck':
      categoryAdjustment = -10;
      break;
    default:
      categoryAdjustment = 0;
  }

  // Efficiency features adjustment
  const hasEfficiencyFeatures = car.features?.some(f =>
    ['auto_start_stop', 'eco_mode', 'regenerative_braking'].includes(f)
  );
  const featureAdjustment = hasEfficiencyFeatures ? 5 : 0;

  // Calculate final score
  const finalScore = baseScore + ageAdjustment + categoryAdjustment + featureAdjustment;

  // Ensure score is within 0-100 range
  return Math.min(100, Math.max(0, finalScore));
};

// Component for car picker modal
const CarPickerModal = ({
  visible,
  onClose,
  cars,
  onSelect,
  selectedCars,
  isDarkMode,
  position
}: {
  visible: boolean;
  onClose: () => void;
  cars: Car[];
  onSelect: (car: Car, position: 'left' | 'right') => void;
  selectedCars: [Car | null, Car | null];
  isDarkMode: boolean;
  position: 'left' | 'right';
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('make');
  const sortOptions = [
    { value: 'make', label: 'Make' },
    { value: 'price_asc', label: 'Price (Low to High)' },
    { value: 'price_desc', label: 'Price (High to Low)' },
    { value: 'year_desc', label: 'Year (Newest First)' },
    { value: 'year_asc', label: 'Year (Oldest First)' },
  ];

  // Filter and sort cars
  const filteredAndSortedCars = useMemo(() => {
    // First filter by search query
    let filtered = cars;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = cars.filter(car =>
        car.make.toLowerCase().includes(query) ||
        car.model.toLowerCase().includes(query) ||
        car.year.toString().includes(query) ||
        car.category?.toLowerCase().includes(query) ||
        car.dealership_name?.toLowerCase().includes(query)
      );
    }

    // Then sort
    return [...filtered].sort((a, b) => {
      switch(sortOption) {
        case 'price_asc':
          return a.price - b.price;
        case 'price_desc':
          return b.price - a.price;
        case 'year_desc':
          return b.year - a.year;
        case 'year_asc':
          return a.year - b.year;
        case 'make':
        default:
          return a.make.localeCompare(b.make);
      }
    });
  }, [cars, searchQuery, sortOption]);



  return (
    <Modal visible={visible} animationType="slide" transparent>
      <BlurView
        style={styles.modalBlurContainer}
        intensity={isDarkMode ? 30 : 20}
        tint={isDarkMode ? 'dark' : 'light'}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <Animated.View
          entering={SlideInDown}
          exiting={SlideOutDown}
          style={[
            styles.modalContent,
            {
              backgroundColor: isDarkMode ? '#121212' : '#ffffff',
              height: '75%',
            }
          ]}
        >
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHandleBar} />

            <Text style={[
              styles.modalTitle,
              { color: isDarkMode ? '#ffffff' : '#000000' }
            ]}>
              Select Car for {position === 'left' ? 'Left' : 'Right'} Position
            </Text>

            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons
                name="close"
                size={24}
                color={isDarkMode ? '#ffffff' : '#000000'}
              />
            </TouchableOpacity>
          </View>

          {/* Search and sort options */}
          <View style={styles.searchSortContainer}>
            <View style={[
              styles.searchInputContainer,
              {
                backgroundColor: isDarkMode ? '#333333' : '#f0f0f0',
                borderColor: isDarkMode ? '#444444' : '#e0e0e0'
              }
            ]}>
              <Ionicons
                name="search"
                size={20}
                color={isDarkMode ? '#bbbbbb' : '#666666'}
              />
              <TextInput
                style={[
                  styles.searchInput,
                  { color: isDarkMode ? '#ffffff' : '#000000' }
                ]}
                placeholder="Search cars..."
                placeholderTextColor={isDarkMode ? '#888888' : '#aaaaaa'}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={isDarkMode ? '#bbbbbb' : '#666666'}
                  />
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.sortContainer}>
              <Text style={[
                styles.sortLabel,
                { color: isDarkMode ? '#bbbbbb' : '#666666' }
              ]}>
                Sort by:
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.sortOptionsContainer}
              >
                {sortOptions.map(option => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.sortOption,
                      sortOption === option.value && styles.sortOptionActive,
                      {
                        backgroundColor: isDarkMode ?
                          (sortOption === option.value ? '#D55004' : '#333333') :
                          (sortOption === option.value ? '#D55004' : '#f0f0f0'),
                      }
                    ]}
                    onPress={() => setSortOption(option.value)}
                  >
                    <Text style={[
                      styles.sortOptionText,
                      {
                        color: sortOption === option.value ?
                          '#ffffff' :
                          (isDarkMode ? '#ffffff' : '#333333')
                      }
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          {/* Car list */}
          {filteredAndSortedCars.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Ionicons
                name="car-sport-outline"
                size={48}
                color={isDarkMode ? '#555555' : '#cccccc'}
              />
              <Text style={[
                styles.emptyStateText,
                { color: isDarkMode ? '#aaaaaa' : '#666666' }
              ]}>
                {searchQuery ?
                  'No cars match your search' :
                  'No favorite cars available to compare'}
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.carList}
              showsVerticalScrollIndicator={false}
            >
              {filteredAndSortedCars.map((car) => {
                // Check if car is already selected in the other position
                const isSelectedInOtherPosition =
                  (position === 'left' && selectedCars[1]?.id === car.id) ||
                  (position === 'right' && selectedCars[0]?.id === car.id);

                return (
                  <TouchableOpacity
                    key={car.id}
                    style={[
                      styles.carItem,
                      {
                        backgroundColor: isDarkMode ? '#1e1e1e' : '#f5f5f5',
                        opacity: isSelectedInOtherPosition ? 0.5 : 1,
                        borderColor: isDarkMode ? '#333333' : '#dddddd',
                      }
                    ]}
                    onPress={() => {
                      if (!isSelectedInOtherPosition) {
                        // Add haptic feedback
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onSelect(car, position);
                        onClose();
                      }
                    }}
                    disabled={isSelectedInOtherPosition}
                  >
                    <Image
                      source={{ uri: car.images[0] }}
                      style={styles.carThumbnail}
                      contentFit="cover"
                    />
                    <View style={styles.carInfo}>
                      <Text style={[
                        styles.carMake,
                        { color: isDarkMode ? '#D55004' : '#D55004' }
                      ]}>
                        {car.make}
                      </Text>
                      <Text style={[
                        styles.carTitle,
                        { color: isDarkMode ? '#ffffff' : '#000000' }
                      ]}>
                        {car.year} {car.model}
                      </Text>
                      <Text style={[
                        styles.carPrice,
                        { color: isDarkMode ? '#ffffff' : '#000000' }
                      ]}>
                        ${car.price.toLocaleString()}
                      </Text>
                      <View style={styles.carMeta}>
                        <Text style={[
                          styles.carMetaItem,
                          { color: isDarkMode ? '#bbbbbb' : '#666666' }
                        ]}>
                          <Ionicons name="speedometer-outline" size={12} color={isDarkMode ? '#bbbbbb' : '#666666'} /> {car.mileage.toLocaleString()} km
                        </Text>
                        <Text style={[
                          styles.carMetaItem,
                          { color: isDarkMode ? '#bbbbbb' : '#666666' }
                        ]}>
                          <Ionicons name="cog-outline" size={12} color={isDarkMode ? '#bbbbbb' : '#666666'} /> {car.transmission}
                        </Text>
                      </View>

                      {/* Feature count badge */}
                      <View style={[
                        styles.featureCountBadge,
                        { backgroundColor: isDarkMode ? '#333333' : '#eeeeee' }
                      ]}>
                        <MaterialCommunityIcons
                          name="feature-search"
                          size={12}
                          color={isDarkMode ? '#bbbbbb' : '#666666'}
                        />
                        <Text style={[
                          styles.featureCountText,
                          { color: isDarkMode ? '#bbbbbb' : '#666666' }
                        ]}>
                          {car.features?.length || 0} features
                        </Text>
                      </View>
                    </View>
                    {
                      isSelectedInOtherPosition && (
                        <View style={styles.alreadySelectedBadge}>
                          <Text style={styles.alreadySelectedText}>Already Selected</Text>
                        </View>
                      )
                    }
                  </TouchableOpacity>
                );
              })}
              <View style={{ height: 50 }} />
            </ScrollView>
          )}
        </Animated.View>
      </BlurView>
    </Modal>
  );
};

// Custom Modal component
const Modal = ({
  visible,
  children,
  animationType = 'fade',
  transparent = true,
}: {
  visible: boolean;
  children: React.ReactNode;
  animationType?: 'fade' | 'slide';
  transparent?: boolean;
}) => {
  if (!visible) return null;

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        { zIndex: 1000 }
      ]}
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(300)}
    >
      {children}
    </Animated.View>
  );
};

// Enhanced comparison attribute component with progress indicators
const ComparisonAttribute = ({
  label,
  value1,
  value2,
  better,
  isDarkMode,
  icon,
  prefix = "",
  suffix = "",
  showBar = false,
  maxValue = 0,
  isHigherBetter = false,
}: {
  label: string;
  value1: any;
  value2: any;
  better: number; // 0 = equal, 1 = left is better, 2 = right is better
  isDarkMode: boolean;
  icon?: string;
  prefix?: string;
  suffix?: string;
  showBar?: boolean;
  maxValue?: number;
  isHigherBetter?: boolean;
}) => {
  // Animation references
  const progressAnim1 = useRef(new RNAnimated.Value(0)).current;
  const progressAnim2 = useRef(new RNAnimated.Value(0)).current;
  const highlightAnim = useRef(new RNAnimated.Value(0)).current;

  // Start animations when component mounts
  useEffect(() => {
    // Only animate if we're showing bars and have a max value
    if (showBar && maxValue > 0) {
      const val1 = typeof value1 === 'number' ? value1 : 0;
      const val2 = typeof value2 === 'number' ? value2 : 0;

      const progress1 = Math.min(1, Math.max(0, val1 / maxValue));
      const progress2 = Math.min(1, Math.max(0, val2 / maxValue));

      // Animate progress bars
      RNAnimated.timing(progressAnim1, {
        toValue: progress1,
        duration: 1000,
        useNativeDriver: false,

      }).start();

      RNAnimated.timing(progressAnim2, {
        toValue: progress2,
        duration: 1000,
        useNativeDriver: false,

      }).start();
    }

    // Highlight animation for the better value
    if (better > 0) {
      RNAnimated.sequence([
        RNAnimated.timing(highlightAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false
        }),
        RNAnimated.timing(highlightAnim, {
          toValue: 0.7,
          duration: 500,
          useNativeDriver: false
        })
      ]).start();
    }
  }, [value1, value2, maxValue, showBar, better, progressAnim1, progressAnim2, highlightAnim]);

  // Format the value based on type
  const formatValue = (value: any) => {
    if (value === null || value === undefined) return "N/A";
    if (typeof value === 'number') {
      if (label.toLowerCase().includes('price') || label.toLowerCase().includes('cost')) {
        return `${prefix}${value.toLocaleString()}${suffix}`;
      }
      return `${prefix}${value.toLocaleString()}${suffix}`;
    }
    return `${prefix}${value}${suffix}`;
  };

  // Colors for better values
  const getBetterColor = (isBetter: boolean) => {
    if (!isBetter) return isDarkMode ? '#ffffff' : '#000000';
    return isDarkMode ? '#4ADE80' : '#10B981';
  };

  const getBetterBgColor = (isBetter: boolean) => {
    if (!isBetter) return isDarkMode ? '#333333' : '#F5F5F5';
    return isDarkMode ? '#0E3E2D' : '#E6F4F1';
  };

  // Value interpolation for highlight animation
  const getBetterBgColorAnimated = (isBetter: boolean) => {
    if (!isBetter) return isDarkMode ? '#333333' : '#F5F5F5';

    return highlightAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [
        isDarkMode ? '#0E3E2D' : '#E6F4F1',
        isDarkMode ? '#15654A' : '#D1FBF0'
      ]
    });
  };

  

  return (
    <View style={styles.comparisonRow}>
      {/* Attribute label */}
      <View style={styles.attributeLabelContainer}>
        {icon && (
          <MaterialCommunityIcons
            name={icon as any}
            size={18}
            color={isDarkMode ? '#ffffff' : '#000000'}
            style={styles.attributeIcon}
          />
        )}
        <Text style={[
          styles.attributeLabel,
          { color: isDarkMode ? '#ffffff' : '#000000' }
        ]} >
          {label}
        </Text>
      </View>

      {/* Values and indicators */}
      <View style={styles.valuesContainer}>
        {/* Left value */}
        <RNAnimated.View style={[
          styles.valueCell,
          { backgroundColor: better === 1 ? getBetterBgColorAnimated(true) : getBetterBgColor(false) }
        ]}>
          <Text style={[
            styles.valueText,
            { color: getBetterColor(better === 1) }
          ]}>
            {formatValue(value1)}
          </Text>
          {better === 1 && (
            <AntDesign
              name="checkcircle"
              size={16}
              color={isDarkMode ? '#4ADE80' : '#10B981'}
              style={styles.betterIndicator}
            />
          )}

          {/* Progress bar for numeric values */}
          {showBar && typeof value1 === 'number' && maxValue > 0 && (
            <View style={styles.progressBarContainer}>
              <RNAnimated.View
                style={[
                  styles.progressBar,
                  {
                    width: progressAnim1.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%']
                    }),
                    backgroundColor: isHigherBetter ?
                      (better === 1 ? '#4ADE80' : '#60A5FA') :
                      (better === 1 ? '#4ADE80' : '#F87171')
                  }
                ]}
              />
            </View>
          )}
        </RNAnimated.View>

        {/* Right value */}
        <RNAnimated.View style={[
          styles.valueCell,
          { backgroundColor: better === 2 ? getBetterBgColorAnimated(true) : getBetterBgColor(false) }
        ]}>
          <Text style={[
            styles.valueText,
            { color: getBetterColor(better === 2) }
          ]}>
            {formatValue(value2)}
          </Text>
          {better === 2 && (
            <AntDesign
              name="checkcircle"
              size={16}
              color={isDarkMode ? '#4ADE80' : '#10B981'}
              style={styles.betterIndicator}
            />
          )}

          {/* Progress bar for numeric values */}
          {showBar && typeof value2 === 'number' && maxValue > 0 && (
            <View style={styles.progressBarContainer}>
              <RNAnimated.View
                style={[
                  styles.progressBar,
                  {
                    width: progressAnim2.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%']
                    }),
                    backgroundColor: isHigherBetter ?
                      (better === 2 ? '#4ADE80' : '#60A5FA') :
                      (better === 2 ? '#4ADE80' : '#F87171')
                  }
                ]}
              />
            </View>
          )}
        </RNAnimated.View>
      </View>
    </View>
  );
};

// Component for image gallery comparison
const ImageComparisonGallery = ({
  car1,
  car2,
  isDarkMode
}: {
  car1: Car | null;
  car2: Car | null;
  isDarkMode: boolean;
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const maxImages = Math.max(
    car1?.images?.length || 0,
    car2?.images?.length || 0
  );

  

  if (!car1 || !car2 || maxImages === 0) return null;

  return (
    <View style={styles.imageGalleryContainer}>
      <Text style={[
        styles.galleryTitle,
        { color: isDarkMode ? '#ffffff' : '#000000' }
      ]}>
        Visual Comparison
      </Text>

      <View style={styles.imagesContainer}>
        {/* Left car image */}
        <View style={styles.singleImageContainer}>
          {car1.images && car1.images.length > currentImageIndex ? (
            <Image
              source={{ uri: car1.images[currentImageIndex] }}
              style={styles.comparisonImage}
              contentFit="cover"
            />
          ) : (
            <View style={[
              styles.noImagePlaceholder,
              { backgroundColor: isDarkMode ? '#333333' : '#f0f0f0' }
            ]}>
              <Ionicons
                name="image-outline"
                size={40}
                color={isDarkMode ? '#666666' : '#cccccc'}
              />
              <Text style={{ color: isDarkMode ? '#666666' : '#cccccc' }}>
                No image
              </Text>
            </View>
          )}
          <Text style={[
            styles.imageCarLabel,
            { color: isDarkMode ? '#ffffff' : '#000000' }
          ]}>
            {car1.year} {car1.make} {car1.model}
          </Text>
        </View>

        {/* Right car image */}
        <View style={styles.singleImageContainer}>
          {car2.images && car2.images.length > currentImageIndex ? (
            <Image
              source={{ uri: car2.images[currentImageIndex] }}
              style={styles.comparisonImage}
              contentFit="cover"
            />
          ) : (
            <View style={[
              styles.noImagePlaceholder,
              { backgroundColor: isDarkMode ? '#333333' : '#f0f0f0' }
            ]}>
              <Ionicons
                name="image-outline"
                size={40}
                color={isDarkMode ? '#666666' : '#cccccc'}
              />
              <Text style={{ color: isDarkMode ? '#666666' : '#cccccc' }}>
                No image
              </Text>
            </View>
          )}
          <Text style={[
            styles.imageCarLabel,
            { color: isDarkMode ? '#ffffff' : '#000000' }
          ]}>
            {car2.year} {car2.make} {car2.model}
          </Text>
        </View>
      </View>

      {/* Navigation controls */}
      {maxImages > 1 && (
        <View style={styles.galleryControls}>
          <TouchableOpacity
            style={[
              styles.galleryButton,
              currentImageIndex === 0 && { opacity: 0.5 },
              { backgroundColor: isDarkMode ? '#333333' : '#f0f0f0' }
            ]}
            onPress={() => setCurrentImageIndex(prev => Math.max(0, prev - 1))}
            disabled={currentImageIndex === 0}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={isDarkMode ? '#ffffff' : '#000000'}
            />
          </TouchableOpacity>

          <Text style={[
            styles.galleryCounter,
            { color: isDarkMode ? '#cccccc' : '#666666' }
          ]}>
            {currentImageIndex + 1} / {maxImages}
          </Text>

          <TouchableOpacity
            style={[
              styles.galleryButton,
              currentImageIndex === maxImages - 1 && { opacity: 0.5 },
              { backgroundColor: isDarkMode ? '#333333' : '#f0f0f0' }
            ]}
            onPress={() => setCurrentImageIndex(prev => Math.min(maxImages - 1, prev + 1))}
            disabled={currentImageIndex === maxImages - 1}
          >
            <Ionicons
              name="chevron-forward"
              size={24}
              color={isDarkMode ? '#ffffff' : '#000000'}
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// Feature comparison component
const FeatureComparison = ({
  car1Features = [],
  car2Features = [],
  isDarkMode,
  filterByCategory,
}: {
  car1Features: string[];
  car2Features: string[];
  isDarkMode: boolean;
  filterByCategory?: string;
}) => {
  // Get all unique features, optionally filtered by category
  const allFeatures = useMemo(() => {
    const featureSet = new Set([...(car1Features || []), ...(car2Features || [])]);

    // Filter by category if specified
    if (filterByCategory) {
      return Array.from(featureSet).filter(feature =>
        FEATURE_METADATA[feature]?.category === filterByCategory
      );
    }

    return Array.from(featureSet);
  }, [car1Features, car2Features, filterByCategory]);

  if (allFeatures.length === 0) {
    return (
      <View style={styles.emptyFeaturesContainer}>
        <Text style={[
          styles.emptyFeaturesText,
          { color: isDarkMode ? '#aaaaaa' : '#666666' }
        ]}>
          {filterByCategory ?
            `No ${filterByCategory} features available for comparison` :
            'No feature information available for comparison'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.featureComparisonContainer}>
      {allFeatures.map((feature) => {
        const hasCar1 = car1Features?.includes(feature);
        const hasCar2 = car2Features?.includes(feature);
        const metadata = FEATURE_METADATA[feature] || {
          label: feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          icon: "car-feature",
          description: "Car feature",
          importance: "medium" as "medium",
          category: "technology" as "technology"
        };

        // Importance-based styling
        const getImportanceStyle = () => {
          switch(metadata.importance) {
            case 'high':
              return {
                borderLeftWidth: 3,
                borderLeftColor: '#F97316', // Orange for high importance
              };
            case 'medium':
              return {
                borderLeftWidth: 2,
                borderLeftColor: '#60A5FA', // Blue for medium importance
              };
            default:
              return {
                borderLeftWidth: 0,
              };
          }
        };

        return (
          <View key={feature} style={[
            styles.featureRow,
            getImportanceStyle(),
            {
              backgroundColor: isDarkMode ?
                (hasCar1 && hasCar2 ? 'rgba(74, 222, 128, 0.1)' : 'transparent') :
                (hasCar1 && hasCar2 ? 'rgba(16, 185, 129, 0.05)' : 'transparent')
            }
          ]}>
            <View style={styles.featureInfo}>
              <MaterialCommunityIcons
                name={metadata.icon as any || "check-circle-outline"}
                size={20}
                color={isDarkMode ? '#ffffff' : '#000000'}
              />
              <View style={styles.featureTextContainer}>
                <Text style={[
                  styles.featureLabel,
                  { color: isDarkMode ? '#ffffff' : '#000000' }
                ]}>
                  {metadata.label}
                  {metadata.importance === 'high' && (
                    <Text style={{ color: '#F97316', fontWeight: 'bold' }}> ★</Text>
                  )}
                </Text>
                <Text style={[
                  styles.featureDescription,
                  { color: isDarkMode ? '#bbbbbb' : '#666666' }
                ]}>
                  {metadata.description}
                </Text>
              </View>
            </View>

            <View style={styles.featureAvailability}>
              <View style={styles.featureCheckContainer}>
                {hasCar1 ? (
                  <AntDesign name="checkcircle" size={22} color="#4ADE80" />
                ) : (
                  <AntDesign name="closecircle" size={22} color="#EF4444" />
                )}
              </View>

              <View style={styles.featureCheckContainer}>
                {hasCar2 ? (
                  <AntDesign name="checkcircle" size={22} color="#4ADE80" />
                ) : (
                  <AntDesign name="closecircle" size={22} color="#EF4444" />
                )}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
};



// Total cost of ownership component
const TotalCostOfOwnership = ({
  car1,
  car2,
  isDarkMode
}: {
  car1: Car | null;
  car2: Car | null;
  isDarkMode: boolean;
}) => {
  if (!car1 || !car2) return null;

  // Calculate total costs
  const car1Cost = calculateTotalCostOfOwnership(car1);
  const car2Cost = calculateTotalCostOfOwnership(car2);

  // Determine which is better (lower is better)
  const betterCar = car1Cost < car2Cost ? car1 : car2Cost < car1Cost ? car2 : null;
  const costDifference = Math.abs(car1Cost - car2Cost);
  const percentageDifference = ((costDifference / Math.max(car1Cost, car2Cost)) * 100).toFixed(1);

  return (
    <View style={styles.costComparisonContainer}>
      <View style={styles.costHeader}>
        <Text style={[
          styles.costTitle,
          { color: isDarkMode ? '#ffffff' : '#000000' }
        ]}>
          5-Year Ownership Cost Estimate
        </Text>
        <TouchableOpacity style={styles.infoButton}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={isDarkMode ? '#bbbbbb' : '#666666'}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.costCards}>
        {/* Car 1 Cost Card */}
        <View style={[
          styles.costCard,
          car1Cost < car2Cost && styles.betterCostCard,
          {
            backgroundColor: isDarkMode ?
              (car1Cost < car2Cost ? '#0E3E2D' : '#1e1e1e') :
              (car1Cost < car2Cost ? '#E6F4F1' : '#f5f5f5')
          }
        ]}>
          <Text style={[
            styles.costCardTitle,
            { color: isDarkMode ? '#ffffff' : '#000000' }
          ]}>
            {car1.make} {car1.model}
          </Text>
          <Text style={[
            styles.costAmount,
            {
              color: car1Cost < car2Cost ?
                (isDarkMode ? '#4ADE80' : '#10B981') :
                (isDarkMode ? '#ffffff' : '#000000')
            }
          ]}>
            ${car1Cost.toLocaleString()}
          </Text>
          {car1Cost < car2Cost && (
            <View style={styles.savingsBadge}>
              <Text style={styles.savingsText}>
                Save ${costDifference.toLocaleString()}
              </Text>
            </View>
          )}
        </View>

        {/* Car 2 Cost Card */}
        <View style={[
          styles.costCard,
          car2Cost < car1Cost && styles.betterCostCard,
          {
            backgroundColor: isDarkMode ?
              (car2Cost < car1Cost ? '#0E3E2D' : '#1e1e1e') :
              (car2Cost < car1Cost ? '#E6F4F1' : '#f5f5f5')
          }
        ]}>
          <Text style={[
            styles.costCardTitle,
            { color: isDarkMode ? '#ffffff' : '#000000' }
          ]}>
            {car2.make} {car2.model}
          </Text>
          <Text style={[
            styles.costAmount,
            {
              color: car2Cost < car1Cost ?
                (isDarkMode ? '#4ADE80' : '#10B981') :
                (isDarkMode ? '#ffffff' : '#000000')
            }
          ]}>
            ${car2Cost.toLocaleString()}
          </Text>
          {car2Cost < car1Cost && (
            <View style={styles.savingsBadge}>
              <Text style={styles.savingsText}>
                Save ${costDifference.toLocaleString()}
              </Text>
            </View>
          )}
        </View>
      </View>

      {betterCar && (
        <View style={[
          styles.costInsight,
          { backgroundColor: isDarkMode ? '#2D2D3A' : '#F5F5F5' }
        ]}>
          <Text style={[
            styles.costInsightText,
            { color: isDarkMode ? '#bbbbbb' : '#666666' }
          ]}>
            The {betterCar.year} {betterCar.make} {betterCar.model} costs approximately {percentageDifference}% less to own and operate over 5 years, considering depreciation, maintenance, insurance, and fuel costs.
          </Text>
        </View>
      )}

      <Text style={[
        styles.costDisclaimer,
        { color: isDarkMode ? '#999999' : '#888888' }
      ]}>
        * Estimates based on typical ownership patterns and may vary based on driving habits and location.
      </Text>
    </View>
  );
};

// Summary section with enhanced insights and recommendations
const ComparisonSummary = ({
  car1,
  car2,
  isDarkMode
}: {
  car1: Car | null;
  car2: Car | null;
  isDarkMode: boolean;
}) => {
  if (!car1 || !car2) return null;

  // Calculate value scores
  const car1ValueScore = calculateValueScore(car1);
  const car2ValueScore = calculateValueScore(car2);

  // Environmental scores
  const car1EnvScore = calculateEnvironmentalScore(car1);
  const car2EnvScore = calculateEnvironmentalScore(car2);

  // Total cost of ownership
  const car1Cost = calculateTotalCostOfOwnership(car1);
  const car2Cost = calculateTotalCostOfOwnership(car2);

  // Simple scoring system with weights
  let car1Score = 0;
  let car2Score = 0;

  // Price score (20%)
  if (car1.price < car2.price) car1Score += 20;
  else if (car2.price < car1.price) car2Score += 20;

  // Value score (25%)
  if (car1ValueScore > car2ValueScore) car1Score += 25;
  else if (car2ValueScore > car1ValueScore) car2Score += 25;

  // Total cost score (20%)
  if (car1Cost < car2Cost) car1Score += 20;
  else if (car2Cost < car1Cost) car2Score += 20;

  // Features score (15%)
  const car1FeatureCount = car1.features?.length || 0;
  const car2FeatureCount = car2.features?.length || 0;
  if (car1FeatureCount > car2FeatureCount) car1Score += 15;
  else if (car2FeatureCount > car1FeatureCount) car2Score += 15;

  // Safety score (20%)
  const car1SafetyCount = car1.features?.filter(f => FEATURE_METADATA[f]?.category === 'safety').length || 0;
  const car2SafetyCount = car2.features?.filter(f => FEATURE_METADATA[f]?.category === 'safety').length || 0;
  if (car1SafetyCount > car2SafetyCount) car1Score += 20;
  else if (car2SafetyCount > car1SafetyCount) car2Score += 20;

  // Determine the recommended car based on overall score
  let recommendedCar = car1Score > car2Score ? car1 : car2Score > car1Score ? car2 : null;
  const recommendedCarScore = Math.max(car1Score, car2Score);
  const nonRecommendedCarScore = Math.min(car1Score, car2Score);
  const scoreDifference = recommendedCarScore - nonRecommendedCarScore;

  // Confidence level based on score difference
  let confidenceLevel = "moderate";
  if (scoreDifference > 30) confidenceLevel = "high";
  else if (scoreDifference < 15) confidenceLevel = "slight";

  // Generate pros and cons for each car
  const generateProsAndCons = (car: Car, otherCar: Car) => {
    const pros = [];
    const cons = [];

    // Price comparison
    if (car.price < otherCar.price) {
      pros.push("Lower purchase price");
    } else if (car.price > otherCar.price) {
      cons.push("Higher purchase price");
    }

    // Year comparison
    if (car.year > otherCar.year) {
      pros.push("Newer model year");
    } else if (car.year < otherCar.year) {
      cons.push("Older model year");
    }

    // Mileage comparison
    if (car.mileage < otherCar.mileage) {
      pros.push("Lower mileage");
    } else if (car.mileage > otherCar.mileage) {
      cons.push("Higher mileage");
    }

    // Feature count
    const carFeatures = car.features?.length || 0;
    const otherFeatures = otherCar.features?.length || 0;
    if (carFeatures > otherFeatures) {
      pros.push("More features overall");
    } else if (carFeatures < otherFeatures) {
      cons.push("Fewer features overall");
    }

    // Safety features
    const carSafety = car.features?.filter(f => FEATURE_METADATA[f]?.category === 'safety').length || 0;
    const otherSafety = otherCar.features?.filter(f => FEATURE_METADATA[f]?.category === 'safety').length || 0;
    if (carSafety > otherSafety) {
      pros.push("Better safety features");
    } else if (carSafety < otherSafety) {
      cons.push("Fewer safety features");
    }

    // Comfort features
    const carComfort = car.features?.filter(f => FEATURE_METADATA[f]?.category === 'comfort').length || 0;
    const otherComfort = otherCar.features?.filter(f => FEATURE_METADATA[f]?.category === 'comfort').length || 0;
    if (carComfort > otherComfort) {
      pros.push("More comfort features");
    } else if (carComfort < otherComfort) {
      cons.push("Fewer comfort features");
    }

    // Technology features
    const carTech = car.features?.filter(f => FEATURE_METADATA[f]?.category === 'technology').length || 0;
    const otherTech = otherCar.features?.filter(f => FEATURE_METADATA[f]?.category === 'technology').length || 0;
    if (carTech > otherTech) {
      pros.push("More technology features");
    } else if (carTech < otherTech) {
      cons.push("Fewer technology features");
    }

    // Total cost of ownership
    const carCost = calculateTotalCostOfOwnership(car);
    const otherCost = calculateTotalCostOfOwnership(otherCar);
    if (carCost < otherCost) {
      pros.push("Lower cost of ownership");
    } else if (carCost > otherCost) {
      cons.push("Higher cost of ownership");
    }

    // Environmental score
    const carEnv = calculateEnvironmentalScore(car);
    const otherEnv = calculateEnvironmentalScore(otherCar);
    if (carEnv > otherEnv) {
      pros.push("Better environmental score");
    } else if (carEnv < otherEnv) {
      cons.push("Lower environmental score");
    }

    return { pros, cons };
  };

  const car1ProsAndCons = generateProsAndCons(car1, car2);
  const car2ProsAndCons = generateProsAndCons(car2, car1);

  // Determine use cases where each car excels
  const determineUseCases = () => {
    const car1Cases = [];
    const car2Cases = [];

    // Urban driving
    if (car1.category === 'Hatchback' || car1.category === 'Sedan') {
      car1Cases.push("Urban driving");
    }
    if (car2.category === 'Hatchback' || car2.category === 'Sedan') {
      car2Cases.push("Urban driving");
    }

    // Off-road capability
    if (car1.drivetrain === '4WD' || car1.drivetrain === '4x4' || car1.category === 'SUV' || car1.category === 'Truck') {
      car1Cases.push("Off-road driving");
    }
    if (car2.drivetrain === '4WD' || car2.drivetrain === '4x4' || car2.category === 'SUV' || car2.category === 'Truck') {
      car2Cases.push("Off-road driving");
    }

    // Family use
    const car1ThirdRow = car1.features?.includes('third_row_seats') || false;
    const car2ThirdRow = car2.features?.includes('third_row_seats') || false;
    if (car1.category === 'SUV' || car1.category === 'Minivan' || car1ThirdRow) {
      car1Cases.push("Family trips");
    }
    if (car2.category === 'SUV' || car2.category === 'Minivan' || car2ThirdRow) {
      car2Cases.push("Family trips");
    }

    // Luxury/comfort
    const car1ComfortFeatures = car1.features?.filter(f => FEATURE_METADATA[f]?.category === 'comfort').length || 0;
    const car2ComfortFeatures = car2.features?.filter(f => FEATURE_METADATA[f]?.category === 'comfort').length || 0;
    if (car1ComfortFeatures >= 3) {
      car1Cases.push("Comfortable commuting");
    }
    if (car2ComfortFeatures >= 3) {
      car2Cases.push("Comfortable commuting");
    }

    // Tech enthusiasts
    const car1TechFeatures = car1.features?.filter(f => FEATURE_METADATA[f]?.category === 'technology').length || 0;
    const car2TechFeatures = car2.features?.filter(f => FEATURE_METADATA[f]?.category === 'technology').length || 0;
    if (car1TechFeatures >= 3) {
      car1Cases.push("Tech enthusiasts");
    }
    if (car2TechFeatures >= 3) {
      car2Cases.push("Tech enthusiasts");
    }

    // Economy/budget
    if (car1.price < car2.price && calculateTotalCostOfOwnership(car1) < calculateTotalCostOfOwnership(car2)) {
      car1Cases.push("Budget-conscious buyers");
    }
    if (car2.price < car1.price && calculateTotalCostOfOwnership(car2) < calculateTotalCostOfOwnership(car1)) {
      car2Cases.push("Budget-conscious buyers");
    }

    // Long trips
    if (car1.type === 'Diesel' || car1.type === 'Hybrid' || car1.type === 'Electric') {
      car1Cases.push("Long distance travel");
    }
    if (car2.type === 'Diesel' || car2.type === 'Hybrid' || car2.type === 'Electric') {
      car2Cases.push("Long distance travel");
    }

    return { car1: car1Cases, car2: car2Cases };
  };

  const useCases = determineUseCases();

  return (
    <View style={styles.summaryContainer}>
      <Text style={[
        styles.summaryTitle,
        { color: isDarkMode ? '#ffffff' : '#000000' }
      ]}>
        Comparison Summary
      </Text>

      <View style={styles.summaryContent}>
        {/* Overall recommendation */}
        {recommendedCar ? (
          <View style={[
            styles.recommendationBox,
            { backgroundColor: isDarkMode ? '#0E3E2D' : '#E6F4F1' }
          ]}>
            <Text style={[
              styles.recommendationTitle,
              { color: isDarkMode ? '#4ADE80' : '#10B981' }
            ]}>
              Recommended Choice
            </Text>
            <Text style={[
              styles.recommendedCarName,
              { color: isDarkMode ? '#ffffff' : '#000000' }
            ]}>
              {recommendedCar.year} {recommendedCar.make} {recommendedCar.model}
            </Text>
            <Text style={[
              styles.recommendationReason,
              { color: isDarkMode ? '#bbbbbb' : '#666666' }
            ]}>
              With a {confidenceLevel} level of confidence, this vehicle scores better across key metrics including {
                [
                  recommendedCar === car1 && car1.price < car2.price ? 'price' : null,
                  recommendedCar === car1 && car1ValueScore > car2ValueScore ? 'value' : null,
                  recommendedCar === car1 && car1Cost < car2Cost ? 'cost of ownership' : null,
                  recommendedCar === car1 && car1FeatureCount > car2FeatureCount ? 'features' : null,
                  recommendedCar === car1 && car1SafetyCount > car2SafetyCount ? 'safety' : null,
                  recommendedCar === car2 && car2.price < car1.price ? 'price' : null,
                  recommendedCar === car2 && car2ValueScore > car1ValueScore ? 'value' : null,
                  recommendedCar === car2 && car2Cost < car1Cost ? 'cost of ownership' : null,
                  recommendedCar === car2 && car2FeatureCount > car1FeatureCount ? 'features' : null,
                  recommendedCar === car2 && car2SafetyCount > car1SafetyCount ? 'safety' : null,
                ].filter(Boolean).join(', ')
              }.
            </Text>
          </View>
        ) : (
          <View style={[
            styles.recommendationBox,
            { backgroundColor: isDarkMode ? '#2D2D3A' : '#F5F5F5' }
          ]}>
            <Text style={[
              styles.recommendationTitle,
              { color: isDarkMode ? '#ffffff' : '#000000' }
            ]}>
              Evenly Matched
            </Text>
            <Text style={[
              styles.recommendationReason,
              { color: isDarkMode ? '#bbbbbb' : '#666666' }
            ]}>
              Both vehicles have comparable pros and cons. Consider your specific needs and preferences, or review the detailed insights below to make your decision.
            </Text>
          </View>
        )}

        {/* Pros and Cons section */}
        <View style={styles.prosConsContainer}>
          <Text style={[
            styles.prosConsTitle,
            { color: isDarkMode ? '#ffffff' : '#000000' }
          ]}>
            Pros & Cons Comparison
          </Text>

          <View style={styles.prosConsRow}>
            {/* Car 1 Pros & Cons */}
            <View style={[
              styles.prosConsCard,
              { backgroundColor: isDarkMode ? '#1e1e1e' : '#f5f5f5' }
            ]}>
              <Text style={[
                styles.prosConsCardTitle,
                { color: isDarkMode ? '#ffffff' : '#000000' }
              ]}>
                {car1.make} {car1.model}
              </Text>

              {/* Pros */}
              <View style={styles.prosSection}>
                <Text style={[
                  styles.proTitle,
                  { color: isDarkMode ? '#4ADE80' : '#10B981' }
                ]}>
                  Pros:
                </Text>
                {car1ProsAndCons.pros.length > 0 ? (
                  car1ProsAndCons.pros.map((pro, index) => (
                    <View key={`pro-${index}`} style={styles.proConItem}>
                      <AntDesign
                        name="plus"
                        size={12}
                        color={isDarkMode ? '#4ADE80' : '#10B981'}
                        style={styles.proConIcon}
                      />
                      <Text style={[
                        styles.proConText,
                        { color: isDarkMode ? '#bbbbbb' : '#666666' }
                      ]}>
                        {pro}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={[
                    styles.noProsCons,
                    { color: isDarkMode ? '#bbbbbb' : '#666666' }
                  ]}>
                    No significant advantages detected
                  </Text>
                )}
              </View>

              {/* Cons */}
              <View style={styles.consSection}>
                <Text style={[
                  styles.conTitle,
                  { color: isDarkMode ? '#F87171' : '#EF4444' }
                ]}>
                  Cons:
                </Text>
                {car1ProsAndCons.cons.length > 0 ? (
                  car1ProsAndCons.cons.map((con, index) => (
                    <View key={`con-${index}`} style={styles.proConItem}>
                      <AntDesign
                        name="minus"
                        size={12}
                        color={isDarkMode ? '#F87171' : '#EF4444'}
                        style={styles.proConIcon}
                      />
                      <Text style={[
                        styles.proConText,
                        { color: isDarkMode ? '#bbbbbb' : '#666666' }
                      ]}>
                        {con}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={[
                    styles.noProsCons,
                    { color: isDarkMode ? '#bbbbbb' : '#666666' }
                  ]}>
                    No significant disadvantages detected
                  </Text>
                )}
              </View>
            </View>

            {/* Car 2 Pros & Cons */}
            <View style={[
              styles.prosConsCard,
              { backgroundColor: isDarkMode ? '#1e1e1e' : '#f5f5f5' }
            ]}>
              <Text style={[
                styles.prosConsCardTitle,
                { color: isDarkMode ? '#ffffff' : '#000000' }
              ]}>
                {car2.make} {car2.model}
              </Text>

              {/* Pros */}
              <View style={styles.prosSection}>
                <Text style={[
                  styles.proTitle,
                  { color: isDarkMode ? '#4ADE80' : '#10B981' }
                ]}>
                  Pros:
                </Text>
                {car2ProsAndCons.pros.length > 0 ? (
                  car2ProsAndCons.pros.map((pro, index) => (
                    <View key={`pro-${index}`} style={styles.proConItem}>
                      <AntDesign
                        name="plus"
                        size={12}
                        color={isDarkMode ? '#4ADE80' : '#10B981'}
                        style={styles.proConIcon}
                      />
                      <Text style={[
                        styles.proConText,
                        { color: isDarkMode ? '#bbbbbb' : '#666666' }
                      ]}>
                        {pro}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={[
                    styles.noProsCons,
                    { color: isDarkMode ? '#bbbbbb' : '#666666' }
                  ]}>
                    No significant advantages detected
                  </Text>
                )}
              </View>

              {/* Cons */}
              <View style={styles.consSection}>
                <Text style={[
                  styles.conTitle,
                  { color: isDarkMode ? '#F87171' : '#EF4444' }
                ]}>
                  Cons:
                </Text>
                {car2ProsAndCons.cons.length > 0 ? (
                  car2ProsAndCons.cons.map((con, index) => (
                    <View key={`con-${index}`} style={styles.proConItem}>
                      <AntDesign
                        name="minus"
                        size={12}
                        color={isDarkMode ? '#F87171' : '#EF4444'}
                        style={styles.proConIcon}
                      />
                      <Text style={[
                        styles.proConText,
                        { color: isDarkMode ? '#bbbbbb' : '#666666' }
                      ]}>
                        {con}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={[
                    styles.noProsCons,
                    { color: isDarkMode ? '#bbbbbb' : '#666666' }
                  ]}>
                    No significant disadvantages detected
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Use cases section */}
        <View style={[
          styles.useCasesContainer,
          { backgroundColor: isDarkMode ? '#2C2B56' : '#EEEDF8' }
        ]}>
          <Text style={[
            styles.useCasesTitle,
            { color: isDarkMode ? '#A5B4FC' : '#4F46E5' }
          ]}>
            Best Use Cases
          </Text>

          <View style={styles.useCasesContent}>
            {/* Car 1 Use Cases */}
            <View style={styles.useCaseColumn}>
              <Text style={[
                styles.useCaseCarName,
                { color: isDarkMode ? '#ffffff' : '#000000' }
              ]}>
                {car1.make} {car1.model}
              </Text>

              {useCases.car1.length > 0 ? (
                useCases.car1.map((useCase, index) => (
                  <View key={`use1-${index}`} style={styles.useCaseItem}>
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={isDarkMode ? '#A5B4FC' : '#4F46E5'}
                      style={styles.useCaseIcon}
                    />
                    <Text style={[
                      styles.useCaseText,
                      { color: isDarkMode ? '#bbbbbb' : '#666666' }
                    ]}>
                      {useCase}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={[
                  styles.noUseCases,
                  { color: isDarkMode ? '#bbbbbb' : '#666666' }
                ]}>
                  No specific use cases identified
                </Text>
              )}
            </View>

            {/* Car 2 Use Cases */}
            <View style={styles.useCaseColumn}>
              <Text style={[
                styles.useCaseCarName,
                { color: isDarkMode ? '#ffffff' : '#000000' }
              ]}>
                {car2.make} {car2.model}
              </Text>

              {useCases.car2.length > 0 ? (
                useCases.car2.map((useCase, index) => (
                  <View key={`use2-${index}`} style={styles.useCaseItem}>
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={isDarkMode ? '#A5B4FC' : '#4F46E5'}
                      style={styles.useCaseIcon}
                    />
                    <Text style={[
                      styles.useCaseText,
                      { color: isDarkMode ? '#bbbbbb' : '#666666' }
                    ]}>
                      {useCase}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={[
                  styles.noUseCases,
                  { color: isDarkMode ? '#bbbbbb' : '#666666' }
                ]}>
                  No specific use cases identified
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Value insight */}
        <View style={[
          styles.insightBox,
          { backgroundColor: isDarkMode ? '#2E2842' : '#F5F0FF' }
        ]}>
          <Ionicons name="analytics-outline" size={20} color={isDarkMode ? '#C084FC' : '#8B5CF6'} />
          <Text style={[
            styles.insightTitle,
            { color: isDarkMode ? '#C084FC' : '#8B5CF6' }
          ]}>
            Value Score
          </Text>
          <Text style={[
            styles.insightText,
            { color: isDarkMode ? '#bbbbbb' : '#666666' }
          ]}>
            {car1ValueScore > car2ValueScore ?
              `The ${car1.year} ${car1.make} ${car1.model} offers better overall value with a score of ${Math.round(car1ValueScore)}/100 compared to ${Math.round(car2ValueScore)}/100 for the ${car2.make}.` :
              car2ValueScore > car1ValueScore ?
              `The ${car2.year} ${car2.make} ${car2.model} offers better overall value with a score of ${Math.round(car2ValueScore)}/100 compared to ${Math.round(car1ValueScore)}/100 for the ${car1.make}.` :
              `Both vehicles offer similar value with scores of ${Math.round(car1ValueScore)}/100.`
            }
          </Text>
        </View>

        {/* Environmental impact */}
        <View style={[
          styles.insightBox,
          { backgroundColor: isDarkMode ? '#0E3E2D' : '#E6F4F1' }
        ]}>
          <Ionicons name="leaf-outline" size={20} color={isDarkMode ? '#4ADE80' : '#10B981'} />
          <Text style={[
            styles.insightTitle,
            { color: isDarkMode ? '#4ADE80' : '#10B981' }
          ]}>
            Environmental Impact
          </Text>
          <Text style={[
            styles.insightText,
            { color: isDarkMode ? '#bbbbbb' : '#666666' }
          ]}>
            {car1EnvScore > car2EnvScore ?
              `The ${car1.year} ${car1.make} ${car1.model} has a better environmental score (${Math.round(car1EnvScore)}/100) based on fuel type, age, and vehicle category.` :
              car2EnvScore > car1EnvScore ?
              `The ${car2.year} ${car2.make} ${car2.model} has a better environmental score (${Math.round(car2EnvScore)}/100) based on fuel type, age, and vehicle category.` :
              `Both vehicles have similar environmental scores of ${Math.round(car1EnvScore)}/100.`
            }
          </Text>
        </View>
      </View>
    </View>
  );
};

const TextInput = ({ style, ...props }:any) => (
  <RNTextInput
    style={[styles.textInput, style]}
    placeholderTextColor="#999999"
    {...props}
  />
);

// Complete ShareButton component
const ShareButton = ({
  car1,
  car2,
  isDarkMode
}: {
  car1: Car | null;
  car2: Car | null;
  isDarkMode: boolean;
}) => {
  const handleShare = async () => {
    if (!car1 || !car2) return;

    try {
      // Provide haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Create share content
      const title = `Car Comparison: ${car1.make} ${car1.model} vs ${car2.make} ${car2.model}`;
      const message = `I'm comparing a ${car1.year} ${car1.make} ${car1.model} ($${car1.price.toLocaleString()}) with a ${car2.year} ${car2.make} ${car2.model} ($${car2.price.toLocaleString()}) using Fleet app.`;

      const url = `fleet://comparison?car1Id=${car1.id}&car2Id=${car2.id}`;

      // Show share dialog
      const result = await Share.share(
        {
          title,
          message: message + '\n\n' + url,
          url: url
        },
        {
          dialogTitle: 'Share Car Comparison',
          subject: title
        }
      );

      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          console.log(`Shared via ${result.activityType}`);
        } else {
          console.log('Shared successfully');
        }
      } else if (result.action === Share.dismissedAction) {
        console.log('Share dismissed');
      }
    } catch (error) {
      console.error('Error sharing comparison:', error);
      Alert.alert('Error', 'Unable to share this comparison');
    }
  };

  return (
    <View style={styles.shareButtonContainer}>
      <TouchableOpacity
        style={styles.shareButton}
        onPress={handleShare}
        disabled={!car1 || !car2}
      >
        <Ionicons name="share-outline" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );
};

// Value comparison chart component
const ValueComparisonChart = ({
  car1,
  car2,
  isDarkMode
}: {
  car1: Car | null;
  car2: Car | null;
  isDarkMode: boolean;
}) => {
  if (!car1 || !car2) return null;

  // Define metrics to compare
  const metrics = [
    {
      label: 'Value Score',
      car1Value: calculateValueScore(car1),
      car2Value: calculateValueScore(car2),
      maxValue: 100,
      higherIsBetter: true,
    },
    {
      label: 'Env. Score',
      car1Value: calculateEnvironmentalScore(car1),
      car2Value: calculateEnvironmentalScore(car2),
      maxValue: 100,
      higherIsBetter: true,
    },
    {
      label: 'Features',
      car1Value: car1.features?.length || 0,
      car2Value: car2.features?.length || 0,
      maxValue: 20,
      higherIsBetter: true,
    },
    {
      label: 'Price Ratio',
      car1Value: (car1.features?.length || 1) / (car1.price / 10000),
      car2Value: (car2.features?.length || 1) / (car2.price / 10000),
      maxValue: 5,
      higherIsBetter: true,
    },
    {
      label: '5-Yr Cost',
      car1Value: calculateTotalCostOfOwnership(car1) / 10000,
      car2Value: calculateTotalCostOfOwnership(car2) / 10000,
      maxValue: 10,
      higherIsBetter: false,
    },
  ];

  return (
    <View style={[
      styles.valueChartContainer,
      { backgroundColor: isDarkMode ? '#1A1A1A' : '#F5F5F5' }
    ]}>
      <Text style={[
        styles.valueChartTitle,
        { color: isDarkMode ? '#ffffff' : '#000000' }
      ]}>
        Value Comparison Matrix
      </Text>

      <View style={styles.valueMetricsContainer}>
        {metrics.map((metric, index) => {
          // Calculate width percentage for each bar (max 90% of container width)
          const maxBarWidth = 90; // percentage
          const car1BarWidth = Math.min(maxBarWidth, (metric.car1Value / metric.maxValue) * maxBarWidth);
          const car2BarWidth = Math.min(maxBarWidth, (metric.car2Value / metric.maxValue) * maxBarWidth);

          // Determine which value is better
          const car1IsBetter = metric.higherIsBetter ?
            (metric.car1Value > metric.car2Value) :
            (metric.car1Value < metric.car2Value);
          const car2IsBetter = metric.higherIsBetter ?
            (metric.car2Value > metric.car1Value) :
            (metric.car2Value < metric.car1Value);

          // Calculate formatted values
          const car1FormattedValue = metric.label === '5-Yr Cost' ?
            `$${Math.round(metric.car1Value * 10000).toLocaleString()}` :
            metric.label === 'Price Ratio' ?
              metric.car1Value.toFixed(1) :
              Math.round(metric.car1Value);

          const car2FormattedValue = metric.label === '5-Yr Cost' ?
            `$${Math.round(metric.car2Value * 10000).toLocaleString()}` :
            metric.label === 'Price Ratio' ?
              metric.car2Value.toFixed(1) :
              Math.round(metric.car2Value);

          return (
            <View key={`metric-${index}`} style={styles.valueMetricRow}>
              <Text style={[
                styles.valueMetricLabel,
                { color: isDarkMode ? '#ffffff' : '#000000' }
              ]}>
                {metric.label}
              </Text>

              <View style={styles.valueMetricBars}>
                {/* Car 1 bar */}
                <View style={[
                  styles.valueBar1,
                  {
                    width: `${car1BarWidth}%`,
                    backgroundColor: car1IsBetter ? '#FF6B00' : '#FF9D4D',
                    borderTopRightRadius: 0,
                    borderBottomRightRadius: 0,
                  }
                ]}>
                  <Text style={[
                    styles.valueScoreText,
                    styles.valueScore1
                  ]}>
                    {car1FormattedValue}
                  </Text>
                </View>

                {/* Car 2 bar */}
                <View style={[
                  styles.valueBar2,
                  {
                    width: `${car2BarWidth}%`,
                    backgroundColor: car2IsBetter ? '#60A5FA' : '#93C5FD',
                    borderTopLeftRadius: 0,
                    borderBottomLeftRadius: 0,
                  }
                ]}>
                  <Text style={[
                    styles.valueScoreText,
                    styles.valueScore2
                  ]}>
                    {car2FormattedValue}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.valueChartLegend}>
        <View style={styles.legendItem}>
          <View style={[
            styles.legendColor,
            { backgroundColor: '#FF6B00' }
          ]} />
          <Text style={[
            styles.legendText,
            { color: isDarkMode ? '#bbbbbb' : '#666666' }
          ]}>
            {car1.make} {car1.model}
          </Text>
        </View>

        <View style={styles.legendItem}>
          <View style={[
            styles.legendColor,
            { backgroundColor: '#60A5FA' }
          ]} />
          <Text style={[
            styles.legendText,
            { color: isDarkMode ? '#bbbbbb' : '#666666' }
          ]}>
            {car2.make} {car2.model}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default function CarComparison() {
  const { isDarkMode } = useTheme();
  const { favorites, isFavorite } = useFavorites();
  const { user } = useAuth();
  const { isGuest } = useGuestUser();
  const router = useRouter();
  const params = useLocalSearchParams<{ car1Id?: string; car2Id?: string }>();

  // State for selected cars
  const [selectedCars, setSelectedCars] = useState<[Car | null, Car | null]>([null, null]);
  const [favoriteCars, setFavoriteCars] = useState<Car[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerPosition, setPickerPosition] = useState<'left' | 'right'>('left');

  // State for active tab
  const [activeTab, setActiveTab] = useState<'basics' | 'features' | 'cost' | 'summary'>('basics');

  // Animations
  const headerOpacity = useSharedValue(1);
  const scrollY = useSharedValue(0);

  // Animated scroll handler
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      if (event.contentOffset.y > 50) {
        headerOpacity.value = withTiming(0, { duration: 200, easing: Easing.ease });
      } else {
        headerOpacity.value = withTiming(1, { duration: 200, easing: Easing.ease });
      }
    }
  });

  // Fetch favorite cars
  useEffect(() => {
    const fetchFavoriteCars = async () => {
      if ((!user && !isGuest) || favorites.length === 0) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('cars')
          .select(`
            *,
            dealerships (
              name,
              logo,
              phone,
              location,
              latitude,
              longitude
            )
          `)
          .eq('status', 'available')
          .in('id', favorites);

        if (error) throw error;

        // Process data and filter out null/unavailable cars
        const availableCars = (data || [])
          .filter(item => item && item.status === 'available')
          .map(item => ({
            ...item,
            dealership_name: item.dealerships?.name,
            dealership_logo: item.dealerships?.logo,
            dealership_phone: item.dealerships?.phone,
            dealership_location: item.dealerships?.location,
            dealership_latitude: item.dealerships?.latitude,
            dealership_longitude: item.dealerships?.longitude
          }));

        setFavoriteCars(availableCars);

        // Check if we need to preselect cars from URL params
        if (params.car1Id) {
          const car1 = availableCars.find(car => car.id.toString() === params.car1Id);
          if (car1) {
            setSelectedCars(prev => [car1, prev[1]]);
          }
        }

        if (params.car2Id) {
          const car2 = availableCars.find(car => car.id.toString() === params.car2Id);
          if (car2) {
            setSelectedCars(prev => [prev[0], car2]);
          }
        }
      } catch (error) {
        console.error('Error fetching favorite cars:', error);
        Alert.alert('Error', 'Failed to fetch your favorite cars');
      } finally {
        setIsLoading(false);
      }
    };

    fetchFavoriteCars();
  }, [user, favorites, params.car1Id, params.car2Id]);

  // Select car handler
  const handleSelectCar = useCallback((car: Car, position: 'left' | 'right') => {
    setSelectedCars(prev => {
      // Provide haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (position === 'left') {
        return [car, prev[1]];
      } else {
        return [prev[0], car];
      }
    });
  }, []);

const CustomHeader = React.memo(
  ({ title, onBack }: { title: string; onBack?: () => void }) => {
    const { isDarkMode } = useTheme();

    return (
      <SafeAreaView
        className={`bg-${isDarkMode ? "black" : "white"}`}
      >
        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
        <View className={`flex-row items-center ml-2  ${Platform.OS === "ios" ? "" : "mb-7"}`}>
          {onBack && (
            <Pressable onPress={onBack} className="p-2">
              <ChevronLeft
                size={24}
                className={isDarkMode ? "text-white" : "text-black"}
              />
            </Pressable>
          )}
          <Text
            className={`text-2xl ${
              isDarkMode ? "text-white" : "text-black"
            } font-bold ml-2`}
          >
            {title}
          </Text>
        </View>
      </SafeAreaView>
    );
  }
);

  // Clear car handler
  const handleClearCar = useCallback((position: 'left' | 'right') => {
    setSelectedCars(prev => {
      // Provide haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (position === 'left') {
        return [null, prev[1]];
      } else {
        return [prev[0], null];
      }
    });
  }, []);

  // Open car picker modal
  const openCarPicker = useCallback((position: 'left' | 'right') => {
    setPickerPosition(position);
    setPickerVisible(true);

    // Provide haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Animated header style
  const headerAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: headerOpacity.value,
      transform: [
        { translateY: headerOpacity.value * 0 - (1 - headerOpacity.value) * 100 }
      ]
    };
  });

  // Calculate if comparison is possible
  const canCompare = useMemo(() => {
    return favoriteCars.length >= 2;
  }, [favoriteCars]);

  // Change tab with haptic feedback
  const handleTabChange = useCallback((tab: 'basics' | 'features' | 'cost' | 'summary') => {
    setActiveTab(tab);

    // Provide haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Generate comparison data
  const comparisonData = useMemo(() => {
    if (!selectedCars[0] || !selectedCars[1]) return [];

    const car1 = selectedCars[0];
    const car2 = selectedCars[1];

    return [
      {
        label: 'Price',
        value1: car1.price,
        value2: car2.price,
        better: getBetterValue('price', car1.price, car2.price),
        icon: 'currency-usd',
        prefix: '$',
        showBar: true,
        maxValue: Math.max(car1.price, car2.price) * 1.1,
        isHigherBetter: false,
      },
      {
        label: 'Year',
        value1: car1.year,
        value2: car2.year,
        better: getBetterValue('year', car1.year, car2.year),
        icon: 'calendar-blank',
        showBar: true,
        maxValue: Math.max(car1.year, car2.year),
        isHigherBetter: true,
      },
      {
        label: 'Mileage',
        value1: car1.mileage,
        value2: car2.mileage,
        better: getBetterValue('mileage', car1.mileage, car2.mileage),
        icon: 'speedometer',
        suffix: ' km',
        showBar: true,
        maxValue: Math.max(car1.mileage, car2.mileage) * 1.1,
        isHigherBetter: false,
      },
      {
        label: 'Condition',
        value1: car1.condition,
        value2: car2.condition,
        better: 0, // Subjective, no better value
        icon: 'car-info'
      },
      {
        label: 'Trans',
        value1: car1.transmission,
        value2: car2.transmission,
        better: 0, // Preference-based
        icon: 'car-shift-pattern'
      },
      {
        label: 'Color',
        value1: car1.color,
        value2: car2.color,
        better: 0, // Subjective
        icon: 'palette'
      },
      {
        label: 'Drivetrain',
        value1: car1.drivetrain,
        value2: car2.drivetrain,
        better: 0, // Depends on needs
        icon: 'car-traction-control'
      },
      {
        label: 'Fuel Type',
        value1: car1.type,
        value2: car2.type,
        better: 0, // Depends on preference
        icon: 'gas-station'
      },
      {
        label: 'Category',
        value1: car1.category,
        value2: car2.category,
        better: 0, // Depends on needs
        icon: 'car-estate'
      },
      {
        label: 'Score',
        value1: Math.round(calculateValueScore(car1)),
        value2: Math.round(calculateValueScore(car2)),
        better: getBetterValue('value_score', calculateValueScore(car1), calculateValueScore(car2)),
        icon: 'chart-line',
        suffix: '/100',
        showBar: true,
        maxValue: 100,
        isHigherBetter: true,
      },
    ];
  }, [selectedCars]);

  // Render tab navigation
  const renderTabNavigation = () => {
    return (
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            {
              borderBottomColor: activeTab === 'basics' ? '#D55004' : 'transparent',
              backgroundColor: isDarkMode ? '#121212' : '#ffffff'
            }
          ]}
          onPress={() => handleTabChange('basics')}
        >
          <Text style={[
            styles.tabText,
            {
              color: activeTab === 'basics' ?
                (isDarkMode ? '#D55004' : '#D55004') :
                (isDarkMode ? '#999999' : '#666666')
            }
          ]}>
            Basics
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            {
              borderBottomColor: activeTab === 'features' ? '#D55004' : 'transparent',
              backgroundColor: isDarkMode ? '#121212' : '#ffffff'
            }
          ]}
          onPress={() => handleTabChange('features')}
        >
          <Text style={[
            styles.tabText,
            {
              color: activeTab === 'features' ?
                (isDarkMode ? '#D55004' : '#D55004') :
                (isDarkMode ? '#999999' : '#666666')
            }
          ]}>
            Features
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            {
              borderBottomColor: activeTab === 'cost' ? '#D55004' : 'transparent',
              backgroundColor: isDarkMode ? '#121212' : '#ffffff'
            }
          ]}
          onPress={() => handleTabChange('cost')}
        >
          <Text style={[
            styles.tabText,
            {
              color: activeTab === 'cost' ?
                (isDarkMode ? '#D55004' : '#D55004') :
                (isDarkMode ? '#999999' : '#666666')
            }
          ]}>
            Cost
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            {
              borderBottomColor: activeTab === 'summary' ? '#D55004' : 'transparent',
              backgroundColor: isDarkMode ? '#121212' : '#ffffff'
            }
          ]}
          onPress={() => handleTabChange('summary')}
        >
          <Text style={[
            styles.tabText,
            {
              color: activeTab === 'summary' ?
                (isDarkMode ? '#D55004' : '#D55004') :
                (isDarkMode ? '#999999' : '#666666')
            }
          ]}>
            Summary
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Render active tab content
  const renderTabContent = () => {
    if (!selectedCars[0] || !selectedCars[1]) return null;

    switch (activeTab) {
      case 'basics':
        return (
          <>
            {/* Images comparison */}
            <ImageComparisonGallery
              car1={selectedCars[0]}
              car2={selectedCars[1]}
              isDarkMode={isDarkMode}
            />

            {/* Basic comparison */}
            <View style={[
              styles.comparisonSection,
              { backgroundColor: isDarkMode ? '#1A1A1A' : '#F5F5F5' }
            ]}>
              <Text style={[
                styles.sectionTitle,
                { color: isDarkMode ? '#FFFFFF' : '#000000' }
              ]}>
                Basic Specifications
              </Text>

              <View style={styles.comparisonGrid}>
                {/* Car names header */}
                <View style={styles.comparisonHeader}>
                  <View style={styles.headerSpacer} />
                  <Text style={[
                    styles.carHeader,
                    { color: isDarkMode ? '#FFFFFF' : '#000000' }
                  ]} numberOfLines={1}>
                    {selectedCars[0].year} {selectedCars[0].make}
                  </Text>
                  <Text style={[
                    styles.carHeader,
                    { color: isDarkMode ? '#FFFFFF' : '#000000' }
                  ]} numberOfLines={1}>
                    {selectedCars[1].year} {selectedCars[1].make}
                  </Text>
                </View>

                {/* Comparison rows */}
                {comparisonData.map((item, index) => (
                  <ComparisonAttribute
                    key={`attr-${index}`}
                    label={item.label}
                    value1={item.value1}
                    value2={item.value2}
                    better={item.better}
                    isDarkMode={isDarkMode}
                    icon={item.icon}
                    prefix={item.prefix}
                    suffix={item.suffix}
                    showBar={item.showBar}
                    maxValue={item.maxValue}
                    isHigherBetter={item.isHigherBetter}
                  />
                ))}
              </View>
            </View>


          </>
        );

      case 'features':
        return (
          <>
            {/* Value comparison chart */}
            <ValueComparisonChart
              car1={selectedCars[0]}
              car2={selectedCars[1]}
              isDarkMode={isDarkMode}
            />

            {/* All features */}
            <View style={[
              styles.comparisonSection,
              { backgroundColor: isDarkMode ? '#1A1A1A' : '#F5F5F5' }
            ]}>
              <Text style={[
                styles.sectionTitle,
                { color: isDarkMode ? '#FFFFFF' : '#000000' }
              ]}>
                All Features
              </Text>

              {/* Feature comparison header */}
              <View style={styles.featureHeader}>
                <View style={styles.featureHeaderLeft}>
                  <Text style={[
                    styles.featureHeaderText,
                    { color: isDarkMode ? '#FFFFFF' : '#000000' }
                  ]}>
                    Feature
                  </Text>
                </View>

                <View style={styles.featureHeaderRight}>
                  <Text style={[
                    styles.featureHeaderCarName,
                    { color: isDarkMode ? '#FFFFFF' : '#000000' }
                  ]} numberOfLines={1}>
                    {selectedCars[0].make}
                  </Text>
                  <Text style={[
                    styles.featureHeaderCarName,
                    { color: isDarkMode ? '#FFFFFF' : '#000000' }
                  ]} numberOfLines={1}>
                    {selectedCars[1].make}
                  </Text>
                </View>
              </View>

              {/* Feature comparison content */}
              <FeatureComparison
                car1Features={selectedCars[0].features}
                car2Features={selectedCars[1].features}
                isDarkMode={isDarkMode}
              />
            </View>

            {/* Safety features */}
            <View style={[
              styles.comparisonSection,
              { backgroundColor: isDarkMode ? '#1A1A1A' : '#F5F5F5' }
            ]}>
              <Text style={[
                styles.sectionTitle,
                { color: isDarkMode ? '#FFFFFF' : '#000000' }
              ]}>
                Safety Features
              </Text>

              {/* Feature comparison content */}
              <FeatureComparison
                car1Features={selectedCars[0].features}
                car2Features={selectedCars[1].features}
                isDarkMode={isDarkMode}
                filterByCategory="safety"
              />
            </View>

            {/* Comfort features */}
            <View style={[
              styles.comparisonSection,
              { backgroundColor: isDarkMode ? '#1A1A1A' : '#F5F5F5' }
            ]}>
              <Text style={[
                styles.sectionTitle,
                { color: isDarkMode ? '#FFFFFF' : '#000000' }
              ]}>
                Comfort Features
              </Text>

              {/* Feature comparison content */}
              <FeatureComparison
                car1Features={selectedCars[0].features}
                car2Features={selectedCars[1].features}
                isDarkMode={isDarkMode}
                filterByCategory="comfort"
              />
            </View>

            {/* Technology features */}
            <View style={[
              styles.comparisonSection,
              { backgroundColor: isDarkMode ? '#1A1A1A' : '#F5F5F5' }
            ]}>
              <Text style={[
                styles.sectionTitle,
                { color: isDarkMode ? '#FFFFFF' : '#000000' }
              ]}>
                Technology Features
              </Text>

              {/* Feature comparison content */}
              <FeatureComparison
                car1Features={selectedCars[0].features}
                car2Features={selectedCars[1].features}
                isDarkMode={isDarkMode}
                filterByCategory="technology"
              />
            </View>
          </>
        );

      case 'cost':
        return (
          <>
            {/* Total cost of ownership component */}
            <TotalCostOfOwnership
              car1={selectedCars[0]}
              car2={selectedCars[1]}
              isDarkMode={isDarkMode}
            />

            {/* Additional cost information */}
            <View style={[
              styles.comparisonSection,
              { backgroundColor: isDarkMode ? '#1A1A1A' : '#F5F5F5' }
            ]}>
              <Text style={[
                styles.sectionTitle,
                { color: isDarkMode ? '#FFFFFF' : '#000000' }
              ]}>
                Depreciation Estimate
              </Text>

              <Text style={[
                styles.insightText,
                { color: isDarkMode ? '#bbbbbb' : '#666666', marginBottom: 12 }
              ]}>
                Estimated value after 5 years of ownership based on average depreciation rates.
              </Text>

              <View style={styles.comparisonGrid}>
                {/* Car names header */}
                <View style={styles.comparisonHeader}>
                  <View style={styles.headerSpacer} />
                  <Text style={[
                    styles.carHeader,
                    { color: isDarkMode ? '#FFFFFF' : '#000000' }
                  ]} numberOfLines={1}>
                    {selectedCars[0].make} {selectedCars[0].model}
                  </Text>
                  <Text style={[
                    styles.carHeader,
                    { color: isDarkMode ? '#FFFFFF' : '#000000' }
                  ]} numberOfLines={1}>
                    {selectedCars[1].make} {selectedCars[1].model}
                  </Text>
                </View>

                {/* Current value */}
                <ComparisonAttribute
                  label="Value Now"
                  value1={selectedCars[0].price}
                  value2={selectedCars[1].price}
                  better={0} // Neutral comparison
                  isDarkMode={isDarkMode}
                  icon="cash"
                  prefix="$"
                />

                {/* Calculate future values */}
                {(() => {
                  // Variables for calculations
                  const car1Age = new Date().getFullYear() - selectedCars[0].year;
                  const car2Age = new Date().getFullYear() - selectedCars[1].year;
                  const car1FutureValue = calculateFutureValue(selectedCars[0].price, car1Age, 5);
                  const car2FutureValue = calculateFutureValue(selectedCars[1].price, car2Age, 5);
                  const car1LossAmount = selectedCars[0].price - car1FutureValue;
                  const car2LossAmount = selectedCars[1].price - car2FutureValue;
                  const car1LossPercent = (car1LossAmount / selectedCars[0].price) * 100;
                  const car2LossPercent = (car2LossAmount / selectedCars[1].price) * 100;

                  const betterDepreciation = car1LossPercent < car2LossPercent ? 1 : car2LossPercent < car1LossPercent ? 2 : 0;

                  // Render attributes
                  return (
                    <>
                      <ComparisonAttribute
                        label="Value in 5 Years"
                        value1={car1FutureValue}
                        value2={car2FutureValue}
                        better={0} // Neutral comparison
                        isDarkMode={isDarkMode}
                        icon="calendar-clock"
                        prefix="$"
                      />

                      <ComparisonAttribute
                        label="Total price drop"
                        value1={car1LossAmount}
                        value2={car2LossAmount}
                        better={betterDepreciation}
                        isDarkMode={isDarkMode}
                        icon="chart-line-variant"
                        prefix="$"
                      />

                      <ComparisonAttribute
                        label="Price drop Rate"
                        value1={car1LossPercent.toFixed(1)}
                        value2={car2LossPercent.toFixed(1)}
                        better={betterDepreciation}
                        isDarkMode={isDarkMode}
                        icon="percent"
                        suffix="%"
                      />
                    </>
                  );
                })()}
              </View>

              <Text style={[
                styles.costDisclaimer,
                { color: isDarkMode ? '#999999' : '#888888', marginTop: 12 }
              ]}>
                * Depreciation estimates are based on industry averages and may vary based on market conditions.
              </Text>
            </View>

            {/* Insurance cost estimates */}
            <View style={[
              styles.comparisonSection,
              { backgroundColor: isDarkMode ? '#1A1A1A' : '#F5F5F5' }
            ]}>
              <Text style={[
                styles.sectionTitle,
                { color: isDarkMode ? '#FFFFFF' : '#000000' }
              ]}>
                Annual Cost Estimates
              </Text>

              <View style={styles.comparisonGrid}>
                {/* Car names header */}
                <View style={styles.comparisonHeader}>
                  <View style={styles.headerSpacer} />
                  <Text style={[
                    styles.carHeader,
                    { color: isDarkMode ? '#FFFFFF' : '#000000' }
                  ]} numberOfLines={1}>
                    {selectedCars[0].make} {selectedCars[0].model}
                  </Text>
                  <Text style={[
                    styles.carHeader,
                    { color: isDarkMode ? '#FFFFFF' : '#000000' }
                  ]} numberOfLines={1}>
                    {selectedCars[1].make} {selectedCars[1].model}
                  </Text>
                </View>

                {/* Calculate costs */}
                {(() => {
                  // Get category-specific estimates
                  const getCategoryEstimate = (car: Car, costType: string) => {
                    const category = car.category || 'Sedan';
                    const condition = car.condition || 'Used';
                    const fuelType = car.type || 'Benzine';

                    switch (costType) {
                      case 'maintenance':
                        return ANNUAL_COST_ESTIMATES.maintenance[condition];
                      case 'insurance':
                        return ANNUAL_COST_ESTIMATES.insurance[category] || ANNUAL_COST_ESTIMATES.insurance['Sedan'];
                      case 'fuel':
                        const fuelData = ANNUAL_COST_ESTIMATES.fuelConsumption[fuelType] || ANNUAL_COST_ESTIMATES.fuelConsumption['Benzine'];
                        return fuelData[category] || fuelData['Sedan'];
                      default:
                        return 0;
                    }
                  };

                  // Calculate estimates
                  const car1Maintenance = getCategoryEstimate(selectedCars[0], 'maintenance');
                  const car2Maintenance = getCategoryEstimate(selectedCars[1], 'maintenance');
                  const car1Insurance = getCategoryEstimate(selectedCars[0], 'insurance');
                  const car2Insurance = getCategoryEstimate(selectedCars[1], 'insurance');
                  const car1Fuel = getCategoryEstimate(selectedCars[0], 'fuel');
                  const car2Fuel = getCategoryEstimate(selectedCars[1], 'fuel');
                  const car1Total = car1Maintenance + car1Insurance + car1Fuel;
                  const car2Total = car2Maintenance + car2Insurance + car2Fuel;

                  return (
                    <>
                      <ComparisonAttribute
                        label="Service"
                        value1={car1Maintenance}
                        value2={car2Maintenance}
                        better={getBetterValue('price', car1Maintenance, car2Maintenance)}
                        isDarkMode={isDarkMode}
                        icon="wrench"
                        prefix="$"
                        suffix="/yr"
                      />

                      <ComparisonAttribute
                        label="Insurance"
                        value1={car1Insurance}
                        value2={car2Insurance}
                        better={getBetterValue('price', car1Insurance, car2Insurance)}
                        isDarkMode={isDarkMode}
                        icon="shield"
                        prefix="$"
                        suffix="/yr"
                      />

                      <ComparisonAttribute
                        label="Usage"
                        value1={car1Fuel}
                        value2={car2Fuel}
                        better={getBetterValue('price', car1Fuel, car2Fuel)}
                        isDarkMode={isDarkMode}
                        icon="gas-station"
                        prefix="$"
                        suffix="/yr"
                      />

                      <ComparisonAttribute
                        label="Total"
                        value1={car1Total}
                        value2={car2Total}
                        better={getBetterValue('price', car1Total, car2Total)}
                        isDarkMode={isDarkMode}
                        icon="cash-multiple"
                        prefix="$"
                        suffix="/yr"
                        showBar={true}
                        maxValue={Math.max(car1Total, car2Total) * 1.1}
                        isHigherBetter={false}
                      />
                    </>
                  );
                })()}
              </View>

              <Text style={[
                styles.costDisclaimer,
                { color: isDarkMode ? '#999999' : '#888888', marginTop: 12 }
              ]}>
                * Cost estimates based on typical ownership patterns and may vary by location and driving habits.
              </Text>
            </View>
          </>
        );

      case 'summary':
        return (
          <>
            {/* Summary section */}
            <View style={[
              styles.comparisonSection,
              { backgroundColor: isDarkMode ? '#1A1A1A' : '#F5F5F5' }
            ]}>
              <ComparisonSummary
                car1={selectedCars[0]}
                car2={selectedCars[1]}
                isDarkMode={isDarkMode}
              />
            </View>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <View style={[
      styles.container,
      { backgroundColor: isDarkMode ? '#000000' : '#FFFFFF' }
    ]}>

      {/* Animated header */}
<CustomHeader title={'Car Comparison'} onBack={() => router.back()}/>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#D55004" />
          <Text style={[
            styles.loadingText,
            { color: isDarkMode ? '#FFFFFF' : '#000000' }
          ]}>
            Loading your favorite cars...
          </Text>
        </View>
      ) : (
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
        >
          {/* Car selection cards */}
          <View style={styles.carSelectionContainer}>
            {/* Left car */}
            <TouchableOpacity
              style={[
                styles.carSelectionCard,
                { backgroundColor: isDarkMode ? '#1A1A1A' : '#F5F5F5' }
              ]}
              onPress={() => openCarPicker('left')}
            >
              {selectedCars[0] ? (
                <View style={styles.selectedCarContainer}>
                  <Image
                    source={{ uri: selectedCars[0].images[0] }}
                    style={styles.selectedCarImage}
                    contentFit="cover"
                  />
                  <View style={styles.selectedCarInfo}>
                    <Text style={[
                      styles.selectedCarMake,
                      { color: isDarkMode ? '#FFFFFF' : '#000000' }
                    ]} numberOfLines={1}>
                      {selectedCars[0].make}
                    </Text>
                    <Text style={[
                      styles.selectedCarModel,
                      { color: isDarkMode ? '#FFFFFF' : '#000000' }
                    ]} numberOfLines={1}>
                      {selectedCars[0].model}
                    </Text>
                    <Text style={[
                      styles.selectedCarYear,
                      { color: isDarkMode ? '#BBBBBB' : '#666666' }
                    ]}>
                      {selectedCars[0].year}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => handleClearCar('left')}
                  >
                    <Ionicons name="close-circle" size={22} color={isDarkMode ? '#FFFFFF' : '#000000'} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.emptyCarSlot}>
                  <Ionicons
                    name="add-circle-outline"
                    size={40}
                    color={isDarkMode ? '#FFFFFF' : '#000000'}
                  />
                  <Text style={[
                    styles.emptyCarText,
                    { color: isDarkMode ? '#FFFFFF' : '#000000' }
                  ]}>
                    Select Car
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Comparison indicator */}
            <View style={styles.vsContainer}>
              <LinearGradient
                colors={['#D55004', '#FF6B00']}
                style={styles.vsCircle}
                start={{ x: 0.1, y: 0.1 }}
                end={{ x: 0.9, y: 0.9 }}
              >
                <Text style={styles.vsText}>VS</Text>
              </LinearGradient>
            </View>

            {/* Right car */}
            <TouchableOpacity
              style={[
                styles.carSelectionCard,
                { backgroundColor: isDarkMode ? '#1A1A1A' : '#F5F5F5' }
              ]}
              onPress={() => openCarPicker('right')}
            >
              {selectedCars[1] ? (
                <View style={styles.selectedCarContainer}>
                  <Image
                    source={{ uri: selectedCars[1].images[0] }}
                    style={styles.selectedCarImage}
                    contentFit="cover"
                  />
                  <View style={styles.selectedCarInfo}>
                    <Text style={[
                      styles.selectedCarMake,
                      { color: isDarkMode ? '#FFFFFF' : '#000000' }
                    ]} numberOfLines={1}>
                      {selectedCars[1].make}
                    </Text>
                    <Text style={[
                      styles.selectedCarModel,
                      { color: isDarkMode ? '#FFFFFF' : '#000000' }
                    ]} numberOfLines={1}>
                      {selectedCars[1].model}
                    </Text>
                    <Text style={[
                      styles.selectedCarYear,
                      { color: isDarkMode ? '#BBBBBB' : '#666666' }
                    ]}>
                      {selectedCars[1].year}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => handleClearCar('right')}
                  >
                    <Ionicons name="close-circle" size={22} color={isDarkMode ? '#FFFFFF' : '#000000'} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.emptyCarSlot}>
                  <Ionicons
                    name="add-circle-outline"
                    size={40}
                    color={isDarkMode ? '#FFFFFF' : '#000000'}
                  />
                  <Text style={[
                    styles.emptyCarText,
                    { color: isDarkMode ? '#FFFFFF' : '#000000' }
                  ]}>
                    Select Car
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Comparison content */}
          {selectedCars[0] && selectedCars[1] ? (
            <View style={styles.comparisonContent}>
              {/* Tab navigation */}
              {renderTabNavigation()}

              {/* Tab content */}
              {renderTabContent()}
            </View>
          ) : (
            <View style={styles.placeholderContainer}>
              <View style={[
                styles.placeholderContent,
                { backgroundColor: isDarkMode ? '#1A1A1A' : '#F5F5F5' }
              ]}>
                <Ionicons
                  name="car-sport-outline"
                  size={64}
                  color={isDarkMode ? '#555555' : '#CCCCCC'}
                />
                <Text style={[
                  styles.placeholderTitle,
                  { color: isDarkMode ? '#FFFFFF' : '#000000' }
                ]}>
                  Select Two Cars to Compare
                </Text>
                <Text style={[
                  styles.placeholderText,
                  { color: isDarkMode ? '#BBBBBB' : '#666666' }
                ]}>
                  Choose from your favorite cars to see a detailed comparison of specifications, features, and insights.
                </Text>

                {favoriteCars.length === 0 && (
                  <TouchableOpacity
                    style={styles.addFavoritesButton}
                    onPress={() => router.push('/(home)/(user)')}
                  >
                    <Text style={styles.addFavoritesButtonText}>
                      Browse Cars to Add Favorites
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Bottom padding */}
          <View style={{ height: 100 }} />
        </Animated.ScrollView>
      )}

      {/* Share button */}
      {selectedCars[0] && selectedCars[1] && (
        <ShareButton
          car1={selectedCars[0]}
          car2={selectedCars[1]}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Car picker modal */}
      <CarPickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        cars={favoriteCars}
        onSelect={handleSelectCar}
        selectedCars={selectedCars}
        isDarkMode={isDarkMode}
        position={pickerPosition}
      />
    </View>
  );
}

// Helper function for calculating future value (for depreciation)
const calculateFutureValue = (currentValue:any, currentAge:any, yearsToProject:any) => {
  let futureValue = currentValue;

  for (let year = 1; year <= yearsToProject; year++) {
    const yearsSinceNew:any = currentAge + year;
    let rate:any = 0;

    if (yearsSinceNew <= 10) {
      rate = ANNUAL_COST_ESTIMATES.depreciation.rates[yearsSinceNew.toString()];
    } else {
      rate = ANNUAL_COST_ESTIMATES.depreciation.rates['10+'];
    }

    const yearlyDepreciation = futureValue * (rate / 100);
    futureValue -= yearlyDepreciation;
  }

  return Math.round(futureValue);
};




  const styles = StyleSheet.create({
  // Main container styles
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  placeholderRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },

  // Loading state styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },

  // Car selection styles
  carSelectionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  carSelectionCard: {
    width: width * 0.42,
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  vsContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  vsCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  vsText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  emptyCarSlot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCarText: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '500',
  },
  selectedCarContainer: {
    width: '100%',
    height: '100%',
  },
  selectedCarImage: {
    width: '100%',
    height: '65%',
  },
  selectedCarInfo: {
    padding: 8,
  },
  selectedCarMake: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 2,
  },
  selectedCarModel: {
    fontSize: 14,
    marginBottom: 2,
  },
  selectedCarYear: {
    fontSize: 12,
  },
  clearButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 15,
    padding: 2,
  },

  // Placeholder and empty state styles
  placeholderContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },
  placeholderContent: {
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  placeholderText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
    lineHeight: 20,
  },
  addFavoritesButton: {
    backgroundColor: '#D55004',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    marginTop: 8,
    elevation: 2,
  },
  addFavoritesButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },

  // Comparison content styles
  comparisonContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  comparisonSection: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  comparisonGrid: {
    width: '100%',
  },
  comparisonHeader: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.2)',
  },
  headerSpacer: {
    flex: 1,
  },
  carHeader: {
    width: '35%',
    fontWeight: '500',
    fontSize: 14,
    textAlign: 'center',
  },

  // Comparison row styles
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  attributeLabelContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  attributeIcon: {
    marginRight: 8,
  },
  attributeLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  valuesContainer: {
    flexDirection: 'row',
    width: '70%',
  },
  valueCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 8,
    marginHorizontal: 4,
    position: 'relative',
    height: 45,
  },
  betterValueCell: {
    borderWidth: 1,
    borderColor: '#4ADE80',
  },
  valueText: {
    fontSize: 13,
    fontWeight: '500',
  },
  betterValueText: {
    fontWeight: 'bold',
  },
  betterIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  progressBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(150,150,150,0.2)',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
  },

  // Feature header styles
  featureHeader: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.2)',
  },
  featureHeaderLeft: {
    flex: 2,
    paddingLeft: 8,
  },
  featureHeaderText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  featureHeaderRight: {
    flex: 1,
    flexDirection: 'row',
  },
  featureHeaderCarName: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },

  // Feature comparison styles
  featureComparisonContainer: {
    paddingTop: 8,
  },
  featureRow: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.1)',
    paddingLeft: 6,
  },
  featureInfo: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 8,
  },
  featureTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  featureLabel: {
    fontWeight: '500',
    fontSize: 14,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  featureAvailability: {
    flex: 1,
    flexDirection: 'row',
  },
  featureCheckContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Summary component styles
  summaryContainer: {
    padding: 8,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  summaryContent: {
    marginTop: 8,
  },
  recommendationBox: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  recommendedCarName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  recommendationReason: {
    fontSize: 14,
    lineHeight: 20,
  },
  insightBox: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginVertical: 8,
  },
  insightText: {
    fontSize: 14,
    lineHeight: 20,
  },

  // Pros & Cons styles
  prosConsContainer: {
    marginBottom: 16,
  },
  prosConsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  prosConsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  prosConsCard: {
    width: '48%',
    borderRadius: 12,
    padding: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  prosConsCardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  prosSection: {
    marginBottom: 12,
  },
  consSection: {
    marginBottom: 4,
  },
  proTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  conTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  proConItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  proConIcon: {
    marginTop: 2,
    marginRight: 4,
  },
  proConText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  noProsCons: {
    fontSize: 12,
    fontStyle: 'italic',
  },

  // Use cases styles
  useCasesContainer: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  useCasesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  useCasesContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  useCaseColumn: {
    width: '48%',
  },
  useCaseCarName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  useCaseItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  useCaseIcon: {
    marginTop: 2,
    marginRight: 4,
  },
  useCaseText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  noUseCases: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },

  // Image gallery styles
  imageGalleryContainer: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  galleryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  imagesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  singleImageContainer: {
    width: '48%',
    alignItems: 'center',
  },
  comparisonImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
  },
  imageCarLabel: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  noImagePlaceholder: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  galleryButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryCounter: {
    marginHorizontal: 16,
    fontSize: 14,
  },

  // Radar chart styles
  radarChartContainer: {
    margin: 8,
    marginBottom: 16,
    padding: 8,
    borderRadius: 16,
  },
  radarChartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  radarChartContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Cost of ownership styles
  costComparisonContainer: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
  },
  costHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  costTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  infoButton: {
    padding: 4,
  },
  costCards: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  costCard: {
    width: '48%',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  betterCostCard: {
    borderWidth: 1,
    borderColor: '#4ADE80',
  },
  costCardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  costAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  savingsBadge: {
    backgroundColor: '#4ADE80',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  savingsText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  costInsight: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  costInsightText: {
    fontSize: 13,
    lineHeight: 18,
  },
  costDisclaimer: {
    fontSize: 10,
    fontStyle: 'italic',
  },

  // Empty states
  emptyFeaturesContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyFeaturesText: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 200,
  },
  emptyStateText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },

  // Modal styles
  modalBlurContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
  },
  modalHeader: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.2)',
    position: 'relative',
  },
  modalHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(150,150,150,0.5)',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    top: 12,
  },

  // Search and sort styles
  searchSortContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.2)',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    marginLeft: 8,
    paddingVertical: 0,
  },
  sortContainer: {
    marginTop: 4,
  },
  sortLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  sortOptionsContainer: {
    paddingVertical: 4,
  },
  sortOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  sortOptionActive: {
    backgroundColor: '#D55004',
  },
  sortOptionText: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Car list styles
  carList: {
    padding: 16,
  },
  carItem: {
    flexDirection: 'row',
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
  },
  carThumbnail: {
    width: 90,
    height: 90,
  },
  carInfo: {
    flex: 1,
    padding: 12,
  },
  carMake: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  carTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  carPrice: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  carMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  carMetaItem: {
    fontSize: 12,
    marginRight: 12,
  },
  featureCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  featureCountText: {
    fontSize: 11,
    marginLeft: 3,
  },
  alreadySelectedBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alreadySelectedText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },

  // Share button
  shareButtonContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 10,
  },
  shareButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#D55004',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },

  // Tab navigation
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
  },
  tabText: {
    fontWeight: '500',
    fontSize: 14,
  },

  // Value comparison chart
  valueChartContainer: {
    padding: 12,
    marginBottom: 16,
    borderRadius: 12,
  },
  valueChartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  valueMetricsContainer: {
    marginTop: 8,
  },
  valueMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.1)',
  },
  valueMetricLabel: {
    width: '30%',
    fontSize: 13,
    fontWeight: '500',
  },
  valueMetricBars: {
    flex: 1,
    flexDirection: 'row',
    height: 24,
    position: 'relative',
  },
  valueBar1: {
    height: '100%',
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    position: 'absolute',
    left: 0,
  },
  valueBar2: {
    height: '100%',
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    position: 'absolute',
    right: 0,
  },
  valueScoreText: {
    position: 'absolute',
    fontSize: 11,
    fontWeight: 'bold',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  valueScore1: {
    left: 4,
  },
  valueScore2: {
    right: 4,
  },
  valueBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  valueBarLabel: {
    fontSize: 10,
  },
  valueChartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 4,
  },
  legendText: {
    fontSize: 12,
  },

  // TextInput
  textInput: {
    padding: 0,
  },
});