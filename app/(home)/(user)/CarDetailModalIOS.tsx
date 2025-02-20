import React, { useCallback, useEffect, useState, useRef } from "react";
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
  AppState,
  Modal,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "@clerk/clerk-expo";
import { supabase } from "@/utils/supabase";
import { debounce } from "@/utils/debounce";
import { useFavorites } from "@/utils/useFavorites";
import MapView, { Marker } from "react-native-maps";
import { useRouter } from "expo-router";
import { useTheme } from "@/utils/ThemeContext";
import { Image } from "expo-image";
import AutoclipModal from "@/components/AutoclipModal";

const { width } = Dimensions.get("window");

const OptimizedImage = React.memo(({ source, style, onLoad }: any) => {
  const [loaded, setLoaded] = useState(false);

  const handleLoad = useCallback(() => {
    setLoaded(true);
    onLoad?.();
  }, [onLoad]);

  const blurhash =
    "|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7azayj[ayj[j[ayofayayayj[fQj[ayayj[ayfjj[j[ayjuayj[";

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
        recyclingKey={`${source.uri}`}
        placeholder={blurhash}
        contentFit="cover"
        transition={200}
        cachePolicy="memory-disk"
      />
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

const ActionButton = ({ icon, onPress, text, isDarkMode }: any) => (
  <TouchableOpacity onPress={onPress} className="items-center mx-2">
    <Ionicons
      name={icon}
      size={27}
      color={isDarkMode ? "#FFFFFF" : "#000000"}
    />
  </TouchableOpacity>
);

const TechnicalDataItem = ({ icon, label, value, isDarkMode, isLast }: any) => (
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
    <Text className="dark:text-white font-semibold text-sm">{value}</Text>

    {!isLast && (
      <View className="absolute bottom-0 w-full h-[1] bg-[#c9c9c9]" />
    )}
  </View>
);

const CarDetailScreen = ({ car, onFavoritePress, onViewUpdate }: any) => {
  if (!car) return null;
  console.log(onFavoritePress);

  const { isDarkMode } = useTheme();
  const router = useRouter();
  const { user } = useUser();
  const { isFavorite } = useFavorites();
  const [similarCars, setSimilarCars] = useState<any>([]);
  const [dealerCars, setDealerCars] = useState<any>([]);
  const scrollViewRef = useRef<any>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [autoclips, setAutoclips] = useState<any>([]);
  const [selectedClip, setSelectedClip] = useState<any>(null);
  const [showClipModal, setShowClipModal] = useState<any>(false);
  const [selectedImage, setSelectedImage] = useState<any>(null);

  // Helper function to compute relative time from the listed_at property
  const getRelativeTime = (dateString: string) => {
    const now = new Date();
    const postedDate = new Date(dateString);
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
  };

  // Add fetchAutoclips function
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
    }
  }, [car]);

  // Add to useEffect for initial fetch
  useEffect(() => {
    if (car) {
      fetchAutoclips();
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

  useEffect(() => {
    const subscription = AppState.addEventListener("memoryWarning", () => {
      // Clear non-essential data
      setSimilarCars([]);
      setDealerCars([]);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const trackCarView = useCallback(
    async (carId: any, userId: any) => {
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
    if (car && user) {
      trackCarView(car.id, user.id);
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: 0, animated: false });
      }
    }
  }, [car, user, trackCarView]);

  const fetchSimilarCars = useCallback(async () => {
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
          dealership_name: item.dealerships.name,
          dealership_logo: item.dealerships.logo,
          dealership_phone: item.dealerships.phone,
          dealership_location: item.dealerships.location,
          dealership_latitude: item.dealerships.latitude,
          dealership_longitude: item.dealerships.longitude,
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
          dealership_name: item.dealerships.name,
          dealership_logo: item.dealerships.logo,
          dealership_phone: item.dealerships.phone,
          dealership_location: item.dealerships.location,
          dealership_latitude: item.dealerships.latitude,
          dealership_longitude: item.dealerships.longitude,
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
  }, [car.id, car.make, car.model, car.year, car.price]);

  const fetchDealerCars = useCallback(async () => {
    const { data, error } = await supabase
      .from("cars")
      .select("*, dealerships (name,logo,phone,location,latitude,longitude)")
      .eq("dealership_id", car.dealership_id)
      .neq("id", car.id)
      .limit(5);

    if (data) {
      const newCars = data.map((item) => ({
        ...item,
        dealership_name: item.dealerships.name,
        dealership_logo: item.dealerships.logo,
        dealership_phone: item.dealerships.phone,
        dealership_location: item.dealerships.location,
        dealership_latitude: item.dealerships.latitude,
        dealership_longitude: item.dealerships.longitude,
        listed_at: item.listed_at,
      }));
      setDealerCars(newCars);
    }
    if (error) console.error("Error fetching dealer cars:", error);
  }, [car.dealership_id, car.id]);

  useEffect(() => {
    return () => {
      // Clear image cache on unmount
      if (Platform.OS === "ios") {
        Image.clearMemoryCache();
      }
    };
  }, []);

  useEffect(() => {
    if (car) {
      // Optional: Add small delay for smoother transition
      const timer = setTimeout(() => {
        fetchSimilarCars();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [car, fetchSimilarCars]);

  // Fetch dealer cars after initial render (or after a slight delay)
  useEffect(() => {
    if (car) {
      // Optional: Stagger the loading slightly
      const timer = setTimeout(() => {
        fetchDealerCars();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [car, fetchDealerCars]);

  const handleDealershipPress = useCallback(() => {
    router.push({
      pathname: "/(home)/(user)/DealershipDetails",
      params: { dealershipId: car.dealership_id },
    });
  }, [router, car.dealership_id]);

  const debouncedTrackCarView = useCallback(
    debounce((carId: any, userId: any) => {
      trackCarView(carId, userId);
    }, 1000),
    [trackCarView]
  );

  const handleCall = useCallback(() => {
    if (car.dealership_phone) {
      Linking.openURL(`tel:${car.dealership_phone}`);
    } else {
      Alert.alert("Phone number not available");
    }
  }, [car.dealership_phone]);

  const handleChat = useCallback(() => {
    Alert.alert("Chat feature coming soon!");
  }, []);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `Check out this ${car.year} ${car.make} ${
          car.model
        } for $${car.price.toLocaleString()}!`,
        url: car.images[0],
      });
    } catch (error: any) {
      Alert.alert(error.message);
    }
  }, [car]);

  const handleOpenInMaps = useCallback(() => {
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
            Linking.openURL(appleMapsUrl);
          },
        },
        {
          text: "Google Maps",
          onPress: () => {
            const googleMapsUrl = `comgooglemaps://?q=${dealership_latitude},${dealership_longitude}&zoom=14`;
            Linking.openURL(googleMapsUrl).catch(() => {
              // If Google Maps app isn’t installed, fallback to browser
              const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${dealership_latitude},${dealership_longitude}`;
              Linking.openURL(fallbackUrl);
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
        Linking.openURL(fallbackUrl);
      });
    }
  }, [car.dealership_latitude, car.dealership_longitude]);

  const handleOpenInGoogleMaps = useCallback(() => {
    const latitude = car.dealership_latitude || 37.7749;
    const longitude = car.dealership_longitude || -122.4194;
    const url = `https://www.google.com/maps?q=${latitude},${longitude}`;

    Linking.openURL(url).catch((err) => {
      Alert.alert("Error", "Could not open Google Maps");
    });
  }, [car.dealership_latitude, car.dealership_longitude]);

  const renderCarItem = useCallback(
    ({ item }: any) => (
      <TouchableOpacity
        className={`${
          isDarkMode ? "bg-gray-800" : "bg-gray-200"
        } rounded-lg p-2 mr-4 w-48`}
        onPress={() => {
          router.push({
            pathname: "/(home)/(user)/CarDetails",
            params: { carId: item.id },
          });
        }}
      >
        <OptimizedImage
          source={{ uri: item.images[0] }}
          style={{ width: "100%", height: 128, borderRadius: 8 }}
        />
        <Text
          className={`${
            isDarkMode ? "text-white" : "text-black"
          } font-bold mt-2`}
        >
          {item.year} {item.make} {item.model}
        </Text>
      </TouchableOpacity>
    ),
    [isDarkMode, router]
  );

  const mapRegion = {
    latitude: car.dealership_latitude || 37.7749,
    longitude: car.dealership_longitude || -122.4194,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  const handleWhatsAppPress = useCallback(() => {
    if (car.dealership_phone) {
      // Format the message
      const message = `Hi, I'm interested in the ${car.year} ${car.make} ${
        car.model
      } listed for $${car.price.toLocaleString()}`;

      // Format the phone number (remove any non-numeric characters)
      const phoneNumber = car.dealership_phone;

      // Create the WhatsApp URL
      const url = `whatsapp://send?phone=+961${phoneNumber}&text=${encodeURIComponent(
        message
      )}`;

      // Try to open WhatsApp
      Linking.canOpenURL(url)
        .then((supported) => {
          if (supported) {
            return Linking.openURL(url);
          } else {
            // WhatsApp is not installed, try web version as fallback
            const webUrl = `https://wa.me/+961${phoneNumber}?text=${encodeURIComponent(
              message
            )}`;
            return Linking.openURL(webUrl);
          }
        })
        .catch(() => {
          Alert.alert(
            "Error",
            "Unable to open WhatsApp. Please make sure it is installed on your device."
          );
        });
    } else {
      Alert.alert("Phone number not available");
    }
  }, [car]);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDarkMode ? "#000000" : "#FFFFFF" },
      ]}
    >
      <TouchableOpacity
        onPress={() => router.back()}
        className="absolute top-12 left-4 z-50 rounded-full p-2"
        style={{
          backgroundColor: isDarkMode
            ? "rgba(255,255,255,0.5)"
            : "rgba(0,0,0,0.5)",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          elevation: 5,
        }}
      >
        <Ionicons
          name="arrow-back"
          size={20}
          color={isDarkMode ? "#FFFFFF" : "#FFFFFF"}
        />
      </TouchableOpacity>

      <ScrollView
        ref={scrollViewRef}
        className="rounded-b-lg"
        scrollEventThrottle={16}
      >
        {/* Image Carousel  */}
        <View className="relative mb-6 overflow-visible">
          <View className="rounded-b-[20px] overflow-hidden">
            <FlatList
              data={car.images}
              renderItem={({ item }) => (
                <Pressable onPress={() => setSelectedImage(item)}>
                  <View className="relative">
                    <OptimizedImage
                      source={{ uri: item }}
                      style={{ width: width, height: 350 }}
                    />
                    {/* Eye and heart icons positioned within the image */}
                    <View className="absolute top-12 right-0 flex-row items-center z-10">
                      <View className="flex-row items-center px-3 py-1 ">
                        <Ionicons name="eye" size={20} color="#FFFFFF" />
                        <Text className="text-white font-bold ml-1">
                          {car.views || 0}
                        </Text>
                      </View>
                      <TouchableOpacity
                        className="mr-3"
                        onPress={() => onFavoritePress(car.id)}
                      >
                        <Ionicons
                          name={isFavorite(car.id) ? "heart" : "heart-outline"}
                          size={20}
                          color={isFavorite(car.id) ? "red" : "white"}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </Pressable>
              )}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event) => {
                const newIndex = Math.round(
                  event.nativeEvent.contentOffset.x / width
                );
                setActiveImageIndex(newIndex);
              }}
            />
            {/* Pagination Dots */}
            <View className="absolute bottom-8 left-0 right-0 flex-row justify-center z-10">
              {car.images.map((_: any, index: React.Key | null | undefined) => (
                <View
                  key={index}
                  className={`w-2 h-2 rounded-full mx-1 ${
                    index === activeImageIndex ? "bg-red" : "bg-white/50"
                  }`}
                />
              ))}
            </View>
          </View>

          {/* Price Badge */}
          <View className="absolute -bottom-6 left-1/2 -translate-x-16 dark:bg-black bg-white rounded-full w-32 h-12 items-center justify-center shadow-lg z-20">
            <Text className="text-red text-lg font-bold">
              ${car.price.toLocaleString()}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between px-4">
          <View className="flex-row items-center">
            <View
              className="justify-center items-center mt-2"
              style={{ width: 50 }}
            >
              <OptimizedImage
                source={{ uri: getLogoUrl(car.make, !isDarkMode) }}
                style={{ width: 70, height: 50 }}
                contentFit="contain"
              />
            </View>
            <View className="ml-3">
              <Text
                className={`text-xl mt-6 font-bold ${
                  isDarkMode ? "text-white" : "text-black"
                }`}
              >
                {car.make} {car.model}
              </Text>
              <Text
                className={`text-sm ${
                  isDarkMode ? "text-white" : "text-black"
                }`}
              >
                {car.year}
              </Text>
              {/* Dynamic relative time display using listed_at */}
              <Text
                className={`text-xs mt-1 ${
                  isDarkMode ? "text-neutral-300" : "text-neutral-600"
                }`}
              >
                Posted {getRelativeTime(car.listed_at)}
              </Text>
            </View>
          </View>

          {/* Autoclip Button (Moved to Top Right) */}

          {/* View Clip Button (Aligned to Technical Data) */}
        </View>

        {/* Technical Data */}
        <View className="mt-8 mx-4">
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8",
            }}
          >
            <Text
              className={`text-lg font-bold ${
                isDarkMode ? "text-white" : "text-black"
              }`}
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
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 3.84,
                  elevation: 5,
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
            className={`rounded-lg mt-5 ${
              isDarkMode ? "bg-[#1c1c1c]" : "bg-[#e9e9e9]"
            }`}
          >
            {[
              {
                icon: "speedometer-outline",
                label: "Mileage",
                value: `${(car.mileage / 1000).toFixed(1)}k`,
              },
              {
                icon: "hardware-chip-outline",
                label: "Trans",
                value: car.transmission.substring(0, 4),
              },
              {
                icon: "car-sport-outline",
                label: "Drive",
                value: car.drivetrain,
              },
              {
                icon: "color-palette-outline",
                label: "Color",
                value: car.color,
              },
              {
                icon: "thermometer-outline",
                label: "Condition",
                value: car.condition,
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
        <View className="mt-6 px-4">
          {car.description ? (
            <>
              <Text
                className={`text-lg font-bold mb-2 ${
                  isDarkMode ? "text-white" : "text-black"
                }`}
              >
                Description
              </Text>
              <Text className={`${isDarkMode ? "text-white" : "text-black"}`}>
                {car.description}
              </Text>
            </>
          ) : null}
        </View>

        {/* Dealership Section */}
        <View className="mt-8 px-4">
          <Text
            className={`text-lg font-bold ${
              isDarkMode ? "text-white" : "text-black"
            }`}
          >
            Location
          </Text>
          <View style={{ flex: 1 }}>
            <MapView style={styles.map} region={mapRegion}>
              <Marker
                coordinate={{
                  latitude: car.dealership_latitude || 37.7749,
                  longitude: car.dealership_longitude || -122.4194,
                }}
                title={car.dealership_name}
                description={car.dealership_location}
              />
            </MapView>
          <TouchableOpacity
            onPress={handleOpenInMaps}
            className='absolute bottom-4 right-4 bg-red px-4 py-2 rounded-full flex-row items-center'>
            <Ionicons name='navigate' size={16} color='white' />
            <Text className='text-white ml-2'>Take Me There</Text>
          </TouchableOpacity>
          </View>
        </View>

        {/* Similar Cars Section */}
        {similarCars.length > 0 && (
          <View className="mt-8 px-4">
            <Text
              className={`text-xl font-bold ${
                isDarkMode ? "text-white" : "text-black"
              } mb-4`}
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
            />
          </View>
        )}

        {dealerCars.length > 0 && (
          <View className="mt-8 px-4 mb-40">
            <Text
              className={`text-xl font-bold ${
                isDarkMode ? "text-white" : "text-black"
              } mb-4`}
            >
              More from {car.dealership_name}
            </Text>
            <FlatList
              data={dealerCars}
              renderItem={renderCarItem}
              keyExtractor={(item) => item.id.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
            />
          </View>
        )}
      </ScrollView>

      {/* Bottom Action Bar */}
      <View
        className={`absolute bottom-0 p-8 w-full flex-col justify-around items-center py-4 border-t ${
          isDarkMode ? "bg-black" : "bg-white"
        }`}
      >
        <View className="flex-row items-center justify-between w-full">
          <View className="flex-row items-center flex-1">
            <TouchableOpacity onPress={handleDealershipPress}>
              <OptimizedImage
                source={{ uri: car.dealership_logo }}
                style={{ width: 50, height: 50, borderRadius: 25 }}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDealershipPress}>
              <View className="flex-1 ml-3">
                <Text
                  className={`text-base font-medium ${
                    isDarkMode ? "text-white" : "text-black"
                  }`}
                  numberOfLines={1}
                >
                  {car.dealership_name}
                </Text>

                <Text
                  className={`text-sm ${
                    isDarkMode ? "text-white" : "text-black"
                  } mr-7`}
                  numberOfLines={2}
                >
                  <Ionicons name="location" size={12} />
                  {car.dealership_location}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
          <View className="flex-row">
            <ActionButton
              icon="call-outline"
              onPress={handleCall}
              isDarkMode={isDarkMode}
            />
            <ActionButton
              icon="logo-whatsapp" // Using Ionicons WhatsApp logo
  
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
          className="flex-row items-center justify-center p-3 mt-4 rounded-full bg-black dark:bg-white w-full"
        >
          <Ionicons
            name="navigate-outline"
            size={24}
            color={isDarkMode ? "black" : "white"}
          />
          <Text className="text-white dark:text-black font-semibold ml-2">
            Open in Google Maps
          </Text>
        </TouchableOpacity>
      </View>
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
      {selectedImage && (
        <Modal
          visible={true}
          transparent={true}
          onRequestClose={() => setSelectedImage(null)}
        >
          <View style={styles.modalBackground}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setSelectedImage(null)}
            >
              <Ionicons name="close" size={40} color="white" />
            </TouchableOpacity>
            <Image
              source={{ uri: selectedImage }}
              style={styles.fullscreenImage}
              contentFit="contain"
            />
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
    marginVertical: 10,
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
    top: 40,
    right: 20,
    zIndex: 1,
  },
  fullscreenImage: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
});

export default CarDetailScreen;
