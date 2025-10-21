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
  TouchableOpacity,
  StyleSheet,
  Text,
  Keyboard,
  StatusBar,
  ActivityIndicator,
  Animated,
  RefreshControl,
  Button
} from "react-native";
import { supabase } from "@/utils/supabase";
import CarCard from "@/components/CarCard";
import { useFavorites } from "@/utils/useFavorites";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import ByBrands from "@/components/ByBrands";
import Banner from "@/components/Banner";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/utils/ThemeContext";
import CategorySelector from "@/components/Category";
import SortPicker from "@/components/SortPicker";
import { useLanguage } from "@/utils/LanguageContext";
import i18n from "@/utils/i18n";
import { useScrollToTop } from "@react-navigation/native";
import SkeletonByBrands from "@/components/SkeletonByBrands";
import SkeletonCategorySelector from "@/components/SkeletonCategorySelector";
import SkeletonCarCard from "@/components/SkeletonCarCard";
import * as Sentry from '@sentry/react-native';
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
  likes?: number;
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
  source?: string | string[];
  fuelType?: string | string[];
}

export default function BrowseCarsPage() {
  const { isDarkMode } = useTheme();
  const { toggleFavorite, isFavorite } = useFavorites();
  const { language } = useLanguage();
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
  const flatListRef = useRef<FlatList<Car>>(null);
  useScrollToTop(flatListRef);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);
  
  // Simplified loading states - removed progressive loading that was causing issues
  const [componentsLoaded, setComponentsLoaded] = useState(false);

  const [suggestions, setSuggestions] = useState<any>({
    makes: [],
    models: [],
  });
  const [showSuggestions, setShowSuggestions] = useState(false);

  const router = useRouter();
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const params = useLocalSearchParams<{
    filters?: string;
    searchQuery?: string;
    timestamp?: string;
  }>();

  // Simplified component loading
  useEffect(() => {
    // Allow components to load immediately instead of progressive loading
    setComponentsLoaded(true);
  }, []);

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

      if (params.filters) {
        try {
          initialFilters = JSON.parse(params.filters);
          shouldFetch = true;
        } catch (error) {
          console.error("Error parsing filters:", error);
        }
      }

      if (params.searchQuery !== undefined) {
        initialQuery = params.searchQuery;
        shouldFetch = true;
      }

      if (Object.keys(initialFilters).length > 0) {
        setFilters(initialFilters);
      }
      if (initialQuery !== searchQuery) {
        setSearchQuery(initialQuery);
      }

      if (shouldFetch || !isInitialLoadDone) {
        await fetchCars(1, initialFilters, sortOption, initialQuery);
        setIsInitialLoadDone(true);
      }
    };

    initializePage();
  }, [params.searchQuery, params.filters, params.timestamp]);

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

        // Multi-select filters
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
        if (
          Array.isArray(currentFilters.source) &&
          currentFilters.source.length > 0
        ) {
          queryBuilder = queryBuilder.in("source", currentFilters.source);
        } else if (
          typeof currentFilters.source === "string" &&
          currentFilters.source
        ) {
          queryBuilder = queryBuilder.eq("source", currentFilters.source);
        }

        // Fuel Type filter
        if (
          Array.isArray(currentFilters.fuelType) &&
          currentFilters.fuelType.length > 0
        ) {
          queryBuilder = queryBuilder.in("type", currentFilters.fuelType);
        } else if (
          typeof currentFilters.fuelType === "string" &&
          currentFilters.fuelType
        ) {
          queryBuilder = queryBuilder.eq("type", currentFilters.fuelType);
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

        // Enhanced search query implementation with smart brand detection
        if (query) {
          const cleanQuery = query.trim().toLowerCase();
          const queryTerms = cleanQuery
            .split(/\s+/)
            .filter((term) => term.length > 0);

          // First, check if the query is an exact brand/make match
          const { data: brandCheck } = await supabase
            .from("cars")
            .select("make")
            .ilike("make", cleanQuery)
            .eq("status", "available")
            .limit(1);

          const isExactBrandMatch = brandCheck && brandCheck.length > 0;

          if (isExactBrandMatch) {
            // If it's an exact brand match, filter by that brand only
            queryBuilder = queryBuilder.eq("make", brandCheck[0].make);
          } else if (queryTerms.length === 1) {
            const singleTerm = queryTerms[0];
            
            // Check if single term is a partial brand match
            const { data: partialBrandCheck } = await supabase
              .from("cars")
              .select("make")
              .ilike("make", `%${singleTerm}%`)
              .eq("status", "available")
              .limit(3);

            const isPartialBrandMatch = partialBrandCheck && partialBrandCheck.length > 0;
            
            if (isPartialBrandMatch && partialBrandCheck.length === 1) {
              // If there's only one partial brand match, filter by that brand
              queryBuilder = queryBuilder.eq("make", partialBrandCheck[0].make);
            } else {
              // General search across multiple fields with prioritization
              let searchConditions = [
                `make.ilike.%${singleTerm}%`,
                `model.ilike.%${singleTerm}%`,
                `description.ilike.%${singleTerm}%`,
                `color.ilike.%${singleTerm}%`,
                `category.ilike.%${singleTerm}%`,
                `transmission.ilike.%${singleTerm}%`,
                `drivetrain.ilike.%${singleTerm}%`,
                `type.ilike.%${singleTerm}%`,
                `condition.ilike.%${singleTerm}%`,
                `source.ilike.%${singleTerm}%`,
              ];

              if (!isNaN(Number(singleTerm))) {
                searchConditions = searchConditions.concat([
                  `year::text.ilike.%${singleTerm}%`,
                  `price::text.ilike.%${singleTerm}%`,
                  `mileage::text.ilike.%${singleTerm}%`,
                ]);
              }

              queryBuilder = queryBuilder.or(searchConditions.join(","));
            }
          } else if (queryTerms.length === 2) {
            const [term1, term2] = queryTerms;
            
            // Check for brand + model combination
            const { data: brandModelCheck } = await supabase
              .from("cars")
              .select("make, model")
              .or(`and(make.ilike.%${term1}%,model.ilike.%${term2}%),and(make.ilike.%${term2}%,model.ilike.%${term1}%)`)
              .eq("status", "available")
              .limit(5);

                         if (brandModelCheck && brandModelCheck.length > 0) {
               // Found specific brand+model combinations
               const brandModelConditions: string[] = [];
               const processedCombos = new Set<string>();
               
                                brandModelCheck.forEach((row: any) => {
                   const combo = `${row.make.toLowerCase()}-${row.model.toLowerCase()}`;
                   if (!processedCombos.has(combo)) {
                     brandModelConditions.push(`and(make.eq.${row.make},model.eq.${row.model})`);
                     processedCombos.add(combo);
                   }
                 });
               
               if (brandModelConditions.length > 0) {
                 queryBuilder = queryBuilder.or(brandModelConditions.join(","));
               } else {
                // Fall back to general search
                const makeModelCondition = `and(make.ilike.%${term1}%,model.ilike.%${term2}%)`;
                const modelMakeCondition = `and(make.ilike.%${term2}%,model.ilike.%${term1}%)`;
                const combinedSearchConditions = [
                  `make.ilike.%${cleanQuery}%`,
                  `model.ilike.%${cleanQuery}%`,
                  `description.ilike.%${cleanQuery}%`,
                  `color.ilike.%${cleanQuery}%`,
                  `category.ilike.%${cleanQuery}%`,
                  `transmission.ilike.%${cleanQuery}%`,
                  `drivetrain.ilike.%${cleanQuery}%`,
                  `type.ilike.%${cleanQuery}%`,
                  `condition.ilike.%${cleanQuery}%`,
                  `source.ilike.%${cleanQuery}%`,
                ];
                
                const allConditions = [
                  makeModelCondition,
                  modelMakeCondition,
                  ...combinedSearchConditions,
                ];
                queryBuilder = queryBuilder.or(allConditions.join(","));
              }
            } else {
              // No specific brand+model found, use general search
              const makeModelCondition = `and(make.ilike.%${term1}%,model.ilike.%${term2}%)`;
              const modelMakeCondition = `and(make.ilike.%${term2}%,model.ilike.%${term1}%)`;
              const combinedSearchConditions = [
                `make.ilike.%${cleanQuery}%`,
                `model.ilike.%${cleanQuery}%`,
                `description.ilike.%${cleanQuery}%`,
                `color.ilike.%${cleanQuery}%`,
                `category.ilike.%${cleanQuery}%`,
                `transmission.ilike.%${cleanQuery}%`,
                `drivetrain.ilike.%${cleanQuery}%`,
                `type.ilike.%${cleanQuery}%`,
                `condition.ilike.%${cleanQuery}%`,
                `source.ilike.%${cleanQuery}%`,
              ];
              const individualTermConditions: any = [];
              queryTerms.forEach((term) => {
                individualTermConditions.push(
                  `make.ilike.%${term}%`,
                  `model.ilike.%${term}%`,
                  `description.ilike.%${term}%`,
                  `category.ilike.%${term}%`
                );
              });
              const allConditions = [
                makeModelCondition,
                modelMakeCondition,
                ...combinedSearchConditions,
                ...individualTermConditions,
              ];
              queryBuilder = queryBuilder.or(allConditions.join(","));
            }
          } else {
            // Multi-term search
            const multiTermConditions = [];
            multiTermConditions.push(
              `make.ilike.%${cleanQuery}%`,
              `model.ilike.%${cleanQuery}%`,
              `description.ilike.%${cleanQuery}%`,
              `category.ilike.%${cleanQuery}%`
            );
            queryTerms.forEach((term) => {
              multiTermConditions.push(
                `make.ilike.%${term}%`,
                `model.ilike.%${term}%`,
                `description.ilike.%${term}%`,
                `category.ilike.%${term}%`,
                `color.ilike.%${term}%`
              );
            });
            queryBuilder = queryBuilder.or(multiTermConditions.join(","));
          }
        }

        // Sorting
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

        // Get count first for pagination
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

        // Apply randomization to ensure all cars get visibility
        if (!currentSortOption && data) {
          if (query) {
            // For search results: maintain relevance but add randomization within relevance groups
            const cleanQueryLocal = query.trim().toLowerCase();
            const terms = cleanQueryLocal.split(/\s+/).filter(Boolean);
            const scoreEntry = (entry: any) => {
              const make = (entry.make || "").toString().toLowerCase();
              const model = (entry.model || "").toString().toLowerCase();
              const concat = `${make} ${model}`.trim();
              let score = 0;

              // Highest priority: make + model combos
              if (terms.length >= 2) {
                if ((make.includes(terms[0]) && model.includes(terms[1])) || (make.includes(terms[1]) && model.includes(terms[0]))) {
                  score += 1000;
                }
              }

              // Exact phrase match in make+model
              if (concat.includes(cleanQueryLocal)) score += 800;

              // Strong matches on model / make
              if (model.includes(cleanQueryLocal)) score += 500;
              if (make.includes(cleanQueryLocal)) score += 400;

              // Partial term matches in make/model
              terms.forEach(t => {
                if (make.includes(t)) score += 120;
                if (model.includes(t)) score += 150;
              });

              // Lower weight for other textual fields (if present)
              const otherFields = [
                (entry.category || ""),
                (entry.color || ""),
                (entry.transmission || ""),
                (entry.drivetrain || ""),
                (entry.type || ""),
                (entry.condition || ""),
                (entry.source || ""),
                (entry.description || "")
              ].map(v => v.toString().toLowerCase());
              if (otherFields.some(v => v.includes(cleanQueryLocal))) score += 80;
              terms.forEach(t => {
                if (otherFields.some(v => v.includes(t))) score += 30;
              });

              // Add small random factor to break ties and add variety
              score += Math.random() * 10;

              return score;
            };

            data.sort((a: any, b: any) => scoreEntry(b) - scoreEntry(a));
          } else {
            // No search query: fully randomize to give all cars equal visibility
            for (let i = data.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [data[i], data[j]] = [data[j], data[i]];
            }
          }
        }

        // Map dealership info - simplified approach
        const newCars: Car[] =
          data?.map((item: any) => ({
            ...item,
            dealership_name: item.dealerships.name,
            dealership_logo: item.dealerships.logo,
            dealership_phone: item.dealerships.phone,
            dealership_location: item.dealerships.location,
            dealership_latitude: item.dealerships.latitude,
            dealership_longitude: item.dealerships.longitude,
          })) || [];

        // Simplified deduplication - use Map for better performance
        const carMap = new Map();
        newCars.forEach(car => {
          if (!carMap.has(car.id)) {
            carMap.set(car.id, car);
          }
        });
        const uniqueCars = Array.from(carMap.values());

        // Update cars state more efficiently
        setCars((prevCars) => {
          if (safePageNumber === 1) {
            return uniqueCars;
          } else {
            // Create a new map to ensure no duplicates when appending
            const allCarsMap = new Map();
            prevCars.forEach(car => allCarsMap.set(car.id, car));
            uniqueCars.forEach(car => allCarsMap.set(car.id, car));
            return Array.from(allCarsMap.values());
          }
        });
        
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

  const onRefresh = useCallback(() => {
    fetchCars(1, filters, sortOption, searchQuery);
  }, [filters, sortOption, searchQuery, fetchCars]);

  const handleFavoritePress = useCallback(
    async (carId: string) => {
      await toggleFavorite(parseInt(carId));
      setCars((prevCars) =>
        prevCars.map(
          (car) => (car.id === carId ? { ...car } : car)
        )
      );
    },
    [toggleFavorite]
  );

  const renderCarItem = useCallback(
    ({ item, index }: { item: Car; index: number }) => (
      <>
        <CarCard
          car={item}
          index={index}
          onFavoritePress={() => handleFavoritePress(item.id)}
          isFavorite={isFavorite(Number(item.id))}
          isDealer={false}
        />
        {/* Show banner after every 10 cars */}
        {(index + 1) % 10 === 0 && <Banner />}
      </>
    ),
    [handleFavoritePress, isFavorite]
  );

  const openFilterPage = useCallback(() => {
    router.push({
      pathname: "/(home)/(user)/filter",
      params: { filters: JSON.stringify(filters) },
    });
  }, [router, filters]);

  // Simplified and stable key extractor - use only ID for uniqueness
  const keyExtractor = useCallback(
    (item: Car, index: number) => `car-${item.id}`,
    []
  );

  const handleSearchSubmit = useCallback(
    (query: string) => {
      setSearchQuery(query);
      setIsSearchVisible(false);
      fetchCars(1, filters, sortOption, query);
    },
    [filters, sortOption, fetchCars]
  );

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
        {!componentsLoaded || isInitialLoading ? (
          <SkeletonByBrands />
        ) : (
          <View>
            <ByBrands />
          </View>
        )}
        <Banner />
        <View style={{ marginBottom: 12, marginTop: 12 }}>
          {!componentsLoaded || isInitialLoading ? (
            <SkeletonCategorySelector />
          ) : (
            <View>
              <CategorySelector
                selectedCategories={filters.categories || []}
                onCategoryPress={handleCategoryPress}
              />
            </View>
          )}
        </View>
      </>
    ),
    [componentsLoaded, isInitialLoading, filters.categories, handleCategoryPress]
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

  // Simplified skeleton rendering - only show when actually loading
  const renderSkeletonItem = useCallback(() => <SkeletonCarCard />, []);

  return (
    <View style={{ flex: 1, backgroundColor: isDarkMode ? "#000000" : "#FFFFFF" }}>
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
            <View style={[
              styles.searchInputContainer,
              language === 'ar' && styles.rtlContainer
            ]}>
              <TouchableOpacity
                style={[
                  styles.searchBar,
                  isDarkMode && styles.darkSearchBar,
                  language === 'ar' && styles.rtlSearchBar
                ]}
                onPress={() => {
                  router.push({
                    pathname: "/(home)/(user)/search",
                    params: {
                      currentQuery: searchQuery,
                      timestamp: Date.now().toString(),
                    },
                  });
                }}
              >
                <FontAwesome
                  name="search"
                  size={20}
                  color={isDarkMode ? "#FFFFFF" : "#000000"}
                  style={language === 'ar' ? { marginRight: 12 } : { marginLeft: 12 }}
                />
                <Text
                  style={[
                    styles.searchPlaceholder,
                    isDarkMode && { color: "#666" },
                    language === 'ar' && styles.rtlText
                  ]}
                  numberOfLines={1}
                >
{searchQuery || i18n.t('search.search_placeholder')}
                </Text>
                {searchQuery ? (
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      setSearchQuery("");
                      fetchCars(1, filters, sortOption, "");
                    }}
                    style={[
                      styles.clearSearchButton,
                      language === 'ar' && styles.rtlClearButton
                    ]}
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
                      language === 'ar' && styles.rtlIconButton
                    ]}
                    onPress={(e) => {
                      e.stopPropagation();
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
                tintColor={isDarkMode ? "#FFFFFF" : "#000000"}
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
            data={isInitialLoading && cars.length === 0 ? Array(3).fill({}) : cars}
            renderItem={
              isInitialLoading && cars.length === 0
                ? renderSkeletonItem
                : renderCarItem
            }
            keyExtractor={
              isInitialLoading && cars.length === 0
                ? (_, index) => `skeleton-${index}`
                : keyExtractor
            }
            onEndReached={() => {
              if (currentPage < totalPages && !loadingMore && !isInitialLoading) {
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
            // Enhanced FlatList performance optimization
            removeClippedSubviews={true}
            maxToRenderPerBatch={5}
            updateCellsBatchingPeriod={50}
            initialNumToRender={5}
            windowSize={10}
            getItemLayout={undefined} // Let FlatList handle this automatically
          />
        </SafeAreaView>
      </LinearGradient>
    </View>
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
    paddingRight: 8,
  },
  // RTL Support Styles
  rtlContainer: {
    flexDirection: "row-reverse",
  },
  rtlSearchBar: {
    flexDirection: "row-reverse",
    paddingLeft: 8,
    paddingRight: 12,
  },
  rtlText: {
    textAlign: "right",
    marginLeft: 0,
    marginRight: 12,
  },
  rtlClearButton: {
    marginRight: 0,
    marginLeft: 4,
  },
  rtlIconButton: {
    marginRight: 0,
    marginLeft: 8,
  },
});