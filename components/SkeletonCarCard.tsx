// components/SkeletonCarCard.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import ShimmerPlaceholder from './ShimmerPlaceholder'; // 1. Import the new component

const SkeletonCarCard = () => {
  // 2. The parent card no longer needs a background color, it can be transparent
  return (
    <View style={styles.card}>
      {/* 3. Replace each View with a ShimmerPlaceholder, passing the style */}
      <ShimmerPlaceholder style={styles.imageSkeleton} />
      <View style={styles.infoSkeleton}>
        <ShimmerPlaceholder style={styles.titleSkeleton} />
        <ShimmerPlaceholder style={styles.detailSkeleton} />
        <ShimmerPlaceholder style={[styles.detailSkeleton, { width: '40%' }]} />
      </View>
      <ShimmerPlaceholder style={styles.footerSkeleton} />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    // The background is now handled by ShimmerPlaceholder, so this can be transparent
    backgroundColor: 'transparent',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    overflow: 'hidden',
  },
  imageSkeleton: {
    width: '100%',
    height: 200,
  },
  infoSkeleton: {
    padding: 16,
  },
  titleSkeleton: {
    width: '80%',
    height: 24,
    marginBottom: 12,
    borderRadius: 4,
  },
  detailSkeleton: {
    width: '60%',
    height: 16,
    marginBottom: 6,
    borderRadius: 4,
  },
  footerSkeleton: {
    height: 50,
  },
});

export default SkeletonCarCard;