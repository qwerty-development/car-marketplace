import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '@/utils/ThemeContext';

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
            <View style={styles.skeletonLogo} />
            <View style={styles.skeletonText} />
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
    backgroundColor: '#ddd',
    borderRadius: 40,
  },
  skeletonText: {
    width: 60,
    height: 12,
    backgroundColor: '#ddd',
    marginTop: 8,
  },
});

export default SkeletonByBrands;