import React, {
  useState,
  useEffect,
  useCallback,
  memo,
  ReactNode,
  useMemo,
} from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  StatusBar,
  Dimensions,
  Modal,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  FontAwesome,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { useTheme } from "@/utils/ThemeContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideInUp,
  SlideOutDown,
} from "react-native-reanimated";
import { supabase } from "@/utils/supabase";
import CategorySelector from "@/components/Category";
import Slider from "@react-native-community/slider";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width } = Dimensions.get("window");

// Quick Filters Configuration
const QUICK_FILTERS = [
  {
    id: "most-popular",
    label: "Most Popular",
    icon: "star",
    filter: { specialFilter: "mostPopular", sortBy: "views" },
  },
  {
    id: "budget-friendly",
    label: "Budget Friendly",
    filter: { priceRange: [0, 20000] },
  },
  {
    id: "luxury",
    label: "Luxury",
    icon: "crown",
    filter: { priceRange: [50000, 1000000] },
  },
  {
    id: "new-arrivals",
    label: "New Arrivals",
    icon: "car-clock",
    filter: { specialFilter: "newArrivals" },
  },
];

const PRICE_RANGES = [
  { label: "Under $15k", value: [0, 15000], icon: "cash" },
  { label: "$15k-30k", value: [15000, 30000], icon: "cash-multiple" },
  { label: "$30k-50k", value: [30000, 50000], icon: "currency-usd" },
  { label: "$50k+", value: [50000, 1000000], icon: "cash-100" },
];

// Vehicle Colors with Gradients
const VEHICLE_COLORS = [
  { name: "Black", gradient: ["#000000", "#1a1a1a"] },
  { name: "White", gradient: ["#ffffff", "#f5f5f5"] },
  { name: "Silver", gradient: ["#C0C0C0", "#A8A8A8"] },
  { name: "Gray", gradient: ["#808080", "#666666"] },
  { name: "Red", gradient: ["#FF0000", "#CC0000"] },
  { name: "Blue", gradient: ["#0000FF", "#0000CC"] },
  { name: "Green", gradient: ["#008000", "#006600"] },
  { name: "Brown", gradient: ["#8B4513", "#723A0F"] },
  { name: "Beige", gradient: ["#F5F5DC", "#E8E8D0"] },
  { name: "Gold", gradient: ["#FFD700", "#CCAC00"] },
];

// Transmission Options
const TRANSMISSION_OPTIONS = [
  { label: "Automatic", value: "Automatic", icon: "cog-clockwise" },
  { label: "Manual", value: "Manual", icon: "cog" },
];

// Drivetrain Options
const DRIVETRAIN_OPTIONS = [
  { label: "FWD", value: "FWD", icon: "car-traction-control" },
  { label: "RWD", value: "RWD", icon: "car-traction-control" },
  { label: "AWD", value: "AWD", icon: "car-traction-control" },
  { label: "4WD", value: "4WD", icon: "car-4x4" },
  { label: "4x4", value: "4x4", icon: "car-4x4" },
];

// Section Header Component
const SectionHeader = memo(({ title, subtitle, isDarkMode }) => (
  <View className="mb-4">
    <Text
      className={`text-xl font-bold ${
        isDarkMode ? "text-white" : "text-black"
      }`}
    >
      {title}
    </Text>
    {subtitle && (
      <Text
        className={`text-sm mt-1 ${
          isDarkMode ? "text-neutral-400" : "text-neutral-600"
        }`}
      >
        {subtitle}
      </Text>
    )}
  </View>
));

interface Brand {
  name: string;
  logoUrl: string;
}

interface BrandSelectorProps {
  selectedBrand: string;
  onSelectBrand: (brand: string) => void;
  children?: ReactNode;
}

const BRANDS_CACHE_KEY = "cachedBrandsSelector";
const CACHE_EXPIRY = 1000000000; // 24 hours in milliseconds

const getLogoUrl = (make: string, isLightMode: boolean) => {
  const formattedMake = make.toLowerCase().replace(/\s+/g, "-");
  switch (formattedMake) {
    case "range-rover":
      return isLightMode
        ? "https://www.carlogos.org/car-logos/land-rover-logo-2020-green.png"
        : "https://www.carlogos.org/car-logos/land-rover-logo.png";
    case "infiniti":
      return "https://www.carlogos.org/car-logos/infiniti-logo.png";
    case "audi":
      return "https://www.freepnglogos.com/uploads/audi-logo-2.png";
    case "nissan":
      return "https://cdn.freebiesupply.com/logos/large/2x/nissan-6-logo-png-transparent.png";
    default:
      return `https://www.carlogos.org/car-logos/${formattedMake}-logo.png`;
  }
};

