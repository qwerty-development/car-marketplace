import React, { useState, useEffect } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  Dimensions,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/utils/ThemeContext';
import { supabase } from '@/utils/supabase';

interface AdBannerData {
  id: number;
  created_at: string;
  image_url: string;
  redirect_to: string | null;
  active: boolean;
}

const AdBanner: React.FC = () => {
  const [ad, setAd] = useState<AdBannerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const { width: screenWidth } = Dimensions.get('window');
  // Account for horizontal margins (mx-3 => 12px left + 12px right)
  const contentWidth = screenWidth - 24;
  // Maintain 2:1 aspect ratio like Banner component
  const bannerHeight = contentWidth / 2;

  useEffect(() => {
    fetchRandomAd();
  }, []);

  const fetchRandomAd = async () => {
    try {
      setIsLoading(true);
      
      // Fetch all active ads
      const { data, error } = await supabase
        .from('ad_banners')
        .select('*')
        .eq('active', true);

      if (error) throw error;

      if (data && data.length > 0) {
        // Select a random ad from the active ads
        const randomIndex = Math.floor(Math.random() * data.length);
        setAd(data[randomIndex]);
      } else {
        setAd(null);
      }
    } catch (error) {
      console.error('Error fetching ad banner:', error);
      setAd(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInternalNavigation = (redirectTo: string) => {
    // Check if it's a dealership redirect
    if (redirectTo.startsWith('fleet://dealership/')) {
      const dealershipId = redirectTo.replace('fleet://dealership/', '');
      router.push({
        pathname: '/(home)/(user)/DealershipDetails',
        params: { dealershipId },
      });
      return true;
    }
    
    // Check if it's a car redirect
    if (redirectTo.startsWith('fleet://car/')) {
      const carId = redirectTo.replace('fleet://car/', '');
      router.push({
        pathname: '/(home)/(user)/CarDetails',
        params: { carId, isDealerView: 'false' },
      });
      return true;
    }
    
    // Check if it's a category redirect
    if (redirectTo.startsWith('fleet://category/')) {
      const category = redirectTo.replace('fleet://category/', '');
      router.push({
        pathname: '/(home)/(user)/(tabs)',
        params: { category },
      });
      return true;
    }
    
    // Check if it's a brand redirect
    if (redirectTo.startsWith('fleet://brand/')) {
      const brand = redirectTo.replace('fleet://brand/', '');
      router.push({
        pathname: '/(home)/(user)/CarsByBrand',
        params: { brand },
      });
      return true;
    }
    
    return false;
  };

  const handleAdPress = async (redirectTo: string | null) => {
    try {
      if (!redirectTo || redirectTo.trim() === '') {
        console.log('Ad has no redirect URL');
        return;
      }

      // Try internal navigation first
      if (handleInternalNavigation(redirectTo)) {
        return;
      }
      
      // Handle external URLs
      const url = redirectTo.startsWith('http') ? redirectTo : `https://${redirectTo}`;
      const supported = await Linking.canOpenURL(url);
      
      if (supported) {
        await Linking.openURL(url);
      } else {
        console.error('Cannot open URL:', url);
      }
    } catch (error) {
      console.error('Error handling ad press:', error);
    }
  };

  if (isLoading) {
    return (
      <View className={`mx-3 mb-4 ${isDarkMode ? 'bg-[#1c1c1c]' : 'bg-[#f5f5f5]'} rounded-2xl`}>
        <View className="h-48 justify-center items-center">
          <ActivityIndicator color={isDarkMode ? '#FFFFFF' : '#000000'} />
        </View>
      </View>
    );
  }

  // Don't render anything if no ad is available
  if (!ad || !ad.image_url) {
    return null;
  }

  return (
    <View className={`mx-3 my-4 ${isDarkMode ? 'bg-[#1c1c1c]' : 'bg-[#f5f5f5]'} rounded-2xl overflow-hidden`}>
      <TouchableOpacity
        onPress={() => handleAdPress(ad.redirect_to)}
        activeOpacity={ad.redirect_to ? 0.8 : 1}
        disabled={!ad.redirect_to}
      >
        <Image
          source={{ uri: ad.image_url }}
          style={{ width: contentWidth, height: bannerHeight }}
          resizeMode="contain"
        />
      </TouchableOpacity>
    </View>
  );
};

export default AdBanner;
