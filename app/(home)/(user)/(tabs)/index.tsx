import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Text,
  Keyboard,
  StatusBar,
  ActivityIndicator,
  Animated,
  RefreshControl,
  Platform,
} from "react-native";
import { supabase } from "@/utils/supabase";
import CarCard from "@/components/CarCard";
import { useFavorites } from "@/utils/useFavorites";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import ByBrands from "@/components/ByBrands";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/utils/ThemeContext";
import CategorySelector from "@/components/Category";
import SortPicker from "@/components/SortPicker";
import { useScrollToTop } from "@react-navigation/native";
import SkeletonByBrands from "@/components/SkeletonByBrands";
import SkeletonCategorySelector from "@/components/SkeletonCategorySelector";
import SkeletonCarCard from "@/components/SkeletonCarCard";
import { BlurView } from "expo-blur";
import { useUser } from "@clerk/clerk-expo";

const ITEMS_PER_PAGE = 7;

interface Car {
  id: string;
  make: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  category: string;
  dealership_name: string;
  dealership_logo: string;
  dealership_phone: string;
  dealership_location: string;
  dealership_latitude: number;
  dealership_longitude: number;
  views?: number;
  listed_at?: string;
  likes?: number; // Add like to interface
}

interface Filters {
  dealership?: string | string[];
  make?: string | string[];
  model?: string | string[];
  condition?: string | string[];
  yearRange?: [number, number];
  color?: string | string[];
  transmission?: string | string[];
  drivetrain?: string | string[];
  priceRange?: [number, number];
  mileageRange?: [number, number];
  categories?: string[];
  specialFilter?: "newArrivals" | "mostPopular" | "bestDeals";
  sortBy?: string;
}

// Define a suggestion type to group makes and models.