const BrandSelector = memo(
  ({ selectedBrand, onSelectBrand }: BrandSelectorProps) => {
    const [brands, setBrands] = useState<Brand[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showAllBrands, setShowAllBrands] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const { isDarkMode } = useTheme();

    const fetchBrands = useMemo(
      () => async () => {
        setIsLoading(true);
        try {
          const cachedData = await AsyncStorage.getItem(BRANDS_CACHE_KEY);
          if (cachedData) {
            const { brands: cachedBrands, timestamp } = JSON.parse(cachedData);
            if (Date.now() - timestamp < CACHE_EXPIRY) {
              setBrands(cachedBrands);
              setIsLoading(false);
              return;
            }
          }

          const { data, error } = await supabase
            .from("cars")
            .select("make")
            .order("make");

          if (error) throw error;

          const uniqueBrands = Array.from(
            new Set(data.map((item: { make: string }) => item.make))
          );
          const brandsData = uniqueBrands.map((make: string) => ({
            name: make,
            logoUrl: getLogoUrl(make, !isDarkMode),
          }));

          setBrands(brandsData);

          await AsyncStorage.setItem(
            BRANDS_CACHE_KEY,
            JSON.stringify({ brands: brandsData, timestamp: Date.now() })
          );
        } catch (error) {
          console.error("Error fetching brands:", error);
        } finally {
          setIsLoading(false);
        }
      },
      [isDarkMode]
    );

    useEffect(() => {
      fetchBrands();
    }, [fetchBrands]);

    const filteredBrands = useMemo(
      () =>
        brands.filter((brand) =>
          brand.name.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      [brands, searchQuery]
    );

    const handleBrandPress = useCallback(
      (brandName: string) => {
        onSelectBrand(selectedBrand === brandName ? "" : brandName);
      },
      [onSelectBrand, selectedBrand]
    );

    if (isLoading) {
      return <ActivityIndicator size="large" color="#D55004" />;
    }

    return (
      <View className={`mt-3  mb-8 ${isDarkMode ? "" : "bg-[#FFFFFF]"}`}>
<View className="mb-4">
  <View className="flex-row justify-between items-center">
    <Text
      className={`text-xl font-bold ${
        isDarkMode ? "text-white" : "text-black"
      }`}
    >
      Brands and Models
    </Text>
    <TouchableOpacity
      onPress={() => setShowAllBrands(true)}
      className="flex-row items-center"
    >
      <Text className="text-red">View All</Text>
      <FontAwesome
        name="chevron-right"
        size={14}
        color={isDarkMode ? "#FFFFFF" : "#000000"}
        style={{ marginLeft: 8 }}
      />
    </TouchableOpacity>
  </View>
  <Text
    className={`text-sm mt-1 ${
      isDarkMode ? "text-neutral-400" : "text-neutral-600"
    }`}
  >
    Filter by brands
  </Text>
</View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="rounded-lg"
        >
          {brands.map((brand, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => handleBrandPress(brand.name)}
              className="items-center mb-1 mt-1 mr-4"
            >
              <View
                className={`p-3 rounded-xl ${
                  selectedBrand === brand.name ? "bg-red/10" : ""
                }`}
              >
                <Image
                  source={{ uri: brand.logoUrl }}
                  style={{ width: 80, height: 80 }}
                  resizeMode="contain"
                />
              </View>
              <Text
                className={`${
                  selectedBrand === brand.name
                    ? "text-red font-medium"
                    : isDarkMode
                    ? "text-white"
                    : "text-black"
                } text-center mt-2`}
              >
                {brand.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Modal for All Brands */}
        <Modal
          visible={showAllBrands}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowAllBrands(false)}
        >
          <BlurView
            intensity={isDarkMode ? 20 : 40}
            tint={isDarkMode ? "dark" : "light"}
            className="flex-1"
          >
            <TouchableOpacity
              className="flex-1"
              activeOpacity={1}
              onPress={() => setShowAllBrands(false)}
            />
            <Animated.View
              entering={SlideInDown}
              exiting={SlideOutDown}
              className={`h-[60%] rounded-t-3xl ${
                isDarkMode ? "bg-black" : "bg-white"
              }`}
            >
              <View className="p-4">
                <View className="items-center mb-2">
                  <View className="w-16 h-1 rounded-full bg-neutral-300" />
                </View>

                <View className="flex-row justify-between items-center mb-4">
                  <Text
                    className={`text-xl font-bold ${
                      isDarkMode ? "text-white" : "text-black"
                    }`}
                  >
                    All Brands
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowAllBrands(false)}
                    className="p-2"
                  >
                    <Ionicons
                      name="close"
                      size={24}
                      color={isDarkMode ? "white" : "black"}
                    />
                  </TouchableOpacity>
                </View>

                <View
                  className={`flex-row items-center rounded-full border border-[#ccc] px-4 h-12 mb-4 ${
                    isDarkMode ? "border-[#555]" : ""
                  }`}
                >
                  <FontAwesome
                    name="search"
                    size={20}
                    color={isDarkMode ? "white" : "black"}
                  />
                  <TextInput
                    className={`flex-1 px-3 h-full ${
                      isDarkMode ? "text-white" : "text-black"
                    }`}
                    style={{ textAlignVertical: "center" }}
                    placeholder="Search brands..."
                    placeholderTextColor={isDarkMode ? "lightgray" : "gray"}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </View>

                <ScrollView
                  className="pt-2"
                  showsVerticalScrollIndicator={false}
                >
                  {filteredBrands.map((brand, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => {
                        handleBrandPress(brand.name);
                        setShowAllBrands(false);
                      }}
                      className={`flex-row items-center p-4 mb-2 rounded-xl ${
                        selectedBrand === brand.name
                          ? "bg-red/10"
                          : isDarkMode
                          ? "bg-neutral-800"
                          : "bg-neutral-100"
                      }`}
                    >
                      <View className="w-12 h-12 justify-center items-center mr-3">
                        <Image
                          source={{ uri: brand.logoUrl }}
                          style={{ width: 40, height: 40 }}
                          resizeMode="contain"
                        />
                      </View>
                      <Text
                        className={`flex-1 font-medium ${
                          selectedBrand === brand.name ? "text-red" : ""
                        } ${isDarkMode ? "text-white" : "text-black"}`}
                        numberOfLines={1}
                      >
                        {brand.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <View className="h-32" />
                </ScrollView>
              </View>
            </Animated.View>
          </BlurView>
        </Modal>
      </View>
    );
  }
);
const ModelSelector = memo(
  ({ make, selectedModel, onSelectModel, isDarkMode }) => {
    const [models, setModels] = useState([]);

    useEffect(() => {
      const fetchModels = async () => {
        if (!make) return;

        const { data, error } = await supabase
          .from("cars")
          .select("model")
          .eq("make", make)
          .order("model");

        if (!error) {
          const uniqueModels = Array.from(
            new Set(data.map((item) => item.model))
          );
          setModels(uniqueModels);
        }
      };
      fetchModels();
    }, [make]);

    if (!make) return null;

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-6"
      >
        {models.map((model, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => onSelectModel(selectedModel === model ? "" : model)}
            className={`mr-3`}
          >
            <BlurView
              intensity={isDarkMode ? 20 : 40}
              tint={isDarkMode ? "dark" : "light"}
              className="rounded-2xl"
            >
              <LinearGradient
                colors={
                  selectedModel === model
                    ? ["#D55004", "#FF6B00"]
                    : isDarkMode
                    ? ["#1c1c1c", "#2d2d2d"]
                    : ["#f5f5f5", "#e5e5e5"]
                }
                className="px-6 py-4 rounded-2xl"
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text
                  className={`text-base font-medium
                ${
                  selectedModel === model
                    ? "text-white"
                    : isDarkMode
                    ? "text-white"
                    : "text-black"
                }`}
                >
                  {model}
                </Text>
              </LinearGradient>
            </BlurView>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  }
);

// Range Selector Component
const RangeSelector = memo(
  ({ title, min, max, value, onChange, prefix = "", isDarkMode, step = 1 }) => {
    const [localValue, setLocalValue] = useState(["", ""]);
    const isYearSelector = title.toLowerCase() === "year";

    // Initialize local value on mount and when value prop changes
    useEffect(() => {
      if (value && Array.isArray(value)) {
        setLocalValue([value[0].toString(), value[1].toString()]);
      }
    }, [value]);

    const formatValue = useCallback(
      (val: string | number) => {
        if (isYearSelector) {
          return val.toString();
        }
        const numericValue = typeof val === "string" ? parseInt(val) : val;
        if (isNaN(numericValue)) return "";
        const formattedNumber = Math.round(numericValue).toLocaleString();
        return prefix === "$"
          ? `${prefix}${formattedNumber}`
          : `${formattedNumber}${prefix}`;
      },
      [prefix, isYearSelector]
    );

    const validateAndFormatYear = useCallback(
      (value: string) => {
        const numValue = parseInt(value);
        if (isNaN(numValue)) return "";
        if (numValue < min) return min.toString();
        if (numValue > max) return max.toString();
        return numValue.toString();
      },
      [min, max]
    );

    const handleTextChange = useCallback(
      (text: string, index: number) => {
        // Remove non-numeric characters
        const cleanText = text.replace(/[^0-9]/g, "");

        // Update local value immediately for responsive input
        const newLocalValue = [...localValue];
        newLocalValue[index] = cleanText;
        setLocalValue(newLocalValue);

        if (cleanText === "") return;

        if (isYearSelector) {
          // For year input, wait for the full year to be typed
          if (cleanText.length < 4) return;

          const validYear = validateAndFormatYear(cleanText);
          if (!validYear) return;

          const yearValue = parseInt(validYear);
          const otherIndex = index === 0 ? 1 : 0;
          const otherValue =
            parseInt(localValue[otherIndex]) || (index === 0 ? max : min);

          // Ensure min <= max
          const newRange =
            index === 0
              ? [yearValue, Math.max(yearValue, otherValue)]
              : [Math.min(yearValue, otherValue), yearValue];

          onChange(newRange);
        } else {
          // Handle other numeric inputs
          const numValue = parseInt(cleanText);
          if (isNaN(numValue)) return;

          const clampedValue = Math.min(Math.max(numValue, min), max);
          const otherIndex = index === 0 ? 1 : 0;
          const otherValue =
            parseInt(localValue[otherIndex]) || (index === 0 ? max : min);

          const newRange =
            index === 0
              ? [clampedValue, Math.max(clampedValue, otherValue)]
              : [Math.min(clampedValue, otherValue), clampedValue];

          onChange(newRange);
        }
      },
      [localValue, onChange, min, max, isYearSelector, validateAndFormatYear]
    );

    const handleBlur = useCallback(
      (index: number) => {
        const currentValue = localValue[index];
        if (currentValue === "") {
          // Reset to min/max on blur if empty
          const defaultValue = index === 0 ? min : max;
          const newLocalValue = [...localValue];
          newLocalValue[index] = defaultValue.toString();
          setLocalValue(newLocalValue);

          const newRange = [...value];
          newRange[index] = defaultValue;
          onChange(newRange);
        } else if (isYearSelector) {
          // Validate and format year on blur
          const validYear = validateAndFormatYear(currentValue);
          const newLocalValue = [...localValue];
          newLocalValue[index] = validYear;
          setLocalValue(newLocalValue);

          if (validYear) {
            const yearValue = parseInt(validYear);
            const otherIndex = index === 0 ? 1 : 0;
            const otherValue =
              parseInt(localValue[otherIndex]) || (index === 0 ? max : min);

            const newRange =
              index === 0
                ? [yearValue, Math.max(yearValue, otherValue)]
                : [Math.min(yearValue, otherValue), yearValue];

            onChange(newRange);
          }
        }
      },
      [
        localValue,
        value,
        onChange,
        min,
        max,
        isYearSelector,
        validateAndFormatYear,
      ]
    );

    return (
      <View className="mb-6">
        <Text
          className={`text-base font-medium mb-4
          ${isDarkMode ? "text-white" : "text-black"}`}
        >
          {title}
        </Text>

        <View className="flex-row items-center space-x-4">
          <BlurView
            intensity={isDarkMode ? 20 : 40}
            tint={isDarkMode ? "dark" : "light"}
            className="flex-1 rounded-2xl overflow-hidden"
          >
            <LinearGradient
              colors={
                isDarkMode ? ["#1c1c1c", "#2d2d2d"] : ["#f5f5f5", "#e5e5e5"]
              }
              className="p-4"
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text
                className={`text-xs mb-1
                ${isDarkMode ? "text-neutral-400" : "text-neutral-600"}`}
              >
                Min {title}
              </Text>
              <TextInput
                value={localValue[0]}
                onChangeText={(text) => handleTextChange(text, 0)}
                onBlur={() => handleBlur(0)}
                keyboardType="numeric"
                className={`text-lg font-medium
                  ${isDarkMode ? "text-white" : "text-black"}`}
                style={{ height: 40 }}
                placeholder={min.toString()}
                placeholderTextColor={isDarkMode ? "#666" : "#999"}
                maxLength={isYearSelector ? 4 : undefined}
              />
            </LinearGradient>
          </BlurView>

          <View className="w-8 h-0.5 bg-neutral-400" />

          <BlurView
            intensity={isDarkMode ? 20 : 40}
            tint={isDarkMode ? "dark" : "light"}
            className="flex-1 rounded-2xl overflow-hidden"
          >
            <LinearGradient
              colors={
                isDarkMode ? ["#1c1c1c", "#2d2d2d"] : ["#f5f5f5", "#e5e5e5"]
              }
              className="p-4"
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text
                className={`text-xs mb-1
                ${isDarkMode ? "text-neutral-400" : "text-neutral-600"}`}
              >
                Max {title}
              </Text>
              <TextInput
                value={localValue[1]}
                onChangeText={(text) => handleTextChange(text, 1)}
                onBlur={() => handleBlur(1)}
                keyboardType="numeric"
                className={`text-lg font-medium
                  ${isDarkMode ? "text-white" : "text-black"}`}
                style={{ height: 40 }}
                placeholder={max.toString()}
                placeholderTextColor={isDarkMode ? "#666" : "#999"}
                maxLength={isYearSelector ? 4 : undefined}
              />
            </LinearGradient>
          </BlurView>
        </View>
      </View>
    );
  }
);

// Quick Filter Card Component
const QuickFilterCard = memo(({ filter, isSelected, onSelect, isDarkMode }) => (
  <TouchableOpacity onPress={onSelect} className={`mr-3 w-40  `}>
    <BlurView
      intensity={isDarkMode ? 20 : 40}
      tint={isDarkMode ? "dark" : "light"}
      className="rounded-2xl"
    >
      <LinearGradient
        colors={
          isSelected
            ? ["#D55004", "#FF6B00"]
            : isDarkMode
            ? ["#1c1c1c", "#2d2d2d"]
            : ["#f5f5f5", "#e5e5e5"]
        }
        className="px-6 py-4 rounded-2xl"
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <MaterialCommunityIcons
          name={filter.icon || "car"}
          size={24}
          color={isSelected ? "#fff" : isDarkMode ? "#fff" : "#000"}
        />
        <Text
          className={`mt-2 text-sm font-medium
          ${
            isSelected ? "text-white" : isDarkMode ? "text-white" : "text-black"
          }`}
        >
          {filter.label}
        </Text>
      </LinearGradient>
    </BlurView>
  </TouchableOpacity>
));

// Color Selector Component
const ColorSelector = memo(({ selectedColor, onSelectColor, isDarkMode }) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    className="mb-6"
  >
    {VEHICLE_COLORS.map((color) => (
      <TouchableOpacity
        key={color.name}
        onPress={() =>
          onSelectColor(selectedColor === color.name ? "" : color.name)
        }
        className={`mr-3`}
      >
        <BlurView
          intensity={isDarkMode ? 20 : 40}
          tint={isDarkMode ? "dark" : "light"}
          className="rounded-2xl p-2"
        >
          <LinearGradient
            colors={color.gradient}
            className="w-16 h-16 rounded-xl mb-2"
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <Text
            className={`text-center text-sm font-medium
            ${
              selectedColor === color.name
                ? "text-red"
                : isDarkMode
                ? "text-white"
                : "text-black"
            }`}
          >
            {color.name}
          </Text>
        </BlurView>
      </TouchableOpacity>
    ))}
  </ScrollView>
));

// Selection Card Component
const SelectionCard = memo(
  ({
    label = "",
    icon = "car",
    isSelected = false,
    onSelect = () => {},
    isDarkMode = false,
    imageUrl = null,
  }) => (
    <TouchableOpacity onPress={onSelect} className={`mr-3 mb-3 w-40 `}>
      <BlurView
        intensity={isDarkMode ? 20 : 40}
        tint={isDarkMode ? "dark" : "light"}
        className="rounded-2xl"
      >
        <LinearGradient
          colors={
            isSelected
              ? ["#D55004", "#FF6B00"]
              : isDarkMode
              ? ["#1c1c1c", "#2d2d2d"]
              : ["#f5f5f5", "#e5e5e5"]
          }
          className="p-4 rounded-2xl items-center"
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={{ width: 40, height: 40 }}
              contentFit="contain"
              className="mb-2"
            />
          ) : (
            <MaterialCommunityIcons
              name={icon}
              size={24}
              color={isSelected ? "#fff" : isDarkMode ? "#fff" : "#000"}
            />
          )}
          <Text
            className={`mt-2 text-sm font-medium
          ${
            isSelected ? "text-white" : isDarkMode ? "text-white" : "text-black"
          }`}
          >
            {label}
          </Text>
        </LinearGradient>
      </BlurView>
    </TouchableOpacity>
  )
);

// First, add this new component above your FilterPage component:
const DealershipSelector = memo(
  ({ dealerships, filters, setFilters, isDarkMode }) => {
    const [showAllDealers, setShowAllDealers] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const filteredDealerships = dealerships.filter((dealer: { name: string }) =>
      dealer.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <View>
<View className="mb-4">
  <View className="flex-row justify-between items-center">
    <Text
      className={`text-xl font-bold ${
        isDarkMode ? "text-white" : "text-black"
      }`}
    >
      Dealerships
    </Text>
    <TouchableOpacity
      onPress={() => setShowAllDealers(true)}
      className="flex-row items-center"
    >
      <Text className="text-red">View All</Text>
      <FontAwesome
        name="chevron-right"
        size={14}
        color={isDarkMode ? "#FFFFFF" : "#000000"}
        style={{ marginLeft: 8 }}
      />
    </TouchableOpacity>
  </View>
  <Text
    className={`text-sm mt-1 ${
      isDarkMode ? "text-neutral-400" : "text-neutral-600"
    }`}
  >
    Filter by dealerships
  </Text>
</View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-6"
        >
          {dealerships.map(
            (dealer: {
              id: React.Key | null | undefined;
              name:
                | string
                | number
                | boolean
                | React.ReactElement<
                    any,
                    string | React.JSXElementConstructor<any>
                  >
                | Iterable<React.ReactNode>
                | React.ReactPortal
                | null
                | undefined;
              logo: any;
            }) => (
              <TouchableOpacity
                key={dealer.id}
                onPress={() =>
                  setFilters((prev: { dealership: any }) => ({
                    ...prev,
                    dealership: prev.dealership === dealer.id ? "" : dealer.id,
                    dealershipName:
                      prev.dealership === dealer.id ? "" : dealer.name,
                  }))
                }
                className={`mr-3 `}
              >
                <BlurView
                  intensity={isDarkMode ? 20 : 40}
                  tint={isDarkMode ? "dark" : "light"}
                  className="rounded-2xl p-4 w-[110px] h-[150px] justify-between items-center"
                >
                  <View className="w-[60px] h-[60px] justify-center items-center">
                    {dealer.logo ? (
                      <Image
                        source={{ uri: dealer.logo }}
                        style={{ width: 60, height: 60 }}
                        contentFit="contain"
                      />
                    ) : (
                      <MaterialCommunityIcons
                        name="car-estate"
                        size={40}
                        color={isDarkMode ? "#666" : "#999"}
                      />
                    )}
                  </View>
                  <Text
                    className={`text-center text-sm font-medium
                ${
                  filters.dealership === dealer.id
                    ? "text-red"
                    : isDarkMode
                    ? "text-white"
                    : "text-black"
                }`}
                    numberOfLines={2}
                  >
                    {dealer.name}
                  </Text>
                </BlurView>
              </TouchableOpacity>
            )
          )}
        </ScrollView>
        // Modify the Modal section in the DealershipSelector component:
        <Modal
          visible={showAllDealers}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowAllDealers(false)}
        >
          <BlurView
            intensity={isDarkMode ? 20 : 40}
            tint={isDarkMode ? "dark" : "light"}
            className="flex-1"
          >
            <TouchableOpacity
              className="flex-1"
              activeOpacity={1}
              onPress={() => setShowAllDealers(false)}
            />
            <Animated.View
              entering={SlideInDown}
              exiting={SlideOutDown}
              className={`h-[60%] rounded-t-3xl ${
                isDarkMode ? "bg-black" : "bg-white"
              }`}
            >
              <View className="p-4">
                <View className="items-center mb-2">
                  <View className="w-16 h-1 rounded-full bg-neutral-300" />
                </View>

                <View className="flex-row justify-between items-center mb-4">
                  <Text
                    className={`text-xl font-bold ${
                      isDarkMode ? "text-white" : "text-black"
                    }`}
                  >
                    All Dealerships
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowAllDealers(false)}
                    className="p-2"
                  >
                    <Ionicons
                      name="close"
                      size={24}
                      color={isDarkMode ? "white" : "black"}
                    />
                  </TouchableOpacity>
                </View>

                <View
                  className={`flex-row items-center rounded-full border border-[#ccc] dark:border-[#555] px-4 h-12 mb-4`}
                >
                  <FontAwesome
                    name="search"
                    size={20}
                    color={isDarkMode ? "white" : "black"}
                  />
                  <TextInput
                    className={`flex-1 px-3 h-full ${
                      isDarkMode ? "text-white" : "text-black"
                    }`}
                    style={{ textAlignVertical: "center" }}
                    placeholder="Search dealerships..."
                    placeholderTextColor={isDarkMode ? "lightgray" : "gray"}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </View>

                <ScrollView
                  className="pt-2"
                  showsVerticalScrollIndicator={false}
                >
                  {filteredDealerships.map((dealer) => (
                    <TouchableOpacity
                      key={dealer.id}
                      onPress={() => {
                        setFilters((prev) => ({
                          ...prev,
                          dealership: dealer.id,
                          dealershipName: dealer.name,
                        }));
                        setShowAllDealers(false);
                      }}
                      className={`flex-row items-center p-4 mb-2 rounded-xl ${
                        filters.dealership === dealer.id
                          ? "bg-red/10"
                          : isDarkMode
                          ? "bg-neutral-800"
                          : "bg-neutral-100"
                      }`}
                    >
                      <View className="w-12 h-12 justify-center items-center mr-3">
                        {dealer.logo ? (
                          <Image
                            source={{ uri: dealer.logo }}
                            style={{ width: 40, height: 40 }}
                            contentFit="contain"
                          />
                        ) : (
                          <MaterialCommunityIcons
                            name="car-estate"
                            size={24}
                            color={isDarkMode ? "#666" : "#999"}
                          />
                        )}
                      </View>
                      <Text
                        className={`flex-1 font-medium ${
                          filters.dealership === dealer.id
                            ? "text-red"
                            : isDarkMode
                            ? "text-white"
                            : "text-black"
                        }`}
                      >
                        {dealer.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <View className="h-32" />
                </ScrollView>
              </View>
            </Animated.View>
          </BlurView>
        </Modal>
      </View>
    );
  }
);

// Then in your FilterPage component, replace the dealership section with:
{
  /* Dealership Section */
}

// Main Filter Page Component
const FilterPage = () => {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [dealerships, setDealerships] = useState([]);
  const defaultFilters = {
    dealership: "",
    dealershipName: "",
    make: "",
    model: "",
    condition: "",
    priceRange: [0, 1000000],
    mileageRange: [0, 500000],
    yearRange: [1900, new Date().getFullYear()],
    color: "",
    transmission: "",
    drivetrain: "",
    categories: [],
    quickFilter: null,
  };

  const [filters, setFilters] = useState(() => {
    if (!params.filters) return defaultFilters;

    try {
      const parsedFilters = JSON.parse(params.filters);
      return parsedFilters && typeof parsedFilters === "object"
        ? { ...defaultFilters, ...parsedFilters }
        : defaultFilters;
    } catch (error) {
      console.error("Error parsing filters:", error);
      return defaultFilters;
    }
  });

  useEffect(() => {
    const fetchDealerships = async () => {
      const { data, error } = await supabase
        .from("dealerships")
        .select("id, name, logo");
      if (!error) setDealerships(data || []);
    };
    fetchDealerships();
  }, []);

  const handleQuickFilterSelect = (
    quickFilter:
      | {
          id: string;
          label: string;
          icon: string;
          filter: {
            specialFilter: string;
            sortBy: string;
            priceRange?: undefined;
          };
        }
      | {
          id: string;
          label: string;
          filter: {
            priceRange: number[];
            specialFilter?: undefined;
            sortBy?: undefined;
          };
          icon?: undefined;
        }
      | {
          id: string;
          label: string;
          icon: string;
          filter: {
            priceRange: number[];
            specialFilter?: undefined;
            sortBy?: undefined;
          };
        }
      | {
          id: string;
          label: string;
          icon: string;
          filter: {
            specialFilter: string;
            sortBy?: undefined;
            priceRange?: undefined;
          };
        }
  ) => {
    if (filters.quickFilter?.id === quickFilter.id) {
      // Deselect if already selected
      setFilters((prev: { categories: any }) => ({
        ...defaultFilters,
        categories: prev.categories, // Preserve categories
      }));
    } else {
      setFilters((prev: { categories: any }) => ({
        ...defaultFilters,
        ...quickFilter.filter,
        quickFilter,
        categories: prev.categories, // Preserve categories
      }));
    }
  };

  const handleCategorySelect = (category: any) => {
    setFilters((prev: { categories: any[] }) => ({
      ...prev,
      categories: prev.categories?.includes(category)
        ? prev.categories.filter((c: any) => c !== category)
        : [...(prev.categories || []), category],
    }));
  };

  return (
    <SafeAreaView className={`flex-1 ${isDarkMode ? "bg-black" : "bg-white"}`}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />

      <View className="p-4 ">
        <View className="relative flex-row items-center ">
          <Text
            className={`text-xl font-bold ${
              isDarkMode ? "text-white" : "text-black"
            }`}
          >
            Filters
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            className="absolute right-4"
          >
            <Ionicons
              name="arrow-down"
              size={24}
              color={isDarkMode ? "white" : "black"}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1 px-4">
        <View className="py-4">
          {/* Quick Filters Section */}
          <SectionHeader
            title="Quick Filters"
            subtitle="Popular filter combinations"
            isDarkMode={isDarkMode}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {QUICK_FILTERS.map((filter) => (
              <QuickFilterCard
                key={filter.id}
                filter={filter}
                isSelected={filters.quickFilter?.id === filter.id}
                onSelect={() => handleQuickFilterSelect(filter)}
                isDarkMode={isDarkMode}
              />
            ))}
          </ScrollView>

          <SectionHeader
            subtitle="Select your budget range"
            isDarkMode={isDarkMode}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-6"
          >
            {PRICE_RANGES.map((range, index) => (
              <SelectionCard
                key={index}
                label={range.label}
                icon={range.icon}
                isSelected={
                  JSON.stringify(filters.priceRange || [0, 1000000]) ===
                  JSON.stringify(range.value)
                }
                onSelect={() =>
                  setFilters((prev: { priceRange: any }) => ({
                    ...prev,
                    priceRange:
                      JSON.stringify(prev.priceRange) ===
                      JSON.stringify(range.value)
                        ? [0, 1000000] // Reset to default range when deselecting
                        : range.value,
                  }))
                }
                isDarkMode={isDarkMode}
              />
            ))}
          </ScrollView>

          <LinearGradient
            colors={isDarkMode ? ["#D55004", "#FF6B00"] : ["#000", "#333"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="w-12 h-1 rounded-full mb-2"
          />

          <BrandSelector
            selectedBrand={filters.make}
            onSelectBrand={(make: any) => {
              setFilters((prev: any) => ({
                ...prev,
                make,
                model: "", // Clear model when brand changes or is deselected
              }));
            }}
            isDarkMode={isDarkMode}
          />

          <ModelSelector
            make={filters.make}
            selectedModel={filters.model}
            onSelectModel={(model: any) => setFilters({ ...filters, model })}
            isDarkMode={isDarkMode}
          />

          <LinearGradient
            colors={isDarkMode ? ["#D55004", "#FF6B00"] : ["#000", "#333"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="w-12 h-1 rounded-full mb-2"
          />

          {/* Price Range Selector */}
          <SectionHeader
            title="Price Range"
            subtitle="Set your budget range"
            isDarkMode={isDarkMode}
          />
          <RangeSelector
            title="Price"
            min={0}
            max={1000000}
            step={1000}
            value={filters.priceRange}
            onChange={(range: any) =>
              setFilters((prev: any) => ({
                ...prev,
                priceRange: range,
              }))
            }
            prefix="$"
            isDarkMode={isDarkMode}
          />

          <LinearGradient
            colors={isDarkMode ? ["#D55004", "#FF6B00"] : ["#000", "#333"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="w-12 h-1 rounded-full mb-2"
          />

          {/* Mileage Range Selector */}
          <SectionHeader
            title="Mileage Range"
            subtitle="Set mileage preferences"
            isDarkMode={isDarkMode}
          />
          <RangeSelector
            title="Mileage"
            min={0}
            max={500000}
            step={1000}
            value={filters.mileageRange}
            onChange={(range: any) =>
              setFilters((prev: any) => ({
                ...prev,
                mileageRange: range,
              }))
            }
            prefix=" km"
            isDarkMode={isDarkMode}
          />

          <LinearGradient
            colors={isDarkMode ? ["#D55004", "#FF6B00"] : ["#000", "#333"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="w-12 h-1 rounded-full mb-2"
          />

          {/* Year Range Selector */}
          <SectionHeader
            title="Year Range"
            subtitle="Select manufacturing year range"
            isDarkMode={isDarkMode}
          />
          <RangeSelector
            title="Year"
            min={1900}
            max={new Date().getFullYear()}
            step={1}
            value={filters.yearRange}
            onChange={(range: number[]) =>
              setFilters((prev: any) => ({
                ...prev,
                yearRange: range.map(Math.floor),
              }))
            }
            isDarkMode={isDarkMode}
          />

          <LinearGradient
            colors={isDarkMode ? ["#D55004", "#FF6B00"] : ["#000", "#333"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="w-12 h-1 rounded-full mb-2"
          />

          {/* Dealership Section */}

          <DealershipSelector
            dealerships={dealerships}
            filters={filters}
            setFilters={setFilters}
            isDarkMode={isDarkMode}
          />

          <LinearGradient
            colors={isDarkMode ? ["#D55004", "#FF6B00"] : ["#000", "#333"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="w-12 h-1 rounded-full mb-2"
          />

          {/* Transmission Options */}
          <SectionHeader
            title="Transmission"
            subtitle="Choose transmission type"
            isDarkMode={isDarkMode}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-6"
          >
            {TRANSMISSION_OPTIONS.map((option) => (
              <SelectionCard
                key={option.value}
                label={option.label}
                icon={option.icon}
                isSelected={filters.transmission === option.value}
                onSelect={() =>
                  setFilters((prev: { transmission: string }) => ({
                    ...prev,
                    transmission:
                      prev.transmission === option.value ? "" : option.value,
                  }))
                }
                isDarkMode={isDarkMode}
              />
            ))}
          </ScrollView>

          {/* Drivetrain Options */}

          <LinearGradient
            colors={isDarkMode ? ["#D55004", "#FF6B00"] : ["#000", "#333"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="w-12 h-1 rounded-full mb-2"
          />
          <SectionHeader
            title="Drivetrain"
            subtitle="Select drivetrain configuration"
            isDarkMode={isDarkMode}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-6"
          >
            {DRIVETRAIN_OPTIONS.map((option) => (
              <SelectionCard
                key={option.value}
                label={option.label}
                isSelected={filters.drivetrain === option.value}
                onSelect={() =>
                  setFilters((prev: { drivetrain: string }) => ({
                    ...prev,
                    drivetrain:
                      prev.drivetrain === option.value ? "" : option.value,
                  }))
                }
                isDarkMode={isDarkMode}
              />
            ))}
          </ScrollView>

          <LinearGradient
            colors={isDarkMode ? ["#D55004", "#FF6B00"] : ["#000", "#333"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="w-12 h-1 rounded-full mb-2"
          />

          {/* Color Selection */}
          <SectionHeader
            title="Vehicle Color"
            subtitle="Choose exterior color"
            isDarkMode={isDarkMode}
          />
          <ColorSelector
            selectedColor={filters.color}
            onSelectColor={(color: any) =>
              setFilters((prev: any) => ({
                ...prev,
                color,
              }))
            }
            isDarkMode={isDarkMode}
          />

          {/* Bottom Spacing */}
          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <BlurView
        intensity={isDarkMode ? 25 : 40}
        tint={isDarkMode ? "dark" : "light"}
        className="absolute bottom-0 left-0 right-0 border-t border-neutral-200/30"
      >
<View className="flex-row  bg-white dark:bg-black justify-center items-center pb-3">
  <TouchableOpacity
    onPress={() => {
      setFilters(defaultFilters);
      router.replace({
        pathname: "/(home)/(user)",
        params: { filters: JSON.stringify({}) },
      });
    }}
    className="w-40 py-3 px-6 rounded-full bg-gradient-to-r from-neutral-600 to-neutral-800 shadow-lg transition-transform active:scale-95"
  >
    <Text className="text-black dark:text-white border border-textgray p-2 rounded-full bg-red font-medium text-center">
      Clear All
    </Text>
  </TouchableOpacity>

  <TouchableOpacity
    onPress={() => {
      router.replace({
        pathname: "/(home)/(user)",
        params: { filters: JSON.stringify(filters) },
      });
    }}
    className="w-40 py-3 px-6 rounded-full bg-gradient-to-r from-red-500 to-red-700 shadow-lg transition-transform active:scale-95"
  >
    <Text className="text-black dark:text-white border border-textgray p-2 rounded-full font-semibold text-center">
      Apply Filters
    </Text>
  </TouchableOpacity>
</View>
      </BlurView>
    </SafeAreaView>
  );
};

export default FilterPage;
