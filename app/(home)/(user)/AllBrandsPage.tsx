import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  SectionList,
  SectionListData,
  StatusBar,
  RefreshControl,
  Pressable,
  Platform,
  Animated,
  I18nManager,
} from "react-native";
import { Image } from "expo-image";
import { supabase } from "@/utils/supabase";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import { router, useRouter, useLocalSearchParams } from "expo-router";
import { useTheme } from "@/utils/ThemeContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { getLogoUrl } from "@/hooks/getLogoUrl";

interface Brand {
  name: string;
  logoUrl: string | null;
}

// Skeleton component defined within the same file
const BrandSkeletonLoading = ({ isDarkMode }:any) => {
  const skeletonCount = 8; // Number of skeleton items to show
  const fadeAnim = useRef(new Animated.Value(0.5)).current;
  const isRTL = I18nManager.isRTL;

  useEffect(() => {
    // Create shimmer effect
    Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.8,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0.5,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [fadeAnim]);

  const bgColor = isDarkMode ? '#1c1c1c' : '#f5f5f5';
  const shimmerColor = isDarkMode ? '#333' : '#e0e0e0';

  return (
    <View className="mt-2">
      {Array.from({ length: skeletonCount }).map((_, index) => (
        <View key={index} className={`mx-3 mb-3`}>
          <View className={`flex-row items-center p-4 rounded-2xl`} style={{ backgroundColor: bgColor }}>
            {/* Logo placeholder */}
            <Animated.View 
              style={{ 
                width: 50, 
                height: 50, 
                borderRadius: 10, 
                backgroundColor: shimmerColor,
                opacity: fadeAnim 
              }} 
            />
            
            {/* Text placeholder */}
            <View className={`flex-1 ${isRTL ? 'mr-4' : 'ml-4'}`}>
              <Animated.View
                style={{
                  height: 20,
                  width: '60%',
                  borderRadius: 4,
                  backgroundColor: shimmerColor,
                  opacity: fadeAnim
                }}
              />
            </View>
            
            {/* Chevron placeholder */}
            <Animated.View 
              style={{ 
                width: 16, 
                height: 16, 
                borderRadius: 8, 
                backgroundColor: shimmerColor,
                opacity: fadeAnim 
              }} 
            />
          </View>
        </View>
      ))}
    </View>
  );
};

const CustomHeader = React.memo(
  ({ title, onBack }: { title: string; onBack?: () => void }) => {
    const { isDarkMode } = useTheme();

    return (
      <SafeAreaView
        className={`bg-${isDarkMode ? "black" : "white"}`}
      >

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




export default function AllBrandsPage() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const viewMode = (mode === 'rent' ? 'rent' : 'sale') as 'sale' | 'rent';
  const [brands, setBrands] = useState<Brand[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const sectionListRef = useRef<SectionList>(null);
  const { isDarkMode } = useTheme();
  const isRTL = I18nManager.isRTL;

  const textColor = isDarkMode ? "text-white" : "text-black";
  const bgColor = isDarkMode ? "bg-black" : "bg-white";
  const borderColor = isDarkMode ? "border-red" : "border-red";
  const sectionHeaderBgColor = isDarkMode ? "bg-gray" : "bg-white";

  const fetchBrands = useCallback(async () => {
    if (!refreshing) setIsLoading(true);
    try {
      // Query the appropriate table based on mode
      const tableName = viewMode === 'rent' ? 'cars_rent' : 'cars';
      const { data, error } = await supabase
        .from(tableName)
        .select("make")
        .eq("status","available")
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
    } catch (error) {
      console.error("Error fetching brands:", error);
    } finally {
      setIsLoading(false);
    }
  }, [isDarkMode, refreshing, viewMode]);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBrands().then(() => setRefreshing(false));
  }, [fetchBrands]);

  const filteredBrands = useMemo(() => {
    return brands.filter((brand) =>
      brand.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [brands, searchQuery]);

  const groupedBrands = useMemo(() => {
    const groups: { title: string; data: Brand[] }[] = [];
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

    alphabet.forEach((letter) => {
      const brandsForLetter = filteredBrands.filter((brand) =>
        brand.name.toUpperCase().startsWith(letter)
      );
      if (brandsForLetter.length > 0) {
        groups.push({ title: letter, data: brandsForLetter });
      }
    });

    return groups;
  }, [filteredBrands]);

  const handleBrandPress = useCallback(
    (brand: string) => {
      router.push({
        pathname: "/(home)/(user)/CarsByBrand",
        params: { brand, mode: viewMode },
      });
    },
    [router, viewMode]
  );

  const renderBrandItem = useCallback(
    ({ item }: { item: Brand }) => (
      <TouchableOpacity
        className={`mx-3 mb-3`}
        onPress={() => handleBrandPress(item.name)}
      >
        <View className={`flex-row items-center p-4 rounded-2xl ${
          isDarkMode ? 'bg-[#1c1c1c]' : 'bg-[#f5f5f5]'
        }`}>
          <View className={`w-[60px] h-[60px] rounded-xl justify-center items-center`}>
            <Image
              source={item.logoUrl ? { uri: item.logoUrl } : require('@/assets/images/placeholder-logo.png')}
              style={{ width: 50, height: 50 }}
              contentFit="contain"
              placeholder={require('@/assets/images/placeholder-logo.png')}
              transition={200}
            />
          </View>
          <View className={`flex-1 ${isRTL ? 'mr-4' : 'ml-4'}`}>
            <Text className={`text-lg font-medium ${textColor}`}>
              {item.name}
            </Text>
          </View>
          <FontAwesome
            name={isRTL ? "chevron-left" : "chevron-right"}
            size={16}
            color={isDarkMode ? '#D55004' : '#D55004'}
          />
        </View>
      </TouchableOpacity>
    ),
    [textColor, handleBrandPress, isDarkMode, isRTL]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<Brand> }) => (
      <View className={`${sectionHeaderBgColor} p-2`}>
        <Text className={`${textColor} font-bold`}>{section.title}</Text>
      </View>
    ),
    [sectionHeaderBgColor, textColor]
  );

  return (
    <View className={`flex-1  ${bgColor}`}>
      <CustomHeader title="All Brands" onBack={() => router.back()} />
      <View className="px-4 -mt-6 ">
        <View className="flex-row gap-2">
          <View
            className={`flex-1 flex-row items-center rounded-full border border-[#ccc] dark:border-[#555] px-4 h-12`}
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
              style={{ textAlignVertical: 'center' }}
              placeholder="Search Brands..."
              placeholderTextColor={isDarkMode ? "lightgray" : "gray"}
              value={searchQuery}
              onChangeText={setSearchQuery}
              textAlignVertical="center"
            />
          </View>
        </View>
      </View>
      
      {isLoading && !refreshing ? (
        <BrandSkeletonLoading isDarkMode={isDarkMode} />
      ) : (
        <SectionList
          ref={sectionListRef}
          sections={groupedBrands}
          renderItem={renderBrandItem}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={(item) => `${item.name}-${item.logoUrl}`}
          stickySectionHeadersEnabled={true}
          className="mt-2"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={isDarkMode ? "#ffffff" : "#000000"}
              colors={["#D55004"]}
            />
          }
        />
      )}
    </View>
  );
}