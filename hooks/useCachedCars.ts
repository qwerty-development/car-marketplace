/**
 * Optimized hook for fetching cars with aggressive caching
 * 
 * Features:
 * - Request deduplication
 * - Aggressive caching (24h)
 * - Smart prefetching
 * - Reduced Supabase egress
 */

import { useQuery } from 'react-query';
import { cachedSelect } from '@/utils/supabaseCache';
import { supabase } from '@/utils/supabase';
import { CACHE_CONFIG } from '@/utils/supabaseCache';
import { prefetchCarImages } from '@/utils/smartPrefetch';

interface CarFilters {
  make?: string[];
  model?: string[];
  category?: string[];
  condition?: string[];
  color?: string[];
  yearRange?: [number, number];
  priceRange?: [number, number];
  mileageRange?: [number, number];
  dealership?: number[];
  specialFilter?: 'newArrivals' | 'mostPopular';
}

interface UseCachedCarsOptions {
  table?: 'cars' | 'cars_rent';
  filters?: CarFilters;
  sortOption?: string | null;
  searchQuery?: string;
  page?: number;
  pageSize?: number;
  enabled?: boolean;
  prefetchImages?: boolean;
}

export function useCachedCars(options: UseCachedCarsOptions = {}) {
  const {
    table = 'cars',
    filters = {},
    sortOption = null,
    searchQuery = '',
    page = 1,
    pageSize = 20,
    enabled = true,
    prefetchImages: shouldPrefetchImages = true,
  } = options;

  // Generate query key
  const queryKey = [
    'cached-cars',
    table,
    filters,
    sortOption,
    searchQuery,
    page,
    pageSize,
  ];

  // Fetch function with caching
  const fetchCars = async () => {
    const selectString = table === 'cars_rent'
      ? `*, dealerships (name,logo,phone,location,latitude,longitude)`
      : `*, dealerships (name,logo,phone,location,latitude,longitude), users (name, id)`;

    const cacheKey = `cars:${table}:page:${page}:${JSON.stringify(filters)}:${sortOption}:${searchQuery}`;

    const result = await cachedSelect(
      table,
      selectString,
      (query) => {
        let builder = query.eq('status', 'available');

        // Apply filters
        if (filters.make && filters.make.length > 0) {
          builder = builder.in('make', filters.make);
        }
        if (filters.model && filters.model.length > 0) {
          builder = builder.in('model', filters.model);
        }
        if (filters.category && filters.category.length > 0) {
          builder = builder.in('category', filters.category);
        }
        if (filters.condition && filters.condition.length > 0 && table === 'cars') {
          builder = builder.in('condition', filters.condition);
        }
        if (filters.color && filters.color.length > 0) {
          builder = builder.in('color', filters.color);
        }
        if (filters.dealership && filters.dealership.length > 0) {
          builder = builder.in('dealership_id', filters.dealership);
        }
        if (filters.yearRange) {
          builder = builder
            .gte('year', filters.yearRange[0])
            .lte('year', filters.yearRange[1]);
        }
        if (filters.priceRange) {
          builder = builder
            .gte('price', filters.priceRange[0])
            .lte('price', filters.priceRange[1]);
        }
        if (filters.mileageRange) {
          builder = builder
            .gte('mileage', filters.mileageRange[0])
            .lte('mileage', filters.mileageRange[1]);
        }

        // Special filters
        if (filters.specialFilter === 'newArrivals') {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          builder = builder.gte('listed_at', sevenDaysAgo.toISOString());
        }

        // Search query
        if (searchQuery) {
          builder = builder.or(
            `make.ilike.%${searchQuery}%,model.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`
          );
        }

        // Sorting
        if (sortOption) {
          const [column, order] = sortOption.split('_');
          builder = builder.order(column, { ascending: order === 'asc' });
        } else {
          builder = builder.order('listed_at', { ascending: false });
        }

        // Pagination
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        builder = builder.range(from, to);

        return builder;
      },
      {
        ttl: filters.specialFilter === 'newArrivals' 
          ? CACHE_CONFIG.SHORT_TTL 
          : CACHE_CONFIG.DEFAULT_TTL,
      }
    );

    if (result.error) {
      throw result.error;
    }

    return result.data || [];
  };

  // Use React Query with aggressive caching
  const query = useQuery(
    queryKey,
    fetchCars,
    {
      enabled,
      staleTime: CACHE_CONFIG.DEFAULT_TTL,
      cacheTime: CACHE_CONFIG.LONG_TTL,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
    }
  );

  // Prefetch images when data is loaded
  if (shouldPrefetchImages && query.data && query.data.length > 0) {
    prefetchCarImages(query.data, {
      startIndex: 0,
      count: Math.min(10, query.data.length),
    }).catch(console.warn);
  }

  return {
    ...query,
    cars: query.data || [],
    fromCache: query.data ? true : false, // React Query handles caching internally
  };
}

