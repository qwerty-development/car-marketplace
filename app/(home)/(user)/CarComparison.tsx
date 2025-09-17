import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  Share,
  Pressable,
  I18nManager,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  FontAwesome,
  Ionicons,
  MaterialCommunityIcons,
  AntDesign,
  Feather,
  MaterialIcons,
} from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
  useAnimatedScrollHandler,
  cancelAnimation,
  runOnJS,
  withDelay,
} from "react-native-reanimated";
import { supabase } from "@/utils/supabase";
import { useFavorites } from "@/utils/useFavorites";
import { useTheme } from "@/utils/ThemeContext";
import { useAuth } from "@/utils/AuthContext";
import { useGuestUser } from "@/utils/GuestUserContext";
import * as Haptics from "expo-haptics";
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Car } from "@/components/comparison/types";
import {
  FEATURE_METADATA,
  ANNUAL_COST_ESTIMATES,
} from "@/components/comparison/constants";
import {
  getBetterValue,
  calculateEnvironmentalScore,
  calculateValueScore,
  calculateTotalCostOfOwnership,
  calculateFutureValue,
} from "@/components/comparison/calculate";
import { CarCostService, ProcessedCostData } from "@/services/CarCostService";
import styles from "@/components/comparison/styles";
import { CarPickerModal } from "@/components/comparison/modals";
import {
  ComparisonAttribute,
  ImageComparisonGallery,
  ValueComparisonChart,
  FeatureComparison,
} from "@/components/comparison/comparisons";
import { ComparisonSummary } from "@/components/comparison/comparisonSummary";
import { TotalCostOfOwnership } from "@/components/comparison/totalCostOfOwnership";

// Memoized Custom Header component
const CustomHeader = React.memo(
  ({ title, onBack }: { title: string; onBack?: () => void }) => {
    const { isDarkMode } = useTheme();
    const { i18n } = useTranslation();
    const isRTL = i18n.language === 'ar';

    return (
      <SafeAreaView className={`bg-${isDarkMode ? "black" : "white"} -mb-7`}>
        <View
          className={`flex-row items-center ${isRTL ? 'flex-row-reverse mr-2' : 'ml-2'} ${
            Platform.OS === "ios" ? "" : "mb-7"
          }`}
        >
          {onBack && (
            <Pressable
              onPress={onBack}
              className="p-2"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {isRTL ? (
                <ChevronRight
                  size={24}
                  className={isDarkMode ? "text-white" : "text-black"}
                />
              ) : (
                <ChevronLeft
                  size={24}
                  className={isDarkMode ? "text-white" : "text-black"}
                />
              )}
            </Pressable>
          )}
          <Text
            className={`text-2xl ${
              isDarkMode ? "text-white" : "text-black"
            } font-bold ${isRTL ? 'mr-2' : 'ml-2'}`}
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {title}
          </Text>
        </View>
      </SafeAreaView>
    );
  }
);

