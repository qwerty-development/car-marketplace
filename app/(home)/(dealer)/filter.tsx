import React, {
  useState,
  useEffect,
  useCallback,
  memo,
  useMemo,
} from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
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
import Animated, { SlideInDown, SlideOutDown } from "react-native-reanimated";
import { supabase } from "@/utils/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLogoSource } from "@/hooks/getLogoUrl";
import { ImageSourcePropType } from "react-native";
import { useTranslation } from 'react-i18next';
import { I18nManager } from 'react-native';

const { width } = Dimensions.get("window");

// Quick Filters Configuration
const QUICK_FILTERS = [
  {
    id: "most-popular",
    labelKey: "filters.quick.most_popular",
    icon: "star",
    filter: { specialFilter: "mostPopular", sortBy: "views" },
  },
  {
    id: "budget-friendly",
    labelKey: "filters.quick.budget_friendly",
    filter: { priceRange: [0, 20000] },
  },
  {
    id: "luxury",
    labelKey: "filters.quick.luxury",
    icon: "crown",
    filter: { priceRange: [50000, 1000000] },
  },
  {
    id: "new-arrivals",
    labelKey: "filters.quick.new_arrivals",
    icon: "car-clock",
    filter: { specialFilter: "newArrivals" },
  },
];

const PRICE_RANGES = [
  { labelKey: "filters.price_under_15k", value: [0, 15000], icon: "cash" },
  { labelKey: "filters.price_15k_30k", value: [15000, 30000], icon: "cash-multiple" },
  { labelKey: "filters.price_30k_50k", value: [30000, 50000], icon: "currency-usd" },
  { labelKey: "filters.price_50k_plus", value: [50000, 1000000], icon: "cash-100" },
];

// Vehicle Colors with Gradients
const VEHICLE_COLORS = [
  { name: "Black", nameKey: "colors.Black", gradient: ["#000000", "#1a1a1a"] },
  { name: "White", nameKey: "colors.White", gradient: ["#ffffff", "#f5f5f5"] },
  { name: "Silver", nameKey: "colors.Silver", gradient: ["#C0C0C0", "#A8A8A8"] },
  { name: "Gray", nameKey: "colors.Gray", gradient: ["#808080", "#666666"] },
  { name: "Red", nameKey: "colors.Red", gradient: ["#FF0000", "#CC0000"] },
  { name: "Blue", nameKey: "colors.Blue", gradient: ["#0000FF", "#0000CC"] },
  { name: "Green", nameKey: "colors.Green", gradient: ["#008000", "#006600"] },
  { name: "Brown", nameKey: "colors.Brown", gradient: ["#8B4513", "#723A0F"] },
  { name: "Beige", nameKey: "colors.Beige", gradient: ["#F5F5DC", "#E8E8D0"] },
  { name: "Gold", nameKey: "colors.Gold", gradient: ["#FFD700", "#CCAC00"] },
];

// Transmission Options
const TRANSMISSION_OPTIONS = [
  { label: "Automatic", value: "Automatic", icon: "cog-clockwise" },
  { label: "Manual", value: "Manual", icon: "cog" },
];

// Drivetrain Options
// Drivetrain Options
const DRIVETRAIN_OPTIONS = [
  {
    label: "FWD",
    value: "FWD",
    getImage: (isDark: boolean) => isDark ?
      require("../../../assets/drivetrain/fwdD.png") :
      require("../../../assets/drivetrain/fwd.png")
  },
  {
    label: "RWD",
    value: "RWD",
    getImage: (isDark: boolean) => isDark ?
      require("../../../assets/drivetrain/rwdD.png") :
      require("../../../assets/drivetrain/rwd.png")
  },
  {
    label: "AWD",
    value: "AWD",
    getImage: (isDark: boolean) => isDark ?
      require("../../../assets/drivetrain/awdD.png") :
      require("../../../assets/drivetrain/awd.png")
  },
  {
    label: "4WD",
    value: "4WD",
    getImage: (isDark: boolean) => isDark ?
      require("../../../assets/drivetrain/4wdD.png") :
      require("../../../assets/drivetrain/4wd.png")
  },
  {
    label: "4x4",
    value: "4x4",
    getImage: (isDark: boolean) => isDark ?
      require("../../../assets/drivetrain/4x4D.png") :
      require("../../../assets/drivetrain/4x4.png")
  },
];

