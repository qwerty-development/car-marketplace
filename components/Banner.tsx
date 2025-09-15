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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/utils/ThemeContext';
import { supabase } from '@/utils/supabase';
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
  const scrollViewRef = useRef<ScrollView>(null);
  const autoScrollRef = useRef<NodeJS.Timeout | null>(null);
  const { width: screenWidth } = Dimensions.get('window');

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
  };

  const handleBannerPress = async (redirectTo: string | null) => {
    try {
      // If no redirect URL, do nothing
      if (!redirectTo || redirectTo.trim() === '') {
        console.log('Banner has no redirect URL');
        return;
      }

      // Check if it's a dealership redirect (internal app navigation)
      if (redirectTo.startsWith('fleet://dealership/')) {
        const dealershipId = redirectTo.replace('fleet://dealership/', '');
        router.push({
          pathname: '/(home)/(user)/DealershipDetails',
          params: { dealershipId },
        });
        return;
      }
      
      // Check if it's a car redirect (internal app navigation)
      if (redirectTo.startsWith('fleet://car/')) {
        const carId = redirectTo.replace('fleet://car/', '');
        router.push({
          pathname: '/(home)/(user)/CarDetails',
          params: { 
            carId,
            isDealerView: 'false',
          },
        });
        return;
      }
      
      // Check if it's a category redirect (internal app navigation)
      if (redirectTo.startsWith('fleet://category/')) {
        const category = redirectTo.replace('fleet://category/', '');
        // Navigate to home with category filter
        router.push({
          pathname: '/(home)/(user)/(tabs)',
          params: { category },
        });
        return;
      }
      
      // Check if it's a brand redirect (internal app navigation)
      if (redirectTo.startsWith('fleet://brand/')) {
        const brand = redirectTo.replace('fleet://brand/', '');
        router.push({
          pathname: '/(home)/(user)/CarsByBrand',
          params: { brand },
        });
        return;
      }
      
      // For external URLs, open in browser
      const url = redirectTo.startsWith('http') ? redirectTo : `https://${redirectTo}`;
      const supported = await Linking.canOpenURL(url);
      
      if (supported) {
        await Linking.openURL(url);
      } else {
        console.error('Cannot open URL:', url);
      }
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
            Loading banners...
          </Text>
        </View>
      </View>
    );
  }

  if (banners.length === 0) {
    return null; // Don't render anything if no banners
  }

  return (
    <View className={`mx-3 mb-4 ${isDarkMode ? 'bg-[#1c1c1c]' : 'bg-[#f5f5f5]'} rounded-2xl overflow-hidden`}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        decelerationRate="fast"
        style={{ height: 200 }}
      >
        {banners.map((banner, index) => (
          <TouchableOpacity
            key={banner.id}
            onPress={() => handleBannerPress(banner.redirect_to)}
            style={{ width: screenWidth - 24 }} // Account for margin
            activeOpacity={banner.redirect_to ? 0.8 : 1}
            disabled={!banner.redirect_to}
          >
            <Image
              source={{ uri: banner.image_url }}
              style={styles.bannerImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Pagination dots */}
      {banners.length > 1 && (
        <View className="flex-row justify-center items-center py-3">
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