export default function BrowseCarsPage() {
  const { isDarkMode } = useTheme();
  const { toggleFavorite, isFavorite } = useFavorites();
  const [cars, setCars] = useState<Car[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({});
  const [showScrollTopButton, setShowScrollTopButton] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList<Car>>(null); // Specify the type of FlatList
  useScrollToTop(flatListRef);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const { user } = useUser();
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);

  // --- New: suggestions state now groups makes and models ---
  const [suggestions, setSuggestions] = useState<Suggestions>({
    makes: [],
    models: [],
  });
  const [showSuggestions, setShowSuggestions] = useState(false);

  const router = useRouter();
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  // Update this line
  const params = useLocalSearchParams<{
    filters?: string;
    searchQuery?: string;
    timestamp?: string;
  }>();

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      "keyboardDidShow",
      () => setKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      "keyboardDidHide",
      () => setKeyboardVisible(false)
    );
    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  useEffect(() => {
    const initializePage = async () => {
      let initialFilters = {};
      let initialQuery = "";
      let shouldFetch = false;

      // Handle filters if present
      if (params.filters) {
        try {
          initialFilters = JSON.parse(params.filters);
          shouldFetch = true;
        } catch (error) {
          console.error("Error parsing filters:", error);
        }
      }

      // Handle search query if present
      if (params.searchQuery !== undefined) {
        initialQuery = params.searchQuery;
        shouldFetch = true;
      }

      // Only update states if we have new values
      if (Object.keys(initialFilters).length > 0) {
        setFilters(initialFilters);
      }
      if (initialQuery !== searchQuery) {
        setSearchQuery(initialQuery);
      }

      // Only fetch if we have new params or haven't loaded yet
      if (shouldFetch || !isInitialLoadDone) {
        await fetchCars(1, initialFilters, sortOption, initialQuery);
        setIsInitialLoadDone(true);
      }
    };

    initializePage();
  }, [params.searchQuery, params.filters, params.timestamp]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [cars]);

  // Add near your other useEffects

  const CustomHeader = React.memo(
    ({ title, onBack }: { title: string; onBack?: () => void }) => {
      const { isDarkMode } = useTheme();
      return (
        <SafeAreaView style={{ backgroundColor: isDarkMode ? "#000" : "#fff" }}>
          <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginLeft: 8,
              marginBottom: -24,
            }}
          >
            <Text
              style={{
                fontSize: 24,
                fontWeight: "bold",
                marginLeft: 8,
                color: isDarkMode ? "#fff" : "#000",
              }}
            >
              {title}
            </Text>
          </View>
        </SafeAreaView>
      );
    }
  );

  const fetchCars = useCallback(
    async (
      page: number = 1,
      currentFilters: Filters = filters,
      currentSortOption: string | null = sortOption,
      query: string = searchQuery
    ) => {
      if (page === 1) {
        if (!hasFetched) {
          setIsInitialLoading(true);
        } else {
          setRefreshing(true);
        }
      } else {
        setLoadingMore(true);
      }
      try {
        let queryBuilder = supabase
          .from("cars")
          .select(
            `*, dealerships (name,logo,phone,location,latitude,longitude)`,
            { count: "exact" }
          )
          .eq("status", "available");

        // Special Filters
        if (currentFilters.specialFilter) {
          switch (currentFilters.specialFilter) {
            case "newArrivals":
              const sevenDaysAgo = new Date();
              sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
              queryBuilder = queryBuilder.gte(
                "listed_at",
                sevenDaysAgo.toISOString()
              );
              break;
            case "mostPopular":
              currentSortOption = "views_desc";
              break;
          }
        }

        // Categories
        if (currentFilters.categories && currentFilters.categories.length > 0) {
          queryBuilder = queryBuilder.in("category", currentFilters.categories);
        }

        // Multi‑select filters
        if (
          Array.isArray(currentFilters.dealership) &&
          currentFilters.dealership.length > 0
        ) {
          queryBuilder = queryBuilder.in(
            "dealership_id",
            currentFilters.dealership
          );
        }
        if (
          Array.isArray(currentFilters.make) &&
          currentFilters.make.length > 0
        ) {
          queryBuilder = queryBuilder.in("make", currentFilters.make);
        }
        if (
          Array.isArray(currentFilters.model) &&
          currentFilters.model.length > 0
        ) {
          queryBuilder = queryBuilder.in("model", currentFilters.model);
        }
        if (
          Array.isArray(currentFilters.condition) &&
          currentFilters.condition.length > 0
        ) {
          queryBuilder = queryBuilder.in("condition", currentFilters.condition);
        } else if (
          typeof currentFilters.condition === "string" &&
          currentFilters.condition
        ) {
          queryBuilder = queryBuilder.eq("condition", currentFilters.condition);
        }

        // Year Range
        if (currentFilters.yearRange) {
          queryBuilder = queryBuilder
            .gte("year", currentFilters.yearRange[0])
            .lte("year", currentFilters.yearRange[1]);
        }
        if (
          Array.isArray(currentFilters.color) &&
          currentFilters.color.length > 0
        ) {
          queryBuilder = queryBuilder.in("color", currentFilters.color);
        }
        if (
          Array.isArray(currentFilters.transmission) &&
          currentFilters.transmission.length > 0
        ) {
          queryBuilder = queryBuilder.in(
            "transmission",
            currentFilters.transmission
          );
        }
        if (
          Array.isArray(currentFilters.drivetrain) &&
          currentFilters.drivetrain.length > 0
        ) {
          queryBuilder = queryBuilder.in(
            "drivetrain",
            currentFilters.drivetrain
          );
        }

        // Price Range
        if (currentFilters.priceRange) {
          queryBuilder = queryBuilder
            .gte("price", currentFilters.priceRange[0])
            .lte("price", currentFilters.priceRange[1]);
        }
        // Mileage Range
        if (currentFilters.mileageRange) {
          queryBuilder = queryBuilder
            .gte("mileage", currentFilters.mileageRange[0])
            .lte("mileage", currentFilters.mileageRange[1]);
        }

        // Search query
        if (query) {
          const cleanQuery = query.trim().toLowerCase();

          let searchConditions = [
            `make.ilike.%${cleanQuery}%`,
            `model.ilike.%${cleanQuery}%`,
            `description.ilike.%${cleanQuery}%`,
            `color.ilike.%${cleanQuery}%`,
            `category.ilike.%${cleanQuery}%`,
            `transmission.ilike.%${cleanQuery}%`,
            `drivetrain.ilike.%${cleanQuery}%`,
            `type.ilike.%${cleanQuery}%`,
            `condition.ilike.%${cleanQuery}%`,
          ];

          // If the user input is numeric (year, price, mileage), add specific conditions
          if (!isNaN(Number(cleanQuery))) {
            searchConditions = searchConditions.concat([
              `year::text.ilike.%${cleanQuery}%`,
              `price::text.ilike.%${cleanQuery}%`,
              `mileage::text.ilike.%${cleanQuery}%`,
            ]);
          }

          // Apply the OR filter properly
          queryBuilder = queryBuilder.or(searchConditions.join(","));
        }

        // Sorting: Only apply ordering if a sort option is provided.
        if (currentSortOption) {
          switch (currentSortOption) {
            case "price_asc":
              queryBuilder = queryBuilder.order("price", { ascending: true });
              break;
            case "price_desc":
              queryBuilder = queryBuilder.order("price", { ascending: false });
              break;
            case "year_asc":
              queryBuilder = queryBuilder.order("year", { ascending: true });
              break;
            case "year_desc":
              queryBuilder = queryBuilder.order("year", { ascending: false });
              break;
            case "mileage_asc":
              queryBuilder = queryBuilder.order("mileage", { ascending: true });
              break;
            case "mileage_desc":
              queryBuilder = queryBuilder.order("mileage", {
                ascending: false,
              });
              break;
            case "views_desc":
              queryBuilder = queryBuilder.order("views", { ascending: false });
              break;
          }
        }

        // Pagination calculations
        const { count } = await queryBuilder;
        if (!count) {
          setCars([]);
          setTotalPages(0);
          setCurrentPage(1);
          return;
        }
        const totalItems = count;
        const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
        const safePageNumber = Math.min(page, totalPages);
        const startRange = (safePageNumber - 1) * ITEMS_PER_PAGE;
        const endRange = Math.min(
          safePageNumber * ITEMS_PER_PAGE - 1,
          totalItems - 1
        );

        // Fetch data for current page
        const { data, error } = await queryBuilder.range(startRange, endRange);

        if (error) throw error;

        // If no sort option is selected, randomize the order of the fetched data
        if (!currentSortOption) {
          for (let i = data.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [data[i], data[j]] = [data[j], data[i]];
          }
        }

        // Merge dealership info into the car data
        const newCars =
          data?.map((item: any) => ({
            ...item,
            dealership_name: item.dealerships.name,
            dealership_logo: item.dealerships.logo,
            dealership_phone: item.dealerships.phone,
            dealership_location: item.dealerships.location,
            dealership_latitude: item.dealerships.latitude,
            dealership_longitude: item.dealerships.longitude,
          })) || [];

        // Deduplicate car entries by id
        const uniqueCars = Array.from(
          new Set(newCars.map((car: any) => car.id))
        ).map((id) => newCars.find((car: any) => car.id === id)) as Car[];

        setCars((prevCars) =>
          safePageNumber === 1 ? uniqueCars : [...prevCars, ...uniqueCars]
        );
        setTotalPages(totalPages);
        setCurrentPage(safePageNumber);
      } catch (error) {
        console.error("Error fetching cars:", error);
        setCars([]);
        setTotalPages(0);
        setCurrentPage(1);
      } finally {
        if (page === 1) {
          if (!hasFetched) {
            setIsInitialLoading(false);
          } else {
            setRefreshing(false);
          }
          setHasFetched(true);
        } else {
          setLoadingMore(false);
        }
      }
    },
    [filters, sortOption, searchQuery, hasFetched]
  );

  // Debounce suggestions fetch
  useEffect(() => {
    const delayDebounce = setTimeout(() => {}, 300);
    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const onRefresh = useCallback(() => {
    fetchCars(1, filters, sortOption, searchQuery);
  }, [filters, sortOption, searchQuery, fetchCars]);

  const handleFavoritePress = useCallback(
    async (carId: string) => {
      await toggleFavorite(carId); // Just toggle, we don't manage likes here
      setCars((prevCars) =>
        prevCars.map(
          (car) => (car.id === carId ? { ...car } : car) // Just change likes
        )
      );
    },
    [toggleFavorite]
  );

  const renderCarItem = useCallback(
    ({ item, index }: { item: Car; index: number }) => (
      <CarCard
        car={item}
        index={index}
        onFavoritePress={() => handleFavoritePress(item.id)}
        isFavorite={isFavorite(Number(item.id))}
        isDealer={false}
      />
    ),
    [handleFavoritePress, isFavorite]
  );

  const openFilterPage = useCallback(() => {
    router.push({
      pathname: "/(home)/(user)/filter",
      params: { filters: JSON.stringify(filters) },
    });
  }, [router, filters]);

  const keyExtractor = useCallback(
    (item: Car) => `${item.id}-${item.make}-${item.model}`,
    []
  );

  // Add this callback function in BrowseCarsPage
  const handleSearchSubmit = useCallback(
    (query: string) => {
      setSearchQuery(query); // Update the search query
      setIsSearchVisible(false); // Close the modal
      fetchCars(1, filters, sortOption, query); // Fetch with new query
    },
    [filters, sortOption, fetchCars]
  );

  // Update the SearchModal component call

  const handleCategoryPress = useCallback(
    (category: string) => {
      setFilters((prevFilters) => {
        const updatedCategories = prevFilters.categories
          ? prevFilters.categories.includes(category)
            ? prevFilters.categories.filter((c) => c !== category)
            : [...prevFilters.categories, category]
          : [category];
        const newFilters = {
          ...prevFilters,
          categories: updatedCategories,
        };
        fetchCars(1, newFilters, sortOption, searchQuery);
        return newFilters;
      });
    },
    [sortOption, searchQuery, fetchCars]
  );

  const handleResetFilters = useCallback(() => {
    setFilters({});
    setSearchQuery("");
    setSortOption(null);
    fetchCars(1, {}, null, "");
  }, [fetchCars]);

  const renderListHeader = useMemo(
    () => (
      <>
        {isInitialLoading && cars.length === 0 ? (
          <SkeletonByBrands />
        ) : (
          <Animated.View style={{ opacity: fadeAnim }}>
            <ByBrands />
          </Animated.View>
        )}
        <View style={{ marginBottom: 12, marginTop: 12 }}>
          {isInitialLoading && cars.length === 0 ? (
            <SkeletonCategorySelector />
          ) : (
            <Animated.View style={{ opacity: fadeAnim }}>
              <CategorySelector
                selectedCategories={filters.categories || []}
                onCategoryPress={handleCategoryPress}
              />
            </Animated.View>
          )}
        </View>
      </>
    ),
    [cars, isInitialLoading, fadeAnim, filters.categories, handleCategoryPress]
  );

  const renderListEmpty = useCallback(
    () =>
      !isInitialLoading &&
      cars.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, isDarkMode && styles.darkEmptyText]}>
            {filters.categories && filters.categories.length > 0
              ? `No cars available for the selected ${
                  filters.categories.length === 1 ? "category" : "categories"
                }:\n${filters.categories.join(", ")}`
              : "No cars available."}
          </Text>
          {(Object.keys(filters).length > 0 || searchQuery) && (
            <TouchableOpacity
              onPress={handleResetFilters}
              style={styles.resetButton}
            >
              <Text style={styles.resetButtonText}>Remove filters</Text>
            </TouchableOpacity>
          )}
        </View>
      ),
    [
      filters,
      searchQuery,
      isDarkMode,
      isInitialLoading,
      handleResetFilters,
      cars,
    ]
  );

  // When initially loading with no data, show skeletons
  const listData =
    isInitialLoading && cars.length === 0 ? Array(3).fill(null) : cars;

  // Styles for the suggestions
  const suggestionStyles = useMemo(
    () =>
      StyleSheet.create({
        suggestionsContainer: {
          position: "absolute",
          top: 60,
          left: 10,
          right: 10,
          borderRadius: 16,
          backgroundColor: isDarkMode
            ? "rgba(30,30,30,0.9)"
            : "rgba(255,255,255,0.95)",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 6,
          borderWidth: 1,
          borderColor: isDarkMode ? "rgba(255,255,255)" : "rgba(0, 0, 0, 0)",
        },
        suggestionsInnerContainer: {
          padding: 4,
        },

        suggestionsHeader: {
          fontWeight: "bold",
          fontSize: 16,
          paddingBottom: 8,
          marginTop: 8,
          color: isDarkMode ? "#fff" : "#000",
        },
        suggestionItem: {
          paddingVertical: 8,
          fontSize: 12,
          paddingHorizontal: 16,
          borderBottomWidth: 1,
          borderBottomColor: isDarkMode
            ? "rgba(255,255,255,0.1)"
            : "rgba(0, 0, 0, 0.06)",
        },
        suggestionItemLast: {
          borderBottomWidth: 0,
        },
        suggestionText: {
          fontSize: 18,
          color: isDarkMode ? "#fff" : "#000",
        },
      }),
    [isDarkMode]
  );

  return (
    <LinearGradient
      colors={isDarkMode ? ["#000000", "#1A1A1A"] : ["#FFFFFF", "#F5F5F5"]}
      style={{ flex: 1 }}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <SafeAreaView
        style={[
          styles.container,
          isDarkMode && styles.darkContainer,
          { backgroundColor: "transparent" },
        ]}
      >
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <TouchableOpacity
              style={[styles.searchBar, isDarkMode && styles.darkSearchBar]}
              onPress={() => {
                router.push({
                  pathname: "/(home)/(user)/search",
                  params: {
                    currentQuery: searchQuery, // Pass current query to maintain state
                    timestamp: Date.now().toString(), // Add timestamp to force refresh
                  },
                });
              }}
            >
              <FontAwesome
                name="search"
                size={20}
                color={isDarkMode ? "#FFFFFF" : "#000000"}
                style={{ marginLeft: 12 }}
              />
              <Text
                style={[
                  styles.searchPlaceholder,
                  isDarkMode && { color: "#666" },
                ]}
                numberOfLines={1}
              >
                {searchQuery || "Search cars..."}
              </Text>
              {searchQuery ? (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation(); // Prevent parent onPress from firing
                    setSearchQuery("");
                    fetchCars(1, filters, sortOption, ""); // Immediately fetch all cars when clearing
                  }}
                  style={styles.clearSearchButton}
                >
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={isDarkMode ? "#FFFFFF" : "#666666"}
                  />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.iconButton,
                    isDarkMode && styles.darkIconButton,
                  ]}
                  onPress={(e) => {
                    e.stopPropagation(); // Prevent parent onPress from firing
                    openFilterPage();
                  }}
                >
                  <FontAwesome
                    name="sliders"
                    size={20}
                    color={isDarkMode ? "#000000" : "#ffffff"}
                  />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            <SortPicker
              onValueChange={(value: string | null) => {
                setSortOption(value);
                fetchCars(1, filters, value, searchQuery);
              }}
              initialValue={sortOption}
            />
          </View>
        </View>
        <FlatList
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#D55004"]}
              tintColor={isDarkMode ? "#FFFFFF" : "#D55004"}
              titleColor={isDarkMode ? "#FFFFFF" : "#000000"}
            />
          }
          ref={flatListRef}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            {
              useNativeDriver: false,
              listener: ({ nativeEvent }: any) => {
                setShowScrollTopButton(nativeEvent.contentOffset.y > 200);
              },
            }
          )}
          scrollEventThrottle={16}
          ListHeaderComponent={renderListHeader}
          data={listData}
          renderItem={
            isInitialLoading && cars.length === 0
              ? () => <SkeletonCarCard />
              : renderCarItem
          }
          keyExtractor={
            isInitialLoading && cars.length === 0
              ? (_item, index) => `skeleton-${index}`
              : keyExtractor
          }
          onEndReached={() => {
            if (currentPage < totalPages && !loadingMore) {
              fetchCars(currentPage + 1, filters, sortOption, searchQuery);
            }
          }}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={renderListEmpty}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                style={{ margin: 16 }}
                color={isDarkMode ? "#FFFFFF" : "#000000"}
              />
            ) : (
              <View style={{ paddingBottom: 50 }} />
            )
          }
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  darkContainer: {
    backgroundColor: "#000000",
  },
  searchContainer: {
    padding: 10,
    zIndex: 10,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  searchInput: {
    flex: 1,
    color: "black",
    padding: 12,
  },
  darkSearchInput: {
    color: "white",
  },
  clearButton: {
    padding: 10,
  },
  iconButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: "#000000",
  },
  darkIconButton: {
    backgroundColor: "#ffffff",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
    color: "#000",
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
  darkSearchBar: {
    borderColor: "#333",
    backgroundColor: "#222",
  },
  searchPlaceholder: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: "#666",
  },
  // Add to your styles
  clearSearchButton: {
    padding: 8,
    marginRight: 4,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 24,
    marginHorizontal: 10,
    backgroundColor: "#f5f5f5",
    paddingLeft: 12,
    paddingRight: 8, // Reduced padding to accommodate the clear button
  },
});
