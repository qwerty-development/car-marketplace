import React, {
  useMemo,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import {
  View,
  Text,
  Dimensions,
  Linking,
  Alert,
  FlatList,
  Image,
  ActivityIndicator,
  Pressable,
  Share,
  Animated,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { styled } from "nativewind";
import { useTheme } from "@/utils/ThemeContext";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useCarDetails } from "@/hooks/useCarDetails";
import { useAuth } from "@/utils/AuthContext";
import { supabase } from "@/utils/supabase";
import * as Haptics from 'expo-haptics';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledImage = styled(Image);
const StyledPressable = styled(Pressable);

const MAX_IMAGES = 3;

const OptimizedImage = ({ source, style, onLoad }: any) => {
  const [loaded, setLoaded] = useState(false);
  const { isDarkMode } = useTheme();

  const handleLoad = useCallback(() => {
    setLoaded(true);
    onLoad?.();
  }, [onLoad]);

  return (
    <View style={[style, { overflow: "hidden" }]} className="bg-neutral-800">
      <StyledImage
        source={source}
        className="w-full h-full bg-neutral-800"
        style={{ opacity: loaded ? 1 : 0 }}
        onLoad={handleLoad}
        resizeMode="cover"
      />
    </View>
  );
};

const SpecItem = ({
  icon,
  title,
  value,
  isDarkMode,
  iconLibrary = "Ionicons",
}: any) => (
  <StyledView 
    className="flex-1 items-center justify-center"
    style={{
      minHeight: 80,
      paddingHorizontal: 8,
      paddingVertical: 12,
    }}
  >
    <StyledView 
      className="items-center justify-center"
      style={{
        height: 32,
        marginBottom: 8,
      }}
    >
      {iconLibrary === "MaterialCommunityIcons" ? (
        <MaterialCommunityIcons
          name={icon}
          size={26}
          color={isDarkMode ? "#FFFFFF" : "#000000"}
        />
      ) : (
        <Ionicons
          name={icon}
          size={26}
          color={isDarkMode ? "#FFFFFF" : "#000000"}
        />
      )}
    </StyledView>
    
    <StyledText
      className={`text-xs font-medium text-center ${
        isDarkMode ? "text-white" : "text-black"
      }`}
      style={{
        marginBottom: 4,
        lineHeight: 16,
        minHeight: 16,
      }}
      numberOfLines={1}
    >
      {title}
    </StyledText>
    
    <StyledText
      className={`text-sm font-semibold text-center ${
        isDarkMode ? "text-white" : "text-black"
      }`}
      style={{
        lineHeight: 18,
        minHeight: 18,
      }}
      numberOfLines={1}
    >
      {value}
    </StyledText>
  </StyledView>
);

const ActionButton = ({ icon, text, onPress, isDarkMode }: any) => (
  <StyledPressable
    onPress={async () => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }}
    className="items-center justify-center active:opacity-70"
    style={{
      width: 44,
      height: 44,
      borderRadius: 22,
    }}
  >
    <Ionicons
      name={icon}
      size={24}
      color={isDarkMode ? "#FFFFFF" : "#000000"}
    />
  </StyledPressable>
);

