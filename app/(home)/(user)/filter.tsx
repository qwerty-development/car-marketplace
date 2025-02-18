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
  SlideInDown,
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
  <View style={{ marginBottom: 16 }}>
    <Text
      style={{
        fontSize: 20,
        fontWeight: "bold",
        color: isDarkMode ? "white" : "black",
      }}
    >
      {title}
    </Text>
    {subtitle && (
      <Text
        style={{
          fontSize: 14,
          marginTop: 4,
          color: isDarkMode ? "#aaa" : "#555",
        }}
      >
        {subtitle}
      </Text>
    )}
  </View>
));

// --------------------
// Brand Selector Component (Multi‑select)
// --------------------
interface Brand {
  name: string;
  logoUrl: string;
}

interface BrandSelectorProps {
  selectedBrands: string[];
  onSelectBrand: (brands: string[]) => void;
  isDarkMode: boolean;
}

const BRANDS_CACHE_KEY = "cachedBrandsSelector";
const CACHE_EXPIRY = 1000000000; // dummy expiry

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
  ({ selectedBrands, onSelectBrand, isDarkMode }: BrandSelectorProps) => {
    const [brands, setBrands] = useState<Brand[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showAllBrands, setShowAllBrands] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

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
        if (selectedBrands.includes(brandName)) {
          onSelectBrand(selectedBrands.filter((b) => b !== brandName));
        } else {
          onSelectBrand([...selectedBrands, brandName]);
        }
      },
      [onSelectBrand, selectedBrands]
    );

    if (isLoading) {
      return <ActivityIndicator size="large" color="#D55004" />;
    }

    return (
      <View style={{ marginTop: 12, marginBottom: 32 }}>
        <View style={{ marginBottom: 16 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontSize: 20,
                fontWeight: "bold",
                color: isDarkMode ? "white" : "black",
              }}
            >
              Brands and Models
            </Text>
            <TouchableOpacity
              onPress={() => setShowAllBrands(true)}
              style={{ flexDirection: "row", alignItems: "center" }}
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
            style={{
              fontSize: 14,
              marginTop: 4,
              color: isDarkMode ? "#aaa" : "#555",
            }}
          >
            Filter by brands
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {brands.map((brand, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => handleBrandPress(brand.name)}
              style={{ alignItems: "center", marginRight: 16 }}
            >
              <View
                style={{
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: selectedBrands.includes(brand.name)
                    ? "rgba(255,0,0,0.1)"
                    : "transparent",
                }}
              >
                <Image
                  source={{ uri: brand.logoUrl }}
                  style={{ width: 80, height: 80 }}
                  resizeMode="contain"
                />
              </View>
              <Text
                style={{
                  marginTop: 8,
                  color: selectedBrands.includes(brand.name)
                    ? "#D55004"
                    : isDarkMode
                    ? "white"
                    : "black",
                  textAlign: "center",
                }}
              >
                {brand.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Modal
          visible={showAllBrands}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowAllBrands(false)}
        >
          <BlurView
            intensity={isDarkMode ? 20 : 40}
            tint={isDarkMode ? "dark" : "light"}
            style={{ flex: 1 }}
          >
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => setShowAllBrands(false)}
            />
            <Animated.View
              entering={SlideInDown}
              exiting={SlideOutDown}
              style={{
                height: "60%",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                backgroundColor: isDarkMode ? "black" : "white",
              }}
            >
              <View style={{ padding: 16 }}>
                <View style={{ alignItems: "center", marginBottom: 8 }}>
                  <View
                    style={{
                      width: 64,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: "#ccc",
                    }}
                  />
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 16,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: "bold",
                      color: isDarkMode ? "white" : "black",
                    }}
                  >
                    All Brands
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowAllBrands(false)}
                    style={{ padding: 8 }}
                  >
                    <Ionicons
                      name="close"
                      size={24}
                      color={isDarkMode ? "white" : "black"}
                    />
                  </TouchableOpacity>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: isDarkMode ? "#555" : "#ccc",
                    borderRadius: 24,
                    paddingHorizontal: 16,
                    height: 48,
                    marginBottom: 16,
                  }}
                >
                  <FontAwesome
                    name="search"
                    size={20}
                    color={isDarkMode ? "white" : "black"}
                  />
                  <TextInput
                    style={{
                      flex: 1,
                      marginLeft: 12,
                      color: isDarkMode ? "white" : "black",
                    }}
                    placeholder="Search brands..."
                    placeholderTextColor={isDarkMode ? "gray" : "gray"}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  {filteredBrands.map((brand, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => {
                        handleBrandPress(brand.name);
                        setShowAllBrands(false);
                      }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        padding: 16,
                        marginBottom: 8,
                        borderRadius: 12,
                        backgroundColor: selectedBrands.includes(brand.name)
                          ? "rgba(255,0,0,0.1)"
                          : isDarkMode
                          ? "#333"
                          : "#eee",
                      }}
                    >
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          justifyContent: "center",
                          alignItems: "center",
                          marginRight: 12,
                        }}
                      >
                        <Image
                          source={{ uri: brand.logoUrl }}
                          style={{ width: 40, height: 40 }}
                          resizeMode="contain"
                        />
                      </View>
                      <Text
                        style={{
                          flex: 1,
                          fontWeight: "500",
                          color: selectedBrands.includes(brand.name)
                            ? "#D55004"
                            : isDarkMode
                            ? "white"
                            : "black",
                        }}
                      >
                        {brand.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <View style={{ height: 32 }} />
                </ScrollView>
              </View>
            </Animated.View>
          </BlurView>
        </Modal>
      </View>
    );
  }
);