// Section Header Component
interface SectionHeaderProps {
  title?: string;
  subtitle?: string;
  isDarkMode: boolean;
}

const SectionHeader = memo(({ title, subtitle, isDarkMode }: SectionHeaderProps) => (
  <View style={{ marginBottom: 16 }}>
    {title && (<Text
      style={{
        fontSize: 20,
        fontWeight: "bold",
        color: isDarkMode ? "white" : "black",
      }}
    >
      {title}
    </Text>)}
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
const CACHE_EXPIRY = 1000 * 60 * 60 * 24; // 24 hours


const BrandSelector = memo(
  ({ selectedBrands, onSelectBrand, isDarkMode }: BrandSelectorProps) => {
    const { t } = useTranslation();
    const isRTL = I18nManager.isRTL;
    const [brands, setBrands] = useState<Brand[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showAllBrands, setShowAllBrands] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const fetchBrands = useCallback(async () => {
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
          .eq("status","available")
          .order("make");



        if (error) throw error;

        const uniqueBrands = Array.from(
          new Set(data.map((item: { make: string }) => item.make))
        );
        const brandsData = uniqueBrands.map((make: string) => ({
          name: make,
          logoSource: getLogoSource(make, isDarkMode),
        }));

        setBrands(brandsData);

        await AsyncStorage.setItem(
          BRANDS_CACHE_KEY,
          JSON.stringify({ brands: brandsData, timestamp: Date.now() })
        );
      } catch (error: any) {
        console.error("Error fetching brands:", error);
      } finally {
        setIsLoading(false);
      }
    }, [isDarkMode]);

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
              {t('filters.brands_and_models')}
            </Text>
            <TouchableOpacity
              onPress={() => setShowAllBrands(true)}
              style={{ flexDirection: "row", alignItems: "center" }}
            >
              <Text style={{ color: "#D55004" }}>{t('common.view_all')}</Text>
              <FontAwesome
                name={isRTL ? "chevron-left" : "chevron-right"}
                size={14}
                color={isDarkMode ? "#FFFFFF" : "#000000"}
                style={isRTL ? { marginRight: 8 } : { marginLeft: 8 }}
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
            {t('filters.filter_by_brands')}
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {brands.map((brand, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => handleBrandPress(brand.name)}
              style={{ alignItems: "center", marginRight: 16, marginLeft: isRTL ? 16 : 0 }}
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
                  source={brand.logoSource}
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
                    {t('filters.brands_and_models')}
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
                      marginLeft: isRTL ? 0 : 12,
                      marginRight: isRTL ? 12 : 0,
                      color: isDarkMode ? "white" : "black",
                    }}
                    placeholder={t('search.search_cars')}
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
                          marginRight: isRTL ? 0 : 12,
                          marginLeft: isRTL ? 12 : 0,
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
interface ModelSelectorProps {
  make: string[];
  selectedModels: string[];
  onSelectModel: (models: string[]) => void;
  isDarkMode: boolean;
}

const ModelSelector = memo(
  ({ make, selectedModels, onSelectModel, isDarkMode }: ModelSelectorProps) => {
    const isRTL = I18nManager.isRTL;
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
          .eq("status","available")
          .in("make", make)
          .order("model");


        if (!error && data) {
          const uniqueModels = Array.from(
            new Set(data.map((item: { model: string }) => item.model))
          );
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 24 }}
      >
        {models.map((model, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => handleModelPress(model)}
            style={{ marginRight: 16, marginLeft: isRTL ? 16 : 0 }}
          >
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
// Range Selector Component
// --------------------
interface RangeSelectorProps {
  title: string;
  min: number;
  max: number;
  value: number[];
  onChange: (range: number[]) => void;
  prefix?: string;
  isDarkMode: boolean;
  step?: number;
}

const RangeSelector = memo(({
  title,
  min,
  max,
  value,
  onChange,
  prefix = "",
  isDarkMode,
  step = 1,
}: RangeSelectorProps) => {
  // Separate local state for each field
  const [localMin, setLocalMin] = useState(value[0].toString());
  const [localMax, setLocalMax] = useState(value[1].toString());
  const isYearSelector = title.toLowerCase() === "year";

  // When the parent's value changes, update local state
  useEffect(() => {
    setLocalMin(value[0].toString());
    setLocalMax(value[1].toString());
  }, [value]);

  // Validate and adjust min input on blur
  const handleMinBlur = () => {
    let newMin = parseInt(localMin, 10);
    if (isNaN(newMin)) {
      newMin = min;
    }
    newMin = Math.max(newMin, min);
    newMin = Math.min(newMin, max);
    let newMax = parseInt(localMax, 10);
    if (isNaN(newMax)) {
      newMax = max;
    }
    // If new minimum exceeds current max, adjust max accordingly
    if (newMin > newMax) {
      newMax = newMin;
    }
    setLocalMin(newMin.toString());
    setLocalMax(newMax.toString());
    onChange([newMin, newMax]);
  };

  // Validate and adjust max input on blur
  const handleMaxBlur = () => {
    let newMax = parseInt(localMax, 10);
    if (isNaN(newMax)) {
      newMax = max;
    }
    newMax = Math.min(newMax, max);
    newMax = Math.max(newMax, min);
    let newMin = parseInt(localMin, 10);
    if (isNaN(newMin)) {
      newMin = min;
    }
    // If new maximum is lower than current min, adjust min accordingly
    if (newMax < newMin) {
      newMin = newMax;
    }
    setLocalMin(newMin.toString());
    setLocalMax(newMax.toString());
    onChange([newMin, newMax]);
  };

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
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
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
              value={localMin}
              onChangeText={setLocalMin}
              onBlur={handleMinBlur}
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
        <View
          style={{
            width: 32,
            height: 1,
            backgroundColor: "#ccc",
            marginHorizontal: 8,
          }}
        />
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
              value={localMax}
              onChangeText={setLocalMax}
              onBlur={handleMaxBlur}
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
});


// --------------------
// Quick Filter Card Component
// --------------------
interface QuickFilterCardProps {
  filter: any;
  isSelected: boolean;
  onSelect: () => void;
  isDarkMode: boolean;
}

const QuickFilterCard = memo(({ filter, isSelected, onSelect, isDarkMode }: QuickFilterCardProps) => {
  const { t } = useTranslation();
  const isRTL = I18nManager.isRTL;
  return (
    <TouchableOpacity onPress={onSelect} style={{ marginRight: 16, marginLeft: isRTL ? 16 : 0, width: 160 }}>
      <BlurView
        intensity={isDarkMode ? 20 : 40}
        tint={isDarkMode ? "dark" : "light"}
        style={{ borderRadius: 12 }}
      >
        <LinearGradient
        className="rounded-xl"
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
            {t(filter.labelKey)}
          </Text>
        </LinearGradient>
      </BlurView>
    </TouchableOpacity>
  );
});

// --------------------
// Color Selector Component
// --------------------
interface ColorSelectorProps {
  selectedColor: string[];
  onSelectColor: (colors: string[]) => void;
  isDarkMode: boolean;
}

const ColorSelector = memo(({ selectedColor, onSelectColor, isDarkMode }: ColorSelectorProps) => {
  const { t } = useTranslation();
  const isRTL = I18nManager.isRTL;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginBottom: 24 }}
    >
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
          style={{ marginRight: 16, marginLeft: isRTL ? 16 : 0 }}
        >
          <View style={{ padding: 8 }}>
            <LinearGradient
              colors={color.gradient}
              style={{
                width: 64,
                height: 64,
                borderRadius: 12,
                marginBottom: 8,
                borderWidth: 2,
                borderColor: selectedColor.includes(color.name)
                  ? "#D55004"
                  : isDarkMode
                  ? "white"
                  : "black",
              }}
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
              {t(color.nameKey)}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
});

// --------------------
// Selection Card Component
// --------------------
interface SelectionCardProps {
  label?: string;
  icon?: string;
  isSelected?: boolean;
  onSelect?: () => void;
  isDarkMode?: boolean;
  imageUrl?: string | null;
}

const SelectionCard = memo(
  ({
    label = "",
    icon = "",
    isSelected = false,
    onSelect = () => { },
    isDarkMode = false,
    imageUrl = null,
  }: SelectionCardProps) => {
    const isRTL = I18nManager.isRTL;
    return (
    <TouchableOpacity
      onPress={onSelect}
      style={{ marginRight: 16, marginLeft: isRTL ? 16 : 0, marginBottom: 16, width: 160 }}
    >
      <BlurView
        intensity={isDarkMode ? 20 : 40}
        tint={isDarkMode ? "dark" : "light"}
        className="rounded-xl"
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
    source={imageUrl}
    style={{ width: 60, height: 30, marginBottom: 8 }}
    resizeMode="contain"
  />
) : icon ? (
  <MaterialCommunityIcons
    name={icon}
    size={24}
    color={isSelected ? "#fff" : isDarkMode ? "#fff" : "#000"}
  />
) : null}
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
  );
  }
);

// --------------------
// Dealership Selector Component (Multi‑select)
// --------------------
interface DealershipSelectorProps {
  dealerships: any[];
  filters: any;
  setFilters: (filters: any) => void;
  isDarkMode: boolean;
}

const DealershipSelector = memo(
  ({ dealerships, filters, setFilters, isDarkMode }: DealershipSelectorProps) => {
    const { t } = useTranslation();
    const isRTL = I18nManager.isRTL;
    const [showAllDealers, setShowAllDealers] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const filteredDealerships = dealerships.filter((dealer: { name: string }) =>
      dealer.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleDealershipSelect = useCallback((dealer: { id: string; name: string }) => {
      setFilters((prev: any) => {
        const dealershipIncluded = prev.dealership.includes(dealer.id);
        const updatedDealership = dealershipIncluded
          ? prev.dealership.filter((d: string) => d !== dealer.id)
          : [...prev.dealership, dealer.id];

        const dealershipNameIncluded = prev.dealershipName.includes(dealer.name);
        const updatedDealershipName = dealershipNameIncluded
          ? prev.dealershipName.filter((n: string) => n !== dealer.name)
          : [...prev.dealershipName, dealer.name];

        return {
          ...prev,
          dealership: updatedDealership,
          dealershipName: updatedDealershipName,
        };
      });
    }, [setFilters]);

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
              {t('dealership.dealerships')}
            </Text>
            <TouchableOpacity
              onPress={() => setShowAllDealers(true)}
              style={{ flexDirection: "row", alignItems: "center" }}
            >
              <Text style={{ color: "#D55004" }}>{t('common.view_all')}</Text>
              <FontAwesome
                name={isRTL ? "chevron-left" : "chevron-right"}
                size={14}
                color={isDarkMode ? "#FFFFFF" : "#000000"}
                style={isRTL ? { marginRight: 8 } : { marginLeft: 8 }}
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
            {t('filters.filter_by_dealerships')}
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 24 }}
        >
          {dealerships.map(
            (dealer: { id: string; name: string; logo: string }) => (
              <TouchableOpacity
                key={dealer.id}
                onPress={() => handleDealershipSelect(dealer)}
                style={{ marginRight: 16, marginLeft: isRTL ? 16 : 0 }}
              >
                <View
                  style={{
                    borderRadius: 12,
                    padding: 16,
                    width: 110,
                    height: 150,
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <View
                    style={{
                      width: 80,
                      height: 80,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    {dealer.logo ? (
                      <Image
                        source={{ uri: dealer.logo }}
                        style={{ width: 80, height: 80 }}
                        resizeMode="contain"
                      />
                    ) : (
                      <MaterialCommunityIcons
                        name="car-estate"
                        size={60}
                        color={filters.dealership.includes(dealer.id)
                          ? "#D55004"
                          : isDarkMode
                          ? "white"
                          : "black"}
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
                </View>
              </TouchableOpacity>
            )
          )}
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
                    {t('dealership.view_all_dealerships')}
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
                      marginLeft: isRTL ? 0 : 12,
                      marginRight: isRTL ? 12 : 0,
                      color: isDarkMode ? "white" : "black",
                    }}
                    placeholder={t('dealership.search_dealerships')}
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
                        handleDealershipSelect(dealer);
                        setShowAllDealers(false);
                      }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        padding: 16,
                        marginBottom: 8,

                      }}
                    >
                      <View
                        style={{
                          width: 60,
                          height: 60,
                          justifyContent: "center",
                          alignItems: "center",
                          marginRight: isRTL ? 0 : 12,
                          marginLeft: isRTL ? 12 : 0,
                        }}
                      >
                        {dealer.logo ? (
                          <Image
                            source={{ uri: dealer.logo }}
                            style={{ width: 50, height: 50 }}
                            contentFit="contain"
                          />
                        ) : (
                          <MaterialCommunityIcons
                            name="car-estate"
                            size={40}
                            color={filters.dealership.includes(dealer.id)
                              ? "#D55004"
                              : isDarkMode
                              ? "white"
                              : "black"}
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
interface FilterProps {
dealership: string[];
dealershipName: string[];
make: string[];
model: string[];
condition: string[];
priceRange: number[];
mileageRange: number[];
yearRange: number[];
color: string[];
transmission: string[];
drivetrain: string[];
categories: string[];
quickFilter: any;
specialFilter?: string;
sortBy?: string;
}

const FilterPage = () => {
const { isDarkMode } = useTheme();
const { t } = useTranslation();
const isRTL = I18nManager.isRTL;
const router = useRouter();
const params = useLocalSearchParams();
const [dealerships, setDealerships] = useState<any[]>([]);
const [filterCount, setFilterCount] = useState<number>(0);

// Updated default filters using arrays for multi‑select fields:
const defaultFilters: FilterProps = {
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

const [filters, setFilters] = useState<FilterProps>(() => {
if (!params.filters) return defaultFilters;
try {
const parsedFilters = JSON.parse(params.filters as string);
return parsedFilters && typeof parsedFilters === "object"
? { ...defaultFilters, ...parsedFilters }
: defaultFilters;
} catch (error: any) {
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

const handleQuickFilterSelect = (quickFilter: any) => {
if (filters.quickFilter?.id === quickFilter.id) {
// Deselect if already selected
setFilters((prev: FilterProps) => ({
...defaultFilters,
categories: prev.categories, // Preserve categories
}));
} else {
setFilters((prev: FilterProps) => ({
...defaultFilters,
...quickFilter.filter,
quickFilter,
categories: prev.categories, // Preserve categories
}));
}
};

const handleCategorySelect = (category: any) => {
setFilters((prev: FilterProps) => ({
...prev,
categories: prev.categories.includes(category)
? prev.categories.filter((c: any) => c !== category)
: [...prev.categories, category],
}));
};

// Function to build the filter object for Supabase
const buildSupabaseFilter = useCallback((filters: FilterProps) => {
const supabaseFilter: any = {};

if (filters.dealership.length > 0) {
  supabaseFilter.dealership = filters.dealership;
}
if (filters.make.length > 0) {
  supabaseFilter.make = filters.make;
}
if (filters.model.length > 0) {
  supabaseFilter.model = filters.model;
}
if (filters.color.length > 0) {
  supabaseFilter.color = filters.color;
}
if (filters.transmission.length > 0) {
  supabaseFilter.transmission = filters.transmission;
}
if (filters.drivetrain.length > 0) {
  supabaseFilter.drivetrain = filters.drivetrain;
}
if (filters.categories.length > 0) {
  supabaseFilter.categories = filters.categories;
}
if (filters.priceRange && filters.priceRange.length === 2) {
  supabaseFilter.priceRange = filters.priceRange;
}
if (filters.mileageRange && filters.mileageRange.length === 2) {
  supabaseFilter.mileageRange = filters.mileageRange;
}
if (filters.yearRange && filters.yearRange.length === 2) {
  supabaseFilter.yearRange = filters.yearRange;
}
  if (filters.specialFilter) {
      supabaseFilter.specialFilter = filters.specialFilter
  }
    if (filters.sortBy) {
      supabaseFilter.sortBy = filters.sortBy;
  }

return supabaseFilter;
}, []);

// Function to count the results based on filters
const countFilteredResults = useCallback(async (filters: FilterProps) => {
try {
const supabaseFilter = buildSupabaseFilter(filters);
let query = supabase
.from("cars")
.select('*', { count: 'exact', head: true })
.eq("status","available")

if (supabaseFilter.dealership) {
          query = query.in('dealership_id', supabaseFilter.dealership);
      }
       if (supabaseFilter.make) {
          query = query.in('make', supabaseFilter.make);
      }
        if (supabaseFilter.model) {
          query = query.in('model', supabaseFilter.model);
      }
       if (supabaseFilter.color) {
          query = query.in('color', supabaseFilter.color);
      }
          if (supabaseFilter.transmission) {
          query = query.in('transmission', supabaseFilter.transmission);
      }
           if (supabaseFilter.drivetrain) {
          query = query.in('drivetrain', supabaseFilter.drivetrain);
      }
      if (supabaseFilter.priceRange) {
            query = query.gte('price', supabaseFilter.priceRange[0]).lte('price', supabaseFilter.priceRange[1]);
      }
         if (supabaseFilter.mileageRange) {
            query = query.gte('mileage', supabaseFilter.mileageRange[0]).lte('mileage', supabaseFilter.mileageRange[1]);
      }
          if (supabaseFilter.yearRange) {
            query = query.gte('year', supabaseFilter.yearRange[0]).lte('year', supabaseFilter.yearRange[1]);
      }
            if (supabaseFilter.specialFilter === 'mostPopular') {
            query = query.order('views', { ascending: false });
      }
              if (supabaseFilter.specialFilter === 'newArrivals') {
              query = query.order('created_at', { ascending: false });
      }


  const { count, error } = await query;


  if (error) {
    console.error("Error counting results:", error);
    return 0;
  }

  return count || 0;
} catch (error) {
  console.error("Error counting results:", error);
  return 0;
}
}, [buildSupabaseFilter]);

// Compare current filters vs. the default
// If they differ, we know user has selected something
const hasFiltersSelected = useMemo(() => {
let count = 0;

if (filters.dealership.length > 0) count++;
if (filters.make.length > 0) count++;
if (filters.model.length > 0) count++;
if (JSON.stringify(filters.priceRange) !== JSON.stringify(defaultFilters.priceRange)) count++;
if (JSON.stringify(filters.mileageRange) !== JSON.stringify(defaultFilters.mileageRange)) count++;
if (JSON.stringify(filters.yearRange) !== JSON.stringify(defaultFilters.yearRange)) count++;
if (filters.color.length > 0) count++;
if (filters.transmission.length > 0) count++;
if (filters.drivetrain.length > 0) count++;
if (filters.categories.length > 0) count++;
if (filters.quickFilter !== null) count++;

return count > 0;
}, [filters]);

useEffect(() => {
if (hasFiltersSelected) {
countFilteredResults(filters)
.then((count) => setFilterCount(count));
} else {
setFilterCount(0);
}
}, [filters, hasFiltersSelected, countFilteredResults]);

return (
<SafeAreaView
style={{ flex: 1, backgroundColor: isDarkMode ? "black" : "white" }}
>


<View
    style={{
      paddingHorizontal: 16,
      paddingVertical: 5,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? "#333" : "#ccc",
    }}
  >
    {/* Close Button */}
    <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
      <Ionicons
        name="close"
        size={24}
        color={isDarkMode ? "#ffffff" : "#000000"}
      />
    </TouchableOpacity>

    {/* "Clear All" Button */}
    <TouchableOpacity
      onPress={() => {
        setFilters(defaultFilters);
        router.replace({
          pathname: "/(home)/(dealer)/(tabs)/browse",
          params: { filters: JSON.stringify({}) },
        });
      }}
      style={{ padding: 8 }}
    >
      <Text
        style={{
          fontSize: 14,
          color: isDarkMode ? "#ffffff" : "#000000",
          fontWeight: "400",
        }}
      >
        {t('filters.clear_all')}
      </Text>
    </TouchableOpacity>
  </View>

  <ScrollView style={{ flex: 1, paddingHorizontal: 16 }}>
    <View style={{ paddingVertical: 16 }}>
      {/* Quick Filters Section */}
      <SectionHeader
        title={t('filters.quick_filters')}
        subtitle={t('filters.popular_filter_combinations')}
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

      <SectionHeader
        subtitle={t('filters.select_budget_range')}
        isDarkMode={isDarkMode}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 24 }}
      >
        {PRICE_RANGES.map((range, index) => (
          <SelectionCard
            key={index}
            label={t(range.labelKey)}
            icon={range.icon}
            isSelected={
              JSON.stringify(filters.priceRange) ===
              JSON.stringify(range.value)
            }
            onSelect={() =>
              setFilters((prev: FilterProps) => ({
                ...prev,
                priceRange:
                  JSON.stringify(prev.priceRange) ===
                  JSON.stringify(range.value)
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
          setFilters((prev: FilterProps) => ({
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
          setFilters((prev: FilterProps) => ({ ...prev, model: newSelectedModels }))
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
        title={t('filters.price_range')}
        subtitle={t('filters.set_budget_range')}
        isDarkMode={isDarkMode}
      />
      <RangeSelector
        title={t('filters.price')}
        min={0}
        max={1000000}
        step={1000}
        value={filters.priceRange}
        onChange={(range: number[]) =>
          setFilters((prev: FilterProps) => ({ ...prev, priceRange: range }))
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
        title={t('filters.mileage_range')}
        subtitle={t('filters.set_mileage_preferences')}
        isDarkMode={isDarkMode}
      />
      <RangeSelector
        title={t('filters.mileage')}
        min={0}
        max={500000}
        step={1000}
        value={filters.mileageRange}
        onChange={(range: number[]) =>
          setFilters((prev: FilterProps) => ({ ...prev, mileageRange: range }))
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
        title={t('filters.year_range')}
        subtitle={t('filters.select_manufacturing_year_range')}
        isDarkMode={isDarkMode}
      />
      <RangeSelector
        title={t('filters.year')}
        min={1900}
        max={new Date().getFullYear()}
        step={1}
        value={filters.yearRange}
        onChange={(range: number[]) =>
          setFilters((prev: FilterProps) => ({
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
        title={t('filters.transmission')}
        subtitle={t('filters.choose_transmission_type')}
        isDarkMode={isDarkMode}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 24 }}
      >
        {TRANSMISSION_OPTIONS.map((option) => (
          <SelectionCard
            key={option.value}
            label={t(`filters.${option.value.toLowerCase()}`)}
            icon={option.icon}
            isSelected={filters.transmission.includes(option.value)}
            onSelect={() =>
              setFilters((prev: FilterProps) => ({
                ...prev,
                transmission: prev.transmission.includes(option.value)
                  ? prev.transmission.filter(
                    (val: string) => val !== option.value
                  )
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
        title={t('filters.drivetrain')}
        subtitle={t('filters.select_drivetrain_configuration')}
        isDarkMode={isDarkMode}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 24 }}
      >
{DRIVETRAIN_OPTIONS.map((option) => (
  <SelectionCard
    key={option.value}
    label={t(`filters.${option.value.toLowerCase()}`)}
    imageUrl={option.getImage(isDarkMode)}  // Use the getImage function here
    isSelected={filters.drivetrain.includes(option.value)}
    onSelect={() =>
      setFilters((prev: FilterProps) => ({
        ...prev,
        drivetrain: prev.drivetrain.includes(option.value)
          ? prev.drivetrain.filter(
            (val: string) => val !== option.value
          )
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
        title={t('filters.vehicle_color')}
        subtitle={t('filters.choose_exterior_color')}
        isDarkMode={isDarkMode}
      />
      <ColorSelector
        selectedColor={filters.color}
        onSelectColor={(newColors) =>
          setFilters((prev: FilterProps) => ({
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
      paddingHorizontal: 10,
    }}
  >
    <View
      style={{
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: isDarkMode
          ? "rgba(0,0,0,0.3)"
          : "rgba(255,255,255,0.3)",
        borderRadius: 8,
        padding: 24,
      }}
    >
      <TouchableOpacity
        disabled={!hasFiltersSelected}
        onPress={
          hasFiltersSelected
            ? () => {
              router.replace({
                pathname: "/(home)/(dealer)/(tabs)/browse",
                params: { filters: JSON.stringify(filters) },
              });
            }
            : null
        }
        style={{
          flex: 1,
          paddingVertical: 14,
          borderRadius: 10,
          justifyContent: "center",
          alignItems: "center",
          // Use a semi-transparent color if not selected; full color if selected
          backgroundColor: hasFiltersSelected ? "#D55004" : "#D5500440",
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontWeight: "600",
            fontSize: 16,
          }}
        >
          Apply Filters {hasFiltersSelected ? `(${filterCount})` : ''}
        </Text>
      </TouchableOpacity>
    </View>
  </BlurView>
</SafeAreaView>
);
};

export default FilterPage;