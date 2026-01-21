// app/(home)/(user)/CarDetailModal.android.tsx
import React, { useCallback, useEffect, useState, useRef, lazy, Suspense, memo, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Dimensions,
  Linking,
  Alert,
  Share,
  Platform,
  Pressable,
  ActivityIndicator,
  AppState
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from "@/utils/supabase";
import { debounce } from "@/utils/debounce";
import { useFavorites } from "@/utils/useFavorites";
import { useRouter } from "expo-router";
import { useTheme } from "@/utils/ThemeContext";
import { Image } from "react-native";
import AutoclipModal from "@/components/AutoclipModal";
import { useAuth } from "@/utils/AuthContext";
import ErrorBoundary from "react-native-error-boundary";
import ImageViewing from "react-native-image-viewing";

// Dynamically import MapView to prevent it from blocking the main thread
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { getLogoUrl } from "@/hooks/getLogoUrl";
import { shareCar } from "@/utils/centralizedSharing";
import { styled } from "nativewind";
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { formatMileage } from '@/utils/formatMileage';
import {
  isRentalCar,
  formatCarPrice,
  getTechnicalDataFields,
  getCarWhatsAppMessage,
  getSimilarCarsTableName
} from '@/utils/carDisplayHelpers';

const { width } = Dimensions.get("window");

const StyledPressable = styled(Pressable);

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
// Improved image component with error handling
const OptimizedImage = React.memo(({ source, style, onLoad, fallbackColor = '#333' }: any) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const handleLoad = useCallback(() => {
    setLoaded(true);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setError(true);
    console.log('Image failed to load:', source?.uri);
  }, [source?.uri]);

  return (
    <View style={[style, { overflow: "hidden", backgroundColor: fallbackColor }]}>
      {!error ? (
        <Image
          source={source}
          style={[
            style,
            { opacity: loaded ? 1 : 0.5 }
          ]}
          onLoad={handleLoad}
          onError={handleError}
          resizeMode="cover"
          defaultSource={require('@/assets/placeholder.jpg')} // Make sure to add this placeholder
        />
      ) : (
        <View style={[style, { justifyContent: 'center', alignItems: 'center' }]}>
          <Ionicons name="image-outline" size={40} color="#999" />
        </View>
      )}
    </View>
  );
});



// Action button component
const ActionButton = ({ icon, onPress, text, isDarkMode }: any) => (
  <TouchableOpacity onPress={onPress} className="items-center mx-2">
    <Ionicons
      name={icon}
      size={27}
      color={isDarkMode ? "#FFFFFF" : "#000000"}
    />
  </TouchableOpacity>
);

// Technical data item component
const TechnicalDataItem = ({ icon, label, value = "N/A", isDarkMode, isLast }: any) => (
  <View className={`flex-row items-center mx-4 py-3 relative`}>
    <View className="w-8">
      <Ionicons
        name={icon}
        size={24}
        color={isDarkMode ? "#FFFFFF" : "#000000"}
      />
    </View>
    <Text
      className={`flex-1 text-sm ${isDarkMode ? "text-white" : "text-black"}`}
    >
      {label}
    </Text>
    <Text className="font-semibold text-sm" style={{ color: isDarkMode ? "#FFFFFF" : "#000000" }}>
      {value || "N/A"}
    </Text>

    {!isLast && (
      <View className="absolute bottom-0 w-full h-[1]" style={{ backgroundColor: "#c9c9c9" }} />
    )}
  </View>
);