// --------------------
// Model Selector Component (Multi‑select)
// --------------------
const ModelSelector = memo(
  ({ make, selectedModels, onSelectModel, isDarkMode }) => {
    const [models, setModels] = useState<string[]>([]);

    useEffect(() => {
      const fetchModels = async () => {
        if (!make || make.length === 0) {
          setModels([]);
          return;
        }
        const { data, error } = await supabase
          .from("cars")
          .select("model")
          .in("make", make)
          .order("model");
        if (!error && data) {
          const uniqueModels = Array.from(new Set(data.map((item: any) => item.model)));
          setModels(uniqueModels);
        }
      };
      fetchModels();
    }, [make]);

    if (!make || make.length === 0) return null;

    const handleModelPress = (model: string) => {
      if (selectedModels.includes(model)) {
        onSelectModel(selectedModels.filter((m) => m !== model));
      } else {
        onSelectModel([...selectedModels, model]);
      }
    };

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
        {models.map((model, index) => (
          <TouchableOpacity key={index} onPress={() => handleModelPress(model)} style={{ marginRight: 16 }}>
            <BlurView
              intensity={isDarkMode ? 20 : 40}
              tint={isDarkMode ? "dark" : "light"}
              style={{ borderRadius: 12 }}
            >
              <LinearGradient
                colors={
                  selectedModels.includes(model)
                    ? ["#D55004", "#FF6B00"]
                    : isDarkMode
                    ? ["#1c1c1c", "#2d2d2d"]
                    : ["#f5f5f5", "#e5e5e5"]
                }
                style={{
                  paddingHorizontal: 24,
                  paddingVertical: 16,
                  borderRadius: 12,
                  alignItems: "center",
                }}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "500",
                    color: selectedModels.includes(model)
                      ? "white"
                      : isDarkMode
                      ? "white"
                      : "black",
                  }}
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

// --------------------
// Range Selector Component (Unchanged)
// --------------------
const RangeSelector = memo(
  ({ title, min, max, value, onChange, prefix = "", isDarkMode, step = 1 }) => {
    const [localValue, setLocalValue] = useState(["", ""]);
    const isYearSelector = title.toLowerCase() === "year";

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
        const cleanText = text.replace(/[^0-9]/g, "");
        const newLocalValue = [...localValue];
        newLocalValue[index] = cleanText;
        setLocalValue(newLocalValue);

        if (cleanText === "") return;

        if (isYearSelector) {
          if (cleanText.length < 4) return;
          const validYear = validateAndFormatYear(cleanText);
          if (!validYear) return;
          const yearValue = parseInt(validYear);
          const otherIndex = index === 0 ? 1 : 0;
          const otherValue =
            parseInt(localValue[otherIndex]) || (index === 0 ? max : min);
          const newRange =
            index === 0
              ? [yearValue, Math.max(yearValue, otherValue)]
              : [Math.min(yearValue, otherValue), yearValue];
          onChange(newRange);
        } else {
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
          const defaultValue = index === 0 ? min : max;
          const newLocalValue = [...localValue];
          newLocalValue[index] = defaultValue.toString();
          setLocalValue(newLocalValue);
          const newRange = [...value];
          newRange[index] = defaultValue;
          onChange(newRange);
        } else if (isYearSelector) {
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
      [localValue, value, onChange, min, max, isYearSelector, validateAndFormatYear]
    );

    return (
      <View style={{ marginBottom: 24 }}>
        <Text
          style={{
            fontSize: 16,
            fontWeight: "500",
            marginBottom: 16,
            color: isDarkMode ? "white" : "black",
          }}
        >
          {title}
        </Text>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <BlurView
            intensity={isDarkMode ? 20 : 40}
            tint={isDarkMode ? "dark" : "light"}
            style={{ flex: 1, borderRadius: 12, overflow: "hidden" }}
          >
            <LinearGradient
              colors={isDarkMode ? ["#1c1c1c", "#2d2d2d"] : ["#f5f5f5", "#e5e5e5"]}
              style={{ padding: 16 }}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text
                style={{
                  fontSize: 12,
                  marginBottom: 4,
                  color: isDarkMode ? "#aaa" : "#555",
                }}
              >
                Min {title}
              </Text>
              <TextInput
                value={localValue[0]}
                onChangeText={(text) => handleTextChange(text, 0)}
                onBlur={() => handleBlur(0)}
                keyboardType="numeric"
                style={{
                  fontSize: 18,
                  fontWeight: "500",
                  color: isDarkMode ? "white" : "black",
                  height: 40,
                }}
                placeholder={min.toString()}
                placeholderTextColor={isDarkMode ? "#666" : "#999"}
                maxLength={isYearSelector ? 4 : undefined}
              />
            </LinearGradient>
          </BlurView>

          <View style={{ width: 32, height: 1, backgroundColor: "#ccc", marginHorizontal: 8 }} />

          <BlurView
            intensity={isDarkMode ? 20 : 40}
            tint={isDarkMode ? "dark" : "light"}
            style={{ flex: 1, borderRadius: 12, overflow: "hidden" }}
          >
            <LinearGradient
              colors={isDarkMode ? ["#1c1c1c", "#2d2d2d"] : ["#f5f5f5", "#e5e5e5"]}
              style={{ padding: 16 }}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text
                style={{
                  fontSize: 12,
                  marginBottom: 4,
                  color: isDarkMode ? "#aaa" : "#555",
                }}
              >
                Max {title}
              </Text>
              <TextInput
                value={localValue[1]}
                onChangeText={(text) => handleTextChange(text, 1)}
                onBlur={() => handleBlur(1)}
                keyboardType="numeric"
                style={{
                  fontSize: 18,
                  fontWeight: "500",
                  color: isDarkMode ? "white" : "black",
                  height: 40,
                }}
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

// --------------------
// Quick Filter Card Component
// --------------------
const QuickFilterCard = memo(({ filter, isSelected, onSelect, isDarkMode }) => (
  <TouchableOpacity onPress={onSelect} style={{ marginRight: 16, width: 160 }}>
    <BlurView
      intensity={isDarkMode ? 20 : 40}
      tint={isDarkMode ? "dark" : "light"}
      style={{ borderRadius: 12 }}
    >
      <LinearGradient
        colors={
          isSelected
            ? ["#D55004", "#FF6B00"]
            : isDarkMode
            ? ["#1c1c1c", "#2d2d2d"]
            : ["#f5f5f5", "#e5e5e5"]
        }
        style={{
          paddingHorizontal: 24,
          paddingVertical: 16,
          borderRadius: 12,
          alignItems: "center",
        }}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <MaterialCommunityIcons
          name={filter.icon || "car"}
          size={24}
          color={isSelected ? "#fff" : isDarkMode ? "#fff" : "#000"}
        />
        <Text
          style={{
            marginTop: 8,
            fontSize: 14,
            fontWeight: "500",
            color: isSelected ? "white" : isDarkMode ? "white" : "black",
          }}
        >
          {filter.label}
        </Text>
      </LinearGradient>
    </BlurView>
  </TouchableOpacity>
));

// --------------------
// Color Selector Component
// --------------------
const ColorSelector = memo(({ selectedColor, onSelectColor, isDarkMode }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
    {VEHICLE_COLORS.map((color) => (
      <TouchableOpacity
        key={color.name}
        onPress={() =>
          onSelectColor(
            selectedColor.includes(color.name)
              ? selectedColor.filter((c: string) => c !== color.name)
              : [...selectedColor, color.name]
          )
        }
        style={{ marginRight: 16 }}
      >
        <BlurView
          intensity={isDarkMode ? 20 : 40}
          tint={isDarkMode ? "dark" : "light"}
          style={{ borderRadius: 12, padding: 8 }}
        >
          <LinearGradient
            colors={color.gradient}
            style={{ width: 64, height: 64, borderRadius: 12, marginBottom: 8 }}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <Text
            style={{
              textAlign: "center",
              fontSize: 14,
              fontWeight: "500",
              color: selectedColor.includes(color.name)
                ? "#D55004"
                : isDarkMode
                ? "white"
                : "black",
            }}
          >
            {color.name}
          </Text>
        </BlurView>
      </TouchableOpacity>
    ))}
  </ScrollView>
));

// --------------------
// Selection Card Component
// --------------------
const SelectionCard = memo(
  ({ label = "", icon = "car", isSelected = false, onSelect = () => {}, isDarkMode = false, imageUrl = null }) => (
    <TouchableOpacity onPress={onSelect} style={{ marginRight: 16, marginBottom: 16, width: 160 }}>
      <BlurView
        intensity={isDarkMode ? 20 : 40}
        tint={isDarkMode ? "dark" : "light"}
        style={{ borderRadius: 12 }}
      >
        <LinearGradient
          colors={
            isSelected
              ? ["#D55004", "#FF6B00"]
              : isDarkMode
              ? ["#1c1c1c", "#2d2d2d"]
              : ["#f5f5f5", "#e5e5e5"]
          }
          style={{ padding: 16, borderRadius: 12, alignItems: "center" }}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={{ width: 40, height: 40, marginBottom: 8 }}
              resizeMode="contain"
            />
          ) : (
            <MaterialCommunityIcons
              name={icon}
              size={24}
              color={isSelected ? "#fff" : isDarkMode ? "#fff" : "#000"}
            />
          )}
          <Text
            style={{
              marginTop: 8,
              fontSize: 14,
              fontWeight: "500",
              color: isSelected ? "white" : isDarkMode ? "white" : "black",
            }}
          >
            {label}
          </Text>
        </LinearGradient>
      </BlurView>
    </TouchableOpacity>
  )
);

// --------------------
// Dealership Selector Component (Multi‑select)
// --------------------
const DealershipSelector = memo(
  ({ dealerships, filters, setFilters, isDarkMode }) => {
    const [showAllDealers, setShowAllDealers] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const filteredDealerships = dealerships.filter((dealer: { name: string }) =>
      dealer.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <View>
        <View style={{ marginBottom: 16 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontSize: 20,
                fontWeight: "bold",
                color: isDarkMode ? "white" : "black",
              }}
            >
              Dealerships
            </Text>
            <TouchableOpacity
              onPress={() => setShowAllDealers(true)}
              style={{ flexDirection: "row", alignItems: "center" }}
            >
              <Text style={{ color: "#D55004" }}>View All</Text>
              <FontAwesome
                name="chevron-right"
                size={14}
                color={isDarkMode ? "#FFFFFF" : "#000000"}
                style={{ marginLeft: 8 }}
              />
            </TouchableOpacity>
          </View>
          <Text
            style={{
              fontSize: 14,
              marginTop: 4,
              color: isDarkMode ? "#aaa" : "#555",
            }}
          >
            Filter by dealerships
          </Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
          {dealerships.map((dealer: { id: string; name: string; logo: string }) => (
            <TouchableOpacity
              key={dealer.id}
              onPress={() =>
                setFilters((prev: any) => ({
                  ...prev,
                  dealership: prev.dealership.includes(dealer.id)
                    ? prev.dealership.filter((d: string) => d !== dealer.id)
                    : [...prev.dealership, dealer.id],
                  dealershipName: prev.dealershipName.includes(dealer.name)
                    ? prev.dealershipName.filter((n: string) => n !== dealer.name)
                    : [...prev.dealershipName, dealer.name],
                }))
              }
              style={{ marginRight: 16 }}
            >
              <BlurView
                intensity={isDarkMode ? 20 : 40}
                tint={isDarkMode ? "dark" : "light"}
                style={{
                  borderRadius: 12,
                  padding: 16,
                  width: 110,
                  height: 150,
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View style={{ width: 60, height: 60, justifyContent: "center", alignItems: "center" }}>
                  {dealer.logo ? (
                    <Image
                      source={{ uri: dealer.logo }}
                      style={{ width: 60, height: 60 }}
                      resizeMode="contain"
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
                  style={{
                    textAlign: "center",
                    fontSize: 14,
                    fontWeight: "500",
                    color: filters.dealership.includes(dealer.id)
                      ? "#D55004"
                      : isDarkMode
                      ? "white"
                      : "black",
                  }}
                  numberOfLines={2}
                >
                  {dealer.name}
                </Text>
              </BlurView>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Modal
          visible={showAllDealers}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowAllDealers(false)}
        >
          <BlurView
            intensity={isDarkMode ? 20 : 40}
            tint={isDarkMode ? "dark" : "light"}
            style={{ flex: 1 }}
          >
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => setShowAllDealers(false)}
            />
            <Animated.View
              entering={SlideInDown}
              exiting={SlideOutDown}
              style={{
                height: "60%",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                backgroundColor: isDarkMode ? "black" : "white",
              }}
            >
              <View style={{ padding: 16 }}>
                <View style={{ alignItems: "center", marginBottom: 8 }}>
                  <View
                    style={{
                      width: 64,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: "#ccc",
                    }}
                  />
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 16,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: "bold",
                      color: isDarkMode ? "white" : "black",
                    }}
                  >
                    All Dealerships
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowAllDealers(false)}
                    style={{ padding: 8 }}
                  >
                    <Ionicons
                      name="close"
                      size={24}
                      color={isDarkMode ? "white" : "black"}
                    />
                  </TouchableOpacity>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: isDarkMode ? "#555" : "#ccc",
                    borderRadius: 24,
                    paddingHorizontal: 16,
                    height: 48,
                    marginBottom: 16,
                  }}
                >
                  <FontAwesome
                    name="search"
                    size={20}
                    color={isDarkMode ? "white" : "black"}
                  />
                  <TextInput
                    style={{
                      flex: 1,
                      marginLeft: 12,
                      color: isDarkMode ? "white" : "black",
                    }}
                    placeholder="Search dealerships..."
                    placeholderTextColor={isDarkMode ? "gray" : "gray"}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  {filteredDealerships.map((dealer) => (
                    <TouchableOpacity
                      key={dealer.id}
                      onPress={() => {
                        setFilters((prev: any) => ({
                          ...prev,
                          dealership: prev.dealership.includes(dealer.id)
                            ? prev.dealership.filter((d: string) => d !== dealer.id)
                            : [...prev.dealership, dealer.id],
                          dealershipName: prev.dealershipName.includes(dealer.name)
                            ? prev.dealershipName.filter((n: string) => n !== dealer.name)
                            : [...prev.dealershipName, dealer.name],
                        }));
                        setShowAllDealers(false);
                      }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        padding: 16,
                        marginBottom: 8,
                        borderRadius: 12,
                        backgroundColor: filters.dealership.includes(dealer.id)
                          ? "rgba(255,0,0,0.1)"
                          : isDarkMode
                          ? "#333"
                          : "#eee",
                      }}
                    >
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          justifyContent: "center",
                          alignItems: "center",
                          marginRight: 12,
                        }}
                      >
                        {dealer.logo ? (
                          <Image
                            source={{ uri: dealer.logo }}
                            style={{ width: 40, height: 40 }}
                            resizeMode="contain"
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
                        style={{
                          flex: 1,
                          fontWeight: "500",
                          color: filters.dealership.includes(dealer.id)
                            ? "#D55004"
                            : isDarkMode
                            ? "white"
                            : "black",
                        }}
                      >
                        {dealer.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <View style={{ height: 32 }} />
                </ScrollView>
              </View>
            </Animated.View>
          </BlurView>
        </Modal>
      </View>
    );
  }
);

// --------------------
// Main Filter Page Component
// --------------------
const FilterPage = () => {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [dealerships, setDealerships] = useState<any[]>([]);

  // Updated default filters using arrays for multi‑select fields:
  const defaultFilters = {
    dealership: [],
    dealershipName: [],
    make: [],
    model: [],
    condition: [],
    priceRange: [0, 1000000],
    mileageRange: [0, 500000],
    yearRange: [1900, new Date().getFullYear()],
    color: [],
    transmission: [],
    drivetrain: [],
    categories: [],
    quickFilter: null,
  };

  const [filters, setFilters] = useState(() => {
    if (!params.filters) return defaultFilters;
    try {
      const parsedFilters = JSON.parse(params.filters as string);
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
      const { data, error } = await supabase.from("dealerships").select("id, name, logo");
      if (!error) setDealerships(data || []);
    };
    fetchDealerships();
  }, []);

  const handleQuickFilterSelect = (quickFilter: any) => {
    if (filters.quickFilter?.id === quickFilter.id) {
      // Deselect if already selected
      setFilters((prev: any) => ({
        ...defaultFilters,
        categories: prev.categories, // Preserve categories
      }));
    } else {
      setFilters((prev: any) => ({
        ...defaultFilters,
        ...quickFilter.filter,
        quickFilter,
        categories: prev.categories, // Preserve categories
      }));
    }
  };

  const handleCategorySelect = (category: any) => {
    setFilters((prev: any) => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter((c: any) => c !== category)
        : [...prev.categories, category],
    }));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDarkMode ? "black" : "white" }}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />

      <View style={{ padding: 16 }}>
        <View style={{ position: "relative", flexDirection: "row", alignItems: "center" }}>
          <Text
            style={{
              fontSize: 20,
              fontWeight: "bold",
              color: isDarkMode ? "white" : "black",
            }}
          >
            Filters
          </Text>
          <TouchableOpacity onPress={() => router.back()} style={{ position: "absolute", right: 16 }}>
            <Ionicons name="arrow-down" size={24} color={isDarkMode ? "white" : "black"} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={{ flex: 1, paddingHorizontal: 16 }}>
        <View style={{ paddingVertical: 16 }}>
          {/* Quick Filters Section */}
          <SectionHeader
            title="Quick Filters"
            subtitle="Popular filter combinations"
            isDarkMode={isDarkMode}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {QUICK_FILTERS.map((filterItem) => (
              <QuickFilterCard
                key={filterItem.id}
                filter={filterItem}
                isSelected={filters.quickFilter?.id === filterItem.id}
                onSelect={() => handleQuickFilterSelect(filterItem)}
                isDarkMode={isDarkMode}
              />
            ))}
          </ScrollView>

          <SectionHeader subtitle="Select your budget range" isDarkMode={isDarkMode} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
            {PRICE_RANGES.map((range, index) => (
              <SelectionCard
                key={index}
                label={range.label}
                icon={range.icon}
                isSelected={
                  JSON.stringify(filters.priceRange) === JSON.stringify(range.value)
                }
                onSelect={() =>
                  setFilters((prev: any) => ({
                    ...prev,
                    priceRange:
                      JSON.stringify(prev.priceRange) === JSON.stringify(range.value)
                        ? [0, 1000000]
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
            style={{ width: 48, height: 4, borderRadius: 2, marginBottom: 8 }}
          />

          <BrandSelector
            selectedBrands={filters.make}
            onSelectBrand={(newSelectedBrands) =>
              setFilters((prev: any) => ({
                ...prev,
                make: newSelectedBrands,
                model: [], // Clear models when brand selection changes
              }))
            }
            isDarkMode={isDarkMode}
          />

          <ModelSelector
            make={filters.make}
            selectedModels={filters.model}
            onSelectModel={(newSelectedModels) =>
              setFilters((prev: any) => ({ ...prev, model: newSelectedModels }))
            }
            isDarkMode={isDarkMode}
          />

          <LinearGradient
            colors={isDarkMode ? ["#D55004", "#FF6B00"] : ["#000", "#333"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ width: 48, height: 4, borderRadius: 2, marginBottom: 8 }}
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
              setFilters((prev: any) => ({ ...prev, priceRange: range }))
            }
            prefix="$"
            isDarkMode={isDarkMode}
          />

          <LinearGradient
            colors={isDarkMode ? ["#D55004", "#FF6B00"] : ["#000", "#333"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ width: 48, height: 4, borderRadius: 2, marginBottom: 8 }}
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
              setFilters((prev: any) => ({ ...prev, mileageRange: range }))
            }
            prefix=" km"
            isDarkMode={isDarkMode}
          />

          <LinearGradient
            colors={isDarkMode ? ["#D55004", "#FF6B00"] : ["#000", "#333"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ width: 48, height: 4, borderRadius: 2, marginBottom: 8 }}
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
            style={{ width: 48, height: 4, borderRadius: 2, marginBottom: 8 }}
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
            style={{ width: 48, height: 4, borderRadius: 2, marginBottom: 8 }}
          />

          {/* Transmission Options */}
          <SectionHeader
            title="Transmission"
            subtitle="Choose transmission type"
            isDarkMode={isDarkMode}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
            {TRANSMISSION_OPTIONS.map((option) => (
              <SelectionCard
                key={option.value}
                label={option.label}
                icon={option.icon}
                isSelected={filters.transmission.includes(option.value)}
                onSelect={() =>
                  setFilters((prev: any) => ({
                    ...prev,
                    transmission: prev.transmission.includes(option.value)
                      ? prev.transmission.filter((val: string) => val !== option.value)
                      : [...prev.transmission, option.value],
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
            style={{ width: 48, height: 4, borderRadius: 2, marginBottom: 8 }}
          />

          {/* Drivetrain Options */}
          <SectionHeader
            title="Drivetrain"
            subtitle="Select drivetrain configuration"
            isDarkMode={isDarkMode}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
            {DRIVETRAIN_OPTIONS.map((option) => (
              <SelectionCard
                key={option.value}
                label={option.label}
                isSelected={filters.drivetrain.includes(option.value)}
                onSelect={() =>
                  setFilters((prev: any) => ({
                    ...prev,
                    drivetrain: prev.drivetrain.includes(option.value)
                      ? prev.drivetrain.filter((val: string) => val !== option.value)
                      : [...prev.drivetrain, option.value],
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
            style={{ width: 48, height: 4, borderRadius: 2, marginBottom: 8 }}
          />

          {/* Color Selection */}
          <SectionHeader
            title="Vehicle Color"
            subtitle="Choose exterior color"
            isDarkMode={isDarkMode}
          />
          <ColorSelector
            selectedColor={filters.color}
            onSelectColor={(newColors) =>
              setFilters((prev: any) => ({
                ...prev,
                color: newColors,
              }))
            }
            isDarkMode={isDarkMode}
          />

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <BlurView
        intensity={isDarkMode ? 25 : 40}
        tint={isDarkMode ? "dark" : "light"}
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          borderTopWidth: 1,
          borderTopColor: "rgba(200,200,200,0.3)",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            backgroundColor: isDarkMode ? "black" : "white",
            justifyContent: "center",
            alignItems: "center",
            paddingVertical: 20,
          }}
        >
          <TouchableOpacity
            onPress={() => {
              setFilters(defaultFilters);
              router.replace({
                pathname: "/(home)/(user)",
                params: { filters: JSON.stringify({}) },
              });
            }}
            style={{
              width: 160,
              paddingVertical: 12,
              paddingHorizontal: 24,
              borderRadius: 24,
              backgroundColor: "gray",
              marginRight: 16,
            }}
          >
            <Text style={{ color: "white", fontWeight: "bold", textAlign: "center" }}>
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
            style={{
              width: 160,
              paddingVertical: 12,
              paddingHorizontal: 24,
              borderRadius: 24,
              backgroundColor: "#D55004",
            }}
          >
            <Text style={{ color: isDarkMode ? "black" : "black", fontWeight: "bold", textAlign: "center" }}>
              Apply Filters
            </Text>
          </TouchableOpacity>
        </View>
      </BlurView>
    </SafeAreaView>
  );
};

export default FilterPage;
