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
import { getLogoSource } from "@/hooks/getLogoUrl";
import * as Haptics from 'expo-haptics';
import { startDealerChat, startUserChat } from '@/utils/chatHelpers';
import { useGuestUser } from '@/utils/GuestUserContext';
import AuthRequiredModal from '@/components/AuthRequiredModal';

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

const ActionButton = ({ icon, text, onPress, isDarkMode, disabled = false, loading = false }: any) => (
  <StyledPressable
    onPress={async () => {
      if (disabled || loading) return;
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }}
    className="items-center justify-center active:opacity-70"
    style={{
      width: 44,
      height: 44,
      borderRadius: 22,
    }}
    disabled={disabled || loading}
  >
    {loading ? (
      <ActivityIndicator size="small" color={isDarkMode ? "#FFFFFF" : "#000000"} />
    ) : (
      <Ionicons
        name={icon}
        size={24}
        color={isDarkMode ? "#FFFFFF" : "#000000"}
      />
    )}
  </StyledPressable>
);

// Helper function to format rental period display
const formatRentalPeriod = (period: string | null | undefined) => {
  if (!period) return 'Day'; // Default to 'Day' if period is null/undefined
  
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
  const { isGuest } = useGuestUser();
  const router = useRouter();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const flatListRef = useRef(null);
  const { prefetchCarDetails } = useCarDetails();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isStartingChat, setIsStartingChat] = useState(false);

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
      
      const prefetchedData = await prefetchCarDetails(car.id, true); // Pass true for isRental

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

  const handleChat = useCallback(async () => {
    if (disableActions) return;

    const isDealershipCar = !!car?.dealership_id;

    // Support chat for both user and dealership cars
    if (isDealershipCar) {
      // Chat with dealership
      await startDealerChat({
        dealershipId: car?.dealership_id,
        userId: user?.id ?? null,
        isGuest,
        router,
        t,
        onAuthRequired: () => setShowAuthModal(true),
        setLoading: setIsStartingChat,
        carRentId: car?.id ?? null,
      });
    } else if (car?.user_id) {
      // Chat with private seller
      await startUserChat({
        sellerUserId: car.user_id,
        userId: user?.id ?? null,
        isGuest,
        router,
        t,
        onAuthRequired: () => setShowAuthModal(true),
        setLoading: setIsStartingChat,
        carRentId: car?.id ?? null,
      });
    } else {
      Alert.alert(
        t('common.not_available'),
        t('common.seller_info_not_available', 'Seller information is not available for this listing.')
      );
    }
  }, [car?.dealership_id, car?.id, car?.user_id, disableActions, isGuest, router, t, user?.id]);

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
      <Pressable onPress={handleCardPress} className="bg-neutral-800">
        <View className="relative bg-neutral-800">
          <OptimizedImage
            key={imageIndex}
            source={{ uri: item }}
            style={{
              width: cardWidth,
              height: imageHeight,
            }}
            fallbackColor={isDarkMode ? "#1a1a1a" : "#f0f0f0"}
          />
        </View>
      </Pressable>
    ),
    [cardWidth, imageHeight, isDarkMode, handleCardPress]
  );

  const displayImages = useMemo(() => {
    return car.images ? car.images.slice(0, MAX_IMAGES) : [];
  }, [car.images]);

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentImageIndex(viewableItems[0].index);
    }
  }, []);

  const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 50 });

  const renderPaginationDots = useMemo(() => {
    if (displayImages.length <= 1) return null;
    
    return (
      <View className="absolute bottom-4 left-0 right-0 flex-row justify-center items-center z-10">
        {displayImages.map((_: any, index: number) => (
          <View
            key={index}
            className={`mx-1 rounded-full ${
              index === currentImageIndex
                ? "bg-white"
                : "bg-white/50"
            }`}
            style={{
              width: index === currentImageIndex ? 8 : 6,
              height: index === currentImageIndex ? 8 : 6,
            }}
          />
        ))}
      </View>
    );
  }, [displayImages.length, currentImageIndex]);

  const dealerLogo = useMemo(
    () => car.dealership_logo || null,
    [car.dealership_logo]
  );

  return (
    <>
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
        {/* Image carousel with overlay elements */}
        <View>
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
            snapToAlignment="center"
            bounces={false}
            initialNumToRender={3}
            maxToRenderPerBatch={3}
            windowSize={3}
            removeClippedSubviews={true}
          />

          {/* Rented Banner */}
          {showRentedBanner && (
            <View className="absolute top-1/2 left-1/2 z-20" style={{ transform: [{ translateX: -75 }, { translateY: -20 }] }}>
              <View className="bg-gray-900/90 px-6 py-3 rounded-xl border-2 border-gray-400">
                <StyledText className="text-white text-lg font-bold text-center">
                  RENTED
                </StyledText>
                <StyledText className="text-gray-300 text-sm text-center mt-1">
                  No longer available
                </StyledText>
              </View>
            </View>
          )}

          {/* Pagination Dots - Bottom Center of Image */}
          {renderPaginationDots}

          {/* Favorite Button - Top Right */}
          {!disableActions && (
            <StyledPressable
              onPress={handleFavoritePress}
              className="absolute top-4 right-4 active:opacity-70"
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

        <StyledPressable
          onPress={handleCardPress}
          className="active:opacity-90"
        >
          {/* Car Info Section - Price, Name, and Logo */}
          <View className="px-4 py-3">
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View className="flex-1">
                {/* Price with Rental Period */}
                <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 4 }}>
                  <StyledText
                    className="text-lg font-bold text-red"
                    numberOfLines={1}
                  >
                    ${car.price?.toLocaleString()}
                  </StyledText>
                  {car.rental_period && (
                    <StyledText
                      className={`text-sm font-semibold ml-2 ${
                        isDarkMode ? "text-orange-400" : "text-orange-600"
                      }`}
                    >
                      / {formatRentalPeriod(car.rental_period)}
                    </StyledText>
                  )}
                </View>

                {/* Car Name */}
                <StyledText
                  className={`text-xl font-bold ${
                    isDarkMode ? "text-white" : "text-black"
                  }`}
                  numberOfLines={1}
                  style={{
                    textShadowColor: isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                    textShadowOffset: { width: 1, height: 1 },
                    textShadowRadius: 2
                  }}
                >
                  {car.year} {car.make} {car.model}
                </StyledText>
              </View>

              {/* Car Logo */}
              {car.make && (
                <View style={{ marginLeft: 16 }}>
                  <OptimizedImage
                    source={getLogoSource(car.make, isDarkMode)}
                    style={{ width: 60, height: 40 }}
                    fallbackColor="transparent"
                  />
                </View>
              )}
            </View>
          </View>

          {/* Specs Grid */}
          <StyledView 
            className="flex-row"
            style={{
              marginTop: 0,
              marginBottom: 4,
              paddingHorizontal: 12,
            }}
          >
            <SpecItem
              title={t('car.year')}
              icon="calendar-outline"
              value={car.year}
              isDarkMode={isDarkMode}
              iconLibrary="Ionicons"
            />
            <SpecItem
              title={t('car.color')}
              icon="color-palette-outline"
              value={car.color || 'N/A'}
              isDarkMode={isDarkMode}
              iconLibrary="Ionicons"
            />
            <SpecItem
              title={t('car.transmission')}
              icon="car-shift-pattern"
              value={
                car.transmission === "Automatic"
                  ? "Auto"
                  : car.transmission === "Manual"
                  ? "Man"
                  : car.transmission
              }
              isDarkMode={isDarkMode}
              iconLibrary="MaterialCommunityIcons"
            />
          </StyledView>

          {/* Seller Info */}
          <StyledView
            className={`p-3 ${
              isDarkMode ? "bg-[#2b2b2b]" : "bg-[#d1d1d1]"
            } rounded-t-3xl`}
            style={{ marginTop: 4 }}
          >
            <StyledView style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              {/* Dealership Logo */}
              <Pressable
                onPress={handleDealershipPress}
                style={{ marginRight: 12 }}
              >
                {dealerLogo ? (
                  <StyledImage
                    source={{ uri: dealerLogo }}
                    style={{ width: 48, height: 48 }}
                    className="rounded-full border border-textgray/20"
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: isDarkMode ? "#333" : "#e5e5e5",
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons
                      name="business"
                      size={24}
                      color={isDarkMode ? "#666" : "#999"}
                    />
                  </View>
                )}
              </Pressable>

              <StyledView className="flex-1" style={{ marginLeft: 8 }}>
                <StyledText
                  className={`text-base font-semibold ${
                    isDarkMode ? "text-white" : "text-black"
                  }`}
                  numberOfLines={1}
                >
                  {car.dealership_name || t('common.unknown_dealer')}
                </StyledText>

                {car.dealership_location && (
                  <StyledText
                    className={`text-sm ${
                      isDarkMode ? "text-white/80" : "text-black"
                    }`}
                    numberOfLines={2}
                    style={{ marginTop: 2 }}
                  >
                    {car.dealership_location}
                  </StyledText>
                )}
              </StyledView>

              <StyledView style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {!disableActions ? (
                  <>
                    <ActionButton
                      icon="chatbubble-ellipses-outline"
                      onPress={handleChat}
                      isDarkMode={isDarkMode}
                      disabled={isStartingChat}
                      loading={isStartingChat}
                    />
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
                    {Platform.OS === 'android' ? (
                      <StyledPressable
                        onPress={async () => {
                          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          handleShare();
                        }}
                        className="items-center justify-center active:opacity-70"
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                        }}
                      >
                        <Ionicons
                          name="share-social-outline"
                          size={24}
                          color={isDarkMode ? "#FFFFFF" : "#000000"}
                        />
                      </StyledPressable>
                    ) : (
                      <ActionButton
                        icon="share-outline"
                        onPress={handleShare}
                        isDarkMode={isDarkMode}
                      />
                    )}
                  </>
                ) : (
                  <StyledView className="flex-row items-center justify-center px-4 py-2 bg-gray-500/50 rounded-xl">
                    <StyledText className={`text-sm ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
                      Contact unavailable
                    </StyledText>
                  </StyledView>
                )}
              </StyledView>
            </StyledView>
          </StyledView>
        </StyledPressable>
      </StyledView>
    </Animated.View>
    <AuthRequiredModal
      isVisible={showAuthModal}
      onClose={() => setShowAuthModal(false)}
      featureName={t('chat.feature_name', 'chat with dealers')}
    />
  </>
  );
}
