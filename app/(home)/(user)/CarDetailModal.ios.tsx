// app/(home)/(user)/CarDetailModal.ios.tsx
import React, {
  useCallback,
  useEffect,
  useState,
  useRef,
  memo,
  useMemo,
} from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Linking,
  Alert,
  Share,
  Platform,
  AppState,
  Modal,
  Pressable,
  InteractionManager,
  ActivityIndicator,
  Animated,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "@/utils/supabase";
import { debounce } from "@/utils/debounce";
import { useFavorites } from "@/utils/useFavorites";
import { useRouter } from "expo-router";
import { useTheme } from "@/utils/ThemeContext";
import { Image } from "expo-image";
import { useAuth } from "@/utils/AuthContext";
import { getLogoUrl } from "@/hooks/getLogoUrl";
import { shareCar } from "@/utils/centralizedSharing";
import ImageViewing from "react-native-image-viewing";
import { useTranslation } from 'react-i18next';
import { I18nManager } from 'react-native';
import { formatMileage } from '@/utils/formatMileage';
import {
  isRentalCar,
  formatCarPrice,
  getTechnicalDataFields,
  getCarWhatsAppMessage,
  getSimilarCarsTableName
} from '@/utils/carDisplayHelpers';
let MapView: any;
let MapViewMarker: any;

// Lazy load heavy components
const AutoclipModal = React.lazy(() => import("@/components/AutoclipModal"));
const EmptyMapComponent = (props: any) => <View {...props} />;
EmptyMapComponent.Marker = (props: any) => <View {...props} />;

const { width, height } = Dimensions.get("window");

// Feature definitions - moved outside component to prevent re-creation
const VEHICLE_FEATURES = {
  tech: [
    { id: "bluetooth", labelKey: "features.bluetooth", icon: "bluetooth" },
    { id: "navigation", labelKey: "features.navigation", icon: "map-marker" },
    { id: "backup_camera", labelKey: "features.backup_camera", icon: "camera" },
    { id: "apple_carplay", labelKey: "features.apple_carplay", icon: "apple" },
    { id: "android_auto", labelKey: "features.android_auto", icon: "android" },
    { id: "premium_audio", labelKey: "features.premium_audio", icon: "speaker" },
    { id: "remote_start", labelKey: "features.remote_start", icon: "remote" },
    { id: "keyless_entry", labelKey: "features.keyless_entry", icon: "key-wireless" },
    { id: "keyless_start", labelKey: "features.keyless_start", icon: "power" },
  ],
  safety: [
    {
      id: "lane_assist",
      labelKey: "features.lane_assist",
      icon: "road-variant",
    },
    { id: "blind_spot", labelKey: "features.blind_spot", icon: "eye-off" },
    { id: "parking_sensors", labelKey: "features.parking_sensors", icon: "parking" },
    { id: "backup_camera", labelKey: "features.backup_camera", icon: "camera" },
    { id: "cruise_control", labelKey: "features.cruise_control", icon: "speedometer" },
  ],
  comfort: [
    { id: "heated_seats", labelKey: "features.heated_seats", icon: "car-seat-heater" },
    { id: "leather_seats", labelKey: "features.leather_seats", icon: "car-seat" },
    { id: "third_row_seats", labelKey: "features.third_row_seats", icon: "seat-passenger" },
    { id: "sunroof", labelKey: "features.sunroof", icon: "weather-sunny" },
    { id: "power_mirrors", labelKey: "features.power_mirrors", icon: "car-side" },
    { id: "power_steering", labelKey: "features.power_steering", icon: "steering" },
    { id: "power_windows", labelKey: "features.power_windows", icon: "window-maximize" },
  ],
};

// Memoized image component with improved loading strategy
const OptimizedImage = memo(
  ({ source, style, onLoad, contentFit = "cover" }: any) => {
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);

    const handleLoad = useCallback(() => {
      setLoaded(true);
      onLoad?.();
    }, [onLoad]);

    const handleError = useCallback(() => {
      setError(true);
      console.log("Image failed to load:", source?.uri);
    }, [source?.uri]);

    // Use a lightweight blurhash
    const blurhash = "LBAdAqof00WV_3V@00og00j[";

    // Return empty view immediately if no valid source
    if (!source || !source.uri) {
      return <View style={style} />;
    }

    return (
      <View style={[style, { overflow: "hidden" }]}>
        <Image
          source={source}
          style={[
            style,
            {
              opacity: loaded ? 1 : 0.3,
            },
          ]}
          onLoad={handleLoad}
          onError={handleError}
          placeholder={blurhash}
          contentFit={contentFit}
          transition={150}
          cachePolicy="memory-disk"
          recyclingKey={`${source.uri}`}
          fadeDuration={300}
          priority={"high"}
          allowDownscaling={false}
          
        />
        {error && (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: "#f0f0f0",
              },
            ]}
          >
            <Ionicons name="image-outline" size={24} color="#999" />
          </View>
        )}
      </View>
    );
  }
);

const CarItemSkeleton = memo(({ isDarkMode }: any) => {
  const fadeAnim = useRef(new Animated.Value(0.5)).current;

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

  const bgColor = isDarkMode ? "#1c1c1c" : "#f0f0f0";
  const shimmerColor = isDarkMode ? "#333" : "#e0e0e0";

  return (
    <View
      style={{
        marginRight: 12,
        marginVertical: 8,
        width: 160,
        backgroundColor: bgColor,
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      {/* Image placeholder */}
      <Animated.View
        style={{
          width: "100%",
          height: 120,
          borderRadius: 8,
          backgroundColor: shimmerColor,
          opacity: fadeAnim,
        }}
      />

      <View style={{ padding: 8 }}>
        {/* Title placeholder */}
        <Animated.View
          style={{
            height: 14,
            width: "90%",
            borderRadius: 4,
            backgroundColor: shimmerColor,
            opacity: fadeAnim,
          }}
        />

        {/* Price placeholder */}
        <Animated.View
          style={{
            height: 13,
            width: "50%",
            borderRadius: 4,
            backgroundColor: shimmerColor,
            marginTop: 4,
            opacity: fadeAnim,
          }}
        />
      </View>
    </View>
  );
});

// Memoized simple components
const ActionButton = memo(({ icon, onPress, text, isDarkMode }: any) => (
  <TouchableOpacity
    onPress={onPress}
    style={{ alignItems: "center", marginHorizontal: 8 }}
    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
  >
    <Ionicons
      name={icon}
      size={27}
      color={isDarkMode ? "#FFFFFF" : "#000000"}
    />
  </TouchableOpacity>
));

const TechnicalDataItem = memo(
  ({ icon, label, value, isDarkMode, isLast }: any) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        marginHorizontal: 16,
        paddingVertical: 12,
        position: "relative",
      }}
    >
      <View style={{ width: 32 }}>
        <Ionicons
          name={icon}
          size={24}
          color={isDarkMode ? "#FFFFFF" : "#000000"}
        />
      </View>
      <Text
        style={{
          flex: 1,
          fontSize: 14,
          color: isDarkMode ? "white" : "black",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontWeight: "600",
          fontSize: 14,
          color: isDarkMode ? "white" : "black",
        }}
      >
        {value || "N/A"}
      </Text>

      {!isLast && (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 1,
            backgroundColor: "#c9c9c9",
          }}
        />
      )}
    </View>
  )
);