// Custom MapView component with error handling and fallback
const SafeMapView = React.memo(({ 
  latitude, 
  longitude, 
  dealershipName, 
  dealershipLocation, 
  onMapPress, 
  isDarkMode 
}) => {
  // Component state
  const [mapError, setMapError] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadAttempts, setLoadAttempts] = useState(0);
  const [useStaticMap, setUseStaticMap] = useState(false);
  
  // Refs for lifecycle management
  const isMounted = useRef(true);
  const mapRef = useRef(null);
  const timeoutRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);
  
  // AppState listener for memory management
  useEffect(() => {
    const subscription = AppState.addEventListener("change", nextAppState => {
      if (appStateRef.current === "active" && nextAppState.match(/inactive|background/)) {
        // App is going to background, release map resources
        if (mapRef.current && isMounted.current) {
          // Reset map state to free memory
          setMapLoaded(false);
        }
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Progressive loading with timeouts and retries
  useEffect(() => {
    if (mapError || useStaticMap || mapLoaded) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }
    
    // Set timeout for map loading with exponential backoff
    timeoutRef.current = setTimeout(() => {
      if (!mapLoaded && isMounted.current) {
        console.log(`Map load attempt ${loadAttempts + 1} timed out`);
        
        if (loadAttempts < 2) {
          // Retry loading with incremental backoff
          setLoadAttempts(prev => prev + 1);
        } else {
          // After multiple failures, use static map fallback
          console.log('Multiple map load failures, using fallback');
          setMapError(true);
          setUseStaticMap(Platform.OS === 'android');
        }
      }
    }, 5000 + (loadAttempts * 2000)); // Increasing timeout with each attempt

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [mapLoaded, loadAttempts, mapError, useStaticMap]);

  // Coordinate validation
  const isValidLocation = useCallback(() => {
    try {
      if (!latitude || !longitude) return false;
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      return !isNaN(lat) && !isNaN(lng) && 
              Math.abs(lat) <= 90 && Math.abs(lng) <= 180 &&
              (lat !== 0 || lng !== 0);
    } catch (e) {
      console.error('Location validation error:', e);
      return false;
    }
  }, [latitude, longitude]);

  // Map-ready handler with safety checks
  const handleMapReady = useCallback(() => {
    if (isMounted.current) {
      console.log('Map ready event received');
      setMapLoaded(true);
      
      // Clear timeout when map is successfully loaded
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }, []);

  // Error handler
  const handleMapError = useCallback(() => {
    if (isMounted.current) {
      console.error('Map error event triggered');
      setMapError(true);
    }
  }, []);

  // Maps navigation handler
  const handleOpenInMaps = useCallback(() => {
    try {
      if (!isValidLocation()) {
        Alert.alert("Location unavailable", "No valid location information available");
        return;
      }

      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      const label = encodeURIComponent(dealershipName || "Dealership");

      // For Android, use Google Maps intent
      if (Platform.OS === 'android') {
        const url = `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
        Linking.openURL(url).catch(() => {
          // Fallback to Google Maps web URL if intent fails
          const webUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
          Linking.openURL(webUrl).catch(err => {
            console.error('Error opening maps:', err);
            Alert.alert("Error", "Could not open maps application");
          });
        });
      } else {
        // For iOS
        const appleMapsUrl = `maps:0,0?q=${lat},${lng}`;
        Linking.openURL(appleMapsUrl).catch(() => {
          // Fallback to Google Maps web URL
          const webUrl = `https://maps.google.com/?q=${lat},${lng}`;
          Linking.openURL(webUrl);
        });
      }
    } catch (error) {
      console.error("Error opening maps:", error);
      Alert.alert("Error", "Unable to open maps at this time");
    }
  }, [latitude, longitude, dealershipName, isValidLocation]);

  // Show error state for invalid coordinates or map errors
  if (mapError || !isValidLocation()) {
    // Static map fallback for Android production
    if (useStaticMap) {
      return (
        <View style={{
          height: 200,
          borderRadius: 10,
          backgroundColor: isDarkMode ? '#333' : '#e0e0e0',
          overflow: 'hidden'
        }}>
          <Image 
            source={{ 
              uri: `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=14&size=600x400&markers=color:red%7C${latitude},${longitude}&key=AIzaSyCDuRjdx7YfYc0Y46fcEisE6YbY0zVY7jk` 
            }}
            style={{ width: '100%', height: '100%' }}
            onError={() => {
              if (isMounted.current) {
                setUseStaticMap(false);
                setMapError(true);
              }
            }}
          />
          <TouchableOpacity
            onPress={onMapPress || handleOpenInMaps}
            style={{
              position: 'absolute',
              bottom: 16,
              right: 16,
              backgroundColor: '#D55004',
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 9999,
              flexDirection: 'row',
              alignItems: 'center',
              elevation: 3
            }}
          >
            <Ionicons name='navigate' size={16} color='white' />
            <Text style={{ color: 'white', marginLeft: 8 }}>Take Me There</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    // Standard error fallback
    return (
      <View style={{
        height: 200,
        borderRadius: 10,
        backgroundColor: isDarkMode ? '#333' : '#e0e0e0',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <Ionicons name="location-outline" size={40} color="#999" />
        <Text style={{ 
          marginTop: 8, 
          color: '#666',
          textAlign: 'center',
          paddingHorizontal: 16
        }}>
          {mapError ? 'Unable to load map' : 'Location information unavailable'}
        </Text>
        {loadAttempts > 0 && (
          <TouchableOpacity
            onPress={() => {
              if (isMounted.current) {
                setMapError(false);
                setLoadAttempts(0);
              }
            }}
            style={{
              marginTop: 12,
              padding: 8,
              backgroundColor: '#D55004',
              borderRadius: 8
            }}>
            <Text style={{ color: 'white' }}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Main render with error boundary and optimizations
  try {
    return (
      <View style={{ height: 200, borderRadius: 10, overflow: 'hidden' }}>
        <ErrorBoundary
          FallbackComponent={({ error, resetError }) => (
            <View style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: isDarkMode ? '#333' : '#e0e0e0',
            }}>
              <Ionicons name="warning-outline" size={40} color="#999" />
              <Text style={{ 
                marginTop: 8, 
                color: '#666',
                textAlign: 'center',
                paddingHorizontal: 16
              }}>
                Map display error
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (isMounted.current) {
                    resetError();
                    setMapError(false);
                    setLoadAttempts(prev => prev + 1);
                  }
                }}
                style={{
                  marginTop: 12,
                  padding: 8,
                  backgroundColor: '#D55004',
                  borderRadius: 8
                }}>
                <Text style={{ color: 'white' }}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}>
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            provider={PROVIDER_GOOGLE}
            region={{
              latitude: parseFloat(latitude),
              longitude: parseFloat(longitude),
              latitudeDelta: 0.01,
              longitudeDelta: 0.01
            }}
            // Performance optimizations for Android
            liteMode={Platform.OS === 'android'}
            minZoomLevel={12}
            maxZoomLevel={16}
            rotateEnabled={false}
            pitchEnabled={false}
            zoomTapEnabled={false}
            scrollEnabled={false}
            mapPadding={{ top: 20, right: 20, bottom: 20, left: 20 }}
            showsBuildings={false}
            showsTraffic={false}
            showsIndoors={false}
            showsCompass={false}
            toolbarEnabled={false}
            loadingEnabled={true}
            loadingIndicatorColor="#D55004"
            loadingBackgroundColor={isDarkMode ? "#333" : "#f0f0f0"}
            onMapReady={handleMapReady}
            onError={handleMapError}
          >
            {mapLoaded && (
              <Marker
                coordinate={{
                  latitude: parseFloat(latitude),
                  longitude: parseFloat(longitude)
                }}
                title={dealershipName || "Dealership"}
                description={dealershipLocation || ""}
              />
            )}
          </MapView>

          {mapLoaded && (
            <TouchableOpacity
              onPress={onMapPress || handleOpenInMaps}
              style={{
                position: 'absolute',
                bottom: 16,
                right: 16,
                backgroundColor: '#D55004',
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 9999,
                flexDirection: 'row',
                alignItems: 'center',
                elevation: 3
              }}
            >
              <Ionicons name='navigate' size={16} color='white' />
              <Text style={{ color: 'white', marginLeft: 8 }}>Take Me There</Text>
            </TouchableOpacity>
          )}
        </ErrorBoundary>
      </View>
    );
  } catch (error) {
    console.error('Caught error in SafeMapView render:', error);
    
    // Last resort error fallback
    return (
      <View style={{
        height: 200,
        borderRadius: 10,
        backgroundColor: isDarkMode ? '#333' : '#e0e0e0',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <Ionicons name="warning-outline" size={40} color="#999" />
        <Text style={{ 
          marginTop: 8, 
          color: '#666', 
          textAlign: 'center',
          paddingHorizontal: 16
        }}>
          Error displaying map
        </Text>
        <TouchableOpacity
          onPress={() => {
            if (isMounted.current) {
              setMapError(false);
              setLoadAttempts(prev => prev + 1);
            }
          }}
          style={{
            marginTop: 12,
            padding: 8,
            backgroundColor: '#D55004',
            borderRadius: 8
          }}>
          <Text style={{ color: 'white' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
});


// Custom error fallback component
const ErrorFallback = ({ error, resetError }) => (
  <View style={styles.errorContainer}>
    <Ionicons name="alert-circle-outline" size={50} color="#D55004" />
    <Text style={styles.errorTitle}>Something went wrong</Text>
    <Text style={styles.errorMessage}>We're having trouble displaying this content</Text>
    <TouchableOpacity style={styles.resetButton} onPress={resetError}>
      <Text style={styles.resetButtonText}>Try Again</Text>
    </TouchableOpacity>
  </View>
);

// Main component
const CarDetailScreen = ({ car, onFavoritePress, onViewUpdate, isRental = false }: any) => {
  if (!car) return null;

  const { isDarkMode } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { isFavorite } = useFavorites();
  const { t } = useTranslation();
  const [similarCars, setSimilarCars] = useState<any>([]);
  const [dealerCars, setDealerCars] = useState<any>([]);
  const scrollViewRef = useRef<any>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [autoclips, setAutoclips] = useState<any>([]);
  const [selectedClip, setSelectedClip] = useState<any>(null);
  const [showClipModal, setShowClipModal] = useState<any>(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [isMapSectionVisible, setIsMapSectionVisible] = useState(false);
  const [mapLoadAttempted, setMapLoadAttempted] = useState(false);

  // Determine if this is a dealership car or user car
  const isDealershipCar = useMemo(() => !!car.dealership_id, [car.dealership_id]);

  // Get seller info - works for both dealership and user cars
  const sellerInfo = useMemo(() => ({
    name: isDealershipCar ? car.dealership_name : car.seller_name || car.users?.name || t('common.private_seller'),
    logo: isDealershipCar ? car.dealership_logo : null,
    phone: isDealershipCar ? car.dealership_phone : car.users?.phone_number || car.seller_phone || car.phone,
    location: isDealershipCar ? car.dealership_location : car.location || null,
    id: isDealershipCar ? car.dealership_id : car.user_id,
  }), [car, isDealershipCar, t]);

  // Delayed loading of heavy components
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMapSectionVisible(true);
    }, 1000); // Delay map rendering by 1 second

    return () => clearTimeout(timer);
  }, []);

  // Helper function to compute relative time from the listed_at property
  const getRelativeTime = (dateString: string) => {
    try {
      if (!dateString) return t('car.recently');

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
      console.error('Error calculating relative time:', error);
      return t('car.recently');
    }
  };

  // Fetch autoclips with error handling
  const fetchAutoclips = useCallback(async () => {
    if (!car) return;

    try {
      const { data, error } = await supabase
        .from("auto_clips")
        .select("*")
        .eq("car_id", car.id)
        .eq("status", "published")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAutoclips(data || []);
    } catch (error) {
      console.error("Error fetching autoclips:", error);
      setAutoclips([]);
    }
  }, [car]);

  // Add to useEffect for initial fetch with error handling
  useEffect(() => {
    if (car) {
      const fetchData = async () => {
        try {
          await fetchAutoclips();
        } catch (error) {
          console.error('Failed to fetch autoclips:', error);
        }
      };

      fetchData();
    }
  }, [car, fetchAutoclips]);

  const handleClipLike = useCallback(
    async (clipId: any) => {
      if (!user) return;

      try {
        const { data: newLikesCount, error } = await supabase.rpc(
          "toggle_autoclip_like",
          {
            clip_id: clipId,
            user_id: user.id,
          }
        );

        if (error) throw error;

        setAutoclips((prev: any[]) =>
          prev.map((clip: { id: any; liked_users: string[] }) =>
            clip.id === clipId
              ? {
                  ...clip,
                  likes: newLikesCount,
                  liked_users: clip.liked_users?.includes(user.id)
                    ? clip.liked_users.filter((id: string) => id !== user.id)
                    : [...(clip.liked_users || []), user.id],
                }
              : clip
          )
        );
      } catch (error) {
        console.error("Error toggling autoclip like:", error);
      }
    },
    [user]
  );

  const trackCarView = useCallback(
    async (carId: any, userId: any) => {
      if (!carId || !userId) return;

      try {
        // Use different RPC function based on whether this is a rental car
        const rpcFunction = isRental ? "track_cars_view_rent" : "track_car_view";
        const { data, error } = await supabase.rpc(rpcFunction, {
          car_id: carId,
          user_id: userId,
        });

        if (error) throw error;

        if (data && onViewUpdate) {
          onViewUpdate(carId, data);
        }
      } catch (error) {
        console.error(`Error tracking ${isRental ? 'rental ' : ''}car view:`, error);
      }
    },
    [onViewUpdate, isRental]
  );

  useEffect(() => {
    if (car?.id && user?.id) {
      try {
        // Use a timeout to prevent blocking the UI
        const timer = setTimeout(() => {
          trackCarView(car.id, user.id);
        }, 1000);

        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({ y: 0, animated: false });
        }

        return () => clearTimeout(timer);
      } catch (error) {
        console.error('Error in car view tracking effect:', error);
      }
    }
  }, [car, user, trackCarView]);

  const fetchSimilarCars = useCallback(async () => {
    if (!car?.id || !car?.make) return;

    try {
      // Determine which table to query based on whether this is a rental car
      const tableName = isRental ? 'cars_rent' : 'cars';

      // First, try to find cars with same make, model, and year
      let { data: exactMatches, error: exactMatchError } = await supabase
        .from(tableName)
        .select("*, dealerships (name,logo,phone,location,latitude,longitude)")
        .eq("make", car.make)
        .eq("model", car.model)
        .eq("year", car.year)
        .neq("id", car.id)
        .eq("status", "available")
        .limit(5);

      if (exactMatchError) throw exactMatchError;

      if (exactMatches && exactMatches.length > 0) {
        const newCars = exactMatches.map((item) => ({
          ...item,
          dealership_name: item.dealerships?.name,
          dealership_logo: item.dealerships?.logo,
          dealership_phone: item.dealerships?.phone,
          dealership_location: item.dealerships?.location,
          dealership_latitude: item.dealerships?.latitude,
          dealership_longitude: item.dealerships?.longitude,
          listed_at: item.listed_at,
        }));
        setSimilarCars(newCars);
        return;
      }

      // If no exact matches, fall back to similarly priced cars
      const { data: priceMatches, error: priceMatchError } = await supabase
        .from(tableName)
        .select("*, dealerships (name,logo,phone,location,latitude,longitude)")
        .neq("id", car.id)
        .eq("status", "available")
        .gte("price", Math.floor(car.price * 0.8))
        .lte("price", Math.floor(car.price * 1.2))
        .limit(5);

      if (priceMatchError) throw priceMatchError;

      if (priceMatches && priceMatches.length > 0) {
        const newCars = priceMatches.map((item) => ({
          ...item,
          dealership_name: item.dealerships?.name,
          dealership_logo: item.dealerships?.logo,
          dealership_phone: item.dealerships?.phone,
          dealership_location: item.dealerships?.location,
          dealership_latitude: item.dealerships?.latitude,
          dealership_longitude: item.dealerships?.longitude,
          listed_at: item.listed_at,
        }));
        setSimilarCars(newCars);
      } else {
        setSimilarCars([]);
      }
    } catch (error) {
      console.error("Error fetching similar cars:", error);
      setSimilarCars([]);
    }
  }, [car?.id, car?.make, car?.model, car?.year, car?.price, isRental]);

  // Track call button clicks
  const trackCallClick = useCallback(
    async (carId: number) => {
      if (!user?.id || !carId) return;

      try {
        const { data, error } = await supabase.rpc("track_car_call", {
          car_id: carId,
          user_id: user.id,
        });

        if (error) throw error;
        console.log(`Call count updated: ${data}`);
      } catch (error) {
        console.error("Error tracking call click:", error);
      }
    },
    [user]
  );

  // Track WhatsApp button clicks
  const trackWhatsAppClick = useCallback(
    async (carId: number) => {
      if (!user?.id || !carId) return;

      try {
        const { data, error } = await supabase.rpc("track_car_whatsapp", {
          car_id: carId,
          user_id: user.id,
        });

        if (error) throw error;
        console.log(`WhatsApp count updated: ${data}`);
      } catch (error) {
        console.error("Error tracking WhatsApp click:", error);
      }
    },
    [user]
  );

  const fetchDealerCars = useCallback(async () => {
    // Only fetch dealer cars if this is a dealership listing
    if (!isDealershipCar || !car?.dealership_id || !car?.id) return;

    try {
      // Determine which table to query based on whether this is a rental car
      const tableName = isRental ? 'cars_rent' : 'cars';

      const { data, error } = await supabase
        .from(tableName)
        .select("*, dealerships (name,logo,phone,location,latitude,longitude)")
        .eq("dealership_id", car.dealership_id)
        .eq("status", "available")
        .neq("id", car.id)
        .limit(5);

      if (error) throw error;

      if (data) {
        const newCars = data.map((item) => ({
          ...item,
          dealership_name: item.dealerships?.name,
          dealership_logo: item.dealerships?.logo,
          dealership_phone: item.dealerships?.phone,
          dealership_location: item.dealerships?.location,
          dealership_latitude: item.dealerships?.latitude,
          dealership_longitude: item.dealerships?.longitude,
          listed_at: item.listed_at,
        }));
        setDealerCars(newCars);
      }
    } catch (error) {
      console.error("Error fetching dealer cars:", error);
      setDealerCars([]);
    }
  }, [isDealershipCar, car?.dealership_id, car?.id, isRental]);

  useEffect(() => {
    if (!car) return;

    // Staggered loading to avoid overwhelming the JS thread
    const loadData = async () => {
      try {
        // Wait a bit before loading similar cars
        await new Promise(resolve => setTimeout(resolve, 500));
        fetchSimilarCars().catch(err => console.error('Error fetching similar cars:', err));

        // Add more delay before loading dealer cars
        await new Promise(resolve => setTimeout(resolve, 500));
        fetchDealerCars().catch(err => console.error('Error fetching dealer cars:', err));
      } catch (error) {
        console.error('Error in staggered data loading:', error);
      }
    };

    loadData();
  }, [car, fetchSimilarCars, fetchDealerCars]);

  const handleDealershipPress = useCallback(() => {
    // Only allow navigation to dealership details for dealership cars
    if (!isDealershipCar || !car?.dealership_id) {
      return; // Silently return for user listings
    }

    try {
      router.push({
        pathname: "/(home)/(user)/DealershipDetails",
        params: { dealershipId: car.dealership_id },
      });
    } catch (error) {
      console.error('Navigation error:', error);
      Alert.alert('Error', 'Could not navigate to dealership details');
    }
  }, [isDealershipCar, router, car?.dealership_id]);

  const handleCall = useCallback(() => {
    if (!sellerInfo.phone) {
      Alert.alert("Phone number not available");
      return;
    }

    try {
      // Track the call click first
      if (car.id) {
        trackCallClick(car.id);
      }

      // Then proceed with the call
      Linking.openURL(`tel:${sellerInfo.phone}`);
    } catch (error) {
      console.error('Error making call:', error);
      Alert.alert('Error', 'Could not initiate call');
    }
  }, [sellerInfo.phone, car?.id, trackCallClick]);

  const handleShare = useCallback(async () => {
    if (!car) return;
  
    try {
      await shareCar(car);
    } catch (error) {
      console.error("Share error:", error);
      Alert.alert('Error', 'Failed to share car details');
    }
  }, [car]);

  // Improved maps handling for Android
  const handleOpenInMaps = useCallback(() => {
    try {
      // Get location based on seller type
      const latitude = isDealershipCar ? car.dealership_latitude : car.latitude;
      const longitude = isDealershipCar ? car.dealership_longitude : car.longitude;

      // Validate coordinates
      if (!latitude || !longitude ||
          isNaN(Number(latitude)) || isNaN(Number(longitude))) {
        Alert.alert("Location unavailable", "No valid location information available");
        return;
      }

      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      const label = encodeURIComponent(sellerInfo.name || "Location");

      // For Android, directly use Google Maps intent
      const url = `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
      Linking.openURL(url).catch(() => {
        // Fallback to Google Maps web URL if the intent fails
        const webUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
        Linking.openURL(webUrl).catch(err => {
          console.error('Error opening maps:', err);
          Alert.alert("Error", "Could not open maps application");
        });
      });
    } catch (error) {
      console.error("Error opening maps:", error);
      Alert.alert("Error", "Unable to open maps at this time");
    }
  }, [isDealershipCar, car, sellerInfo.name]);

  const handleOpenInGoogleMaps = useCallback(() => {
    try {
      // Get location based on seller type
      const latValue = isDealershipCar ? car?.dealership_latitude : car?.latitude;
      const lngValue = isDealershipCar ? car?.dealership_longitude : car?.longitude;

      const latitude = parseFloat(latValue) || 0;
      const longitude = parseFloat(lngValue) || 0;

      if (isNaN(latitude) || isNaN(longitude) || (latitude === 0 && longitude === 0)) {
        Alert.alert("Location unavailable", "No location information available");
        return;
      }

      const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
      Linking.openURL(url).catch((err) => {
        console.error("Error opening Google Maps:", err);
        Alert.alert("Error", "Could not open Google Maps");
      });
    } catch (error) {
      console.error("Error with map coordinates:", error);
      Alert.alert("Error", "Could not process map coordinates");
    }
  }, [isDealershipCar, car?.dealership_latitude, car?.dealership_longitude, car?.latitude, car?.longitude]);

  const renderCarItem = useCallback(
    ({ item }: any) => {
      if (!item?.id || !item?.images?.[0]) return null;

      return (
        <TouchableOpacity
          style={{
            marginRight: 12,
            marginTop: 8,
            width: 192,
            backgroundColor: isDarkMode ? '#333' : '#e5e5e5',
            borderRadius: 8,
            overflow: 'hidden'
          }}
          onPress={() => {
            try {
              router.push({
                pathname: "/(home)/(user)/CarDetails",
                params: {
                  carId: item.id,
                  isRental: isRental ? 'true' : 'false'
                },
              });
            } catch (error) {
              console.error('Navigation error:', error);
            }
          }}
        >
          <OptimizedImage
            source={{ uri: item.images[0] }}
            style={{ width: "100%", height: 128, borderRadius: 8 }}
            fallbackColor={isDarkMode ? '#222' : '#e0e0e0'}
          />
          <Text
            style={{
              color: isDarkMode ? '#fff' : '#000',
              fontWeight: 'bold',
              marginTop: 8,
              marginLeft: 8,
              marginBottom: 8
            }}
          >
            {item.year} {item.make} {item.model}
          </Text>
        </TouchableOpacity>
      );
    },
    [isDarkMode, router, isRental]
  );

  // Enhanced WhatsApp handling for Android
  const handleWhatsAppPress = useCallback(() => {
    if (!sellerInfo.phone) {
      Alert.alert('Phone number not available');
      return;
    }

    try {
      // Track the WhatsApp click first
      if (car.id) {
        trackWhatsAppClick(car.id);
      }

      let cleanedPhoneNumber = sellerInfo.phone.toString().replace(/\D/g, '');
      // Only add country code if not already present (user phones are stored with +961, dealer phones without)
      if (!cleanedPhoneNumber.startsWith('961')) {
        cleanedPhoneNumber = `961${cleanedPhoneNumber}`;
      }
      const message = getCarWhatsAppMessage(car);
      const webURL = `https://wa.me/${cleanedPhoneNumber}?text=${encodeURIComponent(message)}`;

      Linking.openURL(webURL).catch(() => {
        Alert.alert(
          'Error',
          'Unable to open WhatsApp. Please make sure it is installed on your device.'
        );
      });
    } catch (error) {
      console.error('Error opening WhatsApp:', error);
      Alert.alert('Error', 'Could not open WhatsApp');
    }
  }, [sellerInfo.phone, car, trackWhatsAppClick]);

  // Safer image modal for Android
  const renderImageModal = () => {
    if (selectedImageIndex === null || !car?.images?.[selectedImageIndex]) return null;

    return (
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'black',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}
      >
        <TouchableOpacity
          style={{
            position: 'absolute',
            top: 40,
            right: 20,
            zIndex: 1001,
            padding: 12,
            backgroundColor: 'rgba(0,0,0,0.5)',
            borderRadius: 25
          }}
          onPress={() => setSelectedImageIndex(null)}
        >
          <Ionicons name="close" size={30} color="white" />
        </TouchableOpacity>

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

        <View
          style={{
            position: 'absolute',
            bottom: 40,
            flexDirection: 'row',
            justifyContent: 'center',
            width: '100%'
          }}
        >
          {car.images.map((_: any, index: number) => (
            <View
              key={index}
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: index === selectedImageIndex ? '#D55004' : 'rgba(255,255,255,0.5)',
                marginHorizontal: 4
              }}
            />
          ))}
        </View>

        {selectedImageIndex > 0 && (
          <TouchableOpacity
            style={{
              position: 'absolute',
              left: 20,
              top: '50%',
              marginTop: -25,
              width: 50,
              height: 50,
              borderRadius: 25,
              backgroundColor: 'rgba(0,0,0,0.3)',
              justifyContent: 'center',
              alignItems: 'center'
            }}
            onPress={() => setSelectedImageIndex(selectedImageIndex - 1)}
          >
            <Ionicons name="chevron-back" size={30} color="white" />
          </TouchableOpacity>
        )}

        {selectedImageIndex < car.images.length - 1 && (
          <TouchableOpacity
            style={{
              position: 'absolute',
              right: 20,
              top: '50%',
              marginTop: -25,
              width: 50,
              height: 50,
              borderRadius: 25,
              backgroundColor: 'rgba(0,0,0,0.3)',
              justifyContent: 'center',
              alignItems: 'center'
            }}
            onPress={() => setSelectedImageIndex(selectedImageIndex + 1)}
          >
            <Ionicons name="chevron-forward" size={30} color="white" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

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

  // Main render with error boundary
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <View
        style={[
          styles.container,
          { backgroundColor: isDarkMode ? "#000000" : "#FFFFFF" },
        ]}
      >

        <ScrollView
          ref={scrollViewRef}
          style={{ borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
        >
          {/* Image Carousel - Enhanced for Android */}
          <View style={{ position: 'relative', marginBottom: 24, overflow: 'visible' }}>
            <View style={{ borderBottomLeftRadius: 20, borderBottomRightRadius: 20, overflow: 'hidden' }}>
              {car.images && car.images.length > 0 ? (
                <FlatList
                  data={car.images}
                  renderItem={({ item, index }) => (
                    <Pressable
                      onPress={() => setSelectedImageIndex(index)}
                      android_ripple={{ color: 'rgba(0,0,0,0.1)' }}
                    >
                      <OptimizedImage
                        source={{ uri: item }}
                        style={{ width, height: 350 }}
                        fallbackColor={isDarkMode ? '#222' : '#e0e0e0'}
                      />
                    </Pressable>
                  )}
                  horizontal
                  pagingEnabled
                  removeClippedSubviews={true}
                  maxToRenderPerBatch={3}
                  initialNumToRender={1}
                  windowSize={3}
                  showsHorizontalScrollIndicator={false}
                  onScroll={(event) => {
                    const newIndex = Math.round(
                      event.nativeEvent.contentOffset.x / width
                    );
                    if (newIndex !== activeImageIndex) {
                      setActiveImageIndex(newIndex);
                    }
                  }}
                  scrollEventThrottle={16}
                />
              ) : (
                <View style={{ width, height: 350, backgroundColor: isDarkMode ? '#222' : '#e0e0e0', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="image-outline" size={80} color={isDarkMode ? '#555' : '#999'} />
                  <Text style={{ color: isDarkMode ? '#999' : '#555', marginTop: 16 }}>No images available</Text>
                </View>
              )}

              {/* Pagination Dots */}
              {car.images && car.images.length > 1 && (
                <View style={{
                  position: 'absolute',
                  bottom: 32,
                  left: 0,
                  right: 0,
                  flexDirection: 'row',
                  justifyContent: 'center',
                  zIndex: 10
                }}>
                  {car.images.map((_, index) => (
                    <View
                      key={index}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: index === activeImageIndex ? "#D55004" : "rgba(255,255,255,0.5)",
                        marginHorizontal: 4
                      }}
                    />
                  ))}
                </View>
              )}
            </View>

            {/* Price Badge */}
            <View style={{
              position: 'absolute',
              bottom: -24,
              left: '50%',
              marginLeft: -64,
              backgroundColor: isDarkMode ? '#000' : '#fff',
              borderRadius: 9999,
              width: 128,
              height: 48,
              alignItems: 'center',
              justifyContent: 'center',
              elevation: 5,
              zIndex: 20
            }}>
              <Text style={{ color: '#D55004', fontSize: 18, fontWeight: 'bold' }}>
                {formatCarPrice(car.price, car.rental_period)}
              </Text>
            </View>
          </View>

          {/* Car Info */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {car.make && (
                <View style={{ justifyContent: 'center', alignItems: 'center', marginTop: 8, width: 50 }}>
                  <OptimizedImage
                    source={{ uri: getLogoUrl(car.make, !isDarkMode) }}
                    style={{ width: 60, height: 40 }}
                    fallbackColor="transparent"
                  />
                </View>
              )}
              <View style={{ marginLeft: 12 }}>

                <Text
                  style={{
                    fontSize: 20,
                    marginTop: 24,
                    fontWeight: 'bold',
                    color: isDarkMode ? "#fff" : "#000"
                  }}
                >
                 {car.year}  {car.make} {car.model}
                </Text>
                  {car.trim !== null && car.trim !== "" && (
                    <Text
                      className="mt-1"
                      style={{
                        fontSize: 14,
                        color: isDarkMode ? "#fff" : "#000",
                      }}
                    >
                      {car.trim}
                    </Text>
                  )}
                {/* Dynamic relative time display using listed_at */}
                {car.listed_at && (
                  <Text
                    style={{
                      fontSize: 12,
                      marginTop: 4,
                      color: isDarkMode ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)"
                    }}
                  >
                    Posted {getRelativeTime(car.listed_at)}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Technical Data */}
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
                  fontWeight: 'bold',
                  color: isDarkMode ? "#fff" : "#000"
                }}
              >
                Technical Data
              </Text>

              {autoclips.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedClip(autoclips[0]);
                    setShowClipModal(true);
                  }}
                  style={{
                    backgroundColor: "#D55004",
                    borderRadius: 20,
                    paddingVertical: 8,
                    paddingHorizontal: 16,
                    justifyContent: "center",
                    alignItems: "center",
                    flexDirection: "row",
                    elevation: 3
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
                marginTop: 20,
                backgroundColor: isDarkMode ? "#1c1c1c" : "#e9e9e9"
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

          {/* Description */}
          {car.description ? (
            <View style={{ marginTop: 32, paddingHorizontal: 16 }}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: 'bold',
                  color: isDarkMode ? "#fff" : "#000"
                }}
              >
                Description
              </Text>
              <Text style={{
                color: isDarkMode ? "#fff" : "#000",
                marginTop: 12
              }}>
                {car.description}
              </Text>
            </View>
          ) : null}

          {/* Features Section */}
          {renderFeatures()}

          {/* Location Section with Map - Enhanced for Android */}
          {isMapSectionVisible && (() => {
            // Get location based on seller type
            const latitude = isDealershipCar ? car.dealership_latitude : car.latitude;
            const longitude = isDealershipCar ? car.dealership_longitude : car.longitude;
            const hasLocation = latitude && longitude;

            // Only show map if we have valid location data
            if (!hasLocation) return null;

            return (
              <View style={{ marginTop: 32, paddingHorizontal: 16 }}>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: 'bold',
                    color: isDarkMode ? "#fff" : "#000",
                    marginBottom: 12
                  }}
                >
                  Location
                </Text>

                <SafeMapView
                  latitude={latitude}
                  longitude={longitude}
                  dealershipName={sellerInfo.name}
                  dealershipLocation={sellerInfo.location}
                  onMapPress={handleOpenInMaps}
                  isDarkMode={isDarkMode}
                />
              </View>
            );
          })()}

          {/* More from Dealership Section */}
          {dealerCars.length > 0 && isDealershipCar && (
            <View style={{ marginTop: 32, paddingHorizontal: 16 }}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: 'bold',
                  color: isDarkMode ? "#fff" : "#000",
                  marginBottom: 8
                }}
              >
                More from {sellerInfo.name || 'Dealership'}
              </Text>
              <FlatList
                data={dealerCars}
                renderItem={renderCarItem}
                keyExtractor={(item) => item.id.toString()}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={192 + 12}
                decelerationRate="fast"
                removeClippedSubviews={true}
                maxToRenderPerBatch={3}
                initialNumToRender={3}
              />
            </View>
          )}

          {/* Similar Cars Section */}
          {similarCars.length > 0 && (
            <View style={{ marginTop: 32, paddingHorizontal: 16, marginBottom: 160 }}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: 'bold',
                  color: isDarkMode ? "#fff" : "#000",
                  marginBottom: 8
                }}
              >
                {similarCars[0].make === car.make &&
                similarCars[0].model === car.model &&
                similarCars[0].year === car.year
                  ? "Explore Similar Cars"
                  : "Similarly Priced Cars"}
              </Text>
              <FlatList
                data={similarCars}
                renderItem={renderCarItem}
                keyExtractor={(item) => item.id.toString()}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={192 + 12}
                decelerationRate="fast"
                removeClippedSubviews={true}
                maxToRenderPerBatch={3}
                initialNumToRender={3}
              />
            </View>
          )}

          {/* Bottom spacing when similar cars section is not shown */}
          {similarCars.length === 0 && (
            <View style={{ marginBottom: 180 }} />
          )}
        </ScrollView>

        {/* Bottom Action Bar */}
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            width: '100%',
            padding: 16,
            paddingBottom: 24,
            flexDirection: 'column',
            justifyContent: 'space-around',
            alignItems: 'center',
            backgroundColor: isDarkMode ? "#000" : "#fff",
            borderTopWidth: 1,
            borderTopColor: isDarkMode ? "#333" : "#e0e0e0",
            elevation: 10
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <TouchableOpacity
              onPress={handleDealershipPress}
              disabled={!isDealershipCar}
              style={{ width: 60 }} // Fixed width for avatar container
            >
              {isDealershipCar && sellerInfo.logo ? (
                <OptimizedImage
                  source={{ uri: sellerInfo.logo }}
                  style={{ width: 50, height: 50, borderRadius: 25 }}
                  fallbackColor={isDarkMode ? '#333' : '#e0e0e0'}
                />
              ) : (
                <View style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  backgroundColor: isDarkMode ? '#333' : '#e0e0e0',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
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
              style={{ flex: 1, paddingLeft: 8 }}
            >
              <View style={{ alignItems: 'flex-start' }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: isDarkMode ? "#fff" : "#000",
                    textAlign: 'left'
                  }}
                  numberOfLines={2}
                >
                  {sellerInfo.name}
                </Text>

                {sellerInfo.location && (
                  <Text
                    style={{
                      fontSize: 13,
                      color: isDarkMode ? "#aaa" : "#555",
                      textAlign: 'left',
                      marginTop: 2
                    }}
                    numberOfLines={1}
                  >
                    <Ionicons name="location" size={12} color={isDarkMode ? "#aaa" : "#555"} /> {sellerInfo.location}
                  </Text>
                )}
              </View>
            </TouchableOpacity>

            <View style={{ width: 110, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
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
              <TouchableOpacity 
                onPress={async () => {
                  if (Platform.OS !== 'web') {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  handleShare();
                }} 
                className="items-center mx-1"
              >
                <Ionicons
                  name="share-social-outline"
                  size={27}
                  color={isDarkMode ? "#FFFFFF" : "#000000"}
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleOpenInGoogleMaps}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 12,
              marginTop: 16,
              borderRadius: 9999,
              backgroundColor: isDarkMode ? "#fff" : "#000",
              width: '100%',
              elevation: 3
            }}
          >
            <Ionicons
              name="navigate-outline"
              size={24}
              color={isDarkMode ? "black" : "white"}
            />
            <Text style={{
              color: isDarkMode ? "black" : "white",
              fontWeight: '600',
              marginLeft: 8
            }}>
              Open in Google Maps
            </Text>
          </TouchableOpacity>
        </View>

        {/* Autoclip Modal */}
        <AutoclipModal
          isVisible={showClipModal}
          onClose={() => {
            setShowClipModal(false);
            setSelectedClip(null);
          }}
          clip={selectedClip}
          onLikePress={() => selectedClip && handleClipLike(selectedClip.id)}
          isLiked={selectedClip?.liked_users?.includes(user?.id)}
        />

        {/* Image Modal - Simplified for Android */}
        {renderImageModal()}
      </View>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  map: {
    height: 200,
    borderRadius: 10,
    overflow: 'hidden'
  },
  scrollContent: {
    flexGrow: 1,
  },
  mainImage: {
    width: "100%",
    height: 300,
  },
  modalBackground: {
    flex: 1,
    backgroundColor: "black",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: 20,
    right: 20,
    zIndex: 1,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
  },
  fullscreenImage: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height * 0.7,
    resizeMode: "contain",
  },
  paginationContainer: {
    position: 'absolute',
    bottom: 40,
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -25,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f8f8',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    color: '#333',
  },
  errorMessage: {
    marginTop: 10,
    textAlign: 'center',
    color: '#666',
  },
  resetButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#D55004',
    borderRadius: 8,
  },
  resetButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default CarDetailScreen;