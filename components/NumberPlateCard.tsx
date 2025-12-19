import React, { useMemo, useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  Linking,
  Alert,
  Pressable,
  Animated,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styled } from "nativewind";
import { useTheme } from "@/utils/ThemeContext";
import { useRouter } from "expo-router";
import { useLanguage } from '@/utils/LanguageContext';
import i18n from '@/utils/i18n';
import { useTranslation } from 'react-i18next';
import { useAuth } from "@/utils/AuthContext";
import { useGuestUser } from "@/utils/GuestUserContext";
import * as Haptics from 'expo-haptics';
import { supabase } from "@/utils/supabase";
import { startDealerChat, startUserChat } from '@/utils/chatHelpers';
import AuthRequiredModal from '@/components/AuthRequiredModal';
import CachedImage from '@/utils/CachedImage';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledPressable = styled(Pressable);

// Lebanese-style license plate component - exported for use in other components
export const LicensePlateTemplate = ({ letter, digits, width }: { letter: string; digits: string; width: number }) => {
  const plateHeight = width * 0.28; // Aspect ratio matching real Lebanese plates
  const blueStripWidth = width * 0.12; // Blue strip width
  
  // Check if letter is "P" for public/red plate
  const isPublicPlate = letter.toUpperCase() === 'P';
  const stripColor = isPublicPlate ? '#C41E3A' : '#1e4a8d'; // Red for P, Blue for others
  
  // Dynamic font size and letter spacing based on digit count
  const digitCount = digits.length;
  const baseFontSize = plateHeight * 0.55;
  
  // Scale down font size for longer numbers
  let fontSize = baseFontSize;
  let digitLetterSpacing = 8;
  let marginLeft = 24;
  
  if (digitCount >= 7) {
    fontSize = baseFontSize * 0.7;
    digitLetterSpacing = 2;
    marginLeft = 16;
  } else if (digitCount >= 6) {
    fontSize = baseFontSize * 0.8;
    digitLetterSpacing = 4;
    marginLeft = 18;
  } else if (digitCount >= 5) {
    fontSize = baseFontSize * 0.9;
    digitLetterSpacing = 6;
    marginLeft = 20;
  }
  
  return (
    <View
      style={{
        width: width,
        height: plateHeight,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        flexDirection: 'row',
        overflow: 'hidden',
        borderWidth: 3,
        borderColor: '#1a1a1a',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 6,
      }}
    >
      {/* Strip on the left with Lebanese details - Red for P, Blue for others */}
      <View
        style={{
          width: blueStripWidth,
          height: '100%',
          backgroundColor: stripColor,
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: 4,
        }}
      >
        {/* لبنان (Lebanon) at top */}
        <Text style={{ color: '#FFFFFF', fontSize: blueStripWidth * 0.35, fontWeight: '600' }}>لبنان</Text>
        
        {/* Cedar tree symbol */}
        <View style={{ alignItems: 'center' }}>
          <Image 
            source={require('@/assets/cedar.png')} 
            style={{ 
              width: blueStripWidth * 0.7, 
              height: blueStripWidth * 0.7,
              tintColor: '#FFFFFF',
            }} 
            resizeMode="contain"
          />
        </View>
        
        {/* خصوصي (Private) at bottom */}
        <Text style={{ color: '#FFFFFF', fontSize: blueStripWidth * 0.2, fontWeight: '500' }}>خصوصي</Text>
      </View>
      
      {/* Plate content - Letter and Numbers */}
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 8,
        }}
      >
        <Text
          style={{
            fontSize: fontSize,
            fontWeight: '600',
            color: '#1a1a1a',
            letterSpacing: 2,
            fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif-condensed',
          }}
        >
          {letter}
        </Text>
        <Text
          style={{
            fontSize: fontSize,
            fontWeight: '600',
            color: '#1a1a1a',
            letterSpacing: digitLetterSpacing,
            marginLeft: marginLeft,
            fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif-condensed',
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {digits}
        </Text>
      </View>
    </View>
  );
};

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

interface NumberPlateCardProps {
  plate: NumberPlate;
  index?: number;
  onPress?: () => void;
}

