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
  Animated,
  RefreshControl,
  TextInput,
} from "react-native";
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
import { useAuth } from "@/utils/AuthContext";
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import GiveawayModal from '@/components/GiveawayModal';
import { useTranslation } from 'react-i18next';
import { prefetchNextPage, prefetchCarImages } from "@/utils/smartPrefetch";
import { LAZY_FLATLIST_PROPS } from "@/utils/lazyLoading";
import { cacheLogger } from "@/utils/cacheLogger";
import { cachedQuery, generateCacheKey } from "@/utils/supabaseCache";
import Reanimated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { FlashList } from "@shopify/flash-list";

// Reanimated-aware FlashList so the worklet onScroll handler runs on the UI
// thread. FlashList ships AnimatedFlashList wrapped with react-native's
// Animated, which isn't compatible with Reanimated's useAnimatedScrollHandler.
const AnimatedFlashList: any = Reanimated.createAnimatedComponent(FlashList);
const ITEMS_PER_PAGE = 20;
const PAGINATION_SKELETON_COUNT = 3;

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
  sellerType?: 'all' | 'dealership' | 'private';
}

export default function BrowseCarsPage() {
  const { isDarkMode } = useTheme();
  const { user, profile } = useAuth();
  const { toggleFavorite, favoritesSet } = useFavorites();
  const { language } = useLanguage();
  const { t } = useTranslation();

  const isDealer = (profile?.role ?? user?.user_metadata?.role) === 'dealer';
  const [cars, setCars] = useState<Car[]>([]);
  const [plates, setPlates] = useState<NumberPlate[]>([]);
  const [vehicleCategory, setVehicleCategory] = useState<VehicleCategory>('all');
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
  // Worklet-driven scroll position. Avoids bridge crossings per scroll event;
  // setShowScrollTopButton fires only when the >200px threshold is crossed.
  const scrollYShared = useSharedValue(0);
  const scrollShowingShared = useSharedValue(false);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollYShared.value = event.contentOffset.y;
      const shouldShow = event.contentOffset.y > 200;
      if (shouldShow !== scrollShowingShared.value) {
        scrollShowingShared.value = shouldShow;
        scheduleOnRN(setShowScrollTopButton, shouldShow);
      }
    },
  });
  const flatListRef = useRef<FlatList<Car>>(null);
  const fetchRequestIdRef = useRef(0);
  const fetchCarsRef = useRef<typeof fetchCars | null>(null);
  useScrollToTop(flatListRef);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);
  const [isPlateFilterVisible, setIsPlateFilterVisible] = useState(false);
  
  // Simplified loading states - removed progressive loading that was causing issues
  const [componentsLoaded, setComponentsLoaded] = useState(false);
  const [hasResultsInOtherCategories, setHasResultsInOtherCategories] = useState(false);

  // Giveaway
  const [showGiveawayBanner, setShowGiveawayBanner] = useState(false);
  const [showGiveawayModal, setShowGiveawayModal] = useState(false);

  // Check if the user should see the giveaway banner
  useEffect(() => {
    if (!user?.id || profile?.role === 'dealer') return;
    const checkGiveaway = async () => {
      try {
        const dismissed = await AsyncStorage.getItem('giveaway_banner_dismissed');
        if (dismissed === 'true') return;
        const { data } = await supabase
          .from('giveaway_entries')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (!data) setShowGiveawayBanner(true);
      } catch {
        // silently fail — non-critical
      }
    };
    checkGiveaway();
  }, [user?.id, profile?.role]);

  const handleGiveawayDismiss = useCallback(async () => {
    setShowGiveawayBanner(false);
    setShowGiveawayModal(false);
    await AsyncStorage.setItem('giveaway_banner_dismissed', 'true');
  }, []);

  const handleGiveawaySuccess = useCallback(() => {
    setShowGiveawayBanner(false);
    setShowGiveawayModal(false);
  }, []);

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
    vehicleCategory?: string;
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

      // Restore vehicleCategory if passed back from search screen
      const paramCategory = params.vehicleCategory as VehicleCategory | undefined;
      if (paramCategory) {
        setVehicleCategory(paramCategory);
      }
      // Use the category from params if available, otherwise keep current state
      const effectiveCategory = paramCategory || vehicleCategory;

      if (Object.keys(initialFilters).length > 0) {
        setFilters(initialFilters);
      }
      if (initialQuery !== searchQuery) {
        setSearchQuery(initialQuery);
      }

      if (shouldFetch || !isInitialLoadDone) {
        if (effectiveCategory !== 'plates') {
          await fetchCars(1, initialFilters, sortOption, initialQuery, carViewMode, false, effectiveCategory);
        } else {
          await fetchPlates(1, plateFilters, sortOption, initialQuery);
        }
        setIsInitialLoadDone(true);

        // PERF: Cold-start TTI measurement (Phase 0 scaffold).
        // Fires once when the home feed has data ready to render.
        const appStart = (globalThis as any).__APP_START_TS__;
        if (appStart && !(globalThis as any).__TTI_REPORTED__) {
          (globalThis as any).__TTI_REPORTED__ = true;
          const ttiMs = Date.now() - appStart;
          if (__DEV__) {
            console.timeEnd('cold-start');
          }
          try {
            Sentry.setMeasurement('tti.feed_ready', ttiMs, 'millisecond');
            Sentry.addBreadcrumb({
              category: 'perf',
              message: `TTI feed_ready ${ttiMs}ms`,
              level: 'info',
            });
          } catch {}
        }
      }
    };

    initializePage();
  // Only re-run when navigation params change, not on local state changes
  // (vehicleCategory/carViewMode changes are handled by their own handlers)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.searchQuery, params.filters, params.timestamp, params.vehicleCategory]);

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
      const requestId = ++fetchRequestIdRef.current;

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
          : `*, dealerships (name,logo,phone,location,latitude,longitude), users!cars_user_id_fkey (name, id, phone_number)`;
        
        let queryBuilder = supabase
          .from(tableName)
          .select(selectString, { count: "exact" })
          .eq("status", "available");

        // Vehicle category filter (all = no filter, bikes = Motorcycle, trucks = Truck, cars = exclude Motorcycle/Truck)
        // Always apply category filter, even during search — users stay in the category they selected
        if (currentVehicleCategory === 'bikes') {
          queryBuilder = queryBuilder.eq("category", "Motorcycle");
        } else if (currentVehicleCategory === 'trucks') {
          queryBuilder = queryBuilder.eq("category", "Truck");
        } else if (currentVehicleCategory === 'cars') {
          // For cars, exclude motorcycles and trucks
          queryBuilder = queryBuilder.not("category", "in", "(Motorcycle,Truck)");
        }
        // 'all' applies no category filter — all vehicle types are shown

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

        // Seller Type filter (sale mode only — cars_rent has no user_id column,
        // every rental is a dealership listing). Stacks AND-style with FTS, so
        // it composes cleanly with the search query above.
        if (currentCarViewMode === 'sale' && currentFilters.sellerType && currentFilters.sellerType !== 'all') {
          if (currentFilters.sellerType === 'dealership') {
            queryBuilder = queryBuilder.not('dealership_id', 'is', null);
          } else if (currentFilters.sellerType === 'private') {
            queryBuilder = queryBuilder
              .is('dealership_id', null)
              .not('user_id', 'is', null);
          }
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

        // ============================================================
        // FULL-TEXT SEARCH: Uses Postgres tsvector with weighted tokens
        // Make (A) > Model (B) > Category (C) > Description (D)
        // Falls back to ilike for edge cases (partial words, numbers)
        // ============================================================
        if (query) {
          const cleanQuery = query.trim().toLowerCase();
          
          // Try full-text search first
          const ftsCountQuery = supabase
            .from(tableName)
            .select('id', { count: 'exact', head: true })
            .eq("status", "available")
            .textSearch('search_vector', cleanQuery, {
              type: 'websearch',
              config: 'english'
            });
          
          const { count: ftsCount } = await ftsCountQuery;

          if (ftsCount && ftsCount > 0) {
            // FTS found matches - use it with relevance ranking
            queryBuilder = queryBuilder
              .textSearch('search_vector', cleanQuery, {
                type: 'websearch',
                config: 'english'
              });
            console.log(`[Search] ✅ FTS: ${ftsCount} results for "${query}"`);
          } else {
            // Fallback to ilike for edge cases (partial words, typos, numbers)
            const queryTerms = cleanQuery.split(/\s+/).filter(t => t.length >= 2);
            const fallbackConditions = [];
            
            queryTerms.forEach(term => {
              fallbackConditions.push(
                `make.ilike.%${term}%`,
                `model.ilike.%${term}%`,
                `category.ilike.%${term}%`
              );
            });
            
            // Year detection
            queryTerms.forEach(term => {
              if (!isNaN(Number(term)) && term.length === 4) {
                fallbackConditions.push(`year::text.ilike.%${term}%`);
              }
            });

            queryBuilder = queryBuilder.or([...new Set(fallbackConditions)].join(","));
            console.log(`[Search] ⚠️ FTS fallback (ilike): 0 FTS results for "${query}"`);
          }
        }

        // Sorting
        if (currentSortOption) {
          switch (currentSortOption) {
            case "date_listed_desc":
              queryBuilder = queryBuilder.order("listed_at", { ascending: false });
              break;
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
        if (requestId !== fetchRequestIdRef.current) return;
        if (!count) {
          setCars([]);
          setTotalPages(0);
          setCurrentPage(1);
          // If searching in a specific category (not 'all'), check if results exist elsewhere
          if (query && currentVehicleCategory !== 'all') {
            try {
              const cleanQuery = query.trim().toLowerCase();
              const { count: otherCount } = await supabase
                .from(tableName)
                .select('id', { count: 'exact', head: true })
                .eq('status', 'available')
                .or(`make.ilike.%${cleanQuery}%,model.ilike.%${cleanQuery}%,category.ilike.%${cleanQuery}%`);
              setHasResultsInOtherCategories((otherCount ?? 0) > 0);
            } catch {
              setHasResultsInOtherCategories(false);
            }
          } else {
            setHasResultsInOtherCategories(false);
          }
          return;
        }
        setHasResultsInOtherCategories(false);

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
            vehicleCategory: currentVehicleCategory,
            carViewMode: currentCarViewMode,
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

        if (requestId !== fetchRequestIdRef.current) return;

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

        // Apply relevance-based sorting for search results (first page only to avoid jank while paginating)
        if (!currentSortOption && data && safePageNumber === 1) {
          if (query) {
            // Relevance scoring: exact make+model matches first, then make-only, then other
            const cleanQueryLocal = query.trim().toLowerCase();
            const terms = cleanQueryLocal.split(/\s+/).filter(Boolean);
            const scoreEntry = (entry: any) => {
              const make = (entry.make || "").toString().toLowerCase();
              const model = (entry.model || "").toString().toLowerCase();
              const concat = `${make} ${model}`.trim();
              let score = 0;

              // TIER 1: Boost priority (active boosts always on top)
              if (entry.is_boosted && entry.boost_priority && entry.boost_end_date) {
                const now = new Date();
                const boostEnd = new Date(entry.boost_end_date);
                if (boostEnd > now) {
                  score += entry.boost_priority * 10000;
                }
              }

              // TIER 2: Exact make+model combination (highest relevance)
              if (terms.length >= 2) {
                // Check if ALL terms match across make+model
                const allTermsMatch = terms.every(t => 
                  make.includes(t) || model.includes(t)
                );
                if (allTermsMatch) {
                  // Both make and model are matched by different terms
                  const makeTerms = terms.filter(t => make.includes(t));
                  const modelTerms = terms.filter(t => model.includes(t));
                  if (makeTerms.length > 0 && modelTerms.length > 0) {
                    score += 5000; // Exact make+model combo
                  } else {
                    score += 3000; // All terms match but in same field
                  }
                }
              }

              // TIER 3: Full query phrase match in make+model
              if (concat.includes(cleanQueryLocal)) score += 2000;
              if (make === cleanQueryLocal || model === cleanQueryLocal) score += 1500;

              // TIER 4: Partial matches in make/model
              if (model.includes(cleanQueryLocal)) score += 800;
              if (make.includes(cleanQueryLocal)) score += 700;

              // Individual term matches
              terms.forEach(t => {
                if (make.includes(t)) score += 200;
                if (model.includes(t)) score += 250;
              });

              // TIER 5: Description/other field matches (lowest priority)
              const description = (entry.description || "").toString().toLowerCase();
              if (description.includes(cleanQueryLocal)) score += 50;
              terms.forEach(t => {
                if (description.includes(t)) score += 20;
              });

              // Small random factor to break ties
              score += Math.random() * 5;

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

  // Keep ref in sync so stable tab handlers always call the latest fetchCars
  fetchCarsRef.current = fetchCars;

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
    ({ item, index }: { item: Car; index: number }) => {
      const fav = favoritesSet.has(Number(item.id));
      return (
        <>
          {carViewMode === 'rent' ? (
            <RentalCarCard
              car={item}
              index={index}
              onFavoritePress={handleFavoritePress}
              isFavorite={fav}
              isDealer={false}
            />
          ) : (
            <CarCard
              car={item}
              index={index}
              onFavoritePress={handleFavoritePress}
              isFavorite={fav}
              isDealer={false}
            />
          )}
          {/* Show random ad banner after every 10 cars */}
          {(index + 1) % 10 === 0 && <AdBanner key={`ad-${index}`} />}
        </>
      );
    },
    [handleFavoritePress, favoritesSet, carViewMode]
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
      setHasResultsInOtherCategories(false);
      fetchCars(1, {}, null, "", carViewMode, false, vehicleCategory);
    } else {
      setPlateFilters({});
      setSearchQuery("");
      setSortOption(null);
      setHasResultsInOtherCategories(false);
      fetchPlates(1, {}, null, "");
    }
  }, [fetchCars, fetchPlates, vehicleCategory, carViewMode]);

  // Get category icon based on selected category
  const getCategoryIcon = (category: VehicleCategory) => {
    switch (category) {
      case 'all':
        return <Ionicons name="grid-outline" size={20} color={isDarkMode ? '#fff' : '#000'} />;
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
      setHasResultsInOtherCategories(false);
      
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

            {!isDealer && (
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
            )}
          </View>
        </View>
      );
    },
    [vehicleCategory, isDarkMode, language, router, isDealer]
  );

  // Stable tab switch handlers — use fetchCarsRef so renderTabsSection doesn't need fetchCars in deps
  const handleSwitchToSale = useCallback(() => {
    if (carViewMode !== 'sale') {
      setCarViewMode('sale');
      setCurrentPage(1);
      setSearchQuery('');
      setFilters({});
      setCars([]);
      fetchCarsRef.current?.(1, {}, sortOption, '', 'sale', false, vehicleCategory);
    }
  }, [carViewMode, sortOption, vehicleCategory]);

  const handleSwitchToRent = useCallback(() => {
    if (carViewMode !== 'rent') {
      setCarViewMode('rent');
      setCurrentPage(1);
      setSearchQuery('');
      setFilters({});
      setCars([]);
      fetchCarsRef.current?.(1, {}, sortOption, '', 'rent', false, vehicleCategory);
    }
  }, [carViewMode, sortOption, vehicleCategory]);

  // Buy/Rent tabs section - only shown for vehicles (not plates)
  const renderTabsSection = useMemo(
    () => {
      // Don't render tabs for plates
      if (vehicleCategory === 'plates') {
        return null;
      }

      return (
        <>
        <View style={[styles.tabsSection, isDarkMode && styles.darkTabsSection]}>
          <View style={styles.unifiedTabContainer}>
            <TouchableOpacity
              style={[
                styles.tabButton,
                carViewMode === 'sale' && styles.tabButtonSelected
              ]}
              onPress={handleSwitchToSale}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.tabButtonText,
                carViewMode === 'sale' && styles.tabButtonTextSelected,
                carViewMode === 'sale' && isDarkMode && styles.tabButtonTextSelectedDark,
                carViewMode !== 'sale' && isDarkMode && styles.tabButtonTextDark
              ]}>
                {i18n.t('home.buy')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tabButton,
                carViewMode === 'rent' && styles.tabButtonSelected
              ]}
              onPress={handleSwitchToRent}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.tabButtonText,
                carViewMode === 'rent' && styles.tabButtonTextSelected,
                carViewMode === 'rent' && isDarkMode && styles.tabButtonTextSelectedDark,
                carViewMode !== 'rent' && isDarkMode && styles.tabButtonTextDark
              ]}>
                {i18n.t('home.rent')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        {showGiveawayBanner && (
          <TouchableOpacity
            onPress={() => setShowGiveawayModal(true)}
            activeOpacity={0.85}
            style={{
              marginHorizontal: 16,
              marginTop: 10,
              marginBottom: 2,
              borderRadius: 16,
              backgroundColor: '#D55004',
              flexDirection: 'row',
              alignItems: 'center',
              padding: 14,
              shadowColor: '#D55004',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 8,
              elevation: 6,
            }}
          >
            <Ionicons name="gift" size={32} color="#fff" style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                {t('giveaway.banner_title')}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 }}>
                {t('giveaway.banner_subtitle')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleGiveawayDismiss}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        </>
      );
    },
    [vehicleCategory, carViewMode, isDarkMode, handleSwitchToSale, handleSwitchToRent, showGiveawayBanner, handleGiveawayDismiss, t]
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
                    vehicleCategory: vehicleCategory,
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
                fetchCars(1, filters, value, searchQuery, carViewMode, true, vehicleCategory);
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
                <ByBrands mode={carViewMode} vehicleCategory={vehicleCategory} />
              </View>
            )}
            {(vehicleCategory === 'cars' || vehicleCategory === 'all') && (
              !componentsLoaded || isInitialLoading ? (
                <SkeletonCategorySelector />
              ) : (
                <View>
                  <CategorySelector
                    selectedCategories={filters.categories || []}
                    onCategoryPress={handleCategoryPress}
                  />
                </View>
              )
            )}
            <Banner />
          </>
        )}
        {vehicleCategory === 'plates' && <Banner />}
      </>
    ),
    [componentsLoaded, isInitialLoading, filters.categories, handleCategoryPress, vehicleCategory, carViewMode]
  );

  const renderListEmpty = useCallback(
    () =>
      !isInitialLoading &&
      ((vehicleCategory !== 'plates' && cars.length === 0) || (vehicleCategory === 'plates' && plates.length === 0)) && (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, isDarkMode && styles.darkEmptyText]}>
            {vehicleCategory !== 'plates'
              ? (searchQuery && vehicleCategory !== 'all'
                  ? `No listings available in this category.`
                  : filters.categories && filters.categories.length > 0
                    ? `No vehicles available for the selected ${
                        filters.categories.length === 1 ? 'category' : 'categories'
                      }:\n${filters.categories.join(', ')}`
                    : vehicleCategory === 'all'
                      ? 'No vehicles available.'
                      : `No ${vehicleCategory} available.`)
              : 'No number plates available.'}
          </Text>
          {searchQuery && vehicleCategory !== 'all' && hasResultsInOtherCategories && (
            <TouchableOpacity
              onPress={() => {
                // Switch to 'all' while keeping the current search query
                setVehicleCategory('all');
                setCurrentPage(1);
                setFilters({});
                setCarViewMode('sale');
                fetchCarsRef.current?.(1, {}, sortOption, searchQuery, 'sale', false, 'all');
              }}
              style={[styles.resetButton, { backgroundColor: '#D55004' }]}
            >
              <Text style={[styles.resetButtonText, { color: '#fff' }]}>Check other categories</Text>
            </TouchableOpacity>
          )}
          {(!searchQuery || vehicleCategory === 'all') &&
            ((vehicleCategory !== 'plates' && Object.keys(filters).length > 0) || 
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
      hasResultsInOtherCategories,
      sortOption,
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

  // Memoize FlatList data array — search bar is rendered outside FlatList (no stickyHeaderIndices needed)
  const flatListData = useMemo(() => [
    ...(vehicleCategory !== 'plates' ? [{ id: 'tabs', type: 'tabs' }] : []),
    { id: 'rest-header', type: 'rest-header' },
    ...(isInitialLoading && ((vehicleCategory !== 'plates' && cars.length === 0) || (vehicleCategory === 'plates' && plates.length === 0))
      ? Array(3).fill({}).map((_, i) => ({ id: `skeleton-${i}`, type: 'skeleton' }))
      : (vehicleCategory !== 'plates' ? cars : plates).map((item: any) => ({ id: item.id, type: 'data', data: item }))),
    ...(loadingMore && !isInitialLoading
      ? Array(PAGINATION_SKELETON_COUNT)
          .fill(null)
          .map((_, i) => ({ id: `loading-skeleton-${i}`, type: 'skeleton' }))
      : [])
  ], [vehicleCategory, isInitialLoading, cars, plates, loadingMore]);

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
          {/* Category row + profile icon — stable above search bar */}
          {renderHeaderSection}
          {/* Search bar rendered outside FlatList — avoids stickyHeaderIndices Android jank */}
          {renderStickySearchBar}
          <AnimatedFlashList
            // FlashList v2 ignores legacy FlatList virtualization props; spread
            // is harmless. scrollEventThrottle / showsVerticalScrollIndicator
            // from LAZY_FLATLIST_PROPS are honored.
            {...(LAZY_FLATLIST_PROPS as any)}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={["#D55004"]}
                tintColor={isDarkMode ? "#FFFFFF" : "#000000"}
              />
            }
            ref={flatListRef as any}
            onScroll={scrollHandler}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
            data={flatListData}
            // Heterogeneous-item recycling: FlashList recycles each type
            // independently, so a 'data' cell never tries to mount over a
            // 'tabs' cell. Big win on this screen because the data structure
            // mixes tabs / header / skeleton / data / loading-skeleton.
            getItemType={(item: any) => item.type}
            renderItem={({ item, index }: any) => {
              if (item.type === 'tabs') return renderTabsSection;
              if (item.type === 'rest-header') return renderRestOfHeader;
              if (item.type === 'skeleton') return renderSkeletonItem();

              // Non-plates: [tabs, rest-header, ...data] = offset 2
              // Plates: [rest-header, ...data] = offset 1
              const dataIndex = index - (vehicleCategory !== 'plates' ? 2 : 1);
              if (vehicleCategory !== 'plates') {
                return renderCarItem({ item: item.data, index: dataIndex });
              } else {
                return renderPlateItem({ item: item.data, index: dataIndex });
              }
            }}
            keyExtractor={(item: any) => `${item.type}-${item.id}`}
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
            ListFooterComponent={<View style={{ paddingBottom: 50 }} />}
          />
        </SafeAreaView>
      </LinearGradient>

      {/* Category Selector Modal — mount only when visible to avoid idle render cost */}
      {isCategoryModalVisible && (
        <CategorySelectorModal
          visible={isCategoryModalVisible}
          onClose={() => setIsCategoryModalVisible(false)}
          selectedCategory={vehicleCategory}
          onSelectCategory={handleCategoryChange}
        />
      )}

      {/* Plate Filter Modal */}
      {isPlateFilterVisible && (
        <PlateFilterModal
          isVisible={isPlateFilterVisible}
          plateFilters={plateFilters}
          onApply={handleApplyPlateFilters}
          onClose={() => setIsPlateFilterVisible(false)}
        />
      )}

      {/* Giveaway Modal */}
      {showGiveawayModal && (
        <GiveawayModal
          isVisible={showGiveawayModal}
          onClose={handleGiveawayDismiss}
          onSuccess={handleGiveawaySuccess}
        />
      )}
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
    paddingTop: 8,
    paddingBottom: 4,
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
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 16,
    width: '100%',
    alignItems: 'center',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  tabButtonSelected: {
    borderBottomWidth: 2,
    borderBottomColor: '#D55004',
  },
  tabButtonText: {
    fontSize: 22,
    fontWeight: '500',
    color: 'black',
  },
  tabButtonTextDark: {
    color: '#666666',
  },
  tabButtonTextSelected: {
    fontWeight: '500',
    color: '#000000',
  },
  tabButtonTextSelectedDark: {
    color: '#FFFFFF',
  },
});