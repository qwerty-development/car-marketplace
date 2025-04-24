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
    { id: "bluetooth", label: "Bluetooth", icon: "bluetooth" },
    { id: "navigation", label: "Navigation System", icon: "map-marker" },
    { id: "backup_camera", label: "Backup Camera", icon: "camera" },
    { id: "apple_carplay", label: "Apple CarPlay", icon: "apple" },
    { id: "android_auto", label: "Android Auto", icon: "android" },
    { id: "premium_audio", label: "Premium Audio", icon: "speaker" },
    { id: "remote_start", label: "Remote Start", icon: "remote" },
    { id: "keyless_entry", label: "Keyless Entry", icon: "key-wireless" },
    { id: "keyless_start", label: "Keyless Start", icon: "power" },
  ],
  safety: [
    {
      id: "lane_assist",
      label: "Lane Departure Warning",
      icon: "road-variant",
    },
    { id: "blind_spot", label: "Blind Spot Monitoring", icon: "eye-off" },
    { id: "parking_sensors", label: "Parking Sensors", icon: "parking" },
    { id: "backup_camera", label: "Backup Camera", icon: "camera" },
    { id: "cruise_control", label: "Cruise Control", icon: "speedometer" },
  ],
  comfort: [
    { id: "heated_seats", label: "Heated Seats", icon: "car-seat-heater" },
    { id: "leather_seats", label: "Leather Seats", icon: "car-seat" },
    { id: "third_row_seats", label: "Third Row Seats", icon: "seat-passenger" },
    { id: "sunroof", label: "Sunroof", icon: "weather-sunny" },
    { id: "power_mirrors", label: "Power Mirrors", icon: "car-side" },
    { id: "power_steering", label: "Power Steering", icon: "steering" },
    { id: "power_windows", label: "Power Windows", icon: "window-maximize" },
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

const CarItemSkeleton = memo(({ isDarkMode }:any) => {
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


const getLogoUrl = (make: string, isLightMode: boolean) => {
  const formattedMake = make.toLowerCase().replace(/\s+/g, "-");

  switch (formattedMake) {
    case "range-rover":
      return isLightMode
        ? "https://www.carlogos.org/car-logos/land-rover-logo-2020-green.png"
        : "https://www.carlogos.org/car-logos/land-rover-logo.png";
    case "infiniti":
      return "https://www.carlogos.org/car-logos/infiniti-logo.png";
    case "jetour":
      return "https://upload.wikimedia.org/wikipedia/commons/8/8a/Jetour_Logo.png?20230608073743";
    case "audi":
      return "https://www.freepnglogos.com/uploads/audi-logo-2.png";
    case "nissan":
      return "https://cdn.freebiesupply.com/logos/large/2x/nissan-6-logo-png-transparent.png";
    default:
      return `https://www.carlogos.org/car-logos/${formattedMake}-logo.png`;
  }
};

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
              {feature.label}
            </Text>
          </View>
        )}
      />
    </View>
  );
});

// Helper function for relative time
const getRelativeTime = (dateString: string) => {
  if (!dateString) return "Recently";

  try {
    const now = new Date();
    const postedDate = new Date(dateString);

    if (isNaN(postedDate.getTime())) return "Recently";

    const seconds = Math.floor((now.getTime() - postedDate.getTime()) / 1000);

    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) {
      return interval + " year" + (interval > 1 ? "s" : "") + " ago";
    }
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) {
      return interval + " month" + (interval > 1 ? "s" : "") + " ago";
    }
    interval = Math.floor(seconds / 604800);
    if (interval >= 1) {
      return interval + " week" + (interval > 1 ? "s" : "") + " ago";
    }
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) {
      return interval + " day" + (interval > 1 ? "s" : "") + " ago";
    }
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) {
      return interval + " hour" + (interval > 1 ? "s" : "") + " ago";
    }
    interval = Math.floor(seconds / 60);
    if (interval >= 1) {
      return interval + " minute" + (interval > 1 ? "s" : "") + " ago";
    }
    return Math.floor(seconds) + " seconds ago";
  } catch (error) {
    console.error("Error computing relative time:", error);
    return "Recently";
  }
};

