// components/SkeletonCategorySelector.tsx
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '@/utils/ThemeContext';
import ShimmerPlaceholder from './ShimmerPlaceholder'; // Import

const SkeletonCategorySelector = () => {
  const { isDarkMode } = useTheme();

  return (
    <View>
      <Text className={`text-xl font-bold mb-4 ml-3 ${isDarkMode ? 'text-white' : 'text-black'}`}>
        Explore by Category
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="pl-4"
      >
        {Array.from({ length: 6 }).map((_, index) => (
          // The parent view no longer needs a background color
          <ShimmerPlaceholder key={index} style={styles.skeletonItem} />
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  skeletonItem: {
    width: 100,
    height: 140,
    marginRight: 12,
    borderRadius: 16,
  },
  // The inner views are no longer needed as the ShimmerPlaceholder is the full shape.
});

export default SkeletonCategorySelector;