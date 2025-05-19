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
import { ChevronLeft } from "lucide-react-native";
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

    return (
      <SafeAreaView className={`bg-${isDarkMode ? "black" : "white"} -mb-7`}>
 
        <View
          className={`flex-row items-center ml-2  ${
            Platform.OS === "ios" ? "" : "mb-7"
          }`}
        >
          {onBack && (
            <Pressable
              onPress={onBack}
              className="p-2"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
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

// Memoized TabButton component for better performance
const TabButton = React.memo(
  ({
    tabName,
    activeTab,
    onPress,
    isDarkMode,
  }: {
    tabName: "basics" | "features" | "cost" | "summary";
    activeTab: string;
    onPress: () => void;
    isDarkMode: boolean;
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
        {tabName.charAt(0).toUpperCase() + tabName.slice(1)}
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
  }: {
    car: Car | null;
    position: "left" | "right";
    isDarkMode: boolean;
    onOpenPicker: (position: "left" | "right") => void;
    onClearCar: (position: "left" | "right") => void;
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
            Select Car
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
  }: {
    favoriteCars: Car[];
    isDarkMode: boolean;
    onBrowseCars: () => void;
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
          Select Two Cars to Compare
        </Text>
        <Text
          style={[
            styles.placeholderText,
            { color: isDarkMode ? "#BBBBBB" : "#666666" },
          ]}
        >
          Choose from your favorite cars to see a detailed comparison of
          specifications, features, and insights.
        </Text>

        {favoriteCars.length === 0 && (
          <TouchableOpacity
            style={styles.addFavoritesButton}
            onPress={onBrowseCars}
          >
            <Text style={styles.addFavoritesButtonText}>
              Browse Cars to Add Favorites
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
  }: {
    activeTab: "basics" | "features" | "cost" | "summary";
    handleTabChange: (tab: "basics" | "features" | "cost" | "summary") => void;
    isDarkMode: boolean;
  }) => (
    <View style={styles.tabContainer}>
      <TabButton
        tabName="basics"
        activeTab={activeTab}
        onPress={() => handleTabChange("basics")}
        isDarkMode={isDarkMode}
      />
      <TabButton
        tabName="features"
        activeTab={activeTab}
        onPress={() => handleTabChange("features")}
        isDarkMode={isDarkMode}
      />
      <TabButton
        tabName="cost"
        activeTab={activeTab}
        onPress={() => handleTabChange("cost")}
        isDarkMode={isDarkMode}
      />
      <TabButton
        tabName="summary"
        activeTab={activeTab}
        onPress={() => handleTabChange("summary")}
        isDarkMode={isDarkMode}
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
  const router = useRouter();
  const params = useLocalSearchParams<{ car1Id?: string; car2Id?: string }>();

  // Refs for animations
  const animationRef = useRef<any>(null);

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
    router.push("/(home)/(user)");
  }, [router]);

  // Handle back button press - optimized with useCallback
  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

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
        label: "Price",
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
        label: "Year",
        value1: car1.year,
        value2: car2.year,
        better: getBetterValue("year", car1.year, car2.year),
        icon: "calendar-blank",
        showBar: true,
        maxValue: Math.max(car1.year, car2.year),
        isHigherBetter: true,
      },
      {
        label: "Mileage",
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
        label: "Condition",
        value1: car1.condition,
        value2: car2.condition,
        better: 0, // Subjective, no better value
        icon: "car-info",
      },
      {
        label: "Trans",
        value1: car1.transmission,
        value2: car2.transmission,
        better: 0, // Preference-based
        icon: "car-shift-pattern",
      },
      {
        label: "Color",
        value1: car1.color,
        value2: car2.color,
        better: 0, // Subjective
        icon: "palette",
      },
      {
        label: "Drivetrain",
        value1: car1.drivetrain,
        value2: car2.drivetrain,
        better: 0, // Depends on needs
        icon: "car-traction-control",
      },
      {
        label: "Fuel Type",
        value1: car1.type,
        value2: car2.type,
        better: 0, // Depends on preference
        icon: "gas-station",
      },
      {
        label: "Category",
        value1: car1.category,
        value2: car2.category,
        better: 0, // Depends on needs
        icon: "car-estate",
      },
      {
        label: "Score",
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
                Basic Specifications
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
                All Features
              </Text>

              <View style={styles.featureHeader}>
                <View style={styles.featureHeaderLeft}>
                  <Text
                    style={[
                      styles.featureHeaderText,
                      { color: isDarkMode ? "#FFFFFF" : "#000000" },
                    ]}
                  >
                    Feature
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
                Safety Features
              </Text>

              <FeatureComparison
                car1Features={car1.features}
                car2Features={car2.features}
                isDarkMode={isDarkMode}
                filterByCategory="safety"
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
                Comfort Features
              </Text>

              <FeatureComparison
                car1Features={car1.features}
                car2Features={car2.features}
                isDarkMode={isDarkMode}
                filterByCategory="comfort"
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
                Technology Features
              </Text>

              <FeatureComparison
                car1Features={car1.features}
                car2Features={car2.features}
                isDarkMode={isDarkMode}
                filterByCategory="technology"
              />
            </View>
          </>
        );

      case "cost":
        return (
          <>
            <TotalCostOfOwnership
              car1={car1}
              car2={car2}
              isDarkMode={isDarkMode}
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
                Depreciation Estimate
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
                Estimated value after 5 years of ownership based on average
                depreciation rates.
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
                  label="Value Now"
                  value1={car1.price}
                  value2={car2.price}
                  better={0}
                  isDarkMode={isDarkMode}
                  icon="cash"
                  prefix="$"
                />

                {(() => {
                  const car1Age = new Date().getFullYear() - car1.year;
                  const car2Age = new Date().getFullYear() - car2.year;
                  const car1Category = car1.category || "Mass-Market";
                  const car2Category = car2.category || "Mass-Market";

                  const car1FutureValue = calculateFutureValue(
                    car1.price,
                    car1Age,
                    5,
                    car1Category
                  );
                  const car2FutureValue = calculateFutureValue(
                    car2.price,
                    car2Age,
                    5,
                    car2Category
                  );
                  const car1LossAmount = car1.price - car1FutureValue;
                  const car2LossAmount = car2.price - car2FutureValue;
                  const car1LossPercent = (car1LossAmount / car1.price) * 100;
                  const car2LossPercent = (car2LossAmount / car2.price) * 100;

                  const betterDepreciation =
                    car1LossPercent < car2LossPercent
                      ? 1
                      : car2LossPercent < car1LossPercent
                      ? 2
                      : 0;

                  return (
                    <>
                      <ComparisonAttribute
                        label="Value in 5 Years"
                        value1={car1FutureValue}
                        value2={car2FutureValue}
                        better={0}
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

              <Text
                style={[
                  styles.costDisclaimer,
                  { color: isDarkMode ? "#999999" : "#888888", marginTop: 12 },
                ]}
              >
                * Depreciation estimates are based on industry averages and may
                vary based on market conditions.
              </Text>
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
                Annual Cost Estimates
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

                {(() => {
                  const car1CostData = calculateTotalCostOfOwnership(car1);
                  const car2CostData = calculateTotalCostOfOwnership(car2);

                  const car1Maintenance = car1CostData.breakdown.maintenance / 5;
                  const car2Maintenance = car2CostData.breakdown.maintenance / 5;
                  const car1Insurance = car1CostData.breakdown.insurance / 5;
                  const car2Insurance = car2CostData.breakdown.insurance / 5;
                  const car1Fuel = car1CostData.breakdown.fuel / 5;
                  const car2Fuel = car2CostData.breakdown.fuel / 5;
                  const car1Registration = car1CostData.breakdown.registration / 5;
                  const car2Registration = car2CostData.breakdown.registration / 5;

                  const car1Total = car1Maintenance + car1Insurance + car1Fuel + car1Registration;
                  const car2Total = car2Maintenance + car2Insurance + car2Fuel + car2Registration;

                  return (
                    <>
                      <ComparisonAttribute
                        label="Est. Annual Mileage"
                        value1={car1CostData.breakdown.annualMileage}
                        value2={car2CostData.breakdown.annualMileage}
                        better={0}
                        isDarkMode={isDarkMode}
                        icon="road"
                        suffix=" km"
                      />

                      <ComparisonAttribute
                        label="Maintenance"
                        value1={car1Maintenance}
                        value2={car2Maintenance}
                        better={getBetterValue(
                          "price",
                          car1Maintenance,
                          car2Maintenance
                        )}
                        isDarkMode={isDarkMode}
                        icon="wrench"
                        prefix="$"
                        suffix="/yr"
                      />

                      <ComparisonAttribute
                        label="Insurance"
                        value1={car1Insurance}
                        value2={car2Insurance}
                        better={getBetterValue(
                          "price",
                          car1Insurance,
                          car2Insurance
                        )}
                        isDarkMode={isDarkMode}
                        icon="shield"
                        prefix="$"
                        suffix="/yr"
                      />

                      <ComparisonAttribute
                        label="Fuel"
                        value1={car1Fuel}
                        value2={car2Fuel}
                        better={getBetterValue("price", car1Fuel, car2Fuel)}
                        isDarkMode={isDarkMode}
                        icon="gas-station"
                        prefix="$"
                        suffix="/yr"
                      />

                      <ComparisonAttribute
                        label="Registration"
                        value1={car1Registration}
                        value2={car2Registration}
                        better={getBetterValue("price", car1Registration, car2Registration)}
                        isDarkMode={isDarkMode}
                        icon="file-document"
                        prefix="$"
                        suffix="/yr"
                      />

                      <ComparisonAttribute
                        label="Total Annual"
                        value1={car1Total}
                        value2={car2Total}
                        better={getBetterValue("price", car1Total, car2Total)}
                        isDarkMode={isDarkMode}
                        icon="cash-multiple"
                        prefix="$"
                        suffix="/yr"
                        showBar={true}
                        maxValue={Math.max(car1Total, car2Total) * 1.1}
                        isHigherBetter={false}
                      />

                      <ComparisonAttribute
                        label="5 Year Total"
                        value1={car1CostData.total}
                        value2={car2CostData.total}
                        better={getBetterValue("price", car1CostData.total, car2CostData.total)}
                        isDarkMode={isDarkMode}
                        icon="calendar-range"
                        prefix="$"
                        suffix=""
                        showBar={true}
                        maxValue={Math.max(car1CostData.total, car2CostData.total) * 1.1}
                        isHigherBetter={false}
                      />
                    </>
                  );
                })()}
              </View>

              <Text
                style={[
                  styles.costDisclaimer,
                  { color: isDarkMode ? "#999999" : "#888888", marginTop: 12 },
                ]}
              >
                * Cost estimates based on typical ownership patterns and may
                vary by location and driving habits.
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
  }, [selectedCars, visibleTab, isDarkMode]);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDarkMode ? "#000000" : "#FFFFFF" },
      ]}
    >
      <CustomHeader title={"Car Comparison"} onBack={handleBack} />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#D55004" />
          <Text
            style={[
              styles.loadingText,
              { color: isDarkMode ? "#FFFFFF" : "#000000" },
            ]}
          >
            Loading your favorite cars...
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
          <View style={styles.carSelectionContainer}>
            <CarSelectionCard
              car={selectedCars[0]}
              position="left"
              isDarkMode={isDarkMode}
              onOpenPicker={openCarPicker}
              onClearCar={handleClearCar}
            />

            <CarSelectionCard
              car={selectedCars[1]}
              position="right"
              isDarkMode={isDarkMode}
              onOpenPicker={openCarPicker}
              onClearCar={handleClearCar}
            />
          </View>

          {/* Comparison content */}
          {selectedCars[0] && selectedCars[1] ? (
            <View style={styles.comparisonContent}>
              <TabNavigation
                activeTab={activeTab}
                handleTabChange={handleTabChange}
                isDarkMode={isDarkMode}
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
      />
    </View>
  );
}