// Memoized TabButton component for better performance
const TabButton = React.memo(
  ({
    tabName,
    activeTab,
    onPress,
    isDarkMode,
    t,
  }: {
    tabName: "basics" | "features" | "cost" | "summary";
    activeTab: string;
    onPress: () => void;
    isDarkMode: boolean;
    t: (key: string) => string;
  }) => (
    <TouchableOpacity
      style={[
        styles.tabButton,
        {
          borderBottomColor: activeTab === tabName ? "#D55004" : "transparent",
          backgroundColor: isDarkMode ? "#121212" : "#ffffff",
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.tabText,
          {
            color:
              activeTab === tabName
                ? "#D55004"
                : isDarkMode
                ? "#999999"
                : "#666666",
          },
        ]}
      >
{t(`comparison.tabs.${tabName}`)}
      </Text>
    </TouchableOpacity>
  )
);

// Memoized car selection card component
const CarSelectionCard = React.memo(
  ({
    car,
    position,
    isDarkMode,
    onOpenPicker,
    onClearCar,
    t,
  }: {
    car: Car | null;
    position: "left" | "right";
    isDarkMode: boolean;
    onOpenPicker: (position: "left" | "right") => void;
    onClearCar: (position: "left" | "right") => void;
    t: (key: string) => string;
  }) => (
    <TouchableOpacity
      style={[
        styles.carSelectionCard,
        { backgroundColor: isDarkMode ? "#1A1A1A" : "#F5F5F5" },
      ]}
      onPress={() => onOpenPicker(position)}
      activeOpacity={0.7}
    >
      {car ? (
        <View style={styles.selectedCarContainer}>
          <Image
            source={{ uri: car.images[0] }}
            style={styles.selectedCarImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={200}
          />
          <View style={styles.selectedCarInfo}>
            <Text
              style={[
                styles.selectedCarMake,
                { color: isDarkMode ? "#FFFFFF" : "#000000" },
              ]}
              numberOfLines={1}
            >
              {car.make}
            </Text>
            <Text
              style={[
                styles.selectedCarModel,
                { color: isDarkMode ? "#FFFFFF" : "#000000" },
              ]}
              numberOfLines={1}
            >
              {car.model}
            </Text>
            <Text
              style={[
                styles.selectedCarYear,
                { color: isDarkMode ? "#BBBBBB" : "#666666" },
              ]}
            >
              {car.year}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.clearButton}
            onPress={(e) => {
              e.stopPropagation();
              onClearCar(position);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name="close-circle"
              size={22}
              color={isDarkMode ? "#FFFFFF" : "#000000"}
            />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.emptyCarSlot}>
          <Ionicons
            name="add-circle-outline"
            size={40}
            color={isDarkMode ? "#FFFFFF" : "#000000"}
          />
          <Text
            style={[
              styles.emptyCarText,
              { color: isDarkMode ? "#FFFFFF" : "#000000" },
            ]}
          >
{t('comparison.select_car')}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  )
);

// EmptyState component
const EmptyState = React.memo(
  ({
    favoriteCars,
    isDarkMode,
    onBrowseCars,
    t,
  }: {
    favoriteCars: Car[];
    isDarkMode: boolean;
    onBrowseCars: () => void;
    t: (key: string) => string;
  }) => (
    <View style={styles.placeholderContainer}>
      <View
        style={[
          styles.placeholderContent,
          { backgroundColor: isDarkMode ? "#1A1A1A" : "#F5F5F5" },
        ]}
      >
        <Ionicons
          name="car-sport-outline"
          size={64}
          color={isDarkMode ? "#555555" : "#CCCCCC"}
        />
        <Text
          style={[
            styles.placeholderTitle,
            { color: isDarkMode ? "#FFFFFF" : "#000000" },
          ]}
        >
{t('comparison.select_two_cars')}
        </Text>
        <Text
          style={[
            styles.placeholderText,
            { color: isDarkMode ? "#BBBBBB" : "#666666" },
          ]}
        >
{t('comparison.select_two_cars_description')}
        </Text>

        {favoriteCars.length === 0 && (
          <TouchableOpacity
            style={styles.addFavoritesButton}
            onPress={onBrowseCars}
          >
            <Text style={styles.addFavoritesButtonText}>
              {t('comparison.browse_cars_add_favorites')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
);

// Memoized TabNavigation component
const TabNavigation = React.memo(
  ({
    activeTab,
    handleTabChange,
    isDarkMode,
    t,
    isRTL = false,
  }: {
    activeTab: "basics" | "features" | "cost" | "summary";
    handleTabChange: (tab: "basics" | "features" | "cost" | "summary") => void;
    isDarkMode: boolean;
    t: (key: string) => string;
    isRTL?: boolean;
  }) => (
    <View style={[
      styles.tabContainer, 
      { flexDirection: isRTL ? 'row-reverse' : 'row' }
    ]}>
      <TabButton
        tabName="basics"
        activeTab={activeTab}
        onPress={() => handleTabChange("basics")}
        isDarkMode={isDarkMode}
        t={t}
      />
      <TabButton
        tabName="features"
        activeTab={activeTab}
        onPress={() => handleTabChange("features")}
        isDarkMode={isDarkMode}
        t={t}
      />
{/*
      <TabButton
        tabName="cost"
        activeTab={activeTab}
        onPress={() => handleTabChange("cost")}
        isDarkMode={isDarkMode}
        t={t}
      /> */}
      <TabButton
        tabName="summary"
        activeTab={activeTab}
        onPress={() => handleTabChange("summary")}
        isDarkMode={isDarkMode}
        t={t}
      />
    </View>
  )
);

// Main component
export default function CarComparison() {
  const { isDarkMode } = useTheme();
  const { favorites } = useFavorites();
  const { user } = useAuth();
  const { isGuest } = useGuestUser();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ car1Id?: string; car2Id?: string }>();

  // RTL support
  const isRTL = i18n.language === 'ar';

  // Refs for animations
  const animationRef = useRef<any>(null);
  const aiCallRef = useRef<string | null>(null);

  // State for selected cars
  const [selectedCars, setSelectedCars] = useState<[Car | null, Car | null]>([
    null,
    null,
  ]);
  const [favoriteCars, setFavoriteCars] = useState<Car[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerPosition, setPickerPosition] = useState<"left" | "right">(
    "left"
  );

  // State for active tab with optimized transition
  const [activeTab, setActiveTab] = useState<
    "basics" | "features" | "cost" | "summary"
  >("basics");
  const [visibleTab, setVisibleTab] = useState<"basics" | "features" | "cost" | "summary">("basics");

  // State for AI cost analysis
  const [aiCostData, setAiCostData] = useState<{
    car1Data: ProcessedCostData | null;
    car2Data: ProcessedCostData | null;
    aiMessage: string;
    isLoading: boolean;
    success: boolean;
  }>({
    car1Data: null,
    car2Data: null,
    aiMessage: "",
    isLoading: false,
    success: false,
  });

  // Animation values
  const fadeAnim = useSharedValue(1);
  const headerOpacity = useSharedValue(1);
  const scrollY = useSharedValue(0);

  // Optimized animated scroll handler with useNativeDriver
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      const newOpacity = event.contentOffset.y > 50 ? 0 : 1;

      if (headerOpacity.value !== newOpacity) {
        headerOpacity.value = withTiming(newOpacity, {
          duration: 200,
          easing: Easing.ease,
        });
      }
    },
  });

  // Create animated style for the tab content
  const fadeStyle = useAnimatedStyle(() => {
    return {
      opacity: fadeAnim.value,
    };
  }, []);

  // Animated header style
  const headerAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: headerOpacity.value,
      transform: [
        {
          translateY: withTiming(headerOpacity.value * 0 - (1 - headerOpacity.value) * 100, {
            duration: 200,
            easing: Easing.ease,
          }),
        },
      ],
    };
  }, []);

  // Fetch favorite cars - optimized with proper error handling and cleanup
  useEffect(() => {
    let isMounted = true;
    const fetchFavoriteCars = async () => {
      if ((!user && !isGuest) || favorites.length === 0) {
        if (isMounted) setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("cars")
          .select(
            `
            *,
            dealerships (
              name,
              logo,
              phone,
              location,
              latitude,
              longitude
            )
          `
          )
          .eq("status", "available")
          .in("id", favorites);

        if (error) throw error;

        if (!isMounted) return;

        // Process data and filter out null/unavailable cars
        const availableCars = (data || [])
          .filter((item) => item && item.status === "available")
          .map((item) => ({
            ...item,
            dealership_name: item.dealerships?.name,
            dealership_logo: item.dealerships?.logo,
            dealership_phone: item.dealerships?.phone,
            dealership_location: item.dealerships?.location,
            dealership_latitude: item.dealerships?.latitude,
            dealership_longitude: item.dealerships?.longitude,
          }));

        setFavoriteCars(availableCars);

        // Check if we need to preselect cars from URL params
        if (params.car1Id) {
          const car1 = availableCars.find(
            (car) => car.id.toString() === params.car1Id
          );
          if (car1) {
            setSelectedCars((prev) => [car1, prev[1]]);
          }
        }

        if (params.car2Id) {
          const car2 = availableCars.find(
            (car) => car.id.toString() === params.car2Id
          );
          if (car2) {
            setSelectedCars((prev) => [prev[0], car2]);
          }
        }
      } catch (error) {
        console.error("Error fetching favorite cars:", error);
        if (isMounted) {
          Alert.alert("Error", "Failed to fetch your favorite cars");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchFavoriteCars();

    return () => {
      isMounted = false;

      // Clean up any ongoing animations
      if (animationRef.current) {
        cancelAnimation(fadeAnim);
      }
    };
  }, [user, favorites, params.car1Id, params.car2Id]);

  // Select car handler - optimized with useCallback
  const handleSelectCar = useCallback(
    (car: Car, position: "left" | "right") => {
      setSelectedCars((prev) => {
        // Provide haptic feedback
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(console.error);

        if (position === "left") {
          return [car, prev[1]];
        } else {
          return [prev[0], car];
        }
      });

      // Auto-close the picker after selection
      setPickerVisible(false);
    },
    []
  );

  // Clear car handler - optimized with useCallback
  const handleClearCar = useCallback((position: "left" | "right") => {
    setSelectedCars((prev) => {
      // Provide haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(console.error);

      if (position === "left") {
        return [null, prev[1]];
      } else {
        return [prev[0], null];
      }
    });
  }, []);

  // Open car picker modal - optimized with useCallback
  const openCarPicker = useCallback((position: "left" | "right") => {
    setPickerPosition(position);
    setPickerVisible(true);

    // Provide haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(console.error);
  }, []);

  // Calculate if comparison is possible - memoized
  const canCompare = useMemo(() => {
    return favoriteCars.length >= 2;
  }, [favoriteCars.length]);

  // Navigate to browse cars - optimized with useCallback
  const handleBrowseCars = useCallback(() => {
    router.push("/(home)/(user)/(tabs)");
  }, [router]);

  // Handle back button press - optimized with useCallback
  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  // Fetch AI cost analysis when both cars are selected
  const fetchAICostAnalysis = useCallback(async (car1: Car, car2: Car) => {
    setAiCostData(prev => ({ ...prev, isLoading: true }));
    
    try {
      const result = await CarCostService.compareCarCosts(car1, car2);
      
      setAiCostData({
        car1Data: result.car1Data,
        car2Data: result.car2Data,
        aiMessage: result.aiMessage,
        isLoading: false,
        success: result.success,
      });
    } catch (error) {
      console.error('Failed to fetch AI cost analysis:', error);
      setAiCostData(prev => ({
        ...prev,
        isLoading: false,
        aiMessage: '⚠️ Unable to load AI cost analysis. Please try again later.',
        success: false,
      }));
    }
  }, []);

  // Trigger AI analysis when both cars are selected (with loop prevention)
  useEffect(() => {
    if (selectedCars[0] && selectedCars[1]) {
      const carComboKey = `${selectedCars[0].id}-${selectedCars[1].id}`;
      
      // Only call AI if we haven't called it for this car combination yet
      if (aiCallRef.current !== carComboKey && !aiCostData.isLoading) {
        aiCallRef.current = carComboKey;
        
        // Reset AI data for new comparison
        setAiCostData(prev => ({
          ...prev,
          car1Data: null,
          car2Data: null,
          aiMessage: "",
          isLoading: false,
          success: false,
        }));
        
        // Call AI analysis
        fetchAICostAnalysis(selectedCars[0], selectedCars[1]);
      }
    } else {
      // Reset when cars are deselected
      aiCallRef.current = null;
      setAiCostData({
        car1Data: null,
        car2Data: null,
        aiMessage: "",
        isLoading: false,
        success: false,
      });
    }
  }, [selectedCars[0]?.id, selectedCars[1]?.id, fetchAICostAnalysis, aiCostData.isLoading]);

  // Change tab with smooth transition - optimized for performance
  const handleTabChange = useCallback(
    (tab: "basics" | "features" | "cost" | "summary") => {
      if (tab === activeTab) return;

      // Store animation reference for cleanup
      animationRef.current = true;

      // Disable multiple clicks during animation
      if (fadeAnim.value < 1) return;

      // Fade out current content with native driver for better performance
      fadeAnim.value = withTiming(0, {
        duration: 120,
        easing: Easing.out(Easing.ease),
      }, (finished) => {
        if (finished) {
          // Only update the visible tab after fade out completes
          runOnJS(setActiveTab)(tab);
          runOnJS(setVisibleTab)(tab);

          // Fade in the new content with slight delay
          fadeAnim.value = withDelay(10, withTiming(1, {
            duration: 120,
            easing: Easing.in(Easing.ease),
          }));

          animationRef.current = false;
        }
      });

      // Provide haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(console.error);
    },
    [activeTab, fadeAnim]
  );

  // Generate comparison data - properly memoized to prevent recalculation
  const comparisonData = useMemo(() => {
    if (!selectedCars[0] || !selectedCars[1]) return [];

    const car1 = selectedCars[0];
    const car2 = selectedCars[1];

    return [
      {
        label: t('car.price'),
        value1: car1.price,
        value2: car2.price,
        better: getBetterValue("price", car1.price, car2.price),
        icon: "currency-usd",
        prefix: "$",
        showBar: true,
        maxValue: Math.max(car1.price, car2.price) * 1.1,
        isHigherBetter: false,
      },
      {
        label: t('car.year'),
        value1: car1.year,
        value2: car2.year,
        better: getBetterValue("year", car1.year, car2.year),
        icon: "calendar-blank",
        showBar: true,
        maxValue: Math.max(car1.year, car2.year),
        isHigherBetter: true,
      },
      {
        label: t('car.mileage'),
        value1: car1.mileage,
        value2: car2.mileage,
        better: getBetterValue("mileage", car1.mileage, car2.mileage),
        icon: "speedometer",
        suffix: " km",
        showBar: true,
        maxValue: Math.max(car1.mileage, car2.mileage) * 1.1,
        isHigherBetter: false,
      },
      {
        label: t('car.condition'),
        value1: car1.condition.toLowerCase() === "used" ? t("profile.inventory.used") : car1.condition.toLowerCase() === "new" ? t("profile.inventory.new") : car1.condition,
        value2: car2.condition.toLowerCase() === "used" ? t("profile.inventory.used") : car2.condition.toLowerCase() === "new" ? t("profile.inventory.new") : car2.condition,
        better: 0, // Subjective, no better value
        icon: "car-info",
      },
      {
        label: t('car.transmission'),
        value1: car1.transmission.toLowerCase() === "automatic" ? t("profile.inventory.automatic") : car1.transmission.toLowerCase() === "manual" ? t("profile.inventory.manual") : car1.transmission,
        value2: car2.transmission.toLowerCase() === "automatic" ? t("profile.inventory.automatic") : car2.transmission.toLowerCase() === "manual" ? t("profile.inventory.manual") : car2.transmission,
        better: 0, // Preference-based
        icon: "car-shift-pattern",
      },
      {
        label: t('car.color'),
        value1: car1.color && typeof car1.color === 'string' ? t(`colors.${car1.color}`) || car1.color : car1.color,
        value2: car2.color && typeof car2.color === 'string' ? t(`colors.${car2.color}`) || car2.color : car2.color,
        better: 0, // Subjective
        icon: "palette",
      },
      {
        label: t('car.drivetrain'),
        value1: car1.drivetrain.toLowerCase() === "awd" ? t("awd") : 
                car1.drivetrain.toLowerCase() === "fwd" ? t("fwd") : 
                car1.drivetrain.toLowerCase() === "rwd" ? t("rwd") : 
                car1.drivetrain.toLowerCase() === "4wd" ? t("4wd") : 
                car1.drivetrain.toLowerCase() === "4x4" ? t("4x4") : 
                car1.drivetrain,
        value2: car2.drivetrain.toLowerCase() === "awd" ? t("awd") : 
                car2.drivetrain.toLowerCase() === "fwd" ? t("fwd") : 
                car2.drivetrain.toLowerCase() === "rwd" ? t("rwd") : 
                car2.drivetrain.toLowerCase() === "4wd" ? t("4wd") : 
                car2.drivetrain.toLowerCase() === "4x4" ? t("4x4") : 
                car2.drivetrain,
        better: 0, // Depends on needs
        icon: "car-traction-control",
      },
      {
        label: t('car.fuel_type'),
        value1: car1.type.toLowerCase() === "benzine" ? t("filters.fuel.benzine") : 
                car1.type.toLowerCase() === "diesel" ? t("filters.fuel.diesel") : 
                car1.type.toLowerCase() === "electric" ? t("filters.fuel.electric") : 
                car1.type.toLowerCase() === "hybrid" ? t("filters.fuel.hybrid") : 
                car1.type,
        value2: car2.type.toLowerCase() === "benzine" ? t("filters.fuel.benzine") : 
                car2.type.toLowerCase() === "diesel" ? t("filters.fuel.diesel") : 
                car2.type.toLowerCase() === "electric" ? t("filters.fuel.electric") : 
                car2.type.toLowerCase() === "hybrid" ? t("filters.fuel.hybrid") : 
                car2.type,
        better: 0, // Depends on preference
        icon: "gas-station",
      },
      {
        label: t('car.category'),
        value1: car1.category.toLowerCase() === "sedan" ? t("category.sedan") : 
                car1.category.toLowerCase() === "suv" ? t("category.suv") : 
                car1.category.toLowerCase() === "hatchback" ? t("category.hatchback") : 
                car1.category.toLowerCase() === "coupe" ? t("category.coupe") : 
                car1.category.toLowerCase() === "convertible" ? t("category.convertible") : 
                car1.category.toLowerCase() === "sports" || car1.category.toLowerCase() === "sport" ? t("category.sports") :
                car1.category.toLowerCase() === "classic" ? t("category.classic") :
                car1.category,
        value2: car2.category.toLowerCase() === "sedan" ? t("category.sedan") : 
                car2.category.toLowerCase() === "suv" ? t("category.suv") : 
                car2.category.toLowerCase() === "hatchback" ? t("category.hatchback") : 
                car2.category.toLowerCase() === "coupe" ? t("category.coupe") : 
                car2.category.toLowerCase() === "convertible" ? t("category.convertible") : 
                car2.category.toLowerCase() === "sports" || car2.category.toLowerCase() === "sport" ? t("category.sports") :
                car2.category.toLowerCase() === "classic" ? t("category.classic") :
                car2.category,
        better: 0, // Depends on needs
        icon: "car-estate",
      },
      {
        label: t('comparison.value_score'),
        value1: Math.round(calculateValueScore(car1)),
        value2: Math.round(calculateValueScore(car2)),
        better: getBetterValue(
          "value_score",
          calculateValueScore(car1),
          calculateValueScore(car2)
        ),
        icon: "chart-line",
        suffix: "/100",
        showBar: true,
        maxValue: 100,
        isHigherBetter: true,
      },
    ];
  }, [selectedCars]);

  // Render active tab content with memoization
  const renderTabContent = useCallback(() => {
    if (!selectedCars[0] || !selectedCars[1]) return null;

    const car1 = selectedCars[0];
    const car2 = selectedCars[1];

    switch (visibleTab) {
      case "basics":
        return (
          <>
            <ImageComparisonGallery
              car1={car1}
              car2={car2}
              isDarkMode={isDarkMode}
              t={t}
            />

            <View
              style={[
                styles.comparisonSection,
                { backgroundColor: isDarkMode ? "#1A1A1A" : "#F5F5F5" },
              ]}
            >
              <Text
                style={[
                  styles.sectionTitle,
                  { color: isDarkMode ? "#FFFFFF" : "#000000" },
                ]}
              >
{t('comparison.sections.basic_specifications')}
              </Text>

              <View style={styles.comparisonGrid}>
                <View style={styles.comparisonHeader}>
                  <View style={styles.headerSpacer} />
                  <Text
                    style={[
                      styles.carHeader,
                      { color: isDarkMode ? "#FFFFFF" : "#000000" },
                    ]}
                    numberOfLines={1}
                  >
                    {car1.year} {car1.make}
                  </Text>
                  <Text
                    style={[
                      styles.carHeader,
                      { color: isDarkMode ? "#FFFFFF" : "#000000" },
                    ]}
                    numberOfLines={1}
                  >
                    {car2.year} {car2.make}
                  </Text>
                </View>

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
                    t={t}
                  />
                ))}
              </View>
            </View>
          </>
        );

      case "features":
        return (
          <>
            <ValueComparisonChart
              car1={car1}
              car2={car2}
              isDarkMode={isDarkMode}
              t={t}
            />

            <View
              style={[
                styles.comparisonSection,
                { backgroundColor: isDarkMode ? "#1A1A1A" : "#F5F5F5" },
              ]}
            >
              <Text
                style={[
                  styles.sectionTitle,
                  { color: isDarkMode ? "#FFFFFF" : "#000000" },
                ]}
              >
{t('comparison.sections.all_features')}
              </Text>

              <View style={styles.featureHeader}>
                <View style={styles.featureHeaderLeft}>
                  <Text
                    style={[
                      styles.featureHeaderText,
                      { color: isDarkMode ? "#FFFFFF" : "#000000" },
                    ]}
                  >
{t('car.features')}
                  </Text>
                </View>

                <View style={styles.featureHeaderRight}>
                  <Text
                    style={[
                      styles.featureHeaderCarName,
                      { color: isDarkMode ? "#FFFFFF" : "#000000" },
                    ]}
                    numberOfLines={1}
                  >
                    {car1.make}
                  </Text>
                  <Text
                    style={[
                      styles.featureHeaderCarName,
                      { color: isDarkMode ? "#FFFFFF" : "#000000" },
                    ]}
                    numberOfLines={1}
                  >
                    {car2.make}
                  </Text>
                </View>
              </View>

              <FeatureComparison
                car1Features={car1.features}
                car2Features={car2.features}
                isDarkMode={isDarkMode}
                t={t}
                isRTL={isRTL}
              />
            </View>

            <View
              style={[
                styles.comparisonSection,
                { backgroundColor: isDarkMode ? "#1A1A1A" : "#F5F5F5" },
              ]}
            >
              <Text
                style={[
                  styles.sectionTitle,
                  { color: isDarkMode ? "#FFFFFF" : "#000000" },
                ]}
              >
{t('comparison.sections.safety_features')}
              </Text>

              <FeatureComparison
                car1Features={car1.features}
                car2Features={car2.features}
                isDarkMode={isDarkMode}
                t={t}
                filterByCategory="safety"
                isRTL={isRTL}
              />
            </View>

            <View
              style={[
                styles.comparisonSection,
                { backgroundColor: isDarkMode ? "#1A1A1A" : "#F5F5F5" },
              ]}
            >
              <Text
                style={[
                  styles.sectionTitle,
                  { color: isDarkMode ? "#FFFFFF" : "#000000" },
                ]}
              >
{t('comparison.sections.comfort_features')}
              </Text>

              <FeatureComparison
                car1Features={car1.features}
                car2Features={car2.features}
                isDarkMode={isDarkMode}
                t={t}
                filterByCategory="comfort"
                isRTL={isRTL}
              />
            </View>

            <View
              style={[
                styles.comparisonSection,
                { backgroundColor: isDarkMode ? "#1A1A1A" : "#F5F5F5" },
              ]}
            >
              <Text
                style={[
                  styles.sectionTitle,
                  { color: isDarkMode ? "#FFFFFF" : "#000000" },
                ]}
              >
{t('comparison.sections.technology_features')}
              </Text>

              <FeatureComparison
                car1Features={car1.features}
                car2Features={car2.features}
                isDarkMode={isDarkMode}
                t={t}
                filterByCategory="technology"
                isRTL={isRTL}
              />
            </View>
          </>
        );

      case "cost":
        return (
          <>
            {/* AI Analysis Message */}
            {(aiCostData.aiMessage || aiCostData.isLoading) && (
              <View
                style={[
                  styles.comparisonSection,
                  { backgroundColor: isDarkMode ? "#1A1A1A" : "#F5F5F5", marginBottom: 16 },
                ]}
              >
                {aiCostData.isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#D55004" />
                    <Text
                      style={[
                        styles.loadingText,
                        { color: isDarkMode ? "#FFFFFF" : "#000000", marginLeft: 8 },
                      ]}
                    >
                      {t('comparison.ai_analyzing_cost')}
                    </Text>
                  </View>
                ) : (
                  <View>
                    <Text
                      style={[
                        styles.sectionTitle,
                        { color: isDarkMode ? "#FFFFFF" : "#000000", marginBottom: 12 },
                      ]}
                    >
                      {t('comparison.ai_cost_analysis')}
                    </Text>
                    <Text
                      style={[
                        styles.insightText,
                        { color: isDarkMode ? "#bbbbbb" : "#666666", lineHeight: 20 },
                      ]}
                    >
                      {aiCostData.aiMessage}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Depreciation Estimate */}
            <View
              style={[
                styles.comparisonSection,
                { backgroundColor: isDarkMode ? "#1A1A1A" : "#F5F5F5" },
              ]}
            >
              <Text
                style={[
                  styles.sectionTitle,
                  { color: isDarkMode ? "#FFFFFF" : "#000000" },
                ]}
              >
                {t('comparison.depreciation_estimate')}
              </Text>

              <Text
                style={[
                  styles.insightText,
                  {
                    color: isDarkMode ? "#bbbbbb" : "#666666",
                    marginBottom: 12,
                  },
                ]}
              >
                {t('comparison.depreciation_description')}
              </Text>

              <View style={styles.comparisonGrid}>
                <View style={styles.comparisonHeader}>
                  <View style={styles.headerSpacer} />
                  <Text
                    style={[
                      styles.carHeader,
                      { color: isDarkMode ? "#FFFFFF" : "#000000" },
                    ]}
                    numberOfLines={1}
                  >
                    {car1.make} {car1.model}
                  </Text>
                  <Text
                    style={[
                      styles.carHeader,
                      { color: isDarkMode ? "#FFFFFF" : "#000000" },
                    ]}
                    numberOfLines={1}
                  >
                    {car2.make} {car2.model}
                  </Text>
                </View>

                <ComparisonAttribute
                  label={t('comparison.value_now')}
                  value1={aiCostData.car1Data?.currentValue || car1.price}
                  value2={aiCostData.car2Data?.currentValue || car2.price}
                  better={0}
                  isDarkMode={isDarkMode}
                  icon="cash"
                  prefix="$"
                  t={t}
                />

                <ComparisonAttribute
                  label={t('comparison.value_5_years')}
                  value1={aiCostData.car1Data?.futureValue || car1.price * 0.6}
                  value2={aiCostData.car2Data?.futureValue || car2.price * 0.6}
                  better={0}
                  isDarkMode={isDarkMode}
                  icon="calendar-clock"
                  prefix="$"
                  t={t}
                />

                <ComparisonAttribute
                  label={t('comparison.total_price_drop')}
                  value1={aiCostData.car1Data?.depreciationAmount || car1.price * 0.4}
                  value2={aiCostData.car2Data?.depreciationAmount || car2.price * 0.4}
                  better={getBetterValue(
                    "price",
                    aiCostData.car1Data?.depreciationAmount || car1.price * 0.4,
                    aiCostData.car2Data?.depreciationAmount || car2.price * 0.4
                  )}
                  isDarkMode={isDarkMode}
                  icon="chart-line-variant"
                  prefix="$"
                  t={t}
                />

                <ComparisonAttribute
                  label={t('comparison.price_drop_rate')}
                  value1={((aiCostData.car1Data?.depreciationRate || 0.4) * 100).toFixed(1)}
                  value2={((aiCostData.car2Data?.depreciationRate || 0.4) * 100).toFixed(1)}
                  better={getBetterValue(
                    "price",
                    aiCostData.car1Data?.depreciationRate || 0.4,
                    aiCostData.car2Data?.depreciationRate || 0.4
                  )}
                  isDarkMode={isDarkMode}
                  icon="percent"
                  suffix="%"
                  t={t}
                />
              </View>

              <Text
                style={[
                  styles.costDisclaimer,
                  { color: isDarkMode ? "#999999" : "#888888", marginTop: 12 },
                ]}
              >
                {t('comparison.depreciation_disclaimer')}
              </Text>
            </View>

            {/* Annual Cost Estimates */}
            <View
              style={[
                styles.comparisonSection,
                { backgroundColor: isDarkMode ? "#1A1A1A" : "#F5F5F5" },
              ]}
            >
              <Text
                style={[
                  styles.sectionTitle,
                  { color: isDarkMode ? "#FFFFFF" : "#000000" },
                ]}
              >
                {t('comparison.annual_cost_estimates')}
              </Text>

              <View style={styles.comparisonGrid}>
                <View style={styles.comparisonHeader}>
                  <View style={styles.headerSpacer} />
                  <Text
                    style={[
                      styles.carHeader,
                      { color: isDarkMode ? "#FFFFFF" : "#000000" },
                    ]}
                    numberOfLines={1}
                  >
                    {car1.make} {car1.model}
                  </Text>
                  <Text
                    style={[
                      styles.carHeader,
                      { color: isDarkMode ? "#FFFFFF" : "#000000" },
                    ]}
                    numberOfLines={1}
                  >
                    {car2.make} {car2.model}
                  </Text>
                </View>

                <ComparisonAttribute
                  label={t('comparison.est_annual_mileage')}
                  value1={aiCostData.car1Data?.annualMileage || 15000}
                  value2={aiCostData.car2Data?.annualMileage || 15000}
                  better={0}
                  isDarkMode={isDarkMode}
                  icon="road"
                  suffix=" km"
                  t={t}
                />

                <ComparisonAttribute
                  label={t('comparison.maintenance')}
                  value1={aiCostData.car1Data?.maintenance || 1200}
                  value2={aiCostData.car2Data?.maintenance || 1200}
                  better={getBetterValue(
                    "price",
                    aiCostData.car1Data?.maintenance || 1200,
                    aiCostData.car2Data?.maintenance || 1200
                  )}
                  isDarkMode={isDarkMode}
                  icon="wrench"
                  prefix="$"
                  suffix="/yr"
                  t={t}
                />

                <ComparisonAttribute
                  label={t('comparison.insurance')}
                  value1={aiCostData.car1Data?.insurance || 2000}
                  value2={aiCostData.car2Data?.insurance || 2000}
                  better={getBetterValue(
                    "price",
                    aiCostData.car1Data?.insurance || 2000,
                    aiCostData.car2Data?.insurance || 2000
                  )}
                  isDarkMode={isDarkMode}
                  icon="shield"
                  prefix="$"
                  suffix="/yr"
                  t={t}
                />

                <ComparisonAttribute
                  label={t('comparison.fuel')}
                  value1={aiCostData.car1Data?.fuel || 1500}
                  value2={aiCostData.car2Data?.fuel || 1500}
                  better={getBetterValue(
                    "price",
                    aiCostData.car1Data?.fuel || 1500,
                    aiCostData.car2Data?.fuel || 1500
                  )}
                  isDarkMode={isDarkMode}
                  icon="gas-station"
                  prefix="$"
                  suffix="/yr"
                  t={t}
                />

                <ComparisonAttribute
                  label={t('comparison.registration')}
                  value1={aiCostData.car1Data?.registration || 500}
                  value2={aiCostData.car2Data?.registration || 500}
                  better={getBetterValue(
                    "price",
                    aiCostData.car1Data?.registration || 500,
                    aiCostData.car2Data?.registration || 500
                  )}
                  isDarkMode={isDarkMode}
                  icon="file-document"
                  prefix="$"
                  suffix="/yr"
                  t={t}
                />

                <ComparisonAttribute
                  label={t('comparison.total_annual')}
                  value1={aiCostData.car1Data?.totalAnnual || 5200}
                  value2={aiCostData.car2Data?.totalAnnual || 5200}
                  better={getBetterValue(
                    "price",
                    aiCostData.car1Data?.totalAnnual || 5200,
                    aiCostData.car2Data?.totalAnnual || 5200
                  )}
                  isDarkMode={isDarkMode}
                  icon="cash-multiple"
                  prefix="$"
                  suffix="/yr"
                  showBar={true}
                  maxValue={Math.max(
                    aiCostData.car1Data?.totalAnnual || 5200,
                    aiCostData.car2Data?.totalAnnual || 5200
                  ) * 1.1}
                  isHigherBetter={false}
                  t={t}
                />

                <ComparisonAttribute
                  label={t('comparison.five_year_total')}
                  value1={aiCostData.car1Data?.totalFiveYear || 26000}
                  value2={aiCostData.car2Data?.totalFiveYear || 26000}
                  better={getBetterValue(
                    "price",
                    aiCostData.car1Data?.totalFiveYear || 26000,
                    aiCostData.car2Data?.totalFiveYear || 26000
                  )}
                  isDarkMode={isDarkMode}
                  icon="calendar-range"
                  prefix="$"
                  suffix=""
                  showBar={true}
                  maxValue={Math.max(
                    aiCostData.car1Data?.totalFiveYear || 26000,
                    aiCostData.car2Data?.totalFiveYear || 26000
                  ) * 1.1}
                  isHigherBetter={false}
                  t={t}
                />
              </View>

              <Text
                style={[
                  styles.costDisclaimer,
                  { color: isDarkMode ? "#999999" : "#888888", marginTop: 12 },
                ]}
              >
                {t('comparison.cost_disclaimer')}
              </Text>
            </View>
          </>
        );

      case "summary":
        return (
          <View
            style={[
              styles.comparisonSection,
              { backgroundColor: isDarkMode ? "#1A1A1A" : "#F5F5F5" },
            ]}
          >
            <ComparisonSummary
              car1={car1}
              car2={car2}
              isDarkMode={isDarkMode}
            />
          </View>
        );

      default:
        return null;
    }
  }, [selectedCars, visibleTab, isDarkMode, aiCostData, t]);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDarkMode ? "#000000" : "#FFFFFF" },
      ]}
    >
      <CustomHeader title={t('comparison.title')} onBack={handleBack} />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#D55004" />
          <Text
            style={[
              styles.loadingText,
              { color: isDarkMode ? "#FFFFFF" : "#000000" },
            ]}
          >
{t('autoclips.loading')} your favorite cars...
          </Text>
        </View>
      ) : (
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingBottom: 100 }}
          removeClippedSubviews={true}
          overScrollMode="never"
          bounces={Platform.OS === 'ios'}
        >
          {/* Car selection cards */}
          <View style={[
            styles.carSelectionContainer,
            { flexDirection: isRTL ? 'row-reverse' : 'row' }
          ]}>
            <CarSelectionCard
              car={selectedCars[isRTL ? 1 : 0]}
              position={isRTL ? "right" : "left"}
              isDarkMode={isDarkMode}
              onOpenPicker={openCarPicker}
              onClearCar={handleClearCar}
              t={t}
            />

            <CarSelectionCard
              car={selectedCars[isRTL ? 0 : 1]}
              position={isRTL ? "left" : "right"}
              isDarkMode={isDarkMode}
              onOpenPicker={openCarPicker}
              onClearCar={handleClearCar}
              t={t}
            />
          </View>

          {/* Comparison content */}
          {selectedCars[0] && selectedCars[1] ? (
            <View style={styles.comparisonContent}>
              <TabNavigation
                activeTab={activeTab}
                handleTabChange={handleTabChange}
                isDarkMode={isDarkMode}
                t={t}
                isRTL={isRTL}
              />

              <Animated.View style={fadeStyle}>
                {renderTabContent()}
              </Animated.View>
            </View>
          ) : (
            <EmptyState
              favoriteCars={favoriteCars}
              isDarkMode={isDarkMode}
              onBrowseCars={handleBrowseCars}
              t={t}
            />
          )}
        </Animated.ScrollView>
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
        t={t}
        isRTL={isRTL}
      />
    </View>
  );
}