// Main component with performance optimizations
const CarDetailScreen = ({ car, onFavoritePress, onViewUpdate }: any) => {
  if (!car) return null;

  const { isDarkMode } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { isFavorite } = useFavorites();
  const scrollViewRef = useRef<FlatList>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
    null
  );

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
      // First, try to find cars with same make, model, and year
      let { data: exactMatches, error: exactMatchError } = await supabase
        .from("cars")
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
          .from("cars")
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
  }, [car?.id, car?.make, car?.model, car?.year, car?.price]);

  // Fetch dealer cars with error handling and optimization
  const fetchDealerCars = useCallback(async () => {
    if (!car || !car.dealership_id || !car.id) return;

    try {
      const { data, error } = await supabase
        .from("cars")
        .select(
          "id, make, model, year, price, images, dealership_id, dealerships:dealership_id (name, logo)"
        )
        .eq("dealership_id", car.dealership_id)
        .neq("id", car.id)
        .eq("status", "available")
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
  }, [car?.dealership_id, car?.id]);

  // Optimized navigation to dealership details
  const handleDealershipPress = useCallback(() => {
    if (!car.dealership_id) return;

    InteractionManager.runAfterInteractions(() => {
      router.push({
        pathname: "/(home)/(user)/DealershipDetails",
        params: { dealershipId: car.dealership_id },
      });
    });
  }, [router, car?.dealership_id]);

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
    if (car.fromDeepLink === 'true') {
      router.replace('/(home)/(user)');
    } else {
      router.back();

      // Safety timer - if we're still on the same screen after 100ms,
      // assume back navigation failed and redirect to home
      const timer = setTimeout(() => {
        router.replace('/(home)/(user)');
      }, 100);

      return () => clearTimeout(timer);
    }
  } catch (error) {
    // If any error occurs during navigation, safely redirect to home
    console.error('Navigation error:', error);
    router.replace('/(home)/(user)');
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
    if (!car || !car.dealership_phone) {
      Alert.alert("Phone number not available");
      return;
    }

    // Track the call click first
    trackCallClick(car.id);

    // Then proceed with the call
    Linking.openURL(`tel:${car.dealership_phone}`).catch((err) => {
      console.error("Error opening phone app:", err);
      Alert.alert("Error", "Could not open phone app");
    });
  }, [car?.id, car?.dealership_phone, trackCallClick]);

