/**
 * Lazy Loading Optimizations for FlatList
 * 
 * Provides optimized FlatList props and utilities for:
 * - Super lazy loading (render only visible items)
 * - Memory-efficient rendering
 * - Smooth scrolling performance
 * - Reduced initial render time
 */

import { FlatListProps } from 'react-native';

/**
 * Optimized FlatList props for aggressive lazy loading
 * Use these props on all FlatLists to minimize rendering and memory usage
 */
export const LAZY_FLATLIST_PROPS: Partial<FlatListProps<any>> = {
  // Render only 5 items initially
  initialNumToRender: 5,
  // Render 5 items per batch
  maxToRenderPerBatch: 5,
  // Update cells every 50ms (balance between smoothness and performance)
  updateCellsBatchingPeriod: 50,
  // Keep 5 windows worth of items rendered (reduces memory)
  windowSize: 5,
  // Remove off-screen views from native view hierarchy (saves memory)
  removeClippedSubviews: true,
  // Optimize scrolling performance
  scrollEventThrottle: 16,
  // Disable scroll indicators for better performance
  showsVerticalScrollIndicator: false,
  showsHorizontalScrollIndicator: false,
};

/**
 * More aggressive lazy loading props for very long lists
 * Use when lists can have 100+ items
 */
export const ULTRA_LAZY_FLATLIST_PROPS: Partial<FlatListProps<any>> = {
  ...LAZY_FLATLIST_PROPS,
  initialNumToRender: 3,
  maxToRenderPerBatch: 3,
  windowSize: 3,
};

/**
 * Balanced lazy loading props for medium lists
 * Use when lists typically have 20-100 items
 */
export const BALANCED_FLATLIST_PROPS: Partial<FlatListProps<any>> = {
  ...LAZY_FLATLIST_PROPS,
  initialNumToRender: 8,
  maxToRenderPerBatch: 8,
  windowSize: 8,
};

/**
 * Get optimized props based on estimated list size
 */
export function getOptimizedFlatListProps(estimatedItemCount: number): Partial<FlatListProps<any>> {
  if (estimatedItemCount > 100) {
    return ULTRA_LAZY_FLATLIST_PROPS;
  } else if (estimatedItemCount > 20) {
    return BALANCED_FLATLIST_PROPS;
  }
  return LAZY_FLATLIST_PROPS;
}

/**
 * Optimized onEndReachedThreshold based on list size
 */
export function getOptimizedEndReachedThreshold(itemCount: number): number {
  if (itemCount > 100) {
    return 0.3; // Trigger earlier for long lists
  }
  return 0.5; // Default threshold
}