export default function NumberPlateCard({
  plate,
  index = 0,
  onPress,
}: NumberPlateCardProps) {
  const { isDarkMode } = useTheme();
  const { language } = useLanguage();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isGuest } = useGuestUser();
  const router = useRouter();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const hasTrackedView = useRef(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = windowWidth - 32;

  const isDealer = plate.seller_type === 'dealer';
  
  // Check if the current user owns this plate (don't show chat button for own listings)
  const isOwnListing = user?.id === plate.user_id;

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

  // Track number plate view - only once per card instance
  const trackPlateView = useCallback(async () => {
    // Skip if already tracked, no user, or user is guest
    if (hasTrackedView.current || !user?.id || isGuest) return;
    
    // Skip if user owns this plate
    if (user.id === plate.user_id) return;
    
    hasTrackedView.current = true;
    
    try {
      const plateId = typeof plate.id === 'string' ? parseInt(plate.id, 10) : plate.id;
      const { error } = await supabase.rpc("track_number_plate_view", {
        plate_id: plateId,
        user_id: user.id,
      });

      if (error) {
        console.error("Error tracking plate view:", error);
        hasTrackedView.current = false; // Allow retry on error
      }
    } catch (error) {
      console.error("Error tracking plate view:", error);
      hasTrackedView.current = false; // Allow retry on error
    }
  }, [plate.id, plate.user_id, user?.id, isGuest]);

  const handleCardPress = useCallback(async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Track the view when user taps on the card
      trackPlateView();
      
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
      
      if (onPress) {
        onPress();
      }
    } catch (error) {
      console.error("Error handling card press:", error);
    }
  }, [onPress, scaleAnim, trackPlateView]);

  const handleCall = useCallback(() => {
    if (plate.seller_phone) {
      Linking.openURL(`tel:${plate.seller_phone}`);
    } else {
      Alert.alert(t('common.phone_not_available'));
    }
  }, [plate.seller_phone, t]);

  const handleWhatsAppPress = useCallback(() => {
    if (plate?.seller_phone) {
      const cleanedPhoneNumber = plate.seller_phone
        .toString()
        .replace(/\D/g, "");

      const fullMessage = `Hi, I'm interested in the number plate ${plate.letter} ${plate.digits} listed for $${plate.price.toLocaleString()} on Fleet`;
      const encodedMessage = encodeURIComponent(fullMessage);

      const webURL = `https://wa.me/961${cleanedPhoneNumber}?text=${encodedMessage}`;

      Linking.openURL(webURL).catch(() => {
        Alert.alert(
          t('common.error'),
          t('common.whatsapp_install_required')
        );
      });
    } else {
      Alert.alert(t('common.error'), t('common.phone_not_available'));
    }
  }, [plate, t]);

  const handleChatPress = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const plateIdNum = typeof plate.id === 'string' ? parseInt(plate.id, 10) : plate.id;
    
    if (isDealer && plate.dealership_id) {
      // Chat with dealer
      await startDealerChat({
        dealershipId: plate.dealership_id,
        userId: user?.id,
        isGuest,
        router,
        t,
        onAuthRequired: () => setShowAuthModal(true),
        setLoading: setIsChatLoading,
        numberPlateId: plateIdNum,
      });
    } else if (plate.user_id) {
      // Chat with private seller (user-to-user)
      await startUserChat({
        sellerUserId: plate.user_id,
        userId: user?.id,
        isGuest,
        router,
        t,
        onAuthRequired: () => setShowAuthModal(true),
        setLoading: setIsChatLoading,
        numberPlateId: plateIdNum,
      });
    } else {
      Alert.alert(t('common.error'), t('chat.seller_not_found', 'Seller unavailable'));
    }
  }, [plate, isDealer, user?.id, isGuest, router, t]);

  const plateDisplay = useMemo(() => {
    return `${plate.letter} ${plate.digits}`;
  }, [plate.letter, plate.digits]);

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
        } overflow-hidden`}
        style={{
          borderRadius: 28,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDarkMode ? 0.4 : 0.15,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <Pressable onPress={handleCardPress}>
          {/* License Plate Template */}
          <View
            style={{
              paddingVertical: 24,
              paddingHorizontal: 20,
              backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <LicensePlateTemplate
              letter={plate.letter}
              digits={plate.digits}
              width={cardWidth - 40}
            />
          </View>
        </Pressable>

        <StyledPressable
          onPress={handleCardPress}
          className="active:opacity-90"
        >
          {/* Plate Info Section - Plate on left, Price on right */}
          <View className="px-4 py-3">
            <View className="flex-row items-center justify-between">
              {/* Plate Number */}
              <StyledText
                className={`text-xl font-bold ${
                  isDarkMode ? "text-white" : "text-black"
                }`}
                numberOfLines={1}
                style={{ 
                  letterSpacing: 2,
                }}
              >
                {plateDisplay}
              </StyledText>
              
              {/* Price */}
              <StyledText
                numberOfLines={1}
                style={{ 
                  fontSize: 20,
                  fontWeight: '800',
                  color: '#D55004',
                }}
              >
                ${plate.price.toLocaleString()}
              </StyledText>
            </View>
          </View>

          {/* Seller Info */}
          <StyledView
            className={`p-3 ${
              isDarkMode ? "bg-[#2b2b2b]" : "bg-[#d1d1d1]"
            } rounded-t-3xl`}
            style={{ marginTop: 4 }}
          >
            {isDealer ? (
              // Dealer Style - Similar to CarCard
              <StyledView className="flex-row items-center justify-between">
                {plate.dealership_logo && (
                  <View className="mr-3">
                    <CachedImage
                      source={{ uri: plate.dealership_logo }}
                      style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(128, 128, 128, 0.2)' }}
                      contentFit="cover"
                      cachePolicy="disk"
                      transition={100}
                    />
                  </View>
                )}

                <StyledView className="flex-1 ml-2">
                  <StyledText
                    className={`text-base font-semibold ${
                      isDarkMode ? "text-white" : "text-black"
                    } mb-0.5`}
                    numberOfLines={2}
                  >
                    {plate.seller_name}
                  </StyledText>
                  {plate.dealership_location && (
                    <StyledText
                      className={`text-sm ${
                        isDarkMode ? "text-white/80" : "text-black"
                      }`}
                      numberOfLines={2}
                    >
                      {plate.dealership_location}
                    </StyledText>
                  )}
                </StyledView>

                <StyledView 
                  className="flex-row items-center"
                  style={{ gap: 8 }}
                >
                  {!isOwnListing && (
                    isChatLoading ? (
                      <View style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator size="small" color={isDarkMode ? "#FFFFFF" : "#000000"} />
                      </View>
                    ) : (
                      <ActionButton
                        icon="chatbubble-outline"
                        onPress={handleChatPress}
                        isDarkMode={isDarkMode}
                      />
                    )
                  )}
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
                </StyledView>
              </StyledView>
            ) : (
              // Regular User Style - Simplified with just contact info
              <StyledView className="flex-row items-center justify-between">
                <StyledView className="flex-1">
                  <StyledText
                    className={`text-base font-semibold ${
                      isDarkMode ? "text-white" : "text-black"
                    } mb-1`}
                  >
                    {plate.seller_name || 'Private Seller'}
                  </StyledText>
                  <StyledText
                    className={`text-sm ${
                      isDarkMode ? "text-white/70" : "text-black/70"
                    }`}
                  >
                    Contact: {plate.seller_phone || 'N/A'}
                  </StyledText>
                </StyledView>

                <StyledView 
                  className="flex-row items-center"
                  style={{ gap: 8 }}
                >
                  {!isOwnListing && (
                    isChatLoading ? (
                      <View style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator size="small" color={isDarkMode ? "#FFFFFF" : "#000000"} />
                      </View>
                    ) : (
                      <ActionButton
                        icon="chatbubble-outline"
                        onPress={handleChatPress}
                        isDarkMode={isDarkMode}
                      />
                    )
                  )}
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
                </StyledView>
              </StyledView>
            )}
          </StyledView>
        </StyledPressable>
      </StyledView>

      {/* Auth Required Modal */}
      <AuthRequiredModal
        isVisible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </Animated.View>
  );
}
