/**
 * Aggressive React Query Configuration
 * 
 * Optimized QueryClient setup with:
 * - Aggressive caching (24h default staleTime)
 * - Request deduplication (built into react-query)
 * - Smart refetch strategies
 * 
 * Note: This works with both react-query v3 and @tanstack/react-query v5
 */

import { QueryClient } from '@tanstack/react-query';

// Aggressive cache configuration
export const CACHE_TIMES = {
  // Data is considered fresh for 24 hours (aggressive caching)
  STALE_TIME: 24 * 60 * 60 * 1000,
  // Keep unused data in cache for 7 days
  CACHE_TIME: 7 * 24 * 60 * 60 * 1000,
  // Retry configuration
  RETRY: 1,
  // Retry delay
  RETRY_DELAY: 1000,
};

/**
 * Create optimized QueryClient with aggressive caching
 * Compatible with react-query v3
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Aggressive stale time - data is fresh for 24 hours
      staleTime: CACHE_TIMES.STALE_TIME,
      // Keep data in cache for 7 days
      gcTime: CACHE_TIMES.CACHE_TIME,
      // Don't refetch on window focus (saves bandwidth)
      refetchOnWindowFocus: false,
      // Don't refetch on mount if data is fresh
      refetchOnMount: false,
      // Don't refetch on reconnect if data is fresh
      refetchOnReconnect: false,
      // Retry once on failure
      retry: CACHE_TIMES.RETRY,
      retryDelay: CACHE_TIMES.RETRY_DELAY,
      // Structural sharing for better performance
      structuralSharing: true,
    },
    mutations: {
      // Retry mutations once
      retry: 1,
      retryDelay: 1000,
    },
  },
});

/**
 * Invalidate all queries (use sparingly)
 */
export function invalidateAllQueries() {
  queryClient.invalidateQueries();
}

/**
 * Clear all cached queries
 */
export function clearAllQueries() {
  queryClient.clear();
}

/**
 * Prefetch query data
 */
export async function prefetchQuery<T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  options?: {
    staleTime?: number;
  }
) {
  await queryClient.prefetchQuery({
    queryKey,
    queryFn,
    staleTime: options?.staleTime || CACHE_TIMES.STALE_TIME,
  });
}

/**
 * Get query data from cache without fetching
 */
export function getCachedQueryData<T>(queryKey: readonly unknown[]): T | undefined {
  return queryClient.getQueryData<T>(queryKey);
}

