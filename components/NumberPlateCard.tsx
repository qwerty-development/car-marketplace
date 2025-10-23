import React, { useMemo, useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  Linking,
  Alert,
  Image,
  Pressable,
  Animated,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styled } from "nativewind";
import { useTheme } from "@/utils/ThemeContext";
import { useRouter } from "expo-router";
import { useLanguage } from '@/utils/LanguageContext';
import i18n from '@/utils/i18n';
import { useTranslation } from 'react-i18next';
import { useAuth } from "@/utils/AuthContext";
import * as Haptics from 'expo-haptics';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledImage = styled(Image);
const StyledPressable = styled(Pressable);

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
  const router = useRouter();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = windowWidth - 32;
  const imageHeight = 260;

  const isDealer = plate.seller_type === 'dealer';

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
      
      if (onPress) {
        onPress();
      }
    } catch (error) {
      console.error("Error handling card press:", error);
    }
  }, [onPress, scaleAnim]);

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
        } rounded-3xl overflow-hidden shadow-xl`}
      >
        <Pressable onPress={handleCardPress} className="bg-neutral-800">
          <View className="relative bg-neutral-800">
            {plate.picture ? (
              <OptimizedImage
                source={{ uri: plate.picture }}
                style={{ width: cardWidth, height: imageHeight }}
              />
            ) : (
              // Fallback design if no image
              <View 
                style={{ width: cardWidth, height: imageHeight }}
                className="bg-gradient-to-br from-orange-500 to-red-600 items-center justify-center"
              >
                <StyledText className="text-white text-6xl font-bold tracking-widest">
                  {plateDisplay}
                </StyledText>
              </View>
            )}
          </View>
        </Pressable>

        <StyledPressable
          onPress={handleCardPress}
          className="active:opacity-90"
        >
          {/* Plate Info Section */}
          <View className="px-4 py-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                {/* Price */}
                <StyledText
                  className="text-lg font-bold text-red"
                  numberOfLines={1}
                  style={{ 
                    textAlign: 'left', 
                    marginBottom: 4
                  }}
                >
                  ${plate.price.toLocaleString()}
                </StyledText>
                
                {/* Plate Number */}
                <StyledText
                  className={`text-2xl font-bold ${
                    isDarkMode ? "text-white" : "text-black"
                  }`}
                  numberOfLines={1}
                  style={{ 
                    textAlign: 'left',
                    letterSpacing: 2,
                    textShadowColor: isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                    textShadowOffset: { width: 1, height: 1 },
                    textShadowRadius: 2
                  }}
                >
                  {plateDisplay}
                </StyledText>
              </View>
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
                    <StyledImage
                      source={{ uri: plate.dealership_logo }}
                      style={{ width: 48, height: 48 }}
                      className="rounded-full border border-textgray/20"
                      resizeMode="cover"
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
    </Animated.View>
  );
}
