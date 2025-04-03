// app/(home)/(user)/CarDetailModal.android.tsx
import React, { useCallback, useEffect, useState, useRef, lazy, Suspense } from "react";
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
  ActivityIndicator
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

// Dynamically import MapView to prevent it from blocking the main thread
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

const { width } = Dimensions.get("window");

const VEHICLE_FEATURES = [
  { id: 'heated_seats', label: 'Heated Seats', icon: 'car-seat-heater' },
  { id: 'keyless_entry', label: 'Keyless Entry', icon: 'key-wireless' },
  { id: 'keyless_start', label: 'Keyless Start', icon: 'power' },
  { id: 'power_mirrors', label: 'Power Mirrors', icon: 'car-side' },
  { id: 'power_steering', label: 'Power Steering', icon: 'steering' },
  { id: 'power_windows', label: 'Power Windows', icon: 'window-maximize' },
  { id: 'backup_camera', label: 'Backup Camera', icon: 'camera' },
  { id: 'bluetooth', label: 'Bluetooth', icon: 'bluetooth' },
  { id: 'cruise_control', label: 'Cruise Control', icon: 'speedometer' },
  { id: 'navigation', label: 'Navigation System', icon: 'map-marker' },
  { id: 'sunroof', label: 'Sunroof', icon: 'weather-sunny' },
  { id: 'leather_seats', label: 'Leather Seats', icon: 'car-seat' },
  { id: 'third_row_seats', label: 'Third Row Seats', icon: 'seat-passenger' },
  { id: 'parking_sensors', label: 'Parking Sensors', icon: 'parking' },
  { id: 'lane_assist', label: 'Lane Departure Warning', icon: 'road-variant' },
  { id: 'blind_spot', label: 'Blind Spot Monitoring', icon: 'eye-off' },
  { id: 'apple_carplay', label: 'Apple CarPlay', icon: 'apple' },
  { id: 'android_auto', label: 'Android Auto', icon: 'android' },
  { id: 'premium_audio', label: 'Premium Audio', icon: 'speaker' },
  { id: 'remote_start', label: 'Remote Start', icon: 'remote' },
];

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

