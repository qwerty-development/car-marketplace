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
  Button,
  TextInput,
  Platform
} from "react-native";
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { supabase } from "@/utils/supabase";
import CarCard from "@/components/CarCard";
import RentalCarCard from "@/components/RentalCarCard";
import NumberPlateCard from "@/components/NumberPlateCard";
import { useFavorites } from "@/utils/useFavorites";
import { FontAwesome, Ionicons, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import ByBrands from "@/components/ByBrands";
import Banner from "@/components/Banner";
import AdBanner from "@/components/AdBanner";
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
import PlateFilterModal from "@/components/PlateFilterModal";
import CategorySelectorModal, { VehicleCategory } from "@/components/CategorySelectorModal";
import * as Sentry from '@sentry/react-native';
import { prefetchNextPage, prefetchCarImages } from "@/utils/smartPrefetch";
import { LAZY_FLATLIST_PROPS } from "@/utils/lazyLoading";
import { cacheLogger } from "@/utils/cacheLogger";
import { cachedQuery, generateCacheKey } from "@/utils/supabaseCache";
const ITEMS_PER_PAGE = 7;

interface Car {
  id: string;
  make: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  category: string;
  seller_type?: 'user' | 'dealer';
  seller_name?: string;
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

interface NumberPlate {
  id: string;
  picture: string;
  price: number;
  letter: string;
  digits: string;
  status: string;
  user_id?: string;
  dealership_id?: number;
  seller_name?: string;
  seller_phone?: string;
  seller_type?: 'user' | 'dealer';
  dealership_logo?: string;
  dealership_location?: string;
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
  const [plates, setPlates] = useState<NumberPlate[]>([]);
  const [vehicleCategory, setVehicleCategory] = useState<VehicleCategory>('cars');
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [carViewMode, setCarViewMode] = useState<'sale' | 'rent'>('sale');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({}); // Car filters
  const [plateFilters, setPlateFilters] = useState<{
    priceRange?: [number, number];
    sortBy?: string;
  }>({}); // Plate filters
  const [plateSortOption, setPlateSortOption] = useState<string | null>(null);
  const [showScrollTopButton, setShowScrollTopButton] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList<Car>>(null);
  useScrollToTop(flatListRef);
  const [searchBarHeight, setSearchBarHeight] = useState(0);

  // Calculate sticky search bar position
  const stickySearchTranslateY = scrollY.interpolate({
    inputRange: [0, 200],
    outputRange: [0, 0],
    extrapolate: 'clamp',
  });
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);
  const [isPlateFilterVisible, setIsPlateFilterVisible] = useState(false);
  
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
        if (vehicleCategory !== 'plates') {
          await fetchCars(1, initialFilters, sortOption, initialQuery, carViewMode, false, vehicleCategory);
        } else {
          await fetchPlates(1, plateFilters, sortOption, initialQuery);
        }
        setIsInitialLoadDone(true);
      }
    };

    initializePage();
  }, [params.searchQuery, params.filters, params.timestamp, vehicleCategory, carViewMode]);

  const fetchCars = useCallback(
    async (
      page: number = 1,
      currentFilters: Filters = filters,
      currentSortOption: string | null = sortOption,
      query: string = searchQuery,
      currentCarViewMode: 'sale' | 'rent' = carViewMode,
      forceRefresh: boolean = false,
      currentVehicleCategory: VehicleCategory = vehicleCategory
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
        // Determine table based on car view mode
        const tableName = currentCarViewMode === 'rent' ? 'cars_rent' : 'cars';
        
        // Build select string based on view mode
        // cars_rent only has dealerships relationship, no users
        // Use explicit FK hint for users since there are multiple relationships (user_id and deleted_by)
        const selectString = currentCarViewMode === 'rent'
          ? `*, dealerships (name,logo,phone,location,latitude,longitude)`
          : `*, dealerships (name,logo,phone,location,latitude,longitude), users!cars_user_id_fkey (name, id)`;
        
        let queryBuilder = supabase
          .from(tableName)
          .select(selectString, { count: "exact" })
          .eq("status", "available");

        // Vehicle category filter (bikes = Motorcycle, trucks = Truck, cars = exclude Motorcycle/Truck)
        if (currentVehicleCategory === 'bikes') {
          queryBuilder = queryBuilder.eq("category", "Motorcycle");
        } else if (currentVehicleCategory === 'trucks') {
          queryBuilder = queryBuilder.eq("category", "Truck");
        } else if (currentVehicleCategory === 'cars') {
          // For cars, exclude motorcycles and trucks
          queryBuilder = queryBuilder.not("category", "in", "(Motorcycle,Truck)");
        }

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

        // Categories (user-selected filter categories, not vehicle category)
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
        // Condition filter (only for sale mode - cars_rent doesn't have condition)
        if (currentCarViewMode === 'sale') {
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
        // Source filter (only for sale mode - cars_rent doesn't have source)
        if (currentCarViewMode === 'sale') {
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
        // Mileage Range (only for sale mode - cars_rent doesn't have mileage)
        if (currentCarViewMode === 'sale' && currentFilters.mileageRange) {
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
              ];

              // Add fields that only exist in cars table (not in cars_rent)
              if (currentCarViewMode === 'sale') {
                searchConditions.push(
                  `condition.ilike.%${singleTerm}%`,
                  `source.ilike.%${singleTerm}%`
                );
              }

              if (!isNaN(Number(singleTerm))) {
                const numericConditions = [
                  `year::text.ilike.%${singleTerm}%`,
                  `price::text.ilike.%${singleTerm}%`,
                ];
                
                // Mileage only exists in cars table
                if (currentCarViewMode === 'sale') {
                  numericConditions.push(`mileage::text.ilike.%${singleTerm}%`);
                }
                
                searchConditions = searchConditions.concat(numericConditions);
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

        // Apply priority-based boost ordering (always prioritize boosted cars in sale mode)
        if (currentCarViewMode === 'sale') {
          queryBuilder = queryBuilder
            .order("boost_priority", { ascending: false, nullsFirst: false });
        }

        // Fetch data for current page - USE CACHE WRAPPER
        const cacheKey = generateCacheKey(
          tableName,
          {
            page: safePageNumber,
            filters: currentFilters,
            sortOption: currentSortOption,
            query: query,
            range: { start: startRange, end: endRange },
          },
          selectString
        );
        
        console.log(`\n[FetchCars] ========================================`);
        console.log(`[FetchCars] 🔍 Querying: ${tableName} page ${safePageNumber}`);
        console.log(`[FetchCars] 📋 Cache Key: ${cacheKey.substring(0, 100)}${cacheKey.length > 100 ? '...' : ''}`);
        console.log(`[FetchCars] 📊 Filters: ${JSON.stringify(currentFilters).substring(0, 50)}...`);
        console.log(`[FetchCars] 🔢 Range: ${startRange}-${endRange}`);
        
        // Use cached query wrapper to actually check cache first
        const result = await cachedQuery(
          async () => {
            console.log(`[FetchCars] 🌐 Executing Supabase query...`);
            const queryResult = await queryBuilder.range(startRange, endRange);
            return queryResult;
          },
          cacheKey,
          {
            ttl: currentFilters.specialFilter === 'newArrivals' 
              ? 5 * 60 * 1000  // 5 minutes for new arrivals
              : 24 * 60 * 60 * 1000, // 24 hours for regular queries
            forceRefresh: forceRefresh, // Bypass cache on pull-to-refresh
          }
        );

        const { data, error, fromCache } = result;
        const dataSize = data ? JSON.stringify(data).length : 0;

        if (error) {
          console.error(`[FetchCars] ❌ Error: ${error.message}`);
          console.log(`[FetchCars] ========================================\n`);
          throw error;
        }

        const cacheStatus = fromCache ? '✅ CACHE HIT' : '❌ CACHE MISS';
        const totalCarsAfter = safePageNumber === 1 ? (data?.length || 0) : cars.length + (data?.length || 0);
        console.log(`[FetchCars] ${cacheStatus} - Fetched ${data?.length || 0} cars (${(dataSize / 1024).toFixed(2)}KB)`);
        console.log(`[FetchCars] 📊 Total cars in state after this query: ${totalCarsAfter}`);
        console.log(`[FetchCars] 📄 Page ${safePageNumber}/${totalPages} | Current state: ${cars.length} cars`);
        console.log(`[FetchCars] ========================================\n`);

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

              // PRIORITY 1: Boost priority gets highest weight (10000 points per priority level)
              // This ensures boosted cars ALWAYS appear before non-boosted cars
              if (entry.is_boosted && entry.boost_priority && entry.boost_end_date) {
                const now = new Date();
                const boostEnd = new Date(entry.boost_end_date);
                if (boostEnd > now) {
                  // Active boost: priority 5 = 50000 points, priority 1 = 10000 points
                  score += entry.boost_priority * 10000;
                }
              }

              // PRIORITY 2: Relevance scoring (max ~2000 points)
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
            // No search query: prioritize boosted cars, then randomize within each group
            const boostedCars = data.filter((car: any) => {
              return car.is_boosted && car.boost_priority && car.boost_end_date &&
                     new Date(car.boost_end_date) > new Date();
            });
            const nonBoostedCars = data.filter((car: any) => {
              return !car.is_boosted || !car.boost_priority || !car.boost_end_date ||
                     new Date(car.boost_end_date) <= new Date();
            });

            // Sort boosted cars by priority (highest first), then randomize within same priority
            boostedCars.sort((a: any, b: any) => {
              if (b.boost_priority !== a.boost_priority) {
                return b.boost_priority - a.boost_priority;
              }
              return Math.random() - 0.5;
            });

            // Randomize non-boosted cars
            for (let i = nonBoostedCars.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [nonBoostedCars[i], nonBoostedCars[j]] = [nonBoostedCars[j], nonBoostedCars[i]];
            }

            // Combine: boosted first, then non-boosted
            data.splice(0, data.length, ...boostedCars, ...nonBoostedCars);
          }
        }

        // Map seller info - handle both dealerships and users
        const newCars: Car[] =
          data?.map((item: any) => {
            const isDealer = !!item.dealership_id;
            return {
              ...item,
              seller_type: isDealer ? 'dealer' : 'user',
              seller_name: isDealer ? item.dealerships?.name : item.users?.name,
              dealership_name: item.dealerships?.name || null,
              dealership_logo: item.dealerships?.logo || null,
              dealership_phone: item.dealerships?.phone || null,
              dealership_location: item.dealerships?.location || null,
              dealership_latitude: item.dealerships?.latitude || null,
              dealership_longitude: item.dealerships?.longitude || null,
            };
          }) || [];

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
          const newCars = safePageNumber === 1 
            ? uniqueCars 
            : (() => {
                const allCarsMap = new Map();
                prevCars.forEach(car => allCarsMap.set(car.id, car));
                uniqueCars.forEach(car => allCarsMap.set(car.id, car));
                return Array.from(allCarsMap.values());
              })();
          
          // Prefetch images for newly loaded cars (non-blocking)
          if (newCars.length > 0 && safePageNumber === 1) {
            setTimeout(() => {
              prefetchCarImages(newCars.slice(0, 10), {
                startIndex: 0,
                count: 10,
                priority: 'normal',
              }).catch(() => {}); // Silently fail prefetch
            }, 500);
          }
          
          return newCars;
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
    [filters, sortOption, searchQuery, hasFetched, carViewMode, vehicleCategory]
  );

  const fetchPlates = useCallback(
    async (
      page: number = 1,
      currentPlateFilters: { priceRange?: [number, number]; sortBy?: string } = plateFilters,
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
          .from("number_plates")
          .select(
            `
            *,
            users!number_plates_user_fk (name, id),
            dealerships (name, logo, phone, location, latitude, longitude)
            `,
            { count: "exact" }
          )
          .eq("status", "available");

        // Search query for plates
        if (query) {
          const cleanQuery = query.trim().toLowerCase();
          queryBuilder = queryBuilder.or(
            `letter.ilike.%${cleanQuery}%,digits.ilike.%${cleanQuery}%`
          );
        }

        // Price Range (from plate filters)
        if (currentPlateFilters.priceRange) {
          queryBuilder = queryBuilder
            .gte("price", currentPlateFilters.priceRange[0])
            .lte("price", currentPlateFilters.priceRange[1]);
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
          }
        }

        // Get count first for pagination
        const { count } = await queryBuilder;
        if (!count) {
          setPlates([]);
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

        // Map seller info
        const newPlates: NumberPlate[] =
          data?.map((item: any) => {
            const isDealer = !!item.dealership_id;
            return {
              ...item,
              seller_type: isDealer ? 'dealer' : 'user',
              seller_name: isDealer ? item.dealerships?.name : item.users?.name,
              seller_phone: isDealer ? item.dealerships?.phone : null,
              dealership_logo: isDealer ? item.dealerships?.logo : null,
              dealership_location: isDealer ? item.dealerships?.location : null,
            };
          }) || [];

        // Deduplication
        const plateMap = new Map();
        newPlates.forEach(plate => {
          if (!plateMap.has(plate.id)) {
            plateMap.set(plate.id, plate);
          }
        });
        const uniquePlates = Array.from(plateMap.values());

        // Update plates state
        setPlates((prevPlates) => {
          if (safePageNumber === 1) {
            return uniquePlates;
          } else {
            const allPlatesMap = new Map();
            prevPlates.forEach(plate => allPlatesMap.set(plate.id, plate));
            uniquePlates.forEach(plate => allPlatesMap.set(plate.id, plate));
            return Array.from(allPlatesMap.values());
          }
        });
        
        setTotalPages(totalPages);
        setCurrentPage(safePageNumber);
      } catch (error) {
        console.error("Error fetching plates:", error);
        setPlates([]);
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
    [plateFilters, sortOption, searchQuery, hasFetched]
  );

  const onRefresh = useCallback(() => {
    if (vehicleCategory !== 'plates') {
      fetchCars(1, filters, sortOption, searchQuery, carViewMode, true, vehicleCategory); // forceRefresh=true to bypass cache
    } else {
      fetchPlates(1, plateFilters, sortOption, searchQuery);
    }
  }, [filters, plateFilters, sortOption, searchQuery, fetchCars, fetchPlates, vehicleCategory, carViewMode]);

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
        {carViewMode === 'rent' ? (
          <RentalCarCard
            car={item}
            index={index}
            onFavoritePress={() => handleFavoritePress(item.id)}
            isFavorite={isFavorite(Number(item.id))}
            isDealer={false}
          />
        ) : (
          <CarCard
            car={item}
            index={index}
            onFavoritePress={() => handleFavoritePress(item.id)}
            isFavorite={isFavorite(Number(item.id))}
            isDealer={false}
          />
        )}
        {/* Show random ad banner after every 10 cars */}
        {(index + 1) % 10 === 0 && <AdBanner key={`ad-${index}`} />}
      </>
    ),
    [handleFavoritePress, isFavorite, carViewMode]
  );

  const renderPlateItem = useCallback(
    ({ item, index }: { item: NumberPlate; index: number }) => (
      <>
        <NumberPlateCard
          plate={item}
          index={index}
          onPress={() => {
            // Handle plate details navigation if needed
            console.log('Plate pressed:', item.id);
          }}
        />
        {/* Show random ad banner after every 10 plates */}
        {(index + 1) % 10 === 0 && <AdBanner key={`ad-${index}`} />}
      </>
    ),
    []
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
      if (vehicleCategory !== 'plates') {
        fetchCars(1, filters, sortOption, query, carViewMode, false, vehicleCategory);
      } else {
        fetchPlates(1, plateFilters, sortOption, query);
      }
    },
    [filters, plateFilters, sortOption, fetchCars, fetchPlates, vehicleCategory, carViewMode]
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
        fetchCars(1, newFilters, sortOption, searchQuery, carViewMode, false, vehicleCategory);
        return newFilters;
      });
    },
    [sortOption, searchQuery, fetchCars, carViewMode, vehicleCategory]
  );

  const handleResetFilters = useCallback(() => {
    if (vehicleCategory !== 'plates') {
      setFilters({});
      setSearchQuery("");
      setSortOption(null);
      fetchCars(1, {}, null, "", carViewMode, false, vehicleCategory);
    } else {
      setPlateFilters({});
      setSearchQuery("");
      setSortOption(null);
      fetchPlates(1, {}, null, "");
    }
  }, [fetchCars, fetchPlates, vehicleCategory, carViewMode]);

  // Get category icon based on selected category
  const getCategoryIcon = (category: VehicleCategory) => {
    switch (category) {
      case 'cars':
        return <Ionicons name="car" size={20} color={isDarkMode ? '#fff' : '#000'} />;
      case 'bikes':
        return <MaterialCommunityIcons name="motorbike" size={20} color={isDarkMode ? '#fff' : '#000'} />;
      case 'trucks':
        return <FontAwesome5 name="truck" size={16} color={isDarkMode ? '#fff' : '#000'} />;
      case 'plates':
        return <MaterialCommunityIcons name="card-text-outline" size={20} color={isDarkMode ? '#fff' : '#000'} />;
    }
  };

  // Handle category change from modal
  const handleCategoryChange = useCallback((newCategory: VehicleCategory) => {
    if (newCategory !== vehicleCategory) {
      setVehicleCategory(newCategory);
      setCurrentPage(1);
      setSearchQuery('');
      setFilters({});
      setPlateFilters({});
      
      if (newCategory === 'plates') {
        fetchPlates(1, {}, null, '');
      } else {
        // Reset to 'sale' mode when switching vehicle categories
        setCarViewMode('sale');
        fetchCars(1, {}, null, '', 'sale', false, newCategory);
      }
    }
  }, [vehicleCategory, fetchCars, fetchPlates]);

  // Header section with category dropdown and profile icon
  const renderHeaderSection = useMemo(
    () => {
      const isRTL = language === 'ar';
      
      return (
        <View style={[styles.headerSection, isDarkMode && styles.darkHeaderSection]}>
          <View style={[styles.headerRow, isRTL && styles.headerRowRTL]}>
            {/* Category Dropdown Button */}
            <TouchableOpacity
              style={[styles.categoryDropdownButton, isDarkMode && styles.categoryDropdownButtonDark]}
              onPress={() => setIsCategoryModalVisible(true)}
              activeOpacity={0.7}
            >
              {getCategoryIcon(vehicleCategory)}
              <Text style={[styles.categoryDropdownText, isDarkMode && styles.categoryDropdownTextDark]}>
                {i18n.t(`home.categories.${vehicleCategory}`)}
              </Text>
              <Ionicons 
                name="chevron-down" 
                size={16} 
                color={isDarkMode ? '#fff' : '#000'} 
                style={{ marginLeft: 4 }}
              />
            </TouchableOpacity>

            {/* Profile Icon */}
            <TouchableOpacity
              style={[styles.profileButton, isDarkMode && styles.profileButtonDark]}
              onPress={() => router.push('/(home)/(user)/(tabs)/profile')}
              activeOpacity={0.7}
            >
              <Ionicons 
                name="person" 
                size={22} 
                color={isDarkMode ? '#000' : '#fff'} 
              />
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [vehicleCategory, isDarkMode, language, router]
  );

  // Buy/Rent tabs section - only shown for vehicles (not plates)
  const renderTabsSection = useMemo(
    () => {
      // Don't render tabs for plates
      if (vehicleCategory === 'plates') {
        return null;
      }

      const selectedIndex = carViewMode === 'sale' ? 0 : 1;

      return (
        <View style={[styles.tabsSection, isDarkMode && styles.darkTabsSection]}>
          <View style={styles.unifiedTabContainer}>
            <SegmentedControl
              values={[
                i18n.t('home.buy'),
                i18n.t('home.rent'),
              ]}
              selectedIndex={selectedIndex}
              onChange={(event) => {
                const index = event.nativeEvent.selectedSegmentIndex;
                const newMode = index === 0 ? 'sale' : 'rent';
                if (carViewMode !== newMode) {
                  setCarViewMode(newMode);
                  setCurrentPage(1);
                  setSearchQuery('');
                  setFilters({});
                  fetchCars(1, {}, sortOption, '', newMode, false, vehicleCategory);
                }
              }}
              style={styles.unifiedSegmentedControl}
              appearance={isDarkMode ? 'dark' : 'light'}
              fontStyle={{
                fontSize: 14,
                fontWeight: '600',
                color: isDarkMode ? '#FFFFFF' : '#000000'
              }}
              activeFontStyle={{
                fontSize: 14,
                fontWeight: '700',
                color: '#FFFFFF'
              }}
              tintColor="#D55004"
              backgroundColor={isDarkMode ? '#1a1a1a' : '#f0f0f0'}
            />
          </View>
        </View>
      );
    },
    [vehicleCategory, carViewMode, isDarkMode, sortOption, fetchCars]
  );

  // Render sticky search bar
  const renderStickySearchBar = useMemo(
    () => (
      <View style={[styles.stickySearchContainer, isDarkMode && styles.darkSearchContainer]}>
        {vehicleCategory !== 'plates' ? (
          // Car Search Bar
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
                    fetchCars(1, filters, sortOption, "", carViewMode, false, vehicleCategory);
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
                fetchCars(1, filters, value, searchQuery, carViewMode, false, vehicleCategory);
              }}
              initialValue={sortOption}
            />
          </View>
        ) : (
          // Plate Search Bar
          <View style={[
            styles.searchInputContainer,
            language === 'ar' && styles.rtlContainer
          ]}>
            <View
              style={[
                styles.searchBar,
                isDarkMode && styles.darkSearchBar,
                language === 'ar' && styles.rtlSearchBar
              ]}
            >
              <FontAwesome
                name="search"
                size={20}
                color={isDarkMode ? "#FFFFFF" : "#000000"}
                style={language === 'ar' ? { marginRight: 12 } : { marginLeft: 12 }}
              />
              <TextInput
                style={[
                  styles.searchPlaceholder,
                  styles.plateSearchInput,
                  isDarkMode && { color: "#FFFFFF" },
                  language === 'ar' && styles.rtlText
                ]}
                placeholder="Search plates by letter or number..."
                placeholderTextColor={isDarkMode ? "#666" : "#999"}
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                }}
                onSubmitEditing={() => {
                  fetchPlates(1, plateFilters, sortOption, searchQuery);
                }}
                returnKeyType="search"
                autoCapitalize="characters"
                autoCorrect={false}
              />
              {searchQuery ? (
                <TouchableOpacity
                  onPress={() => {
                    setSearchQuery("");
                    fetchPlates(1, plateFilters, sortOption, "");
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
                    setIsPlateFilterVisible(true);
                  }}
                >
                  <FontAwesome
                    name="sliders"
                    size={20}
                    color={isDarkMode ? "#000000" : "#ffffff"}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>
    ),
    [vehicleCategory, searchQuery, isDarkMode, language, filters, sortOption, carViewMode, plateFilters, fetchCars, fetchPlates, openFilterPage, router]
  );

  const renderRestOfHeader = useMemo(
    () => (
      <>
        {vehicleCategory !== 'plates' && (
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
        )}
        {vehicleCategory === 'plates' && <Banner />}
      </>
    ),
    [componentsLoaded, isInitialLoading, filters.categories, handleCategoryPress, vehicleCategory]
  );

  const renderListEmpty = useCallback(
    () =>
      !isInitialLoading &&
      ((vehicleCategory !== 'plates' && cars.length === 0) || (vehicleCategory === 'plates' && plates.length === 0)) && (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, isDarkMode && styles.darkEmptyText]}>
            {vehicleCategory !== 'plates' 
              ? (filters.categories && filters.categories.length > 0
                  ? `No ${vehicleCategory} available for the selected ${
                      filters.categories.length === 1 ? "category" : "categories"
                    }:\n${filters.categories.join(", ")}`
                  : `No ${vehicleCategory} available.`)
              : "No number plates available."}
          </Text>
          {((vehicleCategory !== 'plates' && Object.keys(filters).length > 0) || 
            (vehicleCategory === 'plates' && Object.keys(plateFilters).length > 0) || 
            searchQuery) && (
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
      plateFilters,
      searchQuery,
      isDarkMode,
      isInitialLoading,
      handleResetFilters,
      cars,
      plates,
      vehicleCategory,
    ]
  );

  // Simplified skeleton rendering - only show when actually loading
  const renderSkeletonItem = useCallback(() => <SkeletonCarCard />, []);

  const handleApplyPlateFilters = useCallback(
    (newPlateFilters: { priceRange?: [number, number]; sortBy?: string }) => {
      setPlateFilters(newPlateFilters);
      setCurrentPage(1);
      // If sortBy is in filters, use it as the sort option
      const sortToUse = newPlateFilters.sortBy || plateSortOption;
      setPlateSortOption(sortToUse);
      fetchPlates(1, newPlateFilters, sortToUse, searchQuery);
    },
    [plateSortOption, searchQuery, fetchPlates]
  );

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
            data={
              [
                { id: 'header', type: 'header' },
                { id: 'tabs', type: 'tabs' },
                { id: 'search', type: 'search' },
                { id: 'rest-header', type: 'rest-header' },
                ...(isInitialLoading && ((vehicleCategory !== 'plates' && cars.length === 0) || (vehicleCategory === 'plates' && plates.length === 0))
                  ? Array(3).fill({}).map((_, i) => ({ id: `skeleton-${i}`, type: 'skeleton' }))
                  : (vehicleCategory !== 'plates' ? cars : plates).map((item: any) => ({ id: item.id, type: 'data', data: item })))
              ]
            }
            renderItem={({ item, index }: any) => {
              if (item.type === 'header') return renderHeaderSection;
              if (item.type === 'tabs') return renderTabsSection;
              if (item.type === 'search') return renderStickySearchBar;
              if (item.type === 'rest-header') return renderRestOfHeader;
              if (item.type === 'skeleton') return renderSkeletonItem();

              const dataIndex = index - 4; // Subtract header items (now 4 instead of 3)
              if (vehicleCategory !== 'plates') {
                return renderCarItem({ item: item.data, index: dataIndex });
              } else {
                return renderPlateItem({ item: item.data, index: dataIndex });
              }
            }}
            keyExtractor={(item: any) => item.id.toString()}
            stickyHeaderIndices={[2]} // Search bar is now at index 2 (after header and tabs)
            onEndReached={() => {
              if (currentPage < totalPages && !loadingMore && !isInitialLoading) {
                console.log(`\n[Pagination] 📄 Loading page ${currentPage + 1} of ${totalPages} (currently have ${cars.length} items in state)`);
                if (vehicleCategory !== 'plates') {
                  fetchCars(currentPage + 1, filters, sortOption, searchQuery, carViewMode, false, vehicleCategory);
                } else {
                  fetchPlates(currentPage + 1, plateFilters, sortOption, searchQuery);
                }
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
            // Aggressive lazy loading for minimal egress and memory usage
            removeClippedSubviews={true}
            maxToRenderPerBatch={5}
            updateCellsBatchingPeriod={50}
            initialNumToRender={5}
            windowSize={5} // Reduced from 10 to save memory
            getItemLayout={undefined} // Let FlatList handle this automatically
          />
        </SafeAreaView>
      </LinearGradient>

      {/* Category Selector Modal */}
      <CategorySelectorModal
        visible={isCategoryModalVisible}
        onClose={() => setIsCategoryModalVisible(false)}
        selectedCategory={vehicleCategory}
        onSelectCategory={handleCategoryChange}
      />

      {/* Plate Filter Modal */}
      <PlateFilterModal
        isVisible={isPlateFilterVisible}
        plateFilters={plateFilters}
        onApply={handleApplyPlateFilters}
        onClose={() => setIsPlateFilterVisible(false)}
      />
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
  // Header Section Styles
  headerSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: 'transparent',
  },
  darkHeaderSection: {
    backgroundColor: 'transparent',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerRowRTL: {
    flexDirection: 'row-reverse',
  },
  categoryDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  categoryDropdownButtonDark: {
    backgroundColor: '#1a1a1a',
    borderColor: '#333',
  },
  categoryDropdownText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginLeft: 8,
  },
  categoryDropdownTextDark: {
    color: '#fff',
  },
  profileButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileButtonDark: {
    backgroundColor: '#fff',
  },
  tabsSection: {
    backgroundColor: 'transparent',
  },
  darkTabsSection: {
    backgroundColor: 'transparent',
  },
  stickySearchContainer: {
    padding: 10,
    zIndex: 10,
    backgroundColor: 'transparent',
  },
  darkSearchContainer: {
    backgroundColor: 'transparent',
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
  plateSearchInput: {
    paddingVertical: 0,
    marginLeft: 12,
    fontSize: 16,
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
  // Unified Tab Styles - Clean, modern design
  unifiedTabContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  unifiedSegmentedControl: {
    width: '100%',
    height: 44,
  },
});