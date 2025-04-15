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
  Dimensions,
  ActivityIndicator,
  Platform,
  Alert,
  Share,
  Animated as RNAnimated,
  Pressable,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
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
} from "react-native-reanimated";
import { supabase } from "@/utils/supabase";
import { useFavorites } from "@/utils/useFavorites";
import { useTheme } from "@/utils/ThemeContext";
import { useAuth } from "@/utils/AuthContext";
import { useGuestUser } from "@/utils/GuestUserContext";
import * as Haptics from "expo-haptics";

import { TextInput as RNTextInput } from "react-native";
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
// Get screen dimensions
import { CarPickerModal } from "@/components/comparison/modals";
import {
  ComparisonAttribute,
  ImageComparisonGallery,
  ValueComparisonChart,
  FeatureComparison,
} from "@/components/comparison/comparisons";
import { ComparisonSummary } from "@/components/comparison/comparisonSummary";
import { ShareButton } from "@/components/comparison/shareButton";
import { TotalCostOfOwnership } from "@/components/comparison/totalCostOfOwnership";

export default function CarComparison() {
  const { isDarkMode } = useTheme();
  const { favorites, isFavorite } = useFavorites();
  const { user } = useAuth();
  const { isGuest } = useGuestUser();
  const router = useRouter();
  const params = useLocalSearchParams<{ car1Id?: string; car2Id?: string }>();

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

  // State for active tab
  const [activeTab, setActiveTab] = useState<
    "basics" | "features" | "cost" | "summary"
  >("basics");

  // Animations
  const headerOpacity = useSharedValue(1);
  const scrollY = useSharedValue(0);

  // Animated scroll handler
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      if (event.contentOffset.y > 50) {
        headerOpacity.value = withTiming(0, {
          duration: 200,
          easing: Easing.ease,
        });
      } else {
        headerOpacity.value = withTiming(1, {
          duration: 200,
          easing: Easing.ease,
        });
      }
    },
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
        Alert.alert("Error", "Failed to fetch your favorite cars");
      } finally {
        setIsLoading(false);
      }
    };

    fetchFavoriteCars();
  }, [user, favorites, params.car1Id, params.car2Id]);

  // Select car handler
  const handleSelectCar = useCallback(
    (car: Car, position: "left" | "right") => {
      setSelectedCars((prev) => {
        // Provide haptic feedback
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        if (position === "left") {
          return [car, prev[1]];
        } else {
          return [prev[0], car];
        }
      });
    },
    []
  );

  const CustomHeader = React.memo(
    ({ title, onBack }: { title: string; onBack?: () => void }) => {
      const { isDarkMode } = useTheme();

      return (
        <SafeAreaView className={`bg-${isDarkMode ? "black" : "white"}`}>
          <StatusBar style={`auto`} />
          <View
            className={`flex-row items-center ml-2  ${
              Platform.OS === "ios" ? "" : "mb-7"
            }`}
          >
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
  const handleClearCar = useCallback((position: "left" | "right") => {
    setSelectedCars((prev) => {
      // Provide haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (position === "left") {
        return [null, prev[1]];
      } else {
        return [prev[0], null];
      }
    });
  }, []);

  // Open car picker modal
  const openCarPicker = useCallback((position: "left" | "right") => {
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
        {
          translateY: headerOpacity.value * 0 - (1 - headerOpacity.value) * 100,
        },
      ],
    };
  });

  // Calculate if comparison is possible
  const canCompare = useMemo(() => {
    return favoriteCars.length >= 2;
  }, [favoriteCars]);

  // Change tab with haptic feedback
  const handleTabChange = useCallback(
    (tab: "basics" | "features" | "cost" | "summary") => {
      setActiveTab(tab);

      // Provide haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    []
  );

  // Generate comparison data
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

  // Render tab navigation
  const renderTabNavigation = () => {
    return (
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            {
              borderBottomColor:
                activeTab === "basics" ? "#D55004" : "transparent",
              backgroundColor: isDarkMode ? "#121212" : "#ffffff",
            },
          ]}
          onPress={() => handleTabChange("basics")}
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === "basics"
                    ? isDarkMode
                      ? "#D55004"
                      : "#D55004"
                    : isDarkMode
                    ? "#999999"
                    : "#666666",
              },
            ]}
          >
            Basics
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            {
              borderBottomColor:
                activeTab === "features" ? "#D55004" : "transparent",
              backgroundColor: isDarkMode ? "#121212" : "#ffffff",
            },
          ]}
          onPress={() => handleTabChange("features")}
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === "features"
                    ? isDarkMode
                      ? "#D55004"
                      : "#D55004"
                    : isDarkMode
                    ? "#999999"
                    : "#666666",
              },
            ]}
          >
            Features
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            {
              borderBottomColor:
                activeTab === "cost" ? "#D55004" : "transparent",
              backgroundColor: isDarkMode ? "#121212" : "#ffffff",
            },
          ]}
          onPress={() => handleTabChange("cost")}
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === "cost"
                    ? isDarkMode
                      ? "#D55004"
                      : "#D55004"
                    : isDarkMode
                    ? "#999999"
                    : "#666666",
              },
            ]}
          >
            Cost
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            {
              borderBottomColor:
                activeTab === "summary" ? "#D55004" : "transparent",
              backgroundColor: isDarkMode ? "#121212" : "#ffffff",
            },
          ]}
          onPress={() => handleTabChange("summary")}
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === "summary"
                    ? isDarkMode
                      ? "#D55004"
                      : "#D55004"
                    : isDarkMode
                    ? "#999999"
                    : "#666666",
              },
            ]}
          >
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
      case "basics":
        return (
          <>
            {/* Images comparison */}
            <ImageComparisonGallery
              car1={selectedCars[0]}
              car2={selectedCars[1]}
              isDarkMode={isDarkMode}
            />

            {/* Basic comparison */}
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
                {/* Car names header */}
                <View style={styles.comparisonHeader}>
                  <View style={styles.headerSpacer} />
                  <Text
                    style={[
                      styles.carHeader,
                      { color: isDarkMode ? "#FFFFFF" : "#000000" },
                    ]}
                    numberOfLines={1}
                  >
                    {selectedCars[0].year} {selectedCars[0].make}
                  </Text>
                  <Text
                    style={[
                      styles.carHeader,
                      { color: isDarkMode ? "#FFFFFF" : "#000000" },
                    ]}
                    numberOfLines={1}
                  >
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

      case "features":
        return (
          <>
            {/* Value comparison chart */}
            <ValueComparisonChart
              car1={selectedCars[0]}
              car2={selectedCars[1]}
              isDarkMode={isDarkMode}
            />

            {/* All features */}
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

              {/* Feature comparison header */}
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
                    {selectedCars[0].make}
                  </Text>
                  <Text
                    style={[
                      styles.featureHeaderCarName,
                      { color: isDarkMode ? "#FFFFFF" : "#000000" },
                    ]}
                    numberOfLines={1}
                  >
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

              {/* Feature comparison content */}
              <FeatureComparison
                car1Features={selectedCars[0].features}
                car2Features={selectedCars[1].features}
                isDarkMode={isDarkMode}
                filterByCategory="safety"
              />
            </View>

            {/* Comfort features */}
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

              {/* Feature comparison content */}
              <FeatureComparison
                car1Features={selectedCars[0].features}
                car2Features={selectedCars[1].features}
                isDarkMode={isDarkMode}
                filterByCategory="comfort"
              />
            </View>

            {/* Technology features */}
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

      case "cost":
        return (
          <>
            {/* Total cost of ownership component */}
            <TotalCostOfOwnership
              car1={selectedCars[0]}
              car2={selectedCars[1]}
              isDarkMode={isDarkMode}
            />

            {/* Additional cost information */}
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
                {/* Car names header */}
                <View style={styles.comparisonHeader}>
                  <View style={styles.headerSpacer} />
                  <Text
                    style={[
                      styles.carHeader,
                      { color: isDarkMode ? "#FFFFFF" : "#000000" },
                    ]}
                    numberOfLines={1}
                  >
                    {selectedCars[0].make} {selectedCars[0].model}
                  </Text>
                  <Text
                    style={[
                      styles.carHeader,
                      { color: isDarkMode ? "#FFFFFF" : "#000000" },
                    ]}
                    numberOfLines={1}
                  >
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
                  const car1Age =
                    new Date().getFullYear() - selectedCars[0].year;
                  const car2Age =
                    new Date().getFullYear() - selectedCars[1].year;
                  const car1Category =
                    selectedCars[0].category || "Mass-Market";
                  const car2Category =
                    selectedCars[1].category || "Mass-Market";

                  const car1FutureValue = calculateFutureValue(
                    selectedCars[0].price,
                    car1Age,
                    5,
                    car1Category
                  );
                  const car2FutureValue = calculateFutureValue(
                    selectedCars[1].price,
                    car2Age,
                    5,
                    car2Category
                  );
                  const car1LossAmount =
                    selectedCars[0].price - car1FutureValue;
                  const car2LossAmount =
                    selectedCars[1].price - car2FutureValue;
                  const car1LossPercent =
                    (car1LossAmount / selectedCars[0].price) * 100;
                  const car2LossPercent =
                    (car2LossAmount / selectedCars[1].price) * 100;

                  const betterDepreciation =
                    car1LossPercent < car2LossPercent
                      ? 1
                      : car2LossPercent < car1LossPercent
                      ? 2
                      : 0;

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

            {/* Insurance cost estimates */}
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
                {/* Car names header */}
                <View style={styles.comparisonHeader}>
                  <View style={styles.headerSpacer} />
                  <Text
                    style={[
                      styles.carHeader,
                      { color: isDarkMode ? "#FFFFFF" : "#000000" },
                    ]}
                    numberOfLines={1}
                  >
                    {selectedCars[0].make} {selectedCars[0].model}
                  </Text>
                  <Text
                    style={[
                      styles.carHeader,
                      { color: isDarkMode ? "#FFFFFF" : "#000000" },
                    ]}
                    numberOfLines={1}
                  >
                    {selectedCars[1].make} {selectedCars[1].model}
                  </Text>
                </View>

                {/* Calculate costs */}
                {(() => {
  // Calculate costs based on the revised TCO formula
  const car1CostData = calculateTotalCostOfOwnership(selectedCars[0]);
  const car2CostData = calculateTotalCostOfOwnership(selectedCars[1]);
  
  // Extract annual costs from breakdown
  const car1Maintenance = car1CostData.breakdown.maintenance / 5; // convert 5-year to annual
  const car2Maintenance = car2CostData.breakdown.maintenance / 5;
  const car1Insurance = car1CostData.breakdown.insurance / 5;
  const car2Insurance = car2CostData.breakdown.insurance / 5;
  const car1Fuel = car1CostData.breakdown.fuel / 5;
  const car2Fuel = car2CostData.breakdown.fuel / 5;
  const car1Registration = car1CostData.breakdown.registration / 5; // Annual portion of registration
  const car2Registration = car2CostData.breakdown.registration / 5;
  
  // Calculate annual totals
  const car1Total = car1Maintenance + car1Insurance + car1Fuel + car1Registration;
  const car2Total = car2Maintenance + car2Insurance + car2Fuel + car2Registration;

  return (
    <>
      {/* Show estimated annual mileage */}
      <ComparisonAttribute
        label="Est. Annual Mileage"
        value1={car1CostData.breakdown.annualMileage}
        value2={car2CostData.breakdown.annualMileage}
        better={0} // Neutral comparison
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
          <>
            {/* Summary section */}
            <View
              style={[
                styles.comparisonSection,
                { backgroundColor: isDarkMode ? "#1A1A1A" : "#F5F5F5" },
              ]}
            >
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
    <View
      style={[
        styles.container,
        { backgroundColor: isDarkMode ? "#000000" : "#FFFFFF" },
      ]}
    >
      {/* Animated header */}
      <CustomHeader title={"Car Comparison"} onBack={() => router.back()} />

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
        >
          {/* Car selection cards */}
          <View style={styles.carSelectionContainer}>
            {/* Left car */}
            <TouchableOpacity
              style={[
                styles.carSelectionCard,
                { backgroundColor: isDarkMode ? "#1A1A1A" : "#F5F5F5" },
              ]}
              onPress={() => openCarPicker("left")}
              activeOpacity={0.7}
            >
              {selectedCars[0] ? (
                <View style={styles.selectedCarContainer}>
                  <Image
                    source={{ uri: selectedCars[0].images[0] }}
                    style={styles.selectedCarImage}
                    contentFit="cover"
                  />
                  <View style={styles.selectedCarInfo}>
                    <Text
                      style={[
                        styles.selectedCarMake,
                        { color: isDarkMode ? "#FFFFFF" : "#000000" },
                      ]}
                      numberOfLines={1}
                    >
                      {selectedCars[0].make}
                    </Text>
                    <Text
                      style={[
                        styles.selectedCarModel,
                        { color: isDarkMode ? "#FFFFFF" : "#000000" },
                      ]}
                      numberOfLines={1}
                    >
                      {selectedCars[0].model}
                    </Text>
                    <Text
                      style={[
                        styles.selectedCarYear,
                        { color: isDarkMode ? "#BBBBBB" : "#666666" },
                      ]}
                    >
                      {selectedCars[0].year}
                    </Text>
                  </View>
                  {/* We'll make the clear button a separate TouchableOpacity with stopPropagation */}
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={(e) => {
                      e.stopPropagation(); // This prevents the parent TouchableOpacity from receiving the click
                      handleClearCar("left");
                    }}
                  >
                    <Ionicons
                      name="close-circle"
                      size={22}
                      color={isDarkMode ? "#000000" : "#ffffff"}
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

            {/* Comparison indicator */}

            {/* Right car */}
            <TouchableOpacity
              style={[
                styles.carSelectionCard,
                { backgroundColor: isDarkMode ? "#1A1A1A" : "#F5F5F5" },
              ]}
              onPress={() => openCarPicker("right")}
              activeOpacity={0.7} // Added this to match the left car button
            >
              {selectedCars[1] ? (
                <View style={styles.selectedCarContainer}>
                  <Image
                    source={{ uri: selectedCars[1].images[0] }}
                    style={styles.selectedCarImage}
                    contentFit="cover"
                  />
                  <View style={styles.selectedCarInfo}>
                    <Text
                      style={[
                        styles.selectedCarMake,
                        { color: isDarkMode ? "#FFFFFF" : "#000000" },
                      ]}
                      numberOfLines={1}
                    >
                      {selectedCars[1].make}
                    </Text>
                    <Text
                      style={[
                        styles.selectedCarModel,
                        { color: isDarkMode ? "#FFFFFF" : "#000000" },
                      ]}
                      numberOfLines={1}
                    >
                      {selectedCars[1].model}
                    </Text>
                    <Text
                      style={[
                        styles.selectedCarYear,
                        { color: isDarkMode ? "#BBBBBB" : "#666666" },
                      ]}
                    >
                      {selectedCars[1].year}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={(e) => {
                      e.stopPropagation(); // Added stopPropagation to prevent event bubbling
                      handleClearCar("right");
                    }}
                  >
                    <Ionicons
                      name="close-circle"
                      size={22}
                      color={isDarkMode ? "#000000" : "#ffffff"}
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
                    onPress={() => router.push("/(home)/(user)")}
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