// Car logo loader with fallbacks
const getLogoUrl = (make: string, isLightMode: boolean) => {
  if (!make) return ''; // Prevent crashes with undefined

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
const SafeMapView = React.memo(({ latitude, longitude, dealershipName, dealershipLocation, onMapPress, isDarkMode }) => {
  const [mapError, setMapError] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    // Add a timeout to detect extremely slow loading maps
    const timeout = setTimeout(() => {
      if (!mapLoaded) {
        setMapError(true);
      }
    }, 5000);

    return () => clearTimeout(timeout);
  }, [mapLoaded]);

  if (mapError || !latitude || !longitude || isNaN(Number(latitude)) || isNaN(Number(longitude))) {
    return (
      <View style={{
        height: 200,
        borderRadius: 10,
        backgroundColor: isDarkMode ? '#333' : '#e0e0e0',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <Ionicons name="location-outline" size={40} color="#999" />
        <Text style={{ marginTop: 8, color: '#666' }}>
          Location information unavailable
        </Text>
      </View>
    );
  }

  // Try-catch to handle potential native errors that aren't caught by error handlers
  try {
    return (
      <View style={{ height: 200, borderRadius: 10, overflow: 'hidden' }}>
        <MapView
          style={{ flex: 1 }}
          provider={PROVIDER_GOOGLE}
          region={{
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            latitudeDelta: 0.01,
            longitudeDelta: 0.01
          }}
          liteMode={true}
          onMapReady={() => setMapLoaded(true)}
          onError={() => setMapError(true)}
        >
          <Marker
            coordinate={{
              latitude: parseFloat(latitude),
              longitude: parseFloat(longitude)
            }}
            title={dealershipName || "Dealership"}
            description={dealershipLocation || ""}
          />
        </MapView>

        <TouchableOpacity
          onPress={onMapPress}
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
  } catch (error) {
    console.error('Error rendering map:', error);
    return (
      <View style={{
        height: 200,
        borderRadius: 10,
        backgroundColor: isDarkMode ? '#333' : '#e0e0e0',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <Ionicons name="warning-outline" size={40} color="#999" />
        <Text style={{ marginTop: 8, color: '#666' }}>
          Error loading map
        </Text>
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
const CarDetailScreen = ({ car, onFavoritePress, onViewUpdate }: any) => {
  if (!car) return null;

  const { isDarkMode } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { isFavorite } = useFavorites();
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
      if (!dateString) return "Recently";

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
      console.error('Error calculating relative time:', error);
      return "Recently";
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
      // First, try to find cars with same make, model, and year
      let { data: exactMatches, error: exactMatchError } = await supabase
        .from("cars")
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
        .from("cars")
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
  }, [car?.id, car?.make, car?.model, car?.year, car?.price]);

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
    if (!car?.dealership_id || !car?.id) return;

    try {
      const { data, error } = await supabase
        .from("cars")
        .select("*, dealerships (name,logo,phone,location,latitude,longitude)")
        .eq("dealership_id", car.dealership_id)
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
  }, [car?.dealership_id, car?.id]);

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
    if (!car?.dealership_id) {
      Alert.alert('Error', 'Dealership information not available');
      return;
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
  }, [router, car?.dealership_id]);

  const handleCall = useCallback(() => {
    if (!car?.dealership_phone) {
      Alert.alert("Phone number not available");
      return;
    }

    try {
      // Track the call click first
      if (car.id) {
        trackCallClick(car.id);
      }

      // Then proceed with the call
      Linking.openURL(`tel:${car.dealership_phone}`);
    } catch (error) {
      console.error('Error making call:', error);
      Alert.alert('Error', 'Could not initiate call');
    }
  }, [car?.dealership_phone, car?.id, trackCallClick]);

  const handleShare = useCallback(async () => {
    if (!car) return;

    try {
      await Share.share({
        message: `Check out this ${car.year} ${car.make} ${
          car.model
        } for $${car.price ? car.price.toLocaleString() : 'N/A'}!
        at ${car.dealership_name || 'Dealership'} in ${car.dealership_location || 'Location'}
        `,
      });
    } catch (error: any) {
      console.error('Share error:', error);
      Alert.alert('Error', error.message || 'Could not share this car');
    }
  }, [car]);

  // Improved maps handling for Android
  const handleOpenInMaps = useCallback(() => {
    try {
      const { dealership_latitude, dealership_longitude } = car || {};

      // Validate coordinates
      if (!dealership_latitude || !dealership_longitude ||
          isNaN(Number(dealership_latitude)) || isNaN(Number(dealership_longitude))) {
        Alert.alert("Location unavailable", "No valid location information available");
        return;
      }

      const lat = parseFloat(dealership_latitude);
      const lng = parseFloat(dealership_longitude);
      const label = encodeURIComponent(car.dealership_name || "Dealership");

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
  }, [car]);

  const handleOpenInGoogleMaps = useCallback(() => {
    try {
      const latitude = parseFloat(car?.dealership_latitude) || 0;
      const longitude = parseFloat(car?.dealership_longitude) || 0;

      if (isNaN(latitude) || isNaN(longitude)) {
        Alert.alert("Error", "Invalid location coordinates");
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
  }, [car?.dealership_latitude, car?.dealership_longitude]);

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
                params: { carId: item.id },
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
    [isDarkMode, router]
  );

  // Enhanced WhatsApp handling for Android
  const handleWhatsAppPress = useCallback(() => {
    if (!car?.dealership_phone) {
      Alert.alert('Phone number not available');
      return;
    }

    try {
      // Track the WhatsApp click first
      if (car.id) {
        trackWhatsAppClick(car.id);
      }

      const cleanedPhoneNumber = car.dealership_phone.toString().replace(/\D/g, '');
      const message = `Hi, I'm interested in the ${car.year} ${car.make} ${car.model} listed for $${car.price ? car.price.toLocaleString() : 'N/A'} on Fleet`;
      const webURL = `https://wa.me/961${cleanedPhoneNumber}?text=${encodeURIComponent(message)}`;

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
  }, [car, trackWhatsAppClick]);

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

        <Image
          source={{ uri: car.images[selectedImageIndex] }}
          style={{
            width: Dimensions.get('window').width,
            height: Dimensions.get('window').height * 0.7,
            resizeMode: 'contain'
          }}
          defaultSource={require('@/assets/placeholder.jpg')}
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

  // Render features section safely
  const renderFeatures = () => {
    if (!car?.features || !Array.isArray(car.features) || car.features.length === 0) {
      return null;
    }

    try {
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
            Features
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {car.features.map((featureId, index) => {
              const feature = VEHICLE_FEATURES.find(f => f.id === featureId);
              if (!feature) return null;

              return (
                <View
                  key={index}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginRight: 8,
                    marginBottom: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: isDarkMode ? "#1c1c1c" : "#e9e9e9"
                  }}
                >
                  <MaterialCommunityIcons
                    name={feature.icon || "check-circle-outline"}
                    size={18}
                    color="#D55004"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={{ color: isDarkMode ? "#fff" : "#000" }}>
                    {feature.label || featureId}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      );
    } catch (error) {
      console.error('Error rendering features:', error);
      return null;
    }
  };

  // Main render with error boundary
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <View
        style={[
          styles.container,
          { backgroundColor: isDarkMode ? "#000000" : "#FFFFFF" },
        ]}
      >
        {/* Back button */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            position: 'absolute',
            top: 40,
            left: 16,
            zIndex: 50,
            backgroundColor: 'rgba(0,0,0,0.5)',
            borderRadius: 25,
            padding: 8,
            elevation: 5
          }}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color="#FFFFFF"
          />
        </TouchableOpacity>

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
                ${car.price ? car.price.toLocaleString() : 'N/A'}
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
                  {car.make} {car.model}
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: isDarkMode ? "#fff" : "#000"
                  }}
                >
                  {car.year}
                </Text>
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
              {[
                {
                  icon: "speedometer-outline",
                  label: "Mileage",
                  value: car.mileage ? `${(car.mileage / 1000).toFixed(1)}k` : "N/A",
                },
                {
                  icon: "hardware-chip-outline",
                  label: "Trans",
                  value: car.transmission ? car.transmission.substring(0, 4) : "N/A",
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
                  value: car.source || "Local",
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
          {isMapSectionVisible && (
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
                latitude={car.dealership_latitude}
                longitude={car.dealership_longitude}
                dealershipName={car.dealership_name}
                dealershipLocation={car.dealership_location}
                onMapPress={handleOpenInMaps}
                isDarkMode={isDarkMode}
              />
            </View>
          )}

          {/* Similar Cars Section */}
          {similarCars.length > 0 && (
            <View style={{ marginTop: 32, paddingHorizontal: 16 }}>
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

          {dealerCars.length > 0 && (
            <View style={{ marginTop: 32, paddingHorizontal: 16, marginBottom: 160 }}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: 'bold',
                  color: isDarkMode ? "#fff" : "#000",
                  marginBottom: 8
                }}
              >
                More from {car.dealership_name || 'Dealership'}
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
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <TouchableOpacity onPress={handleDealershipPress}>
                {car.dealership_logo ? (
                  <OptimizedImage
                    source={{ uri: car.dealership_logo }}
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
                    <Ionicons name="business-outline" size={24} color={isDarkMode ? '#999' : '#555'} />
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDealershipPress}>
                <View style={{ marginLeft: 12 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '500',
                      color: isDarkMode ? "#fff" : "#000"
                    }}
                    numberOfLines={1}
                  >
                    {car.dealership_name || 'Dealership'}
                  </Text>

                  <Text
                    style={{
                      fontSize: 14,
                      color: isDarkMode ? "#fff" : "#000",
                      marginRight: 28
                    }}
                    numberOfLines={2}
                  >
                    <Ionicons name="location" size={12} /> {car.dealership_location || 'Location not available'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row' }}>
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