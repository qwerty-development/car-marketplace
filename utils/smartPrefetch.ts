/**
 * Smart Prefetching Utilities
 * 
 * Intelligently prefetches data and images to reduce perceived load times
 * and minimize Supabase egress. Features:
 * 
 * - Predictive prefetching based on user behavior
 * - Image prefetching for list items
 * - Query prefetching for likely next screens
 * - Bandwidth-aware prefetching
 */

import { prefetchImages } from './CachedImage';
import { prefetchQuery } from './queryClient';
import { prefetchQuery as prefetchSupabaseQuery } from './supabaseCache';
import { supabase } from './supabase';
import NetInfo from '@react-native-community/netinfo';

// Prefetch configuration
const PREFETCH_CONFIG = {
  // Maximum images to prefetch at once
  MAX_CONCURRENT_IMAGES: 5,
  // Maximum queries to prefetch at once
  MAX_CONCURRENT_QUERIES: 3,
  // Only prefetch on WiFi
  WIFI_ONLY: false,
  // Prefetch delay to avoid blocking initial render
  DELAY_MS: 500,
};

/**
 * Check if network conditions allow prefetching
 */
async function canPrefetch(): Promise<boolean> {
  const netInfo = await NetInfo.fetch();
  
  if (PREFETCH_CONFIG.WIFI_ONLY) {
    return netInfo.type === 'wifi' && netInfo.isConnected === true;
  }
  
  return netInfo.isConnected === true;
}

/**
 * Prefetch car images for a list of cars
 * Intelligently batches and prioritizes based on visibility
 */
export async function prefetchCarImages(
  cars: Array<{ images?: string[]; id: number }>,
  options: {
    startIndex?: number;
    count?: number;
    priority?: 'high' | 'normal' | 'low';
  } = {}
): Promise<void> {
  if (!(await canPrefetch())) {
    return;
  }

  const { startIndex = 0, count = 10, priority = 'normal' } = options;
  const carsToPrefetch = cars.slice(startIndex, startIndex + count);
  
  const imageUrls: string[] = [];
  for (const car of carsToPrefetch) {
    if (car.images && car.images.length > 0) {
      // Prefetch first image (most important)
      imageUrls.push(car.images[0]);
    }
  }

  if (imageUrls.length > 0) {
    // Batch prefetch with delay to avoid blocking
    setTimeout(() => {
      prefetchImages(imageUrls.slice(0, PREFETCH_CONFIG.MAX_CONCURRENT_IMAGES));
    }, PREFETCH_CONFIG.DELAY_MS);
  }
}
/**
 * Prefetch next page of cars for infinite scroll
 */
export async function prefetchNextPage(
  table: 'cars' | 'cars_rent',
  currentPage: number,
  filters: any,
  sortOption: string | null
): Promise<void> {
  if (!(await canPrefetch())) {
    return;
  }

  setTimeout(() => {
    prefetchSupabaseQuery(
      async () => {
        const selectString = table === 'cars_rent'
          ? `*, dealerships (name,logo,phone,location,latitude,longitude)`
          : `*, dealerships (name,logo,phone,location,latitude,longitude), users!cars_user_id_fkey (name, id, phone_number)`;
        
        let query = supabase
          .from(table)
          .select(selectString, { count: 'exact' })
          .eq('status', 'available')
          .range((currentPage + 1) * 20 - 20, (currentPage + 1) * 20 - 1);

        // Apply filters (simplified - you may need to adapt based on your filter structure)
        if (filters.make && filters.make.length > 0) {
          query = query.in('make', filters.make);
        }
        if (filters.model && filters.model.length > 0) {
          query = query.in('model', filters.model);
        }

        // Apply sorting
        if (sortOption) {
          const [column, order] = sortOption.split('_');
          query = query.order(column, { ascending: order === 'asc' });
        }

        const { data, error } = await query;
        return { data, error };
      },
      `cars:${table}:page:${currentPage + 1}:${JSON.stringify(filters)}:${sortOption}`,
      { ttl: 60 * 60 * 1000 } // 1 hour for paginated data
    );
  }, PREFETCH_CONFIG.DELAY_MS);
}
export { PREFETCH_CONFIG };

