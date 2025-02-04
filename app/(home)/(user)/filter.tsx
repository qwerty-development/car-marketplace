import React, { useState, useEffect, useCallback, memo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  StatusBar,
  Dimensions,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/utils/ThemeContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInUp,
  SlideOutDown,
} from "react-native-reanimated";
import { supabase } from "@/utils/supabase";
import CategorySelector from "@/components/Category";
import Slider from "@react-native-community/slider";

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

const BrandSelector = memo(({ selectedBrand, onSelectBrand, isDarkMode }:any) => {
  const [brands, setBrands] = useState([]);

  const getLogoUrl = useCallback((make: string, isLightMode: any) => {
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
  }, []);

  useEffect(() => {
    const fetchBrands = async () => {
      const { data, error } = await supabase
        .from("cars")
        .select("make")
        .order("make");

      if (!error) {
        const uniqueBrands = Array.from(new Set(data.map((item) => item.make)));
        const brandsData = uniqueBrands.map((make) => ({
          name: make,
          logoUrl: getLogoUrl(make, !isDarkMode),
        }));
        setBrands(brandsData);
      }
    };
    fetchBrands();
  }, [isDarkMode]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="mb-6"
    >
      {brands.map((brand, index) => (
        <TouchableOpacity
          key={index}
          onPress={() =>
            onSelectBrand(selectedBrand === brand.name ? "" : brand.name)
          }
          className={`mr-4 ${selectedBrand === brand.name ? "scale-110" : ""}`}
        >
          <BlurView
            intensity={isDarkMode ? 20 : 40}
            tint={isDarkMode ? "dark" : "light"}
            className="rounded-2xl p-4"
          >
            <Image
              source={{ uri: brand.logoUrl }}
              style={{ width: 60, height: 60 }}
              contentFit="contain"
            />
            <Text
              className={`mt-2 text-center text-sm font-medium
              ${
                selectedBrand === brand.name
                  ? "text-red"
                  : isDarkMode
                  ? "text-white"
                  : "text-black"
              }`}
            >
              {brand.name}
            </Text>
          </BlurView>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
});

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
            className={`mr-3 ${selectedModel === model ? "scale-110" : ""}`}
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
    // Format value with prefix and localization
    const formatValue = useCallback(
      (val: number) => {
        const formattedNumber = Math.round(val).toLocaleString();
        return prefix === "$"
          ? `${prefix}${formattedNumber}`
          : `${formattedNumber}${prefix}`;
      },
      [prefix]
    );

    // Clean and validate input
    const handleTextChange = useCallback(
      (text: string, index: number) => {
        // 1. Remove non-numeric characters
        const cleanText = text.replace(/[^0-9]/g, "");

        // 2. Parse to number, default to min/max if invalid
        const newValue = parseInt(cleanText) || (index === 0 ? min : max);

        // 3. Clamp value to valid range
        const clampedValue = Math.min(Math.max(newValue, min), max);

        // 4. Create new range array
        const newRange = [...value];
        newRange[index] = clampedValue;

        // 5. Ensure min <= max
        if (index === 0 && clampedValue > value[1]) {
          newRange[1] = clampedValue;
        } else if (index === 1 && clampedValue < value[0]) {
          newRange[0] = clampedValue;
        }

        // 6. Update parent state
        onChange(newRange);
      },
      [value, min, max, onChange]
    );

    return (
      <View className="mb-6">
        {/* Title */}
        <Text
          className={`text-base font-medium mb-4
        ${isDarkMode ? "text-white" : "text-black"}`}
        >
          {title}
        </Text>

        {/* Input Container */}
        <View className="flex-row items-center space-x-4">
          {/* Min Input */}
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
                value={formatValue(value[0])}
                onChangeText={(text) => handleTextChange(text, 0)}
                keyboardType="numeric"
                className={`text-lg font-medium
                ${isDarkMode ? "text-white" : "text-black"}`}
                style={{ height: 40 }}
                placeholder={`Min ${formatValue(min)}`}
                placeholderTextColor={isDarkMode ? "#666" : "#999"}
              />
            </LinearGradient>
          </BlurView>

          {/* Separator */}
          <View className="w-8 h-0.5 bg-neutral-400" />

          {/* Max Input */}
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
                value={formatValue(value[1])}
                onChangeText={(text) => handleTextChange(text, 1)}
                keyboardType="numeric"
                className={`text-lg font-medium
                ${isDarkMode ? "text-white" : "text-black"}`}
                style={{ height: 40 }}
                placeholder={`Max ${formatValue(max)}`}
                placeholderTextColor={isDarkMode ? "#666" : "#999"}
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
  <TouchableOpacity
    onPress={onSelect}
    className={`mr-3 w-40  ${isSelected ? "scale-110" : ""}`}
  >
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
        className={`mr-3 ${selectedColor === color.name ? "scale-110" : ""}`}
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
    <TouchableOpacity
      onPress={onSelect}
      className={`mr-3 mb-3 w-40 ${isSelected ? "scale-110" : ""}`}
    >
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

  const handleQuickFilterSelect = (quickFilter) => {
    if (filters.quickFilter?.id === quickFilter.id) {
      // Deselect if already selected
      setFilters((prev) => ({
        ...defaultFilters,
        categories: prev.categories, // Preserve categories
      }));
    } else {
      setFilters((prev) => ({
        ...defaultFilters,
        ...quickFilter.filter,
        quickFilter,
        categories: prev.categories, // Preserve categories
      }));
    }
  };

  const handleCategorySelect = (category) => {
    setFilters((prev) => ({
      ...prev,
      categories: prev.categories?.includes(category)
        ? prev.categories.filter((c) => c !== category)
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
                  setFilters((prev) => ({
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

          <SectionHeader
            title="Brand & Model"
            subtitle="Choose your preferred manufacturer"
            isDarkMode={isDarkMode}
          />
          <BrandSelector
            selectedBrand={filters.make}
            onSelectBrand={(make) => {
              setFilters((prev) => ({
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
            onSelectModel={(model) => setFilters({ ...filters, model })}
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
            onChange={(range) =>
              setFilters((prev) => ({
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
            onChange={(range) =>
              setFilters((prev) => ({
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
            onChange={(range) =>
              setFilters((prev) => ({
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
          <SectionHeader
            title="Dealerships"
            subtitle="Filter by dealership"
            isDarkMode={isDarkMode}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-6"
          >
            {dealerships.map((dealer) => (
              <TouchableOpacity
                key={dealer.id}
                onPress={() =>
                  setFilters((prev) => ({
                    ...prev,
                    dealership: prev.dealership === dealer.id ? "" : dealer.id,
                    dealershipName:
                      prev.dealership === dealer.id ? "" : dealer.name,
                  }))
                }
                className={`mr-3 ${
                  filters.dealership === dealer.id ? "scale-110" : ""
                }`}
              >
                <BlurView
                  intensity={isDarkMode ? 20 : 40}
                  tint={isDarkMode ? "dark" : "light"}
                  className="rounded-2xl p-4"
                >
                  {dealer.logo && (
                    <Image
                      source={{ uri: dealer.logo }}
                      style={{ width: 60, height: 60 }}
                      contentFit="contain"
                      className="mb-2"
                    />
                  )}
                  <Text
                    className={`text-center text-sm font-medium
                    ${
                      filters.dealership === dealer.id
                        ? "text-red"
                        : isDarkMode
                        ? "text-white"
                        : "text-black"
                    }`}
                  >
                    {dealer.name}
                  </Text>
                </BlurView>
              </TouchableOpacity>
            ))}
          </ScrollView>

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
                  setFilters((prev) => ({
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
                  setFilters((prev) => ({
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
            onSelectColor={(color) =>
              setFilters((prev) => ({
                ...prev,
                color,
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

          <CategorySelector
            selectedCategories={filters.categories || []}
            onCategoryPress={handleCategorySelect}
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
        <View className="flex-row bg-white dark:bg-black justify-between p-2">
          <TouchableOpacity
            onPress={() => {
              setFilters(defaultFilters);
              router.replace({
                pathname: "/(home)/(user)",
                params: { filters: JSON.stringify({}) },
              });
            }}
            className="flex-1 mr-2 py-3 px-6 rounded-full bg-gradient-to-r from-gray-600 to-gray-800 shadow-lg transition-transform active:scale-95"
          >
            <Text className="text-black dark:text-white border border-textgray p-2 rounded-full font-medium text-center">
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
            className="flex-1 ml-2 py-3 px-6 rounded-full bg-gradient-to-r from-red-500 to-red-700 shadow-lg transition-transform active:scale-95"
          >
            <Text className="text-black dark:text-white border  border-textgray p-2 rounded-full font-semibold text-center">
              Apply Filters
            </Text>
          </TouchableOpacity>
        </View>
      </BlurView>
    </SafeAreaView>
  );
};

export default FilterPage;