export default function CarCard({
  car,
  onFavoritePress,
  isFavorite,
  isDealer = false,
  index = 0,
}: any) {
  const { isDarkMode } = useTheme();
  
  // Improved animation values with better spring physics
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  
  const { user } = useAuth();
  const router = useRouter();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const flatListRef = useRef(null);
  const { prefetchCarDetails } = useCarDetails();

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const cardWidth = windowWidth - 32;

  const imageHeight = useMemo(() => {
    const baseHeight = 260;
    const isTablet = windowWidth >= 768;
    if (isTablet) {
      return 600;
    }
    return baseHeight;
  }, [windowWidth, cardWidth]);

  // Much better entrance animation - smooth and responsive
  useEffect(() => {
    // Use spring animation for more natural feel
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: Math.min(index * 50, 200), // Reduced delay and capped max delay
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        delay: Math.min(index * 50, 200),
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 400,
        delay: Math.min(index * 50, 200),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Track call button clicks
  const trackCallClick = useCallback(
    async (carId: number) => {
      if (!user) return;

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
      if (!user) return;

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

  const handleCardPress = useCallback(async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Add subtle press animation
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.98,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
      
      const prefetchedData = await prefetchCarDetails(car.id);

      router.push({
        pathname: isDealer
          ? "/(home)/(dealer)/CarDetails"
          : "/(home)/(user)/CarDetails",
        params: {
          carId: car.id,
          isDealerView: isDealer,
          prefetchedData: JSON.stringify(prefetchedData),
        },
      });
    } catch (error) {
      console.error("Error navigating to car details:", error);
      router.push({
        pathname: isDealer
          ? "/(home)/(dealer)/CarDetails"
          : "/(home)/(user)/CarDetails",
        params: {
          carId: car.id,
          isDealerView: isDealer,
        },
      });
    }
  }, [router, car, isDealer, prefetchCarDetails, scaleAnim]);

  const handleCall = useCallback(() => {
    if (car.dealership_phone) {
      trackCallClick(car.id);
      Linking.openURL(`tel:${car.dealership_phone}`);
    } else {
      Alert.alert("Phone number not available");
    }
  }, [car.dealership_phone, car.id, trackCallClick]);

  const handleShare = useCallback(async () => {
    if (!car) return;

    try {
      const shareUrl = `https://www.fleetapp.me/cars/${car.id}`;

      const message =
        `Check out this ${car.year} ${car.make} ${car.model} for $${
          car.price ? car.price.toLocaleString() : "N/A"
        }!\n` +
        `at ${car.dealership_name || "Dealership"} in ${
          car.dealership_location || "Location"
        }\n`;

      await Share.share({
        message,
        url: shareUrl,
        title: `${car.year} ${car.make} ${car.model}`,
      });
    } catch (error) {
      console.error("Share error:", error);
      Alert.alert("Error", "Failed to share car details");
    }
  }, [car]);
  
  const handleDealershipPress = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const route = isDealer
      ? "/(home)/(dealer)/DealershipDetails"
      : "/(home)/(user)/DealershipDetails";
    router.push({
      pathname: route,
      params: { dealershipId: car.dealership_id },
    });
  }, [isDealer, router, car.dealership_id]);

  const handleFavoritePress = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Add favorite button animation
    const favoriteScale = new Animated.Value(1);
    Animated.sequence([
      Animated.timing(favoriteScale, {
        toValue: 1.2,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(favoriteScale, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
    
    onFavoritePress(car.id);
  }, [onFavoritePress, car.id]);

  const formattedLocation = useMemo(() => {
    if (car.dealership_location?.length > 20) {
      return (
        car.dealership_location.slice(0, 20) +
        "\n" +
        car.dealership_location.slice(20)
      );
    }
    return car.dealership_location;
  }, [car.dealership_location]);

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentImageIndex(viewableItems[0].index);
    }
  }, []);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const displayedImages = useMemo(
    () => car.images.slice(0, MAX_IMAGES),
    [car.images]
  );

  const renderImage = useCallback(
    ({ item }: any) => (
      <Pressable onPress={handleCardPress} className="bg-neutral-800">
        <View className="relative bg-neutral-800">
          <OptimizedImage
            source={{ uri: item }}
            style={{ width: cardWidth, height: imageHeight }}
          />

          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.8)"]}
            className="absolute bottom-0 left-0 right-0 h-40"
          />

          {/* Price Badge */}
          <View className="absolute top-4 right-4 z-10">
            <StyledView className="bg-red/90 px-4 py-2.5 rounded-2xl shadow-lg">
              <StyledText className="text-white text-lg font-extrabold">
                ${car.price.toLocaleString()}
              </StyledText>
            </StyledView>
          </View>

          {/* Image Counter */}
          {displayedImages.length > 1 && (
            <View className="absolute bottom-4 right-4 z-10 bg-night/60 px-3 py-1 rounded-full">
              <StyledText className="text-white text-sm font-medium">
                {currentImageIndex + 1}/{displayedImages.length}
              </StyledText>
            </View>
          )}

          {/* Car Info */}
          <View className="absolute bottom-0 w-full p-5">
            <View className="pr-28">
              <StyledText
                className="text-white text-2xl font-bold mb-1.5"
                numberOfLines={1}
              >
                {car.make} {car.model}
              </StyledText>
              <View className="flex-row items-center space-x-4">
                <View className="flex-row items-center">
                  <Ionicons name="eye-outline" size={18} color="#FFFFFF" />
                  <StyledText className="text-neutral-200 text-sm ml-1.5">
                    {car.views || 0}
                  </StyledText>
                </View>
                <View className="flex-row items-center">
                  <Ionicons name="heart-outline" size={18} color="#FFFFFF" />
                  <StyledText className="text-neutral-200 text-sm ml-1.5">
                    {car.likes || 0}
                  </StyledText>
                </View>
              </View>
            </View>
          </View>

          {/* Favorite Button */}
          {!isDealer && (
            <StyledPressable
              onPress={handleFavoritePress}
              className={`absolute top-4 left-4 active:opacity-70`}
            >
              <Ionicons
                name={isFavorite ? "heart-sharp" : "heart-outline"}
                size={30}
                color={
                  isFavorite ? "#D55004" : isDarkMode ? "#9d174d" : "#f43f5e"
                }
              />
            </StyledPressable>
          )}
        </View>
      </Pressable>
    ),
    [
      car,
      isFavorite,
      isDealer,
      handleFavoritePress,
      isDarkMode,
      handleCardPress,
      displayedImages.length,
      currentImageIndex,
      cardWidth,
      imageHeight,
    ]
  );

  const handleWhatsAppPress = useCallback(() => {
    if (car?.dealership_phone) {
      if (trackWhatsAppClick) {
        trackWhatsAppClick(car.id);
      }

      const cleanedPhoneNumber = car.dealership_phone
        .toString()
        .replace(/\D/g, "");

      const fullMessage = `Hi, I'm interested in the ${car.year} ${car.make} ${
        car.model
      } listed for $${car.price.toLocaleString()} on Fleet`;
      const encodedMessage = encodeURIComponent(fullMessage);

      const webURL = `https://wa.me/961${cleanedPhoneNumber}?text=${encodedMessage}`;

      Linking.openURL(webURL).catch(() => {
        Alert.alert(
          "Error",
          "Unable to open WhatsApp. Please make sure it is installed on your device."
        );
      });
    } else {
      Alert.alert("Error", "Phone number not available for this car.");
    }
  }, [car, trackWhatsAppClick]);

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [
          { translateY },
          { scale: scaleAnim }
        ],
      }}
    >
      <StyledView
        className={`mx-4 my-3 ${
          isDarkMode ? "bg-[#242424]" : "bg-[#e1e1e1]"
        } rounded-3xl overflow-hidden shadow-xl`}
      >
        <FlatList
          ref={flatListRef}
          data={displayedImages}
          renderItem={renderImage}
          keyExtractor={(item, index) => index.toString()}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          windowSize={3}
          removeClippedSubviews={true}
          decelerationRate="fast"
          snapToInterval={cardWidth}
          snapToAlignment="center"
          bounces={false}
        />

        <StyledPressable
          onPress={handleCardPress}
          className="active:opacity-90"
        >
          {/* Specs Grid */}
          <StyledView 
            className="flex-row"
            style={{
              marginTop: 16,
              marginBottom: 8,
              paddingHorizontal: 12,
            }}
          >
            <SpecItem
              title="Year"
              icon="calendar-outline"
              value={car.year}
              isDarkMode={isDarkMode}
              iconLibrary="Ionicons"
            />
            <SpecItem
              title="Mileage"
              icon="highway"
              value={`${(car.mileage / 1000).toFixed(1)}k`}
              isDarkMode={isDarkMode}
              iconLibrary="MaterialCommunityIcons"
            />
            <SpecItem
              title="Transmission"
              icon="car-shift-pattern"
              value={
                car.transmission === "Automatic"
                  ? "Auto"
                  : car.transmission === "Manual"
                  ? "Manual"
                  : car.transmission
              }
              isDarkMode={isDarkMode}
              iconLibrary="MaterialCommunityIcons"
            />
            <SpecItem
              title="Condition"
              icon="car-wrench"
              value={car.condition}
              isDarkMode={isDarkMode}
              iconLibrary="MaterialCommunityIcons"
            />
          </StyledView>

          {/* Dealership Info */}
          <StyledView
            className={`p-3 pt-2 ${
              isDarkMode ? "bg-[#2b2b2b]" : "bg-[#d1d1d1]"
            } rounded-t-3xl`}
          >
            <StyledView className="flex-row items-center justify-between">
              {car.dealership_logo && (
                <Pressable onPress={handleDealershipPress} className="mr-3">
                  <StyledImage
                    source={{ uri: car.dealership_logo }}
                    style={{ width: 48, height: 48 }}
                    className="rounded-full border border-textgray/20"
                    resizeMode="cover"
                  />
                </Pressable>
              )}

              <StyledView className="flex-1 ml-2">
                <StyledText
                  className={`text-base font-semibold ${
                    isDarkMode ? "text-white" : "text-black"
                  } mb-0.5`}
                  numberOfLines={2}
                >
                  {car.dealership_name}
                </StyledText>
                <StyledText
                  className={`text-sm ${
                    isDarkMode ? "text-white/80" : "text-black"
                  }`}
                  numberOfLines={2}
                >
                  {formattedLocation}
                </StyledText>
              </StyledView>

              <StyledView 
                className="flex-row items-center"
                style={{ gap: 8 }}
              >
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
              </StyledView>
            </StyledView>
          </StyledView>
        </StyledPressable>
      </StyledView>
    </Animated.View>
  );
}