// Memoized feature category component
const FeatureCategory = memo(({ title, features, isDarkMode }: any) => {
  if (!features || features.length === 0) return null;
  const { t } = useTranslation();

  return (
    <View style={{ marginBottom: 24 }}>
      <View
        style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}
      >
        <View
          style={{
            height: 20,
            width: 4,
            backgroundColor: "#D55004",
            marginRight: 8,
            borderRadius: 2,
          }}
        />
        <Text
          style={{
            fontSize: 16,
            fontWeight: "600",
            color: isDarkMode ? "white" : "black",
          }}
        >
          {title}
        </Text>
      </View>

      <FlatList
        data={features}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, index) => `${title.toLowerCase()}-${index}`}
        initialNumToRender={3}
        maxToRenderPerBatch={5}
        windowSize={3}
        removeClippedSubviews={Platform.OS === "android"}
        renderItem={({ item: feature }) => (
          <View
            style={{
              flexDirection: "row",
              borderWidth: 0.5,
              borderColor: isDarkMode ? "#444" : "#ccc",
              alignItems: "center",
              marginRight: 12,
              marginBottom: 4,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: isDarkMode ? "#1c1c1c" : "#f5f5f5",
            }}
          >
            <MaterialCommunityIcons
              name={feature.icon || "check-circle-outline"}
              size={18}
              color="#D55004"
              style={{ marginRight: 8 }}
            />
            <Text
              style={{
                color: isDarkMode ? "white" : "black",
                fontWeight: "500",
              }}
            >
              {feature.labelKey ? t(feature.labelKey) : feature.label}
            </Text>
          </View>
        )}
      />
    </View>
  );
});

// Helper function for relative time
const getRelativeTime = (dateString: string, t: any) => {
  if (!dateString) return t('car.recently');

  try {
    const now = new Date();
    const postedDate = new Date(dateString);

    if (isNaN(postedDate.getTime())) return t('car.recently');

    const seconds = Math.floor((now.getTime() - postedDate.getTime()) / 1000);

    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) {
      return t('car.years_ago', { count: interval });
    }
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) {
      return t('car.months_ago', { count: interval });
    }
    interval = Math.floor(seconds / 604800);
    if (interval >= 1) {
      return t('car.weeks_ago', { count: interval });
    }
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) {
      return t('car.days_ago', { count: interval });
    }
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) {
      return t('car.hours_ago', { count: interval });
    }
    interval = Math.floor(seconds / 60);
    if (interval >= 1) {
      return t('car.minutes_ago', { count: interval });
    }
    return t('car.seconds_ago', { count: Math.floor(seconds) });
  } catch (error) {
    console.error("Error computing relative time:", error);
    return t('car.recently');
  }
};