const handleShare = useCallback(async () => {
  if (!car) return;

  try {
    // Use a consistent URL format
    const shareUrl = `https://www.fleetapp.me/cars/${car.id}`;

    const message =
      `Check out this ${car.year} ${car.make} ${car.model} for $${
        car.price ? car.price.toLocaleString() : "N/A"
      }!\n` +
      `at ${car.dealership_name || "Dealership"} in ${
        car.dealership_location || "Location"
      }\n`

    await Share.share({
      message,
      url: shareUrl,
      title: `${car.year} ${car.make} ${car.model}`
    });
  } catch (error) {
    console.error("Share error:", error);
    Alert.alert('Error', 'Failed to share car details');
  }
}, [car]);

  const handleOpenInMaps = useCallback(() => {
    if (!car) return;

    const { dealership_latitude, dealership_longitude } = car;

    if (!dealership_latitude || !dealership_longitude) {
      Alert.alert(
        "Location unavailable",
        "No location available for this dealership"
      );
      return;
    }

    if (Platform.OS === "ios") {
      Alert.alert("Open Maps", "Choose your preferred maps application", [
        {
          text: "Apple Maps",
          onPress: () => {
            const appleMapsUrl = `maps:0,0?q=${dealership_latitude},${dealership_longitude}`;
            Linking.openURL(appleMapsUrl).catch(() => {
              Alert.alert("Error", "Could not open Maps");
            });
          },
        },
        {
          text: "Google Maps",
          onPress: () => {
            const googleMapsUrl = `comgooglemaps://?q=${dealership_latitude},${dealership_longitude}&zoom=14`;
            Linking.openURL(googleMapsUrl).catch(() => {
              // If Google Maps app isn't installed, fallback to browser
              const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${dealership_latitude},${dealership_longitude}`;
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
      const googleMapsUrl = `geo:${dealership_latitude},${dealership_longitude}?q=${dealership_latitude},${dealership_longitude}`;
      Linking.openURL(googleMapsUrl).catch(() => {
        // Fallback to browser if necessary
        const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${dealership_latitude},${dealership_longitude}`;
        Linking.openURL(fallbackUrl).catch(() => {
          Alert.alert("Error", "Could not open Maps");
        });
      });
    }
  }, [car?.dealership_latitude, car?.dealership_longitude]);

  const handleOpenInGoogleMaps = useCallback(() => {
    if (!car) return;

    const latitude = car.dealership_latitude || 0;
    const longitude = car.dealership_longitude || 0;

    if (!latitude || !longitude) {
      Alert.alert(
        "Location unavailable",
        "No location available for this dealership"
      );
      return;
    }

    const url = `https://www.google.com/maps?q=${latitude},${longitude}`;

    Linking.openURL(url).catch((err) => {
      console.error("Error opening Google Maps:", err);
      Alert.alert("Error", "Could not open Google Maps");
    });
  }, [car?.dealership_latitude, car?.dealership_longitude]);

  const handleWhatsAppPress = useCallback(() => {
    if (!car || !car.dealership_phone) {
      Alert.alert("Phone number not available");
      return;
    }

    // Track the WhatsApp click first
    trackWhatsAppClick(car.id);

    const cleanedPhoneNumber = car.dealership_phone
      .toString()
      .replace(/\D/g, "");
    const message = `Hi, I'm interested in the ${car.year} ${car.make} ${
      car.model
    } listed for $${car.price ? car.price.toLocaleString() : "N/A"} on Fleet`;
    const webURL = `https://wa.me/961${cleanedPhoneNumber}?text=${encodeURIComponent(
      message
    )}`;

    Linking.openURL(webURL).catch(() => {
      Alert.alert(
        "Error",
        "Unable to open WhatsApp. Please make sure it is installed on your device."
      );
    });
  }, [car, trackWhatsAppClick]);

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
                params: { carId: item.id },
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
    [isDarkMode, router]
  );

  // Memoized map region
  const mapRegion = useMemo(
    () => ({
      latitude: parseFloat(car.dealership_latitude) || 37.7749,
      longitude: parseFloat(car.dealership_longitude) || -122.4194,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }),
    [car.dealership_latitude, car.dealership_longitude]
  );

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
              ${car.price.toLocaleString()}
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
            Technical Data
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
          {[
            {
              icon: "speedometer-outline",
              label: "Mileage",
              value: car.mileage
                ? `${(car.mileage / 1000).toFixed(1)}k`
                : "N/A",
            },
            {
              icon: "hardware-chip-outline",
              label: "Trans",
              value: car.transmission
                ? car.transmission.substring(0, 4)
                : "N/A",
            },
            {
              icon: "car-sport-outline",
              label: "Drive",
              value: car.drivetrain || "N/A",
            },
            {
              icon: "color-palette-outline",
              label: "Color",
              value: car.color || "N/A",
            },
            {
              icon: "thermometer-outline",
              label: "Condition",
              value: car.condition || "N/A",
            },
            {
              icon: "earth",
              label: "Source",
              value: car.source || "N/A",
            },
          ].map((item, index, array) => (
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
          Description
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
          Features
        </Text>

        <View>
          <FeatureCategory
            title="Technology"
            features={techFeatures}
            isDarkMode={isDarkMode}
          />

          <FeatureCategory
            title="Safety"
            features={safetyFeatures}
            isDarkMode={isDarkMode}
          />

          <FeatureCategory
            title="Comfort & Convenience"
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
                No feature details available
              </Text>
            )}
        </View>
      </View>
    );
  }, [car.features, techFeatures, safetyFeatures, comfortFeatures, isDarkMode]);

  const renderMap = useCallback(() => {
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
            Location
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
              Loading map...
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
          Location
        </Text>

        <View style={{ height: 200, borderRadius: 10, overflow: "hidden" }}>
          {Platform.OS === "ios" && MapView ? (
            <MapView style={{ flex: 1 }} region={mapRegion} liteMode={false}>
              {MapViewMarker && (
                <MapViewMarker
                  coordinate={{
                    latitude: parseFloat(car.dealership_latitude) || 37.7749,
                    longitude:
                      parseFloat(car.dealership_longitude) || -122.4194,
                  }}
                  title={car.dealership_name || "Dealership"}
                  description={car.dealership_location || ""}
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
                {Platform.OS === "ios" ? "Loading map..." : "Map not available"}
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
              Take Me There
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [
    nonCriticalState.isMapVisible,
    car.dealership_latitude,
    car.dealership_longitude,
    car.dealership_name,
    car.dealership_location,
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
  if (!loadingStatus.similarCarsLoaded) {
    return <CarSectionSkeleton isDarkMode={isDarkMode} />;
  }
  
  // If loaded but empty, return null (show nothing)
  if (nonCriticalState.similarCars.length === 0) return null;
  
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
        {nonCriticalState.similarCars[0]?.make === car.make &&
        nonCriticalState.similarCars[0]?.model === car.model &&
        nonCriticalState.similarCars[0]?.year === car.year
          ? "Explore Similar Cars"
          : "Similarly Priced Cars"}
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
  // If not loaded yet, show the skeleton without any title
  // Include the bottom margin to ensure proper spacing at the end
  if (!loadingStatus.dealerCarsLoaded) {
    return (
      <View style={{ marginBottom: 150 }}>
        <CarSectionSkeleton isDarkMode={isDarkMode} />
      </View>
    );
  }
  
  // If loaded but empty, return null (show nothing)
  if (nonCriticalState.dealerCars.length === 0) return null;
  
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
        More from {car.dealership_name || "Dealership"}
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
  nonCriticalState.dealerCars,
  car.dealership_name,
  isDarkMode,
  renderCarItem,
  loadingStatus.dealerCarsLoaded,
]);

// Don't forget to ensure you have bottom spacing in your main content
// Add this at the end of your main content:
{loadingStatus.similarCarsLoaded && 
 loadingStatus.dealerCarsLoaded && 
 nonCriticalState.similarCars.length === 0 && 
 nonCriticalState.dealerCars.length === 0 && (
  <View style={{ marginBottom: 160 }} />
)}

  // Optimized main render
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDarkMode ? "#000000" : "#FFFFFF" },
      ]}
    >
      {/* Back button */}
      <TouchableOpacity
        onPress={handleBackPress}
        style={{
          position: "absolute",
          top: 35,
          left: 10,
          zIndex: 50,
          backgroundColor: "rgba(0,0,0,0.5)",
          borderRadius: 24,
          padding: 8,
        }}
      >
        <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
      </TouchableOpacity>

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
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 16,
                marginTop: 16,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    justifyContent: "center",
                    alignItems: "center",
                    marginTop: 8,
                    width: 50,
                  }}
                >
                  <OptimizedImage
                    source={{ uri: getLogoUrl(car.make, !isDarkMode) }}
                    style={{ width: 60, height: 40 }}
                    contentFit="contain"
                  />
                </View>

                <View style={{ marginLeft: 12 }}>
                  <Text
                    style={{
                      fontSize: 20,
                      marginTop: 24,
                      fontWeight: "bold",
                      color: isDarkMode ? "#fff" : "#000",
                    }}
                  >
                    {car.make} {car.model}
                  </Text>

                  <Text
                    style={{
                      fontSize: 14,
                      color: isDarkMode ? "#fff" : "#000",
                    }}
                  >
                    {car.year}
                  </Text>

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
                      Posted {getRelativeTime(car.listed_at)}
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

            {/* Similar Cars */}
            {renderSimilarCars()}

            {/* Dealer Cars */}
            {renderDealerCars()}

               {/* Add bottom padding if neither section has content after loading */}
    {loadingStatus.similarCarsLoaded && 
     loadingStatus.dealerCarsLoaded && 
     nonCriticalState.similarCars.length === 0 && 
     nonCriticalState.dealerCars.length === 0 && (
      <View style={{ marginBottom: 160 }} />
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
            <TouchableOpacity onPress={handleDealershipPress}>
              <OptimizedImage
                source={{ uri: car.dealership_logo }}
                style={{ width: 50, height: 50, borderRadius: 25 }}
                contentFit="cover"
              />
            </TouchableOpacity>

            <TouchableOpacity onPress={handleDealershipPress}>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "500",
                    color: isDarkMode ? "#fff" : "#000",
                  }}
                  numberOfLines={1}
                >
                  {car.dealership_name || "Dealership"}
                </Text>

                <Text
                  style={{
                    fontSize: 14,
                    color: isDarkMode ? "#fff" : "#000",
                    maxWidth: 160,
                  }}
                  numberOfLines={2}
                >
                  <Ionicons name="location" size={12} />
                  {car.dealership_location || "Location not available"}
                </Text>
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
          onPress={handleOpenInGoogleMaps}
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
            Open in Google Maps
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
              renderItem={({ item }) => (
                <View style={styles.imageContainer}>
                  <Image
                    source={{ uri: item }}
                    style={styles.fullscreenImage}
                    contentFit="contain"
                    transition={200}
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
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },

  imageContainer: {
    width,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  fullscreenImage: {
    width: width , // Slightly smaller than full width for better appearance
    height: height,
  },

  imageCounter: {
    position: 'absolute',
    bottom: 40,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
  },

  imageCounterText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default CarDetailScreen;
