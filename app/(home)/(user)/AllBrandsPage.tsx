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
  Image,
  TouchableOpacity,
  TextInput,
  SectionList,
  SectionListData,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  Pressable,
  Platform,
} from "react-native";
import { supabase } from "@/utils/supabase";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import { router, useRouter } from "expo-router";
import { useTheme } from "@/utils/ThemeContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";

interface Brand {
  name: string;
  logoUrl: string;
}

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
		  case "jetour":
			return "https://1000logos.net/wp-content/uploads/2023/12/Jetour-Logo.jpg";
    default:
      return `https://www.carlogos.org/car-logos/${formattedMake}-logo.png`;
  }
};

export default function AllBrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const sectionListRef = useRef<SectionList>(null);
  const { isDarkMode } = useTheme();

  const textColor = isDarkMode ? "text-white" : "text-black";
  const bgColor = isDarkMode ? "bg-black" : "bg-white";
  const borderColor = isDarkMode ? "border-red" : "border-red";
  const sectionHeaderBgColor = isDarkMode ? "bg-gray" : "bg-white";

  const fetchBrands = useCallback(async () => {
    setIsLoading(true);
    try {
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
    } catch (error) {
      console.error("Error fetching brands:", error);
    } finally {
      setIsLoading(false);
    }
  }, [isDarkMode]);

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
        params: { brand },
      });
    },
    [router]
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
          <View className={`w-[60px] h-[60px] rounded-xl justify-center items-center '
          }`}>
            <Image
              source={{ uri: item.logoUrl }}
              style={{ width: 50, height: 50 }}
              resizeMode="contain"
            />
          </View>
          <View className="flex-1 ml-4">
            <Text className={`text-lg font-medium ${textColor}`}>
              {item.name}
            </Text>
          </View>
          <FontAwesome
            name="chevron-right"
            size={16}
            color={isDarkMode ? '#D55004' : '#D55004'}
          />
        </View>
      </TouchableOpacity>
    ),
    [textColor, handleBrandPress, isDarkMode]
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
        <ActivityIndicator size="large" color="#D55004" className="mt-4" />
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
