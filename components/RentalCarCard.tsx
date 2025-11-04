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
import { useLanguage } from '@/utils/LanguageContext';
import i18n from '@/utils/i18n';
import { useTranslation } from 'react-i18next';
import { useCarDetails } from "@/hooks/useCarDetails";
import { useAuth } from "@/utils/AuthContext";
import { supabase } from "@/utils/supabase";
import { shareCar } from "@/utils/centralizedSharing";
import { getLogoUrl } from "@/hooks/getLogoUrl";
import * as Haptics from 'expo-haptics';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledImage = styled(Image);
const StyledPressable = styled(Pressable);

const MAX_IMAGES = 3;

const OptimizedImage = ({ source, style, onLoad, fallbackColor = 'transparent' }: any) => {
  const [loaded, setLoaded] = useState(false);
  const { isDarkMode } = useTheme();

  const handleLoad = useCallback(() => {
    setLoaded(true);
    onLoad?.();
  }, [onLoad]);

  return (
    <View style={[style, { overflow: "hidden", backgroundColor: fallbackColor }]}>
      <StyledImage
        source={source}
        className="w-full h-full"
        style={{ opacity: loaded ? 1 : 0, backgroundColor: fallbackColor }}
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

// Helper function to format rental period display
const formatRentalPeriod = (period: string) => {
  const periodMap: { [key: string]: string } = {
    'hourly': 'Hour',
    'daily': 'Day',
    'weekly': 'Week',
    'monthly': 'Month',
  };
  return periodMap[period.toLowerCase()] || period;
};

export default function RentalCarCard({
  car,
  onFavoritePress,
  isFavorite,
  isDealer = false,
  index = 0,
  showRentedBanner = false,
  disableActions = false,
}: any) {
  const { isDarkMode } = useTheme();
  const { language } = useLanguage();
  const { t } = useTranslation();
  
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

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: Math.min(index * 50, 200),
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

  const trackCallClick = useCallback(
    async (carId: number) => {
      if (!user) return;

      try {
        // Note: You might want to create a separate RPC for rental cars
        const { data, error } = await supabase.rpc("track_car_call", {
          car_id: carId,
          user_id: user.id,
        });

        if (error) throw error;
      } catch (error) {
        console.error("Error tracking call click:", error);
      }
    },
    [user]
  );

  const trackWhatsAppClick = useCallback(
    async (carId: number) => {
      if (!user) return;

      try {
        const { data, error } = await supabase.rpc("track_car_whatsapp", {
          car_id: carId,
          user_id: user.id,
        });

        if (error) throw error;
      } catch (error) {
        console.error("Error tracking WhatsApp click:", error);
      }
    },
    [user]
  );

  const handleCardPress = useCallback(async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
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
          isRental: 'true', // Flag to indicate this is a rental car
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
          isRental: 'true',
        },
      });
    }
  }, [router, car, isDealer, prefetchCarDetails, scaleAnim]);

  const handleCall = useCallback(() => {
    if (car.dealership_phone) {
      trackCallClick(car.id);
      Linking.openURL(`tel:${car.dealership_phone}`);
    } else {
      Alert.alert(t('common.phone_not_available'));
    }
  }, [car.dealership_phone, car.id, trackCallClick, t]);

  const handleShare = useCallback(async () => {
    if (!car) return;

    try {
      await shareCar(car);
    } catch (error) {
      console.error("Share error:", error);
      Alert.alert(t('common.error'), t('common.failed_share_car'));
    }
  }, [car, t]);
  
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

  const handleWhatsAppPress = useCallback(() => {
    const phoneNumber = car.dealership_phone?.replace(/[^0-9]/g, "");
    if (phoneNumber) {
      trackWhatsAppClick(car.id);
      const message = encodeURIComponent(
        `Hi! I'm interested in this rental car: ${car.year} ${car.make} ${car.model} - $${car.price}/${formatRentalPeriod(car.rental_period || 'day')}`
      );
      const whatsappUrl = `whatsapp://send?phone=${phoneNumber}&text=${message}`;
      Linking.canOpenURL(whatsappUrl).then((supported) => {
        if (supported) {
          Linking.openURL(whatsappUrl);
        } else {
          Alert.alert(t('common.error'), t('common.whatsapp_not_installed'));
        }
      });
    } else {
      Alert.alert(t('common.phone_not_available'));
    }
  }, [car, trackWhatsAppClick, t]);

  const renderImageItem = useCallback(
    ({ item, index: imageIndex }: any) => (
      <OptimizedImage
        key={imageIndex}
        source={{ uri: item }}
        style={{
          width: cardWidth,
          height: imageHeight,
        }}
        fallbackColor={isDarkMode ? "#1a1a1a" : "#f0f0f0"}
      />
    ),
    [cardWidth, imageHeight, isDarkMode]
  );

  const displayImages = useMemo(() => {
    return car.images ? car.images.slice(0, MAX_IMAGES) : [];
  }, [car.images]);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentImageIndex(viewableItems[0].index || 0);
    }
  }).current;

  const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 50 });

  const renderPaginationDots = useMemo(() => {
    if (displayImages.length <= 1) return null;
    
    return (
      <StyledView 
        className="absolute bottom-3 left-0 right-0 flex-row justify-center items-center"
        style={{ gap: 6 }}
      >
        {displayImages.map((_: any, index: number) => (
          <StyledView
            key={index}
            className="rounded-full"
            style={{
              width: currentImageIndex === index ? 24 : 8,
              height: 8,
              backgroundColor:
                currentImageIndex === index
                  ? "#D55004"
                  : isDarkMode
                  ? "rgba(255, 255, 255, 0.5)"
                  : "rgba(0, 0, 0, 0.3)",
            }}
          />
        ))}
      </StyledView>
    );
  }, [displayImages.length, currentImageIndex, isDarkMode]);

  const dealerLogo = useMemo(
    () => getLogoUrl(car.dealership_logo, isDarkMode),
    [car.dealership_logo, isDarkMode]
  );

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [
          { scale: scaleAnim },
          { translateY: translateY },
        ],
        marginBottom: 20,
      }}
    >
      <StyledPressable
        onPress={handleCardPress}
        className={`mx-4 rounded-3xl overflow-hidden shadow-lg ${
          isDarkMode ? "bg-neutral-900" : "bg-white"
        }`}
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDarkMode ? 0.4 : 0.1,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        {/* Image Section */}
        <StyledView className="relative">
          <FlatList
            ref={flatListRef}
            data={displayImages}
            renderItem={renderImageItem}
            keyExtractor={(_, index) => `image-${index}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewConfigRef.current}
            scrollEventThrottle={16}
            decelerationRate="fast"
            snapToInterval={cardWidth}
            snapToAlignment="start"
            getItemLayout={(data, index) => ({
              length: cardWidth,
              offset: cardWidth * index,
              index,
            })}
          />

          {/* Rental Badge - Top Left */}
          <StyledView 
            className="absolute top-3 left-3"
            style={{
              backgroundColor: 'rgba(213, 80, 4, 0.95)',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Ionicons name="time" size={16} color="#FFFFFF" />
            <StyledText className="text-white text-xs font-bold uppercase">
              FOR RENT
            </StyledText>
          </StyledView>

          {/* Favorite Button */}
          {!disableActions && (
            <StyledView className="absolute top-3 right-3">
              <StyledPressable
                onPress={handleFavoritePress}
                className="items-center justify-center active:opacity-70"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: isDarkMode
                    ? "rgba(0, 0, 0, 0.6)"
                    : "rgba(255, 255, 255, 0.9)",
                }}
              >
                <Ionicons
                  name={isFavorite ? "heart" : "heart-outline"}
                  size={24}
                  color={isFavorite ? "#D55004" : isDarkMode ? "#FFFFFF" : "#000000"}
                />
              </StyledPressable>
            </StyledView>
          )}

          {/* Pagination Dots */}
          {renderPaginationDots}

          {/* Rented Banner */}
          {showRentedBanner && (
            <StyledView className="absolute inset-0 bg-black/60 items-center justify-center">
              <StyledView
                className="bg-orange-600 px-6 py-3 rounded-full"
                style={{
                  transform: [{ rotate: "-15deg" }],
                }}
              >
                <StyledText className="text-white text-2xl font-bold">
                  RENTED
                </StyledText>
              </StyledView>
            </StyledView>
          )}
        </StyledView>

        {/* Content Section */}
        <StyledView className="p-4">
          {/* Price with Rental Period */}
          <StyledView className="flex-row items-baseline mb-2">
            <StyledText
              className={`text-2xl font-bold ${
                isDarkMode ? "text-white" : "text-black"
              }`}
            >
              ${car.price?.toLocaleString()}
            </StyledText>
            {car.rental_period && (
              <StyledText
                className={`text-base font-semibold ml-2 ${
                  isDarkMode ? "text-orange-400" : "text-orange-600"
                }`}
              >
                / {formatRentalPeriod(car.rental_period)}
              </StyledText>
            )}
          </StyledView>

          {/* Car Title */}
          <StyledText
            className={`text-lg font-bold mb-4 ${
              isDarkMode ? "text-white" : "text-black"
            }`}
            numberOfLines={1}
          >
            {car.year} {car.make} {car.model}
          </StyledText>

          {/* Specifications Row - Rental Specific */}
          <StyledView className="flex-row justify-between mb-4">
            {/* Year */}
            <StyledView className="flex-row items-center">
              <Ionicons
                name="calendar"
                size={18}
                color={isDarkMode ? "#9CA3AF" : "#6B7280"}
                style={{ marginRight: 6 }}
              />
              <StyledText
                className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                {t('car.year')}
              </StyledText>
              <StyledText
                className={`text-sm font-semibold ml-2 ${
                  isDarkMode ? "text-white" : "text-black"
                }`}
              >
                {car.year}
              </StyledText>
            </StyledView>

            {/* Rental Period */}
            <StyledView className="flex-row items-center">
              <Ionicons
                name="time"
                size={18}
                color={isDarkMode ? "#9CA3AF" : "#6B7280"}
                style={{ marginRight: 6 }}
              />
              <StyledText
                className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Rental Period
              </StyledText>
              <StyledText
                className={`text-sm font-semibold ml-2 ${
                  isDarkMode ? "text-white" : "text-black"
                }`}
              >
                {formatRentalPeriod(car.rental_period || 'daily')}
              </StyledText>
            </StyledView>

            {/* Transmission */}
            <StyledView className="flex-row items-center">
              <MaterialCommunityIcons
                name="car-shift-pattern"
                size={18}
                color={isDarkMode ? "#9CA3AF" : "#6B7280"}
                style={{ marginRight: 6 }}
              />
              <StyledText
                className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                {t('car.transmission')}
              </StyledText>
              <StyledText
                className={`text-sm font-semibold ml-2 ${
                  isDarkMode ? "text-white" : "text-black"
                }`}
              >
                {car.transmission}
              </StyledText>
            </StyledView>
          </StyledView>

          {/* Dealership Info */}
          <StyledPressable
            onPress={handleDealershipPress}
            className="flex-row items-center mb-4 active:opacity-70"
          >
            <StyledView
              className="rounded-full overflow-hidden mr-3"
              style={{
                width: 40,
                height: 40,
                backgroundColor: isDarkMode ? "#333" : "#e5e5e5",
              }}
            >
              {dealerLogo ? (
                <StyledImage
                  source={{ uri: dealerLogo }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              ) : (
                <StyledView className="w-full h-full items-center justify-center">
                  <Ionicons
                    name="business"
                    size={20}
                    color={isDarkMode ? "#666" : "#999"}
                  />
                </StyledView>
              )}
            </StyledView>

            <StyledView className="flex-1">
              <StyledText
                className={`text-sm font-semibold ${
                  isDarkMode ? "text-white" : "text-black"
                }`}
                numberOfLines={1}
              >
                {car.dealership_name || t('common.unknown_dealer')}
              </StyledText>
              {car.dealership_location && (
                <StyledText
                  className={`text-xs ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                  numberOfLines={1}
                >
                  📍 {car.dealership_location}
                </StyledText>
              )}
            </StyledView>

            <Ionicons
              name="chevron-forward"
              size={18}
              color={isDarkMode ? "#9CA3AF" : "#6B7280"}
            />
          </StyledPressable>

          {/* Action Buttons */}
          {!disableActions && (
            <StyledView className="flex-row justify-around items-center">
              <ActionButton
                icon="call"
                text={t('common.call')}
                onPress={handleCall}
                isDarkMode={isDarkMode}
              />
              <ActionButton
                icon="logo-whatsapp"
                text="WhatsApp"
                onPress={handleWhatsAppPress}
                isDarkMode={isDarkMode}
              />
              <ActionButton
                icon="share-social"
                text={t('common.share')}
                onPress={handleShare}
                isDarkMode={isDarkMode}
              />
            </StyledView>
          )}
        </StyledView>
      </StyledPressable>
    </Animated.View>
  );
}
