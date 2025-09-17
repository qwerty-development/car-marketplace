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
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Platform,
  Alert,
  StyleSheet,
  Share,
  Animated as RNAnimated,
  PanResponder,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import {
  FontAwesome,
  Ionicons,
  MaterialCommunityIcons,
  AntDesign,
  Feather,
  MaterialIcons,
} from "@expo/vector-icons";
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
} from "@/components/comparison/calculate";
import styles from "@/components/comparison/styles";
const { width, height } = Dimensions.get("window");

export const ComparisonAttribute = ({
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
  t,
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
  t?: (key: string) => string;
}) => {
  // Animation references
  const progressAnim1 = useRef(new RNAnimated.Value(0)).current;
  const progressAnim2 = useRef(new RNAnimated.Value(0)).current;
  const highlightAnim = useRef(new RNAnimated.Value(0)).current;

  // Automatically determine which is better if not specified
  const determineBetter = () => {
    if (better !== 0) return better; // Use provided value if not equal

    // Auto-determine better if values are different
    if (value1 === value2 || value1 === null || value2 === null ||
        value1 === undefined || value2 === undefined) {
      return 0; // Equal or incomparable
    }

    // For numeric values
    if (typeof value1 === 'number' && typeof value2 === 'number') {
      // Consider the comparison direction based on what's better
      if (label.toLowerCase().includes('price') ||
          label.toLowerCase().includes('cost') ||
          label.toLowerCase().includes('mileage')) {
        // Lower is better for price, cost, mileage
        return value1 < value2 ? 1 : 2;
      } else {
        // For most other metrics, higher is better (year, power, features, etc.)
        return value1 > value2 ? 1 : 2;
      }
    }

    return 0; // Default: equal
  };

  const effectiveBetter = determineBetter();

  // Start animations when component mounts
  useEffect(() => {
    // Only animate if we're showing bars and have a max value
    if (showBar && maxValue > 0) {
      const val1 = typeof value1 === "number" ? value1 : 0;
      const val2 = typeof value2 === "number" ? value2 : 0;

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
    if (effectiveBetter > 0) {
      RNAnimated.sequence([
        RNAnimated.timing(highlightAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
        RNAnimated.timing(highlightAnim, {
          toValue: 0.7,
          duration: 500,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [
    value1,
    value2,
    maxValue,
    showBar,
    effectiveBetter,
    progressAnim1,
    progressAnim2,
    highlightAnim,
  ]);

  // Format the value based on type
  const formatValue = (value: any) => {
    if (value === null || value === undefined) return t ? t('common.not_available') : "N/A";
    if (typeof value === "number") {
      if (
        label.toLowerCase().includes("price") ||
        label.toLowerCase().includes("cost")
      ) {
        return `${prefix}${value.toLocaleString()}${suffix}`;
      } else if (label.toLowerCase().includes("year")) {
        return `${prefix}${value}${suffix}`;
      }

      return `${prefix}${value.toLocaleString()}${suffix}`;
    }
    return `${prefix}${value}${suffix}`;
  };

  // Colors for better values
  const getBetterColor = (isBetter: boolean) => {
    if (!isBetter) return isDarkMode ? "#ffffff" : "#000000";
    return isDarkMode ? "#4ADE80" : "#10B981";
  };

  const getBetterBgColor = (isBetter: boolean) => {
    if (!isBetter) return isDarkMode ? "#333333" : "#F5F5F5";
    return isDarkMode ? "#0E3E2D" : "#E6F4F1";
  };

  // Value interpolation for highlight animation
  const getBetterBgColorAnimated = (isBetter: boolean) => {
    if (!isBetter) return isDarkMode ? "#333333" : "#F5F5F5";

    return highlightAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [
        isDarkMode ? "#0E3E2D" : "#E6F4F1",
        isDarkMode ? "#15654A" : "#D1FBF0",
      ],
    });
  };

  return (
    <View style={styles.comparisonRow}>
      {/* Attribute label with improved text handling */}
      <View style={[
        styles.attributeLabelContainer,
        {
          flex: 1.2,  // Increased flex to allow more space for labels
          marginRight: 8, // Add margin to ensure separation from value cells
        }
      ]}>
        {icon && (
          <MaterialCommunityIcons
            name={icon as any}
            size={18}
            color={isDarkMode ? "#ffffff" : "#000000"}
            style={styles.attributeIcon}
          />
        )}
        <Text
          style={[
            styles.attributeLabel,
            {
              color: isDarkMode ? "#ffffff" : "#000000",
              flexShrink: 1,  // Allow text to shrink
            }
          ]}
          numberOfLines={2}  // Allow up to 2 lines for long text
          ellipsizeMode="tail"  // Add ellipsis (...) for text truncation
        >
          {label}
        </Text>
      </View>

      {/* Values and indicators */}
      <View style={[styles.valuesContainer, { flex: 2 }]}>
        {/* Left value */}
        <RNAnimated.View
          style={[
            styles.valueCell,
            {
              backgroundColor:
                effectiveBetter === 1
                  ? getBetterBgColorAnimated(true)
                  : getBetterBgColor(false),
            },
          ]}
        >
          <Text
            style={[
              styles.valueText,
              {
                color: getBetterColor(effectiveBetter === 1),
                fontSize: 13,  // Slightly smaller font to accommodate long values
              }
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {formatValue(value1)}
          </Text>
          {effectiveBetter === 1 && (
            <AntDesign
              name="checkcircle"
              size={16}
              color={isDarkMode ? "#4ADE80" : "#10B981"}
              style={styles.betterIndicator}
            />
          )}

          {/* Progress bar for numeric values */}
          {showBar && typeof value1 === "number" && maxValue > 0 && (
            <View style={styles.progressBarContainer}>
              <RNAnimated.View
                style={[
                  styles.progressBar,
                  {
                    width: progressAnim1.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0%", "100%"],
                    }),
                    backgroundColor: isHigherBetter
                      ? effectiveBetter === 1
                        ? "#4ADE80"
                        : "#60A5FA"
                      : effectiveBetter === 1
                      ? "#4ADE80"
                      : "#F87171",
                  },
                ]}
              />
            </View>
          )}
        </RNAnimated.View>

        {/* Right value */}
        <RNAnimated.View
          style={[
            styles.valueCell,
            {
              backgroundColor:
                effectiveBetter === 2
                  ? getBetterBgColorAnimated(true)
                  : getBetterBgColor(false),
            },
          ]}
        >
          <Text
            style={[
              styles.valueText,
              {
                color: getBetterColor(effectiveBetter === 2),
                fontSize: 13,  // Slightly smaller font to accommodate long values
              }
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {formatValue(value2)}
          </Text>
          {effectiveBetter === 2 && (
            <AntDesign
              name="checkcircle"
              size={16}
              color={isDarkMode ? "#4ADE80" : "#10B981"}
              style={styles.betterIndicator}
            />
          )}

          {/* Progress bar for numeric values */}
          {showBar && typeof value2 === "number" && maxValue > 0 && (
            <View style={styles.progressBarContainer}>
              <RNAnimated.View
                style={[
                  styles.progressBar,
                  {
                    width: progressAnim2.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0%", "100%"],
                    }),
                    backgroundColor: isHigherBetter
                      ? effectiveBetter === 2
                        ? "#4ADE80"
                        : "#60A5FA"
                      : effectiveBetter === 2
                      ? "#4ADE80"
                      : "#F87171",
                  },
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
export const ImageComparisonGallery = ({
  car1,
  car2,
  isDarkMode,
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
      <Text
        style={[
          styles.galleryTitle,
          { color: isDarkMode ? "#ffffff" : "#000000" },
        ]}
      >
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
            <View
              style={[
                styles.noImagePlaceholder,
                { backgroundColor: isDarkMode ? "#333333" : "#f0f0f0" },
              ]}
            >
              <Ionicons
                name="image-outline"
                size={40}
                color={isDarkMode ? "#666666" : "#cccccc"}
              />
              <Text style={{ color: isDarkMode ? "#666666" : "#cccccc" }}>
                No image
              </Text>
            </View>
          )}
          <Text
            style={[
              styles.imageCarLabel,
              { color: isDarkMode ? "#ffffff" : "#000000" },
            ]}
          >
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
            <View
              style={[
                styles.noImagePlaceholder,
                { backgroundColor: isDarkMode ? "#333333" : "#f0f0f0" },
              ]}
            >
              <Ionicons
                name="image-outline"
                size={40}
                color={isDarkMode ? "#666666" : "#cccccc"}
              />
              <Text style={{ color: isDarkMode ? "#666666" : "#cccccc" }}>
                No image
              </Text>
            </View>
          )}
          <Text
            style={[
              styles.imageCarLabel,
              { color: isDarkMode ? "#ffffff" : "#000000" },
            ]}
          >
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
              { backgroundColor: isDarkMode ? "#333333" : "#f0f0f0" },
            ]}
            onPress={() =>
              setCurrentImageIndex((prev) => Math.max(0, prev - 1))
            }
            disabled={currentImageIndex === 0}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={isDarkMode ? "#ffffff" : "#000000"}
            />
          </TouchableOpacity>

          <Text
            style={[
              styles.galleryCounter,
              { color: isDarkMode ? "#cccccc" : "#666666" },
            ]}
          >
            {currentImageIndex + 1} / {maxImages}
          </Text>

          <TouchableOpacity
            style={[
              styles.galleryButton,
              currentImageIndex === maxImages - 1 && { opacity: 0.5 },
              { backgroundColor: isDarkMode ? "#333333" : "#f0f0f0" },
            ]}
            onPress={() =>
              setCurrentImageIndex((prev) => Math.min(maxImages - 1, prev + 1))
            }
            disabled={currentImageIndex === maxImages - 1}
          >
            <Ionicons
              name="chevron-forward"
              size={24}
              color={isDarkMode ? "#ffffff" : "#000000"}
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};



export const FeatureComparison = ({
  car1Features = [],
  car2Features = [],
  isDarkMode,
  filterByCategory,
  t,
}: {
  car1Features: string[];
  car2Features: string[];
  isDarkMode: boolean;
  filterByCategory?: string;
  t?: (key: string) => string;
}) => {
  // Get all unique features, optionally filtered by category
  const allFeatures = useMemo(() => {
    const featureSet = new Set([
      ...(car1Features || []),
      ...(car2Features || []),
    ]);

    // Filter by category if specified
    if (filterByCategory) {
      return Array.from(featureSet).filter(
        (feature) => FEATURE_METADATA[feature]?.category === filterByCategory
      );
    }

    return Array.from(featureSet);
  }, [car1Features, car2Features, filterByCategory]);

  if (allFeatures.length === 0) {
    return (
      <View style={styles.emptyFeaturesContainer}>
        <Text
          style={[
            styles.emptyFeaturesText,
            { color: isDarkMode ? "#aaaaaa" : "#666666" },
          ]}
        >
          {filterByCategory
            ? `No ${filterByCategory} features available for comparison`
            : "No feature information available for comparison"}
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
          label: feature
            .replace(/_/g, " ")
            .replace(/\b\w/g, (l) => l.toUpperCase()),
          icon: "car-feature",
          description: "Car feature",
          importance: "medium" as "medium",
          category: "technology" as "technology",
        };

        // Get translated feature name and description
        const featureLabel = t ? t(`features.${feature}`) : metadata.label;
        const featureDescription = t ? t(`features.descriptions.${feature}`) : metadata.description;

        // Importance-based styling with defaults for all features
        const getImportanceStyle = () => {
          switch (metadata.importance) {
            case "high":
              return {
                borderLeftWidth: 3,
                borderLeftColor: "#F97316", // Orange for high importance
              };
            case "medium":
              return {
                borderLeftWidth: 2,
                borderLeftColor: "#60A5FA", // Blue for medium importance
              };
            case "low":
            default:
              return {
                borderLeftWidth: 1,
                borderLeftColor: "#9CA3AF", // Gray for low importance or unspecified
              };
          }
        };

        return (
          <View
            key={feature}
            style={[
              styles.featureRow,
              getImportanceStyle(),
              {
                backgroundColor: isDarkMode
                  ? hasCar1 && hasCar2
                    ? "rgba(74, 222, 128, 0.1)"
                    : "transparent"
                  : hasCar1 && hasCar2
                  ? "rgba(16, 185, 129, 0.05)"
                  : "transparent",
                borderRadius: 8, // Added rounded corners
                marginHorizontal: 2, // Slight margin to make rounded corners more visible
              },
            ]}
          >
            <View style={[styles.featureInfo, { alignItems: 'center' }]}>
              <MaterialCommunityIcons
                name={(metadata.icon as any) || "check-circle-outline"}
                size={20}
                color={isDarkMode ? "#ffffff" : "#000000"}
                style={{ marginRight: 12 }} // Consistent margin
              />
              <View style={styles.featureTextContainer}>
                <Text
                  style={[
                    styles.featureLabel,
                    { color: isDarkMode ? "#ffffff" : "#000000" },
                  ]}
                >
                  {featureLabel}
                  {metadata.importance === "high" && (
                    <Text style={{ color: "#F97316", fontWeight: "bold" }}>
                      {" "}
                      ★
                    </Text>
                  )}
                </Text>
                <Text
                  style={[
                    styles.featureDescription,
                    { color: isDarkMode ? "#bbbbbb" : "#666666" },
                  ]}
                >
                  {featureDescription}
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

export const ValueComparisonChart = ({
  car1,
  car2,
  isDarkMode,
}: {
  car1: Car | null;
  car2: Car | null;
  isDarkMode: boolean;
}) => {
  if (!car1 || !car2) return null;

  // Define metrics to compare
  const metrics = [
    {
      label: "Value Score",
      car1Value: calculateValueScore(car1),
      car2Value: calculateValueScore(car2),
      maxValue: 100,
      higherIsBetter: true,
    },
    {
      label: "Env. Score",
      car1Value: calculateEnvironmentalScore(car1),
      car2Value: calculateEnvironmentalScore(car2),
      maxValue: 100,
      higherIsBetter: true,
    },
    {
      label: "Features",
      car1Value: car1.features?.length || 0,
      car2Value: car2.features?.length || 0,
      maxValue: 20,
      higherIsBetter: true,
    },
    {
      label: "Price Ratio",
      car1Value: (car1.features?.length || 1) / (car1.price / 10000),
      car2Value: (car2.features?.length || 1) / (car2.price / 10000),
      maxValue: 5,
      higherIsBetter: true,
    },
  ];

  return (
    <View
      style={[
        styles.valueChartContainer,
        { backgroundColor: isDarkMode ? "#1A1A1A" : "#F5F5F5" },
      ]}
    >
      <Text
        style={[
          styles.valueChartTitle,
          { color: isDarkMode ? "#ffffff" : "#000000" },
        ]}
      >
        Value Comparison Matrix
      </Text>

      <View style={styles.valueMetricsContainer}>
        {metrics.map((metric, index) => {
          // Calculate the percentages based on the total sum
          const totalValue = metric.car1Value + metric.car2Value;

          // Handle edge cases for zero or equal values
          let car1Percentage, car2Percentage;

          if (totalValue === 0) {
            // If both values are 0, distribute evenly
            car1Percentage = 50;
            car2Percentage = 50;
          } else if (metric.car1Value === metric.car2Value) {
            // If values are identical, distribute evenly
            car1Percentage = 50;
            car2Percentage = 50;
          } else {
            // Normal case: calculate proportional percentages
            car1Percentage = (metric.car1Value / totalValue) * 100;
            car2Percentage = (metric.car2Value / totalValue) * 100;
          }

          // Ensure minimum visibility (5%) even if value is very small but not zero
          if (metric.car1Value > 0 && car1Percentage < 5) car1Percentage = 5;
          if (metric.car2Value > 0 && car2Percentage < 5) car2Percentage = 5;

          // Adjust if sum exceeds 100% after minimum visibility adjustment
          if (car1Percentage + car2Percentage > 100) {
            const excess = (car1Percentage + car2Percentage) - 100;
            // Reduce proportionally from both
            car1Percentage -= (excess * car1Percentage) / (car1Percentage + car2Percentage);
            car2Percentage -= (excess * car2Percentage) / (car1Percentage + car2Percentage);
          }

          // Determine which value is better
          const car1IsBetter = metric.higherIsBetter
            ? metric.car1Value > metric.car2Value
            : metric.car1Value < metric.car2Value;
          const car2IsBetter = metric.higherIsBetter
            ? metric.car2Value > metric.car1Value
            : metric.car2Value < metric.car1Value;

          // Calculate formatted values
          const car1FormattedValue =
            metric.label === "Price Ratio"
              ? metric.car1Value.toFixed(1)
              : Math.round(metric.car1Value);

          const car2FormattedValue =
            metric.label === "Price Ratio"
              ? metric.car2Value.toFixed(1)
              : Math.round(metric.car2Value);

          return (
            <View key={`metric-${index}`} style={styles.valueMetricRow}>
              <Text
                style={[
                  styles.valueMetricLabel,
                  { color: isDarkMode ? "#ffffff" : "#000000" },
                ]}
              >
                {metric.label}
              </Text>

              <View style={styles.valueMetricBars}>
                {/* Car 1 bar */}
                <View
                  style={[
                    styles.valueBar1,
                    {
                      width: `${car1Percentage}%`,
                      backgroundColor: car1IsBetter ? "#FF6B00" : "#FF9D4D",
                      borderTopRightRadius: 0,
                      borderBottomRightRadius: 0,
                    },
                  ]}
                >
                  <Text style={[styles.valueScoreText, styles.valueScore1]}>
                    {car1FormattedValue}
                  </Text>
                </View>

                {/* Car 2 bar */}
                <View
                  style={[
                    styles.valueBar2,
                    {
                      width: `${car2Percentage}%`,
                      backgroundColor: car2IsBetter ? "#60A5FA" : "#93C5FD",
                      borderTopLeftRadius: 0,
                      borderBottomLeftRadius: 0,
                    },
                  ]}
                >
                  <Text style={[styles.valueScoreText, styles.valueScore2]}>
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
          <View style={[styles.legendColor, { backgroundColor: "#FF6B00" }]} />
          <Text
            style={[
              styles.legendText,
              { color: isDarkMode ? "#bbbbbb" : "#666666" },
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {car1.make} {car1.model}
          </Text>
        </View>

        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: "#60A5FA" }]} />
          <Text
            style={[
              styles.legendText,
              { color: isDarkMode ? "#bbbbbb" : "#666666" },
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {car2.make} {car2.model}
          </Text>
        </View>
      </View>
    </View>
  );
};