// Main component with performance optimizations
const CarDetailScreen = ({ car, onFavoritePress, onViewUpdate, isRental = false }: any) => {
  if (!car) return null;

  const { isDarkMode } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { isFavorite } = useFavorites();
  const { t } = useTranslation();
  const isRTL = I18nManager.isRTL;
  const scrollViewRef = useRef<FlatList>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
    null
  );

  // Determine if this is a dealership car or user car
  const isDealershipCar = useMemo(() => !!car.dealership_id, [car.dealership_id]);

  // Get seller info - works for both dealership and user cars
  const sellerInfo = useMemo(() => ({
    name: isDealershipCar ? car.dealership_name : car.seller_name || car.users?.name || t('common.private_seller'),
    logo: isDealershipCar ? car.dealership_logo : null,
    phone: isDealershipCar ? car.dealership_phone : car.seller_phone || car.phone,
    location: isDealershipCar ? car.dealership_location : car.location || null,
    id: isDealershipCar ? car.dealership_id : car.user_id,
  }), [car, isDealershipCar, t]);

  // Split state into critical and non-critical groups
  const [criticalState, setCriticalState] = useState({
    autoclips: [],
    selectedClip: null,
    showClipModal: false,
  });

  const [nonCriticalState, setNonCriticalState] = useState({
    similarCars: [],
    dealerCars: [],
    isMapVisible: false,
  });

  // Track which sections have loaded
  const [loadingStatus, setLoadingStatus] = useState({
    imagesLoaded: false,
    autoclipsLoaded: false,
    similarCarsLoaded: false,
    dealerCarsLoaded: false,
  });

  // App state tracking for background optimization
  const appStateRef = useRef(AppState.currentState);
  const [isActive, setIsActive] = useState(true);

  // Performance tracking
  const performanceRef = useRef({
    startTime: Date.now(),
    firstImageLoaded: 0,
    criticalContentLoaded: 0,
  });

  // Track app state changes to optimize resource usage
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      const currentState = appStateRef.current;
      appStateRef.current = nextAppState;

      if (
        currentState.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        // App came to foreground
        setIsActive(true);
      } else if (nextAppState.match(/inactive|background/)) {
        // App went to background
        setIsActive(false);

        // Clear memory-intensive data
        setNonCriticalState((prev) => ({
          ...prev,
          similarCars: [],
          dealerCars: [],
          isMapVisible: false,
        }));

        // Release image cache if app goes to background
        if (Platform.OS === "ios") {
          try {
            Image.clearMemoryCache();
          } catch (e) {
            console.error("Failed to clear image cache:", e);
          }
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Adds performance tracking to initial load
  useEffect(() => {
    const trackPerformance = () => {
      const { startTime, firstImageLoaded, criticalContentLoaded } =
        performanceRef.current;
      const now = Date.now();

      if (__DEV__) {
        console.log(`[Performance] CarDetail:
          First mount: ${now - startTime}ms
          First image: ${
            firstImageLoaded ? firstImageLoaded - startTime : "Not loaded"
          }ms
          Critical content: ${
            criticalContentLoaded
              ? criticalContentLoaded - startTime
              : "Not loaded"
          }ms
        `);
      }
    };

    // Schedule tracking to run after first render completes
    const timeout = setTimeout(trackPerformance, 3000);

    return () => clearTimeout(timeout);
  }, []);

  // Handle first image loaded
  const handleFirstImageLoaded = useCallback(() => {
    if (performanceRef.current.firstImageLoaded === 0) {
      performanceRef.current.firstImageLoaded = Date.now();

      setLoadingStatus((prev) => ({
        ...prev,
        imagesLoaded: true,
      }));
    }
  }, []);

  // Staggered data loading strategy - only load autoclips initially
  const fetchAutoclips = useCallback(async () => {
    if (!car || !car.id) return;

    try {
      const { data, error } = await supabase
        .from("auto_clips")
        .select("*")
        .eq("car_id", car.id)
        .eq("status", "published")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setCriticalState((prev) => ({
        ...prev,
        autoclips: data || [],
      }));

      setLoadingStatus((prev) => ({
        ...prev,
        autoclipsLoaded: true,
      }));
    } catch (error) {
      console.error("Error fetching autoclips:", error);
      setCriticalState((prev) => ({
        ...prev,
        autoclips: [],
      }));

      setLoadingStatus((prev) => ({
        ...prev,
        autoclipsLoaded: true,
      }));
    }
  }, [car?.id]);

  useEffect(() => {
    // Only load on iOS and when visible
    if (Platform.OS === "ios" && nonCriticalState.isMapVisible) {
      import("react-native-maps")
        .then((module) => {
          MapView = module.default;
          MapViewMarker = module.Marker;
          // Force re-render
          setNonCriticalState((prev) => ({ ...prev }));
        })
        .catch((error) => {
          console.error("Error loading maps:", error);
        });
    }
  }, [nonCriticalState.isMapVisible]);

  // Load critical data on mount
  useEffect(() => {
    if (car && car.id) {
      // Track critical content load
      if (performanceRef.current.criticalContentLoaded === 0) {
        performanceRef.current.criticalContentLoaded = Date.now();
      }

      // Fetch autoclips with slight delay to prioritize UI rendering
      InteractionManager.runAfterInteractions(() => {
        fetchAutoclips();
      });

      // Track view after a slight delay to prioritize UI
      const trackViewTimer = setTimeout(() => {
        if (user && car.id) {
          trackCarView(car.id, user.id);
        }
      }, 1000);

      return () => clearTimeout(trackViewTimer);
    }
  }, [car?.id, user?.id]);

  // Delayed loading of non-critical data (similar cars, dealer cars)
  useEffect(() => {
    if (!car || !car.id) return;

    // Only load these once critical content is loaded and app is active
    if (
      loadingStatus.imagesLoaded &&
      loadingStatus.autoclipsLoaded &&
      isActive
    ) {
      // Staggered loading of similar cars
      const similarCarsTimer = setTimeout(() => {
        fetchSimilarCars();
      }, 1500);

      // Staggered loading of dealer cars
      const dealerCarsTimer = setTimeout(() => {
        fetchDealerCars();
      }, 2500);

      // Show map with even more delay
      const mapTimer = setTimeout(() => {
        setNonCriticalState((prev) => ({
          ...prev,
          isMapVisible: true,
        }));
      }, 3000);

      return () => {
        clearTimeout(similarCarsTimer);
        clearTimeout(dealerCarsTimer);
        clearTimeout(mapTimer);
      };
    }
  }, [
    car?.id,
    loadingStatus.imagesLoaded,
    loadingStatus.autoclipsLoaded,
    isActive,
  ]);

  // Track view API call
  const trackCarView = useCallback(
    async (carId: any, userId: any) => {
      if (!carId || !userId) return;

      try {
        const { data, error } = await supabase.rpc("track_car_view", {
          car_id: carId,
          user_id: userId,
        });

        if (error) throw error;

        if (data && onViewUpdate) {
          onViewUpdate(carId, data);
        }
      } catch (error) {
        console.error("Error tracking car view:", error);
      }
    },
    [onViewUpdate]
  );

  // Handle clip like with debouncing
  const handleClipLike = useCallback(
    debounce(async (clipId: any) => {
      if (!user || !clipId) return;

      try {
        const { data: newLikesCount, error } = await supabase.rpc(
          "toggle_autoclip_like",
          {
            clip_id: clipId,
            user_id: user.id,
          }
        );

        if (error) throw error;

        setCriticalState((prev) => {
          const updatedAutoclips = prev.autoclips.map((clip: any) =>
            clip.id === clipId
              ? {
                  ...clip,
                  likes: newLikesCount,
                  liked_users: clip.liked_users?.includes(user.id)
                    ? clip.liked_users.filter((id: string) => id !== user.id)
                    : [...(clip.liked_users || []), user.id],
                }
              : clip
          );

          return {
            ...prev,
            autoclips: updatedAutoclips,
          };
        });
      } catch (error) {
        console.error("Error toggling autoclip like:", error);
      }
    }, 300),
    [user, supabase]
  );

  // Fetch similar cars with error handling and optimization
  const fetchSimilarCars = useCallback(async () => {
    if (!car || !car.id || !car.make) return;

    try {
      // Determine which table to query based on whether this is a rental car
      const tableName = isRental ? 'cars_rent' : 'cars';

      // First, try to find cars with same make, model, and year
      let { data: exactMatches, error: exactMatchError } = await supabase
        .from(tableName)
        .select(
          "id, make, model, year, price, images, dealership_id, dealerships:dealership_id (name, logo, phone, location, latitude, longitude)"
        )
        .eq("make", car.make)
        .eq("model", car.model)
        .eq("year", car.year)
        .neq("id", car.id)
        .eq("status", "available")
        .limit(5);

      if (exactMatchError) throw exactMatchError;

      if (exactMatches && exactMatches.length > 0) {
        const newCars = exactMatches.map((item) => ({
          id: item.id,
          make: item.make,
          model: item.model,
          year: item.year,
          price: item.price,
          images: item.images,
          dealership_id: item.dealership_id,
          dealership_name: item.dealerships?.name,
          dealership_logo: item.dealerships?.logo,
          dealership_phone: item.dealerships?.phone,
          dealership_location: item.dealerships?.location,
          dealership_latitude: item.dealerships?.latitude,
          dealership_longitude: item.dealerships?.longitude,
        }));

        setNonCriticalState((prev) => ({
          ...prev,
          similarCars: newCars,
        }));

        setLoadingStatus((prev) => ({
          ...prev,
          similarCarsLoaded: true,
        }));

        return;
      }

      // If no exact matches, fall back to similarly priced cars
      if (car.price) {
        const { data: priceMatches, error: priceMatchError } = await supabase
          .from(tableName)
          .select(
            "id, make, model, year, price, images, dealership_id, dealerships:dealership_id (name, logo, phone, location, latitude, longitude)"
          )
          .neq("id", car.id)
          .eq("status", "available")
          .gte("price", Math.floor(car.price * 0.8))
          .lte("price", Math.floor(car.price * 1.2))
          .limit(5);

        if (priceMatchError) throw priceMatchError;

        if (priceMatches && priceMatches.length > 0) {
          const newCars = priceMatches.map((item) => ({
            id: item.id,
            make: item.make,
            model: item.model,
            year: item.year,
            price: item.price,
            images:
              item.images && item.images.length > 0 ? [item.images[0]] : [], // Only load first image
            dealership_id: item.dealership_id,
            dealership_name: item.dealerships?.name,
            dealership_logo: item.dealerships?.logo,
          }));

          setNonCriticalState((prev) => ({
            ...prev,
            similarCars: newCars,
          }));
        }
      }

      setLoadingStatus((prev) => ({
        ...prev,
        similarCarsLoaded: true,
      }));
    } catch (error) {
      console.error("Error fetching similar cars:", error);
      setNonCriticalState((prev) => ({
        ...prev,
        similarCars: [],
      }));

      setLoadingStatus((prev) => ({
        ...prev,
        similarCarsLoaded: true,
      }));
    }
  }, [car?.id, car?.make, car?.model, car?.year, car?.price, isRental]);

  // Fetch dealer cars with error handling and optimization
  const fetchDealerCars = useCallback(async () => {
    // Only fetch dealer cars if this is a dealership listing
    if (!isDealershipCar || !car || !car.dealership_id || !car.id) return;

    try {
      // Determine which table to query based on whether this is a rental car
      const tableName = isRental ? 'cars_rent' : 'cars';

      const { data, error } = await supabase
        .from(tableName)
        .select(
          "id, make, model, year, price, images, dealership_id, dealerships:dealership_id (name, logo)"
        )
        .eq("dealership_id", car.dealership_id)
        .eq("status", "available")
        .neq("id", car.id)
        .limit(5);

      if (error) throw error;

      if (data) {
        const newCars = data.map((item) => ({
          id: item.id,
          make: item.make,
          model: item.model,
          year: item.year,
          price: item.price,
          images: item.images && item.images.length > 0 ? [item.images[0]] : [], // Only load first image
          dealership_id: item.dealership_id,
          dealership_name: item.dealerships?.name,
          dealership_logo: item.dealerships?.logo,
        }));

        setNonCriticalState((prev) => ({
          ...prev,
          dealerCars: newCars,
        }));
      }

      setLoadingStatus((prev) => ({
        ...prev,
        dealerCarsLoaded: true,
      }));
    } catch (error) {
      console.error("Error fetching dealer cars:", error);
      setNonCriticalState((prev) => ({
        ...prev,
        dealerCars: [],
      }));

      setLoadingStatus((prev) => ({
        ...prev,
        dealerCarsLoaded: true,
      }));
    }
  }, [isDealershipCar, car?.dealership_id, car?.id, isRental]);

  // Optimized navigation to dealership details
  const handleDealershipPress = useCallback(() => {
    // Only allow navigation to dealership details for dealership cars
    if (!isDealershipCar || !car.dealership_id) {
      return; // Silently return for user listings
    }

    InteractionManager.runAfterInteractions(() => {
      router.push({
        pathname: "/(home)/(user)/DealershipDetails",
        params: { dealershipId: car.dealership_id },
      });
    });
  }, [isDealershipCar, router, car?.dealership_id]);

  // Tracking functions for analytics - all debounced
  const trackCallClick = useCallback(
    debounce(async (carId: number) => {
      if (!user?.id || !carId) return;

      try {
        await supabase.rpc("track_car_call", {
          car_id: carId,
          user_id: user.id,
        });
      } catch (error) {
        console.error("Error tracking call click:", error);
      }
    }, 500),
    [user?.id]
  );
  // Inside handleBackPress in CarDetailModal.ios.tsx
  const handleBackPress = useCallback(() => {
    try {
      if (car.fromDeepLink === "true") {
        router.replace("/(home)/(user)");
      } else {
        router.back();

        // Safety timer - if we're still on the same screen after 100ms,
        // assume back navigation failed and redirect to home
        const timer = setTimeout(() => {
          router.replace("/(home)/(user)");
        }, 100);

        return () => clearTimeout(timer);
      }
    } catch (error) {
      // If any error occurs during navigation, safely redirect to home
      console.error("Navigation error:", error);
      router.replace("/(home)/(user)");
    }
  }, [car, router]);
  const trackWhatsAppClick = useCallback(
    debounce(async (carId: number) => {
      if (!user?.id || !carId) return;

      try {
        await supabase.rpc("track_car_whatsapp", {
          car_id: carId,
          user_id: user.id,
        });
      } catch (error) {
        console.error("Error tracking WhatsApp click:", error);
      }
    }, 500),
    [user?.id]
  );

  // Action handlers with error protection
  const handleCall = useCallback(() => {
    if (!sellerInfo.phone) {
      Alert.alert("Phone number not available");
      return;
    }

    // Track the call click first
    trackCallClick(car.id);

    // Then proceed with the call
    Linking.openURL(`tel:${sellerInfo.phone}`).catch((err) => {
      console.error("Error opening phone app:", err);
      Alert.alert("Error", "Could not open phone app");
    });
  }, [sellerInfo.phone, car?.id, trackCallClick]);

  const handleShare = useCallback(async () => {
    if (!car) return;

    try {
      await shareCar(car);
    } catch (error) {
      console.error("Share error:", error);
      Alert.alert("Error", "Failed to share car details");
    }
  }, [car]);

  const handleOpenInMaps = useCallback(() => {
    if (!car) return;

    // Get location based on seller type
    const latitude = isDealershipCar ? car.dealership_latitude : car.latitude;
    const longitude = isDealershipCar ? car.dealership_longitude : car.longitude;

    if (!latitude || !longitude) {
      Alert.alert(
        "Location unavailable",
        "No location available"
      );
      return;
    }

    if (Platform.OS === "ios") {
      Alert.alert("Open Maps", "Choose your preferred maps application", [
        {
          text: "Apple Maps",
          onPress: () => {
            const appleMapsUrl = `maps:0,0?q=${latitude},${longitude}`;
            Linking.openURL(appleMapsUrl).catch(() => {
              Alert.alert("Error", "Could not open Maps");
            });
          },
        },
        {
          text: "Google Maps",
          onPress: () => {
            const googleMapsUrl = `comgooglemaps://?q=${latitude},${longitude}&zoom=14`;
            Linking.openURL(googleMapsUrl).catch(() => {
              // If Google Maps app isn't installed, fallback to browser
              const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
              Linking.openURL(fallbackUrl).catch(() => {
                Alert.alert("Error", "Could not open Maps");
              });
            });
          },
        },
        { text: "Cancel", style: "cancel" },
      ]);
    } else {
      // Android: open Google Maps directly
      const googleMapsUrl = `geo:${latitude},${longitude}?q=${latitude},${longitude}`;
      Linking.openURL(googleMapsUrl).catch(() => {
        // Fallback to browser if necessary
        const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
        Linking.openURL(fallbackUrl).catch(() => {
          Alert.alert("Error", "Could not open Maps");
        });
      });
    }
  }, [isDealershipCar, car?.dealership_latitude, car?.dealership_longitude, car?.latitude, car?.longitude]);

  const handleOpenInGoogleMaps = useCallback(() => {
    if (!car) return;

    // Get location based on seller type
    const latValue = isDealershipCar ? car.dealership_latitude : car.latitude;
    const lngValue = isDealershipCar ? car.dealership_longitude : car.longitude;

    const latitude = latValue || 0;
    const longitude = lngValue || 0;

    if (!latitude || !longitude || (latitude === 0 && longitude === 0)) {
      Alert.alert(
        "Location unavailable",
        "No location available"
      );
      return;
    }

    const url = `https://www.google.com/maps?q=${latitude},${longitude}`;

    Linking.openURL(url).catch((err) => {
      console.error("Error opening Google Maps:", err);
      Alert.alert("Error", "Could not open Google Maps");
    });
  }, [isDealershipCar, car?.dealership_latitude, car?.dealership_longitude, car?.latitude, car?.longitude]);

  const handleWhatsAppPress = useCallback(() => {
    if (!sellerInfo.phone) {
      Alert.alert("Phone number not available");
      return;
    }

    // Track the WhatsApp click first
    trackWhatsAppClick(car.id);

    const cleanedPhoneNumber = sellerInfo.phone
      .toString()
      .replace(/\D/g, "");
    const message = getCarWhatsAppMessage(car);
    const webURL = `https://wa.me/961${cleanedPhoneNumber}?text=${encodeURIComponent(
      message
    )}`;

    Linking.openURL(webURL).catch(() => {
      Alert.alert(
        "Error",
        "Unable to open WhatsApp. Please make sure it is installed on your device."
      );
    });
  }, [sellerInfo.phone, car, trackWhatsAppClick]);

  // Memoized render functions
  const renderCarItem = useCallback(
    ({ item }: any) => {
      if (!item?.id || !item?.images?.[0]) return null;

      return (
        <TouchableOpacity
          style={{
            marginRight: 12,
            marginVertical: 8,
            width: 160,
            backgroundColor: isDarkMode ? "#1c1c1c" : "#f0f0f0",
            borderRadius: 8,
            overflow: "hidden",
          }}
          onPress={() => {
            InteractionManager.runAfterInteractions(() => {
              router.push({
                pathname: "/(home)/(user)/CarDetails",
                params: {
                  carId: item.id,
                  isRental: isRental ? 'true' : 'false'
                },
              });
            });
          }}
        >
          <OptimizedImage
            source={{ uri: item.images[0] }}
            style={{ width: "100%", height: 120, borderRadius: 8 }}
          />
          <View style={{ padding: 8 }}>
            <Text
              style={{
                color: isDarkMode ? "white" : "black",
                fontWeight: "bold",
                fontSize: 14,
              }}
              numberOfLines={1}
            >
              {item.year} {item.make} {item.model}
            </Text>
            {item.price && (
              <Text
                style={{
                  color: "#D55004",
                  fontWeight: "500",
                  fontSize: 13,
                  marginTop: 4,
                }}
              >
                ${item.price.toLocaleString()}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [isDarkMode, router, isRental]
  );

  // Memoized map region
  const mapRegion = useMemo(() => {
    const latitude = isDealershipCar ? car.dealership_latitude : car.latitude;
    const longitude = isDealershipCar ? car.dealership_longitude : car.longitude;

    return {
      latitude: parseFloat(latitude) || 37.7749,
      longitude: parseFloat(longitude) || -122.4194,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  }, [isDealershipCar, car.dealership_latitude, car.dealership_longitude, car.latitude, car.longitude]);

  // Extract features for categories
  const techFeatures = useMemo(
    () =>
      car.features
        ? car.features
            .filter((featureId: string) =>
              VEHICLE_FEATURES.tech.some((feature) => feature.id === featureId)
            )
            .map((featureId: string) =>
              VEHICLE_FEATURES.tech.find((f) => f.id === featureId)
            )
            .filter(Boolean)
        : [],
    [car.features]
  );

  const safetyFeatures = useMemo(
    () =>
      car.features
        ? car.features
            .filter((featureId: string) =>
              VEHICLE_FEATURES.safety.some(
                (feature) => feature.id === featureId
              )
            )
            .map((featureId: string) =>
              VEHICLE_FEATURES.safety.find((f) => f.id === featureId)
            )
            .filter(Boolean)
        : [],
    [car.features]
  );

  const comfortFeatures = useMemo(
    () =>
      car.features
        ? car.features
            .filter((featureId: string) =>
              VEHICLE_FEATURES.comfort.some(
                (feature) => feature.id === featureId
              )
            )
            .map((featureId: string) =>
              VEHICLE_FEATURES.comfort.find((f) => f.id === featureId)
            )
            .filter(Boolean)
        : [],
    [car.features]
  );

  // Extracted component renderers to reduce main render function complexity
  const renderImageCarousel = useCallback(
    () => (
      <View
        style={{ position: "relative", marginBottom: 24, overflow: "visible" }}
      >
        <View
          style={{
            borderBottomLeftRadius: 20,
            borderBottomRightRadius: 20,
            overflow: "hidden",
          }}
        >
          {car.images && car.images.length > 0 ? (
            <FlatList
              data={car.images}
              renderItem={({ item, index }) => (
                <Pressable onPress={() => setSelectedImageIndex(index)}>
                  <OptimizedImage
                    source={{ uri: item }}
                    style={{ width, height: 350 }}
                    onLoad={index === 0 ? handleFirstImageLoaded : undefined}
                  />
                </Pressable>
              )}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialNumToRender={2}
              maxToRenderPerBatch={2}
              windowSize={3}
              removeClippedSubviews={true}
              onMomentumScrollEnd={(event) => {
                const newIndex = Math.round(
                  event.nativeEvent.contentOffset.x / width
                );
                setActiveImageIndex(newIndex);
              }}
              keyExtractor={(_, index) => `image-${index}`}
            />
          ) : (
            <View
              style={{
                width,
                height: 350,
                backgroundColor: isDarkMode ? "#222" : "#f0f0f0",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons
                name="image-outline"
                size={60}
                color={isDarkMode ? "#444" : "#ccc"}
              />
              <Text
                style={{
                  marginTop: 16,
                  color: isDarkMode ? "#777" : "#999",
                  fontSize: 16,
                }}
              >
                No images available
              </Text>
            </View>
          )}

          {/* Pagination Dots - only if we have multiple images */}
          {car.images && car.images.length > 1 && (
            <View
              style={{
                position: "absolute",
                bottom: 32,
                left: 0,
                right: 0,
                flexDirection: "row",
                justifyContent: "center",
                zIndex: 10,
              }}
            >
              {car.images.map((_, index) => (
                <View
                  key={index}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor:
                      index === activeImageIndex
                        ? "#D55004"
                        : "rgba(255,255,255,0.5)",
                    marginHorizontal: 4,
                  }}
                />
              ))}
            </View>
          )}
        </View>

        {/* Price Badge */}
        {car.price && (
          <View
            style={{
              position: "absolute",
              bottom: -24,
              left: "50%",
              marginLeft: -64,
              backgroundColor: isDarkMode ? "#fff" : "#fff",
              borderRadius: 9999,
              width: 128,
              height: 48,
              alignItems: "center",
              justifyContent: "center",
              elevation: 5,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
              zIndex: 20,
            }}
          >
            <Text
              style={{ color: "#D55004", fontSize: 18, fontWeight: "bold" }}
            >
              {formatCarPrice(car.price, car.rental_period)}
            </Text>
          </View>
        )}
      </View>
    ),
    [
      car.images,
      car.price,
      width,
      activeImageIndex,
      isDarkMode,
      handleFirstImageLoaded,
    ]
  );

  const renderTechnicalData = useCallback(
    () => (
      <View style={{ marginTop: 32, marginHorizontal: 16 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "bold",
              color: isDarkMode ? "#fff" : "#000",
            }}
          >
            {t('car.technical_data')}
          </Text>

          {criticalState.autoclips.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setCriticalState((prev) => ({
                  ...prev,
                  selectedClip: criticalState.autoclips[0],
                  showClipModal: true,
                }));
              }}
              style={{
                backgroundColor: "#D55004",
                borderRadius: 20,
                paddingVertical: 8,
                paddingHorizontal: 16,
                justifyContent: "center",
                alignItems: "center",
                flexDirection: "row",
              }}
            >
              <Ionicons
                name="play"
                size={16}
                color="white"
                style={{ marginRight: 5 }}
              />
              <Text style={{ color: "white", fontWeight: "bold" }}>
                Autoclip
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View
          style={{
            borderRadius: 8,
            marginTop: 16,
            backgroundColor: isDarkMode ? "#1c1c1c" : "#e9e9e9",
          }}
        >
          {getTechnicalDataFields(car, t).map((item, index, array) => (
            <TechnicalDataItem
              key={item.label}
              icon={item.icon}
              label={item.label}
              value={item.value}
              isDarkMode={isDarkMode}
              isLast={index === array.length - 1}
            />
          ))}
        </View>
      </View>
    ),
    [
      car.mileage,
      car.transmission,
      car.drivetrain,
      car.color,
      car.condition,
      car.source,
      isDarkMode,
      criticalState.autoclips,
    ]
  );

  const renderDescription = useCallback(() => {
    if (!car.description) return null;

    return (
      <View style={{ marginTop: 32, paddingHorizontal: 16 }}>
        <Text
          style={{
            fontSize: 18,
            fontWeight: "bold",
            color: isDarkMode ? "#fff" : "#000",
          }}
        >
          {t('car.description')}
        </Text>
        <Text
          style={{
            color: isDarkMode ? "#fff" : "#000",
            marginTop: 12,
            lineHeight: 20,
          }}
        >
          {car.description}
        </Text>
      </View>
    );
  }, [car.description, isDarkMode]);

  const renderFeatures = useCallback(() => {
    if (!car.features || car.features.length === 0) return null;

    return (
      <View style={{ marginTop: 32, paddingHorizontal: 16 }}>
        <Text
          style={{
            fontSize: 18,
            fontWeight: "bold",
            marginBottom: 16,
            color: isDarkMode ? "#fff" : "#000",
          }}
        >
          {t('car.features')}
        </Text>

        <View>
          <FeatureCategory
            title={t('car.technology')}
            features={techFeatures}
            isDarkMode={isDarkMode}
          />

          <FeatureCategory
            title={t('car.safety')}
            features={safetyFeatures}
            isDarkMode={isDarkMode}
          />

          <FeatureCategory
            title={t('car.comfort_convenience')}
            features={comfortFeatures}
            isDarkMode={isDarkMode}
          />

          {car.features.length > 0 &&
            techFeatures.length === 0 &&
            safetyFeatures.length === 0 &&
            comfortFeatures.length === 0 && (
              <Text
                style={{
                  fontStyle: "italic",
                  color: isDarkMode ? "#777" : "#999",
                }}
              >
                {t('car.no_feature_details')}
              </Text>
            )}
        </View>
      </View>
    );
  }, [car.features, techFeatures, safetyFeatures, comfortFeatures, isDarkMode]);

  const renderMap = useCallback(() => {
    // Get location based on seller type
    const latitude = isDealershipCar ? car.dealership_latitude : car.latitude;
    const longitude = isDealershipCar ? car.dealership_longitude : car.longitude;
    const hasLocation = latitude && longitude;

    // Don't show map section if no location available
    if (!hasLocation) return null;

    if (!nonCriticalState.isMapVisible) {
      return (
        <View
          style={{
            marginTop: 32,
            paddingHorizontal: 16,
            height: 240,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "bold",
              marginBottom: 12,
              color: isDarkMode ? "#fff" : "#000",
            }}
          >
            {t('car.location')}
          </Text>

          <View
            style={{
              height: 200,
              borderRadius: 10,
              backgroundColor: isDarkMode ? "#222" : "#f0f0f0",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Ionicons
              name="map-outline"
              size={40}
              color={isDarkMode ? "#555" : "#ccc"}
            />
            <Text
              style={{
                marginTop: 8,
                color: isDarkMode ? "#777" : "#999",
              }}
            >
              {t('car.loading_map')}
            </Text>
          </View>
        </View>
      );
    }

    // Lazy-loaded map component
    return (
      <View style={{ marginTop: 32, paddingHorizontal: 16 }}>
        <Text
          style={{
            fontSize: 18,
            fontWeight: "bold",
            marginBottom: 12,
            color: isDarkMode ? "#fff" : "#000",
          }}
        >
          {t('car.location')}
        </Text>

        <View style={{ height: 200, borderRadius: 10, overflow: "hidden" }}>
          {Platform.OS === "ios" && MapView ? (
            <MapView style={{ flex: 1 }} region={mapRegion} liteMode={false}>
              {MapViewMarker && (
                <MapViewMarker
                  coordinate={{
                    latitude: parseFloat(latitude) || 37.7749,
                    longitude: parseFloat(longitude) || -122.4194,
                  }}
                  title={sellerInfo.name || "Location"}
                  description={sellerInfo.location || ""}
                />
              )}
            </MapView>
          ) : (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: isDarkMode ? "#1c1c1c" : "#f0f0f0",
              }}
            >
              <Ionicons
                name="map-outline"
                size={40}
                color={isDarkMode ? "#444" : "#888"}
              />
              <Text
                style={{
                  color: isDarkMode ? "#777" : "#555",
                  marginTop: 8,
                }}
              >
                {Platform.OS === "ios" ? t('car.loading_map') : t('car.map_not_available')}
              </Text>
            </View>
          )}

          <TouchableOpacity
            onPress={handleOpenInMaps}
            style={{
              position: "absolute",
              bottom: 16,
              right: 16,
              backgroundColor: "#D55004",
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 9999,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Ionicons name="navigate" size={16} color="white" />
            <Text style={{ color: "white", marginLeft: 8, fontWeight: "500" }}>
              {t('car.take_me_there')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [
    isDealershipCar,
    car.dealership_latitude,
    car.dealership_longitude,
    car.latitude,
    car.longitude,
    nonCriticalState.isMapVisible,
    sellerInfo.name,
    sellerInfo.location,
    mapRegion,
    isDarkMode,
    handleOpenInMaps,
    MapView,
    MapViewMarker,
  ]);

  // First, let's create a CarSectionSkeleton component that doesn't include titles
  const CarSectionSkeleton = memo(({ isDarkMode }) => {
    return (
      <View style={{ marginTop: 20, paddingHorizontal: 16 }}>
        <FlatList
          data={[1, 2, 3]} // Show 3 skeleton items
          renderItem={() => <CarItemSkeleton isDarkMode={isDarkMode} />}
          keyExtractor={(item) => `section-skeleton-${item}`}
          horizontal
          showsHorizontalScrollIndicator={false}
        />
      </View>
    );
  });

  // Updated renderSimilarCars function without title during loading
  const renderSimilarCars = useCallback(() => {
    // If not loaded yet, show the skeleton without any title
    // Include the bottom margin to ensure proper spacing at the end
    if (!loadingStatus.similarCarsLoaded) {
      return (
        <View style={{ marginBottom: 150 }}>
          <CarSectionSkeleton isDarkMode={isDarkMode} />
        </View>
      );
    }

    // If loaded but empty, return null (show nothing)
    if (nonCriticalState.similarCars.length === 0) return null;

    // If loaded and we have content, show the full section with title
    return (
      <View style={{ marginTop: 32, paddingHorizontal: 16, marginBottom: 160 }}>
        <Text
          style={{
            fontSize: 18,
            fontWeight: "bold",
            marginBottom: 8,
            color: isDarkMode ? "#fff" : "#000",
          }}
        >
          {nonCriticalState.similarCars[0]?.make === car.make &&
          nonCriticalState.similarCars[0]?.model === car.model &&
          nonCriticalState.similarCars[0]?.year === car.year
            ? t('car.explore_similar_cars')
            : t('car.similarly_priced_cars')}
        </Text>

        <FlatList
          data={nonCriticalState.similarCars}
          renderItem={renderCarItem}
          keyExtractor={(item: any) => `similar-${item.id}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          initialNumToRender={2}
          maxToRenderPerBatch={3}
          windowSize={3}
          removeClippedSubviews={true}
        />
      </View>
    );
  }, [
    nonCriticalState.similarCars,
    car.make,
    car.model,
    car.year,
    isDarkMode,
    renderCarItem,
    loadingStatus.similarCarsLoaded,
  ]);

  // Updated renderDealerCars function without title during loading
  const renderDealerCars = useCallback(() => {
    // Don't show anything (including skeletons) for user-posted cars
    if (!isDealershipCar) return null;

    // If not loaded yet, show the skeleton without any title (only for dealership cars)
    if (!loadingStatus.dealerCarsLoaded) {
      return <CarSectionSkeleton isDarkMode={isDarkMode} />;
    }

    // If loaded but empty, return null (show nothing)
    if (nonCriticalState.dealerCars.length === 0) return null;

    // If loaded and we have content, show the full section with title
    return (
      <View style={{ marginTop: 32, paddingHorizontal: 16 }}>
        <Text
          style={{
            fontSize: 18,
            fontWeight: "bold",
            marginBottom: 8,
            color: isDarkMode ? "#fff" : "#000",
          }}
        >
          {t('car.more_from')} {sellerInfo.name || t('car.dealership')}
        </Text>

        <FlatList
          data={nonCriticalState.dealerCars}
          renderItem={renderCarItem}
          keyExtractor={(item) => `dealer-${item.id}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          initialNumToRender={2}
          maxToRenderPerBatch={3}
          windowSize={3}
          removeClippedSubviews={true}
        />
      </View>
    );
  }, [
    isDealershipCar,
    nonCriticalState.dealerCars,
    car.dealership_name,
    isDarkMode,
    renderCarItem,
    loadingStatus.dealerCarsLoaded,
    sellerInfo.name,
  ]);

  // Don't forget to ensure you have bottom spacing in your main content
  // Add this at the end of your main content:
  {
    loadingStatus.similarCarsLoaded &&
      loadingStatus.dealerCarsLoaded &&
      nonCriticalState.similarCars.length === 0 &&
      nonCriticalState.dealerCars.length === 0 && (
        <View style={{ marginBottom: 160 }} />
      );
  }

  // Optimized main render
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDarkMode ? "#000000" : "#FFFFFF" },
      ]}
    >
      {/* Main content */}
      <FlatList
        ref={scrollViewRef}
        data={[{ key: "content" }]}
        keyExtractor={(item) => item.key}
        renderItem={() => (
          <>
            {/* Car details */}
            {renderImageCarousel()}

            {/* Car Info */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                justifyContent: "space-between",
                paddingHorizontal: 16,
                marginTop: 8,
                marginBottom: 8,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start", flex: 1 }}>
                <View
                  style={{
                    justifyContent: "center",
                    alignItems: "center",
                    marginTop: 16,
                    width: 50,
                    flexShrink: 0,
                  }}
                >
                  <OptimizedImage
                    source={{ uri: getLogoUrl(car.make, !isDarkMode) }}
                    style={{ width: 60, height: 40 }}
                    contentFit="contain"
                  />
                </View>

                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 20,
                      marginTop: 16,
                      fontWeight: "bold",
                      color: isDarkMode ? "#fff" : "#000",
                      flexWrap: "wrap",
                    }}
                    numberOfLines={3}
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.8}
                  >
                    {car.year} {car.make} {car.model}
                  </Text>

                  {car.trim !== null && car.trim !== "" && (
                    <Text
                      className="mt-1"
                      style={{
                        fontSize: 14,
                        color: isDarkMode ? "#fff" : "#000",
                      }}
                      numberOfLines={2}
                    >
                      {car.trim}
                    </Text>
                  )}

                  {car.listed_at && (
                    <Text
                      style={{
                        fontSize: 12,
                        marginTop: 4,
                        color: isDarkMode
                          ? "rgba(255,255,255,0.6)"
                          : "rgba(0,0,0,0.6)",
                      }}
                    >
                      {t('car.posted')} {getRelativeTime(car.listed_at, t)}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* Technical Data */}
            {renderTechnicalData()}

            {/* Description */}
            {renderDescription()}

            {/* Features */}
            {renderFeatures()}

            {/* Map */}
            {renderMap()}

            {/* Dealer Cars (More from...) */}
            {renderDealerCars()}

            {/* Similar Cars */}
            {renderSimilarCars()}

            {/* Bottom spacing - ensure content isn't cropped by bottom action bar */}
            {(!isDealershipCar || (loadingStatus.dealerCarsLoaded && nonCriticalState.dealerCars.length === 0)) && (
              <View style={{ marginBottom: 180 }} />
            )}
          </>
        )}
        showsVerticalScrollIndicator={false}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={5}
        removeClippedSubviews={Platform.OS === "android"}
        scrollEventThrottle={16}
        onEndReachedThreshold={0.5}
      />

      {/* Bottom Action Bar */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          width: "100%",
          padding: 16,
          paddingBottom: 24,
          flexDirection: "column",
          justifyContent: "space-around",
          alignItems: "center",
          backgroundColor: isDarkMode
            ? "rgba(0,0,0,0.95)"
            : "rgba(255,255,255,0.95)",
          borderTopWidth: 1,
          borderTopColor: isDarkMode ? "#333" : "#e0e0e0",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.1,
          shadowRadius: 3,
          elevation: 10,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <TouchableOpacity
              onPress={handleDealershipPress}
              disabled={!isDealershipCar}
            >
              {isDealershipCar && sellerInfo.logo ? (
                <OptimizedImage
                  source={{ uri: sellerInfo.logo }}
                  style={{ width: 50, height: 50, borderRadius: 25 }}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 25,
                    backgroundColor: isDarkMode ? '#333' : '#e0e0e0',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Ionicons
                    name={isDealershipCar ? "business-outline" : "person-outline"}
                    size={24}
                    color={isDarkMode ? '#999' : '#555'}
                  />
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleDealershipPress}
              disabled={!isDealershipCar}
              style={{ flex: 1 }}
            >
              <View style={{ flex: 1, marginLeft: 12, marginRight: 8, alignItems: 'center' }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "500",
                    color: isDarkMode ? "#fff" : "#000",
                    textAlign: 'center'
                  }}
                  numberOfLines={2}
                  adjustsFontSizeToFit={true}
                  minimumFontScale={0.8}
                >
                  {sellerInfo.name}
                </Text>

                {sellerInfo.location && (
                  <Text
                    style={{
                      fontSize: 14,
                      color: isDarkMode ? "#fff" : "#000",
                      textAlign: 'center'
                    }}
                    numberOfLines={2}
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.7}
                  >
                    <Ionicons name="location" size={12} />
                    {sellerInfo.location}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: "row" }}>
            <ActionButton
              icon="call-outline"
              onPress={handleCall}
              isDarkMode={isDarkMode}
            />
            <ActionButton
              icon="logo-whatsapp"
              onPress={handleWhatsAppPress}
              isDarkMode={isDarkMode}
            />
            <ActionButton
              icon="share-outline"
              onPress={handleShare}
              isDarkMode={isDarkMode}
            />
          </View>
        </View>

        <TouchableOpacity
          onPress={handleOpenInMaps} // CHANGE: from handleOpenInGoogleMaps to handleOpenInMaps
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            padding: 12,
            marginTop: 16,
            borderRadius: 9999,
            backgroundColor: isDarkMode ? "#fff" : "#000",
            width: "100%",
          }}
        >
          <Ionicons
            name="navigate-outline"
            size={24}
            color={isDarkMode ? "black" : "white"}
          />
          <Text
            style={{
              color: isDarkMode ? "black" : "white",
              fontWeight: "600",
              marginLeft: 8,
            }}
          >
            {t('car.open_in_maps')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Autoclip Modal with Suspense */}
      {criticalState.showClipModal && (
        <React.Suspense
          fallback={
            <View style={styles.modalBackground}>
              <ActivityIndicator size="large" color="#D55004" />
            </View>
          }
        >
          <AutoclipModal
            isVisible={criticalState.showClipModal}
            onClose={() => {
              setCriticalState((prev) => ({
                ...prev,
                showClipModal: false,
                selectedClip: null,
              }));
            }}
            clip={criticalState.selectedClip}
            onLikePress={() =>
              criticalState.selectedClip &&
              handleClipLike(criticalState.selectedClip.id)
            }
            isLiked={criticalState.selectedClip?.liked_users?.includes(
              user?.id
            )}
          />
        </React.Suspense>
      )}

      {/* Image Modal (Optimized) */}
      {selectedImageIndex !== null && car.images && (
        <Modal
          visible={true}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setSelectedImageIndex(null)}
        >
          <View style={styles.modalBackground}>
            {/* Close button with improved positioning */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setSelectedImageIndex(null)}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <Ionicons name="close" size={32} color="white" />
            </TouchableOpacity>

            {/* Gallery with proper centering */}
            <FlatList
              data={car.images}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={selectedImageIndex}
              onMomentumScrollEnd={(e) => {
                const newIndex = Math.round(
                  e.nativeEvent.contentOffset.x / width
                );
                setSelectedImageIndex(newIndex);
              }}
              keyExtractor={(_, index) => `fullscreen-${index}`}
              getItemLayout={(_, index) => ({
                length: width,
                offset: width * index,
                index,
              })}
              renderItem={({ item, index }) => (
                <View style={styles.imageContainer}>
                  <Image
                    source={{ uri: item }}
                    style={styles.fullscreenImage}
                    contentFit="contain"
                  />
                </View>
              )}
              initialNumToRender={1}
              maxToRenderPerBatch={2}
              windowSize={3}
              removeClippedSubviews={true}
            />

            {/* Image counter indicator with improved styling */}
            <View style={styles.imageCounter}>
              <Text style={styles.imageCounterText}>
                {selectedImageIndex + 1} / {car.images.length}
              </Text>
            </View>
          </View>
        </Modal>
      )}

      {/* Image Viewer */}
      <ImageViewing
        images={car.images.map((uri: string) => ({ uri }))}
        imageIndex={selectedImageIndex || 0}
        visible={selectedImageIndex !== null}
        onRequestClose={() => setSelectedImageIndex(null)}
        presentationStyle="overFullScreen"
        animationType="fade"
        swipeToCloseEnabled={true}
        doubleTapToZoomEnabled={true}
        enableSwipeDown={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
    ...Platform.select({
      android: {
        elevation: 0,
      },
    }),
  },
  map: {
    height: 200,
    borderRadius: 10,
  },
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },

  closeButton: {
    position: "absolute",
    top: 40,
    right: 20,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
    padding: 8,
  },

  imageContainer: {
    width,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },

  fullscreenImage: {
    width: width, // Slightly smaller than full width for better appearance
    height: height,
  },

  imageCounter: {
    position: "absolute",
    bottom: 40,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 20,
  },

  imageCounterText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
});

export default CarDetailScreen;
