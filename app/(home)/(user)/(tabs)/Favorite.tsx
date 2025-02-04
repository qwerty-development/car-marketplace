import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  View,
  FlatList,
  Text,
  ActivityIndicator,
  RefreshControl,
  ListRenderItem,
  StatusBar,
  Platform,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "@/utils/supabase";
import CarCard from "@/components/CarCard";
import CarDetailModal from "@/app/(home)/(user)/CarDetailModal";
import CarDetailModalIOS from "../CarDetailModalIOS";
import { useFavorites } from "@/utils/useFavorites";
import { useTheme } from "@/utils/ThemeContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { FontAwesome } from "@expo/vector-icons";
import SortPicker from "@/components/SortPicker";
import { useScrollToTop } from "@react-navigation/native";
// Original CustomHeader (Reverted)
const CustomHeader = React.memo(({ title }: { title: string }) => {
  const { isDarkMode } = useTheme();

  return (
    <SafeAreaView className={`bg-${isDarkMode ? "black" : "white"} `}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <View className="flex-row ml-6">
        <Text className="text-2xl -mb-5 font-bold text-black dark:text-white">
          {title}
        </Text>
      </View>
    </SafeAreaView>
  );
});

interface Car {
  id: number;
  make: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  likes: number;
  views: number;
  listed_at: string;
  dealerships: {
    name: string;
    logo: string;
    phone: string;
    location: string;
    latitude: number;
    longitude: number;
  };
}

export default function Favorite() {
  const { isDarkMode } = useTheme();
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  const [favoriteCars, setFavoriteCars] = useState<Car[]>([]);
  const [filteredCars, setFilteredCars] = useState<Car[]>([]);
  const [sortedCars, setSortedCars] = useState<Car[]>([]);
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState("");
  const scrollRef = useRef(null);
  useScrollToTop(scrollRef);
  const fetchFavoriteCars = useCallback(async () => {
    setError(null);
    if (favorites.length === 0) {
      setFavoriteCars([]);
      setFilteredCars([]);
      setSortedCars([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("cars")
        .select(
          `*, dealerships (name, logo, phone, location, latitude, longitude)`
        )
        .eq("status", "available")
        .in("id", favorites);

      if (error) throw error;

      const carsData =
        data?.map((item) => ({
          ...item,
          dealership_name: item.dealerships.name,
          dealership_logo: item.dealerships.logo,
          dealership_phone: item.dealerships.phone,
          dealership_location: item.dealerships.location,
          dealership_latitude: item.dealerships.latitude,
          dealership_longitude: item.dealerships.longitude,
        })) || [];

      setFavoriteCars(carsData);
      setFilteredCars(carsData);
    } catch (error) {
      console.error("Error fetching favorite cars:", error);
      setError("Failed to fetch favorite cars. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [favorites]);

  useEffect(() => {
    fetchFavoriteCars();
  }, [fetchFavoriteCars]);

  useEffect(() => {
    let filtered = favoriteCars;

    // Apply search filtering
    if (searchQuery) {
      const cleanQuery = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(
        (car) =>
          car.make.toLowerCase().includes(cleanQuery) ||
          car.model.toLowerCase().includes(cleanQuery) ||
          car.dealerships.name.toLowerCase().includes(cleanQuery)
      );
    }
    setFilteredCars(filtered);
  }, [searchQuery, favoriteCars]);

  useEffect(() => {
    // Apply sorting based on sortOption
    let sorted = [...filteredCars];

    if (sortOption) {
      switch (sortOption) {
        case "price_asc":
          sorted.sort((a, b) => a.price - b.price);
          break;
        case "price_desc":
          sorted.sort((a, b) => b.price - a.price);
          break;
        case "year_asc":
          sorted.sort((a, b) => a.year - b.year);
          break;
        case "year_desc":
          sorted.sort((a, b) => b.year - a.year);
          break;
        case "mileage_asc":
          sorted.sort((a, b) => a.mileage - b.mileage);
          break;
        case "mileage_desc":
          sorted.sort((a, b) => b.mileage - a.mileage);
          break;
        case "date_listed_desc":
          sorted.sort(
            (a, b) =>
              new Date(b.listed_at).getTime() - new Date(a.listed_at).getTime()
          );
          break;
        default:
          break;
      }
    }

    setSortedCars(sorted);
  }, [sortOption, filteredCars]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFavoriteCars();
    setRefreshing(false);
  }, [fetchFavoriteCars]);

  const handleFavoritePress = useCallback(
    async (carId: number) => {
      const newLikesCount = await toggleFavorite(carId);

      // Update favoriteCars
      setFavoriteCars((prevCars) =>
        prevCars
          .map((car) =>
            car.id === carId ? { ...car, likes: newLikesCount } : car
          )
          .filter((car) => isFavorite(car.id))
      );

      // Also update filteredCars to remove the unfavorited car
      setFilteredCars((prevCars) =>
        prevCars
          .map((car) =>
            car.id === carId ? { ...car, likes: newLikesCount } : car
          )
          .filter((car) => isFavorite(car.id))
      );
    },
    [toggleFavorite, isFavorite]
  );

  const handleCarPress = useCallback((car: Car) => {
    setSelectedCar(car);
    setIsModalVisible(true);
  }, []);

  const handleViewUpdate = useCallback(
    (carId: number, newViewCount: number) => {
      setFavoriteCars((prevCars) =>
        prevCars.map((car) =>
          car.id === carId ? { ...car, views: newViewCount } : car
        )
      );
      setFilteredCars((prevCars) =>
        prevCars.map((car) =>
          car.id === carId ? { ...car, views: newViewCount } : car
        )
      );
    },
    []
  );

  const renderModal = useMemo(() => {
    const ModalComponent =
      Platform.OS === "ios" ? CarDetailModalIOS : CarDetailModal;
    return (
      <ModalComponent
        isVisible={isModalVisible}
        car={selectedCar}
        onClose={() => setIsModalVisible(false)}
        onFavoritePress={() =>
          selectedCar && handleFavoritePress(selectedCar.id)
        }
        isFavorite={true}
        onViewUpdate={handleViewUpdate}
        setSelectedCar={setSelectedCar}
        setIsModalVisible={setIsModalVisible}
      />
    );
  }, [isModalVisible, selectedCar, handleFavoritePress, handleViewUpdate]);

  const renderCarItem: ListRenderItem<Car> = useCallback(
    ({ item }) => (
      <CarCard
        car={item}
        onPress={() => handleCarPress(item)}
        onFavoritePress={() => handleFavoritePress(item.id)}
        isFavorite={true}
      />
    ),
    [handleCarPress, handleFavoritePress]
  );

  const keyExtractor = useCallback(
    (item: Car) => `${item.id}-${item.make}-${item.model}`,
    []
  );

  const EmptyFavorites = useMemo(
    () => (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          {searchQuery
            ? "No cars match your search."
            : "No cars added as favorite"}
        </Text>
        {!searchQuery && (
          <Text style={styles.emptySubText}>
            Your favorite cars will appear here
          </Text>
        )}
      </View>
    ),
    [isDarkMode, searchQuery]
  );

  const ErrorMessage = useMemo(
    () => (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.errorSubText}>
          Pull down to refresh and try again
        </Text>
      </View>
    ),
    [error, isDarkMode]
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={isDarkMode ? "#ffffff" : "#000000"}
          />
        </View>
      );
    }

    if (error) {
      return ErrorMessage;
    }

    return (
      <FlatList
        ref={scrollRef}
        data={sortedCars}
        renderItem={renderCarItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 50 }}
        ListEmptyComponent={EmptyFavorites}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDarkMode ? "#ffffff" : "#000000"}
            colors={["#D55004"]}
          />
        }
      />
    );
  };

  return (
    <View
      style={{ flex: 1, backgroundColor: isDarkMode ? "#000000" : "#FFFFFF" }}
    >
      <CustomHeader title="Favorites" />
      <View className="px-4 pb-3">
        <View className="flex-row gap-2">
          <View
            className={`flex-1 flex-row items-center rounded-full border border-[#ccc] dark:border-[#555] px-4 
								`}
          >
            <FontAwesome
              name="search"
              size={20}
              color={isDarkMode ? "white" : "black"}
            />
            <TextInput
              className={`flex-1 p-3 ${
                isDarkMode ? "text-white" : "text-black"
              }`}
              placeholder="Search dealerships..."
              placeholderTextColor={isDarkMode ? "lightgray" : "gray"}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <View className={`items-center justify-center w-12 h-12`}>
            <SortPicker
              onValueChange={(value: string) => {
                setSortOption(value);
              }}
              initialValue={sortOption}
            />
          </View>
        </View>
      </View>

      {renderContent()}
      {renderModal}
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000000",
    marginBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000000",
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 16,
    color: "#666666",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000000",
    marginBottom: 8,
  },
  errorSubText: {
    fontSize: 16,
    color: "#FF0000",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
  },
  darkContainer: {
    backgroundColor: "#000000",
  },
  searchContainer: {
    padding: 10,
  },
  scrollTopButton: {
    position: "absolute",
    right: 20,
    bottom: 70,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    // `justifyContent: 'space-between'` ensures the two children (search bar and picker) are on opposite ends
    justifyContent: "space-between",
  },
  iconButton: {
    borderRadius: 20,
    backgroundColor: "#000000",
  },
  darkIconButton: {
    backgroundColor: "#ffffff",
  },
  sortPickerContainer: {
    // A little margin to separate from the search bar
    marginLeft: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 20,
  },
  darkSearchBar: {
    borderColor: "#555",
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    color: "black",
  },
  darkSearchInput: {
    color: "white",
  },
  clearButton: {
    padding: 10,
  },
  darkEmptyText: {
    color: "#fff",
  },
  resetButton: {
    marginTop: 10,
    padding: 10,
    backgroundColor: "#D55004",
    borderRadius: 5,
  },
  resetButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  favoriteButton: {
    padding: 12,
    borderRadius: 20,
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
