import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/utils/ThemeContext';

const SkeletonCarCard = () => {
  const { isDarkMode } = useTheme();

  return (
    <View style={[styles.card, isDarkMode ? styles.darkCard : null]}>
      <View style={styles.imageSkeleton} />
      <View style={styles.infoSkeleton}>
        <View style={styles.titleSkeleton} />
        <View style={styles.detailSkeleton} />
        <View style={styles.detailSkeleton} />
      </View>
      <View style={styles.footerSkeleton} />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    overflow: 'hidden',
  },
  darkCard: {
    backgroundColor: '#333',
  },
  imageSkeleton: {
    width: '100%',
    height: 200,
    backgroundColor: '#ddd',
  },
  infoSkeleton: {
    padding: 16,
  },
  titleSkeleton: {
    width: '80%',
    height: 24,
    backgroundColor: '#ddd',
    marginBottom: 8,
  },
  detailSkeleton: {
    width: '60%',
    height: 16,
    backgroundColor: '#ddd',
    marginBottom: 4,
  },
  footerSkeleton: {
    height: 50,
    backgroundColor: '#eee',
  },
});

export default SkeletonCarCard;