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
  // 50ms batching avoids per-frame content-size changes that cause Android scroll snap
  updateCellsBatchingPeriod: 50,
  // Keep 5 windows worth of items rendered (reduces memory)
  windowSize: 5,
  // false on Android: removeClippedSubviews causes height re-measurement on upward scroll,
  // changing contentSize and triggering a native scroll position correction (snap-back)
  removeClippedSubviews: false,
  // Optimize scrolling performance
  scrollEventThrottle: 16,
  // Disable scroll indicators for better performance
  showsVerticalScrollIndicator: false,
  showsHorizontalScrollIndicator: false,
};

