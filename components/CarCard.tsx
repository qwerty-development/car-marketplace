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
  ActivityIndicator,
  Pressable,
  Share,
  Animated,
  Platform,
  useWindowDimensions,
  I18nManager,
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
import { startDealerChat, startUserChat } from '@/utils/chatHelpers';
import { useGuestUser } from '@/utils/GuestUserContext';
import AuthRequiredModal from '@/components/AuthRequiredModal';
import { formatMileage } from '@/utils/formatMileage';
import CachedImage, { prefetchImages } from '@/utils/CachedImage';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledPressable = styled(Pressable);

const MAX_IMAGES = 3;

// Simplified Image component with proper caching and transition
const OptimizedImage = ({ source, style, fallbackColor = 'transparent' }: any) => {
  return (
    <View style={[style, { overflow: "hidden", backgroundColor: fallbackColor }]}>
      <CachedImage
        source={source}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        cachePolicy="disk"
        transition={200}
        priority="normal"
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

export default function CarCard({
  car,
  onFavoritePress,
  isFavorite,
  isDealer = false,
  index = 0,
  showSoldBanner = false,
  disableActions = false,
}: any) {
  const { isDarkMode } = useTheme();
  const { language } = useLanguage();
  const { t } = useTranslation();
  const isRTL = I18nManager.isRTL;
  
  // Determine banner type based on car status
  const isDeleted = car?.status === 'deleted';
  const bannerTitle = isDeleted ? t('car.deleted', 'Deleted') : i18n.t('car.sold');
  const bannerSubtitle = i18n.t('car.no_longer_available');
  
  // Improved animation values with better spring physics
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

  // Determine if this is a dealership car or user car
  const isDealershipCar = useMemo(() => !!car.dealership_id, [car.dealership_id]);
  
  // Get seller info - works for both dealership and user cars
  const sellerInfo = useMemo(() => ({
    name: isDealershipCar ? car.dealership_name : car.seller_name || car.users?.name || t('common.private_seller'),
    logo: isDealershipCar ? car.dealership_logo : null,
    phone: isDealershipCar ? car.dealership_phone : car.users?.phone_number || car.seller_phone,
    location: isDealershipCar ? car.dealership_location : null,
    id: isDealershipCar ? car.dealership_id : car.user_id,
  }), [car, isDealershipCar, t]);

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

    // Track boost impression when card becomes visible
    if (car.is_boosted && car.boost_end_date && new Date(car.boost_end_date) > new Date()) {
      // Debounce impression tracking to avoid spam
      const trackImpression = async () => {
        try {
          await supabase.rpc('track_boost_impression', {
            p_car_id: car.id,
            p_dealership_id: car.dealership_id || null,
            p_user_id: user?.id || null,
            p_boost_priority: car.boost_priority
          });
        } catch (error) {
          // Silently fail - analytics shouldn't break user experience
          console.debug('Boost impression tracking failed:', error);
        }
      };

      // Track after a short delay to ensure it's actually viewed
      const impressionTimer = setTimeout(trackImpression, 500);
      return () => clearTimeout(impressionTimer);
    }
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

      // Track boost click analytics (fire and forget)
      if (car.is_boosted && car.boost_end_date && new Date(car.boost_end_date) > new Date()) {
        (async () => {
          try {
            await supabase.rpc('track_boost_click', {
              p_car_id: car.id,
              p_dealership_id: car.dealership_id || null,
              p_user_id: user?.id || null,
              p_boost_priority: car.boost_priority || 1
            });
          } catch {
            // Silently fail - don't block navigation
          }
        })();
      }

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
  }, [router, car, isDealer, prefetchCarDetails, scaleAnim, user]);

  const handleChat = useCallback(async () => {
    if (disableActions) return;

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
        carId: car?.id ?? null,
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
        carId: car?.id ?? null,
      });
    } else {
      Alert.alert(
        t('common.not_available'),
        t('common.seller_info_not_available', 'Seller information is not available for this listing.')
      );
    }
  }, [
    car?.dealership_id,
    car?.id,
    car?.user_id,
    disableActions,
    isDealershipCar,
    isGuest,
    router,
    t,
    user?.id,
  ]);

  const handleCall = useCallback(() => {
    if (sellerInfo.phone) {
      trackCallClick(car.id);
      Linking.openURL(`tel:${sellerInfo.phone}`);
    } else {
      Alert.alert(t('common.phone_not_available'));
    }
  }, [sellerInfo.phone, car.id, trackCallClick, t]);

  const handleShare = useCallback(async () => {
    if (!car) return;

    try {
      await shareCar(car);
    } catch (error) {
      console.error("Share error:", error);
      Alert.alert(t('common.error'), t('common.failed_share_car'));
    }
  }, [car]);
  
  const handleDealershipPress = useCallback(async () => {
    // Only allow navigation to dealership details for dealership cars
    if (!isDealershipCar) return;
    
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const route = isDealer
      ? "/(home)/(dealer)/DealershipDetails"
      : "/(home)/(user)/DealershipDetails";
    router.push({
      pathname: route,
      params: { dealershipId: car.dealership_id },
    });
  }, [isDealer, isDealershipCar, router, car.dealership_id]);

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
    const location = sellerInfo.location;
    if (!location) return null;
    
    if (location.length > 20) {
      return (
        location.slice(0, 20) +
        "\n" +
        location.slice(20)
      );
    }
    return location;
  }, [sellerInfo.location]);

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
    ({ item, index }: any) => (
      <Pressable onPress={handleCardPress} className="bg-neutral-800">
        <View className="relative bg-neutral-800">
          <OptimizedImage
            source={{ uri: item }}
            style={{ width: cardWidth, height: imageHeight }}
          />



          {/* Sold/Deleted Banner */}
          {showSoldBanner && (
            <View className="absolute top-1/2 left-1/2 z-20" style={{ transform: [{ translateX: -75 }, { translateY: -20 }] }}>
              <View className={`px-6 py-3 rounded-xl border-2 ${isDeleted ? 'bg-red-900/90 border-red-400' : 'bg-gray-900/90 border-gray-400'}`}>
                <StyledText className="text-white text-lg font-bold text-center">
{bannerTitle}
                </StyledText>
                <StyledText className="text-gray-300 text-sm text-center mt-1">
{bannerSubtitle}
                </StyledText>
              </View>
            </View>
          )}


          {/* Image Counter Dots - Bottom Center */}
          {displayedImages.length > 1 && (
            <View className="absolute bottom-4 left-0 right-0 flex-row justify-center items-center z-10">
              {displayedImages.map((_: any, index: number) => (
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
          )}

          {/* Favorite Button - Top Right */}
          {!isDealer && (
            <StyledPressable
              onPress={handleFavoritePress}
              className="absolute top-4 active:opacity-70"
              style={isRTL ? { left: 16 } : { right: 16 }}
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
    if (sellerInfo.phone) {
      if (trackWhatsAppClick) {
        trackWhatsAppClick(car.id);
      }

      let cleanedPhoneNumber = sellerInfo.phone
        .toString()
        .replace(/\D/g, "");
      
      // Only add country code if not already present (user phones are stored with +961, dealer phones without)
      if (!cleanedPhoneNumber.startsWith('961')) {
        cleanedPhoneNumber = `961${cleanedPhoneNumber}`;
      }

      const fullMessage = `Hi, I'm interested in the ${car.year} ${car.make} ${
        car.model
      } listed for $${car.price.toLocaleString()} on Fleet\n\nhttps://www.fleetapp.me/cars/${car.id}`;
      const encodedMessage = encodeURIComponent(fullMessage);

      const webURL = `https://wa.me/${cleanedPhoneNumber}?text=${encodedMessage}`;

      Linking.openURL(webURL).catch(() => {
        Alert.alert(
          t('common.error'),
          t('common.whatsapp_install_required')
        );
      });
    } else {
      Alert.alert(t('common.error'), t('common.phone_not_available'));
    }
  }, [sellerInfo.phone, car, trackWhatsAppClick, t]);

  return (
    <>
    <Animated.View
      style={{
        opacity: showSoldBanner ? Animated.multiply(fadeAnim, 0.7) : fadeAnim, // Reduce opacity for sold cars
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
          decelerationRate="fast"
          snapToInterval={cardWidth}
          snapToAlignment="center"
          bounces={false}
        />

        {/* Boost Indicator Badge - Premium Design */}
        {car.is_boosted && car.boost_end_date && new Date(car.boost_end_date) > new Date() && (
          <LinearGradient
            colors={['#D55004', '#FF6B1A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              position: 'absolute',
              top: 12,
              left: isRTL ? undefined : 12,
              right: isRTL ? 12 : undefined,
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 24,
              shadowColor: '#D55004',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.4,
              shadowRadius: 8,
              elevation: 8,
              borderWidth: 1.5,
              borderColor: 'rgba(255, 255, 255, 0.3)',
            }}
          >
            <Ionicons name="trophy" size={18} color="white" style={isRTL ? { marginLeft: 8 } : { marginRight: 8 }} />
            <Text style={{ color: 'white', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 }}>
              FEATURED
            </Text>
          </LinearGradient>
        )}

        <StyledPressable
          onPress={handleCardPress}
          className="active:opacity-90"
        >
          {/* Car Info Section - Price, Name, and Logo */}
          <View className="px-4 py-3">
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View className="flex-1">
                {/* Price */}
                <StyledText
                  className="text-lg font-bold text-red"
                  numberOfLines={1}
                  style={{
                    textAlign: isRTL ? 'right' : 'left',
                    marginBottom: 4
                  }}
                >
                  ${car.price.toLocaleString()}
                </StyledText>

                {/* Car Name */}
                <StyledText
                  className={`text-xl font-bold ${
                    isDarkMode ? "text-white" : "text-black"
                  }`}
                  numberOfLines={1}
                  style={{
                    textAlign: isRTL ? 'right' : 'left',
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
                <View
                  style={isRTL ? { marginRight: 16 } : { marginLeft: 16 }}
                >
                  <OptimizedImage
                    source={{ uri: getLogoUrl(car.make, !isDarkMode) }}
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
              title={t('car.mileage')}
              icon="highway"
              value={formatMileage(car.mileage)}
              isDarkMode={isDarkMode}
              iconLibrary="MaterialCommunityIcons"
            />
            <SpecItem
              title={t('car.transmission')}
              icon="car-shift-pattern"
              value={
                car.transmission === "Automatic"
                  ? t('filters.automatic')
                  : car.transmission === "Manual"
                  ? t('filters.manual')
                  : car.transmission
              }
              isDarkMode={isDarkMode}
              iconLibrary="MaterialCommunityIcons"
            />
            <SpecItem
              title={t('car.condition')}
              icon="car-wrench"
              value={
                car.condition === "New"
                  ? t('filters.new')
                  : car.condition === "Used"
                  ? t('filters.used')
                  : car.condition
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
            <StyledView style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              {/* Seller Logo/Avatar - Only show for dealerships */}
              {isDealershipCar && sellerInfo.logo && (
                <Pressable
                  onPress={handleDealershipPress}
                  style={isRTL ? { marginLeft: 12 } : { marginRight: 12 }}
                >
                  <CachedImage
                    source={{ uri: sellerInfo.logo }}
                    style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(128, 128, 128, 0.2)' }}
                    contentFit="cover"
                    cachePolicy="disk"
                    transition={100}
                  />
                </Pressable>
              )}

              {/* For user cars, show improved avatar with gradient background */}
              {!isDealershipCar && (
                <LinearGradient
                  colors={isDarkMode ? ['#4A5568', '#2D3748'] : ['#CBD5E0', '#A0AEC0']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    isRTL ? { marginLeft: 12 } : { marginRight: 12 },
                    {
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 2,
                      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }
                  ]}
                >
                  <Ionicons
                    name="person"
                    size={26}
                    color={isDarkMode ? "#E2E8F0" : "#2D3748"}
                  />
                </LinearGradient>
              )}

              <StyledView
                className="flex-1"
                style={isRTL ? { marginRight: 8 } : { marginLeft: 8 }}
              >
                <View style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 6
                }}>
                  <StyledText
                    className={`text-base font-semibold ${
                      isDarkMode ? "text-white" : "text-black"
                    }`}
                    numberOfLines={1}
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {sellerInfo.name}
                  </StyledText>

                  {/* Private Seller Badge for user cars */}
                  {!isDealershipCar && (
                    <View style={{
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 12,
                      backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.15)',
                      borderWidth: 1,
                      borderColor: isDarkMode ? 'rgba(99, 102, 241, 0.4)' : 'rgba(99, 102, 241, 0.3)',
                    }}>
                      <Text style={{
                        fontSize: 10,
                        fontWeight: '600',
                        color: isDarkMode ? '#A5B4FC' : '#4F46E5',
                        letterSpacing: 0.3,
                      }}>
                        {t('common.private_seller', 'PRIVATE')}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Location for dealership cars */}
                {formattedLocation && isDealershipCar && (
                  <StyledText
                    className={`text-sm ${
                      isDarkMode ? "text-white/80" : "text-black"
                    }`}
                    numberOfLines={2}
                    style={{ textAlign: isRTL ? 'right' : 'left', marginTop: 2 }}
                  >
                    {formattedLocation}
                  </StyledText>
                )}


              </StyledView>

              <StyledView
                style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}
              >
                {!disableActions ? (
                  <>
                    {/* Show chat for all cars (both dealership and user-listed) */}
                    <ActionButton
                      icon="chatbubble-ellipses-outline"
                      onPress={handleChat}
                      isDarkMode={isDarkMode}
                      disabled={isStartingChat}
                      loading={isStartingChat}
                    />
                    {sellerInfo.phone && (
                      <>
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
                      </>
                    )}
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
