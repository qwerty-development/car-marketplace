// components/SkeletonByBrands.tsx
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '@/utils/ThemeContext';
import ShimmerPlaceholder from './ShimmerPlaceholder'; // Import

const SkeletonByBrands = () => {
  const { isDarkMode } = useTheme();

  return (
    <View className={`mt-3 px-3 mb-4 ${isDarkMode ? '' : 'bg-[#FFFFFF]'}`}>
      <Text className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>
        Explore by Brands
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="rounded-lg mt-2"
      >
        {Array.from({ length: 5 }).map((_, index) => (
          <View key={index} style={styles.skeletonItem}>
            {/* Replace Views with ShimmerPlaceholders */}
            <ShimmerPlaceholder style={styles.skeletonLogo} />
            <ShimmerPlaceholder style={styles.skeletonText} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  skeletonItem: {
    alignItems: 'center',
    marginRight: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  skeletonLogo: {
    width: 80,
    height: 80,
    borderRadius: 40, // Keep the shape
  },
  skeletonText: {
    width: 60,
    height: 12,
    marginTop: 8,
    borderRadius: 4, // Add a slight radius for a softer look
  },
});

export default SkeletonByBrands;