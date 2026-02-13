import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Linking,
  StyleSheet,
  Animated,
  I18nManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/utils/ThemeContext';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/utils/AuthContext';
import { useGuestUser } from '@/utils/GuestUserContext';
import { getViewerInfo, trackBannerEvent } from '@/utils/bannerAnalytics';
import { FontAwesome } from '@expo/vector-icons';

interface Banner {
  id: string;
  created_at: string;
  image_url: string;
  redirect_to: string | null;
}

const Banner: React.FC = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { guestId } = useGuestUser();
  const scrollViewRef = useRef<ScrollView>(null);
  const autoScrollRef = useRef<NodeJS.Timeout | null>(null);
  const trackedImpressions = useRef<Set<string>>(new Set());
  const { width: screenWidth } = Dimensions.get('window');
  const isRTL = I18nManager.isRTL;
  // Account for horizontal margins (mx-3 => 12px left + 12px right)
  const contentWidth = screenWidth - 24;
  // Maintain 3780x1890 aspect ratio (2:1)
  const bannerHeight = contentWidth / 2;

  const fetchBanners = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setBanners(data || []);
    } catch (error) {
      console.error('Error fetching banners:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  // Track impression for a specific banner slide
  const trackImpression = useCallback((bannerId: string) => {
    if (trackedImpressions.current.has(bannerId)) return;
    const viewer = getViewerInfo(user?.id, guestId);
    if (!viewer) return;
    trackedImpressions.current.add(bannerId);
    setTimeout(() => trackBannerEvent(bannerId, viewer, 'impression'), 500);
  }, [user?.id, guestId]);

  // Track the first visible banner after data loads
  useEffect(() => {
    if (banners.length > 0) {
      trackImpression(banners[0].id);
    }
  }, [banners, trackImpression]);

  // Auto-scroll functionality
  useEffect(() => {
    if (banners.length > 1) {
      const startAutoScroll = () => {
        autoScrollRef.current = setInterval(() => {
          setCurrentIndex((prevIndex) => {
            const nextIndex = (prevIndex + 1) % banners.length;
            scrollViewRef.current?.scrollTo({
              x: nextIndex * screenWidth,
              animated: true,
            });
            // Track impression for auto-scrolled banner
            if (banners[nextIndex]) {
              trackImpression(banners[nextIndex].id);
            }
            return nextIndex;
          });
        }, 3000); // Auto-scroll every 3 seconds
      };

      startAutoScroll();

      return () => {
        if (autoScrollRef.current) {
          clearInterval(autoScrollRef.current);
        }
      };
    }
  }, [banners.length, screenWidth]);

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / screenWidth);
    setCurrentIndex(index);
    // Track impression for the newly visible banner slide
    if (banners[index]) {
      trackImpression(banners[index].id);
    }
  };

  const handleInternalNavigation = (redirectTo: string): boolean => {
    if (redirectTo.startsWith('fleet://dealership/')) {
      const dealershipId = redirectTo.replace('fleet://dealership/', '');
      router.push({ pathname: '/(home)/(user)/DealershipDetails', params: { dealershipId } });
      return true;
    }
    if (redirectTo.startsWith('fleet://car/')) {
      const carId = redirectTo.replace('fleet://car/', '');
      router.push({ pathname: '/(home)/(user)/CarDetails', params: { carId, isDealerView: 'false' } });
      return true;
    }
    if (redirectTo.startsWith('fleet://category/')) {
      const category = redirectTo.replace('fleet://category/', '');
      router.push({ pathname: '/(home)/(user)/(tabs)', params: { category } });
      return true;
    }
    if (redirectTo.startsWith('fleet://brand/')) {
      const brand = redirectTo.replace('fleet://brand/', '');
      router.push({ pathname: '/(home)/(user)/CarsByBrand', params: { brand } });
      return true;
    }
    return false;
  };

  const handleBannerPress = async (bannerId: string, redirectTo: string | null) => {
    // Track click (fire-and-forget, before processing redirect)
    const viewer = getViewerInfo(user?.id, guestId);
    if (viewer) {
      trackBannerEvent(bannerId, viewer, 'click');
    }

    if (!redirectTo?.trim()) return;

    try {
      if (handleInternalNavigation(redirectTo)) return;

      // For external URLs, open in browser
      const url = redirectTo.startsWith('http') ? redirectTo : `https://${redirectTo}`;
      await Linking.openURL(url);
    } catch (error) {
      console.error('Error handling banner press:', error);
    }
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
    scrollViewRef.current?.scrollTo({
      x: index * screenWidth,
      animated: true,
    });
  };

  if (isLoading) {
    return (
      <View className={`mx-3 mb-4 ${isDarkMode ? 'bg-[#1c1c1c]' : 'bg-[#f5f5f5]'} rounded-2xl`}>
        <View className="h-48 justify-center items-center">
          <Text className={`${isDarkMode ? 'text-white' : 'text-black'}`}>
            {t('banner.loading')}
          </Text>
        </View>
      </View>
    );
  }

  if (banners.length === 0) {
    return null; // Don't render anything if no banners
  }

  return (
    <View className={`mx-3 my-4 ${isDarkMode ? 'bg-[#1c1c1c]' : 'bg-[#f5f5f5]'} rounded-2xl overflow-hidden`} style={{ position: 'relative' }}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        decelerationRate="fast"
        style={{ height: bannerHeight }}
      >
        {banners.map((banner, index) => (
          <TouchableOpacity
            key={banner.id}
            onPress={() => handleBannerPress(banner.id, banner.redirect_to)}
            style={{ width: contentWidth }}
            activeOpacity={banner.redirect_to ? 0.8 : 1}
          >
            <Image
              source={{ uri: banner.image_url }}
              style={{ width: contentWidth, height: bannerHeight }}
              resizeMode="contain"
            />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Pagination dots overlaid at the bottom of the banner */}
      {banners.length > 1 && (
        <View
          style={{
            position: 'absolute',
            bottom: 8,
            left: isRTL ? undefined : 0,
            right: isRTL ? 0 : undefined,
            flexDirection: isRTL ? 'row-reverse' : 'row',
          }}
          className="justify-center items-center"
        >
          {banners.map((_, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => goToSlide(index)}
              className={`mx-1 w-2 h-2 rounded-full ${
                index === currentIndex
                  ? isDarkMode
                    ? 'bg-white'
                    : 'bg-black'
                  : isDarkMode
                  ? 'bg-white/30'
                  : 'bg-black/30'
              }`}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  bannerImage: {
    width: '100%',
    height: 200,
  },
});

export default Banner;
