import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '@/utils/ThemeContext';

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
          <View key={index} style={styles.skeletonItem}>
            <View style={styles.skeletonImage} />
            <View style={styles.skeletonText} />
          </View>
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
    backgroundColor: '#ddd',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skeletonImage: {
    width: 60,
    height: 60,
    backgroundColor: '#eee',
    borderRadius: 30,
    marginBottom: 8,
  },
  skeletonText: {
    width: 80,
    height: 12,
    backgroundColor: '#eee',
  },
});

export default SkeletonCategorySelector;