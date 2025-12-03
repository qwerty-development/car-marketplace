/**
 * Aggressive Supabase Query Cache Layer
 * 
 * This module provides a caching wrapper around Supabase queries to minimize
 * egress bandwidth and improve performance. Features:
 * 
 * - Request deduplication (prevents duplicate concurrent requests)
 * - Aggressive caching with configurable TTL
 * - Cache persistence across app sessions
 * - Smart cache invalidation
 * - Memory-efficient cache size limits
 */

import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PostgrestQueryBuilder, PostgrestFilterBuilder } from '@supabase/supabase-js';
import { cacheLogger } from './cacheLogger';

// Cache configuration
const CACHE_CONFIG = {
  // Default TTL for cached queries (24 hours for most data)
  DEFAULT_TTL: 24 * 60 * 60 * 1000,
  // Short TTL for frequently changing data (5 minutes)
  SHORT_TTL: 5 * 60 * 1000,
  // Long TTL for static data (7 days)
  LONG_TTL: 7 * 24 * 60 * 60 * 1000,
  // Maximum cache size in MB
  MAX_CACHE_SIZE_MB: 50,
  // Cache key prefix
  CACHE_PREFIX: '@supabase_cache:',
};

// In-memory cache for fast access
const memoryCache = new Map<string, { data: any; timestamp: number; ttl: number }>();

// Pending requests map for deduplication
const pendingRequests = new Map<string, Promise<any>>();

// Cache entry interface
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  key: string;
}

/**
 * Generate a cache key from query parameters
 */
export function generateCacheKey(table: string, filters: any, select?: string): string {
  const keyParts = [
    table,
    select || '*',
    JSON.stringify(filters),
  ];
  return `${CACHE_CONFIG.CACHE_PREFIX}${keyParts.join(':')}`;
}

/**
 * Check if cache entry is still valid
 */
function isCacheValid(entry: CacheEntry<any>): boolean {
  const age = Date.now() - entry.timestamp;
  return age < entry.ttl;
}

/**
 * Get cached data from memory or persistent storage
 */
async function getCached<T>(key: string): Promise<{ data: T | null; fromMemory: boolean }> {
  const startTime = Date.now();
  const shortKey = key.length > 60 ? key.substring(0, 60) + '...' : key;
  
  // Check memory cache first
  const memoryEntry = memoryCache.get(key);
  if (memoryEntry) {
    if (isCacheValid(memoryEntry)) {
      const queryTime = Date.now() - startTime;
      const dataSize = JSON.stringify(memoryEntry.data).length;
      console.log(`[SupabaseCache] ✅ MEMORY HIT: ${shortKey} (${(dataSize / 1024).toFixed(2)}KB)`);
      cacheLogger.log(key, true, dataSize, queryTime);
      return { data: memoryEntry.data as T, fromMemory: true };
    } else {
      console.log(`[SupabaseCache] ⏰ MEMORY EXPIRED: ${shortKey} (age: ${Date.now() - memoryEntry.timestamp}ms, ttl: ${memoryEntry.ttl}ms)`);
      memoryCache.delete(key); // Remove expired entry
    }
  } else {
    console.log(`[SupabaseCache] 🔍 MEMORY MISS: ${shortKey}`);
  }

  // Check persistent storage
  try {
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      const entry: CacheEntry<T> = JSON.parse(stored);
      if (isCacheValid(entry)) {
        // Restore to memory cache
        memoryCache.set(key, {
          data: entry.data,
          timestamp: entry.timestamp,
          ttl: entry.ttl,
        });
        const queryTime = Date.now() - startTime;
        const dataSize = JSON.stringify(entry.data).length;
        console.log(`[SupabaseCache] ✅ DISK HIT: ${shortKey} (${(dataSize / 1024).toFixed(2)}KB)`);
        cacheLogger.log(key, true, dataSize, queryTime);
        return { data: entry.data, fromMemory: false };
      } else {
        // Remove expired entry
        const age = Date.now() - entry.timestamp;
        console.log(`[SupabaseCache] ⏰ DISK EXPIRED: ${shortKey} (age: ${age}ms, ttl: ${entry.ttl}ms)`);
        await AsyncStorage.removeItem(key);
      }
    } else {
      console.log(`[SupabaseCache] 🔍 DISK MISS: ${shortKey}`);
    }
  } catch (error) {
    console.warn('[SupabaseCache] Failed to read from storage:', error);
  }

  console.log(`[SupabaseCache] ❌ NO CACHE FOUND: ${shortKey}`);
  return { data: null, fromMemory: false };
}

/**
 * Store data in cache (memory + persistent)
 */
async function setCached<T>(key: string, data: T, ttl: number = CACHE_CONFIG.DEFAULT_TTL): Promise<void> {
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
    ttl,
    key,
  };

  // Store in memory cache
  memoryCache.set(key, entry);

  // Store in persistent cache (async, don't block)
  try {
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch (error) {
    console.warn('[SupabaseCache] Failed to write to storage:', error);
  }

  // Cleanup old memory entries if cache is too large
  if (memoryCache.size > 100) {
    const entries = Array.from(memoryCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    // Remove oldest 20% of entries
    const toRemove = Math.floor(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      memoryCache.delete(entries[i][0]);
    }
  }
}

/**
 * Clear cache for a specific key or pattern
 */
export async function clearCache(pattern?: string): Promise<void> {
  if (pattern) {
    // Clear matching keys
    const keys = await AsyncStorage.getAllKeys();
    const matchingKeys = keys.filter(key => key.includes(pattern));
    await AsyncStorage.multiRemove(matchingKeys);
    matchingKeys.forEach(key => memoryCache.delete(key));
  } else {
    // Clear all cache
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => key.startsWith(CACHE_CONFIG.CACHE_PREFIX));
    await AsyncStorage.multiRemove(cacheKeys);
    memoryCache.clear();
  }
}

/**
 * Cached Supabase query with deduplication
 */
export async function cachedQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  cacheKey: string,
  options: {
    ttl?: number;
    skipCache?: boolean;
    forceRefresh?: boolean;
  } = {}
): Promise<{ data: T | null; error: any; fromCache: boolean }> {
  const { ttl = CACHE_CONFIG.DEFAULT_TTL, skipCache = false, forceRefresh = false } = options;
  const queryStartTime = Date.now();

  // Check for pending request (deduplication)
  if (!forceRefresh && pendingRequests.has(cacheKey)) {
    console.log(`[SupabaseCache] 🔄 DEDUP: ${cacheKey}`);
    const pendingResult = await pendingRequests.get(cacheKey)!;
    return { ...pendingResult, fromCache: true };
  }

  // Check cache if not forcing refresh
  if (!forceRefresh && !skipCache) {
    console.log(`[SupabaseCache] 🔍 CHECKING CACHE: ${cacheKey.length > 60 ? cacheKey.substring(0, 60) + '...' : cacheKey}`);
    const cachedResult = await getCached<T>(cacheKey);
    if (cachedResult.data !== null) {
      const source = cachedResult.fromMemory ? 'memory' : 'disk';
      console.log(`[SupabaseCache] ✅ RETURNING CACHED DATA (${source}): ${cacheKey.length > 60 ? cacheKey.substring(0, 60) + '...' : cacheKey}`);
      return { data: cachedResult.data, error: null, fromCache: true };
    }
  } else {
    console.log(`[SupabaseCache] ⏭️ SKIPPING CACHE: ${cacheKey.length > 60 ? cacheKey.substring(0, 60) + '...' : cacheKey} (forceRefresh: ${forceRefresh}, skipCache: ${skipCache})`);
  }

  // Cache miss - execute query
  console.log(`[SupabaseCache] ❌ CACHE MISS - EXECUTING QUERY: ${cacheKey.length > 60 ? cacheKey.substring(0, 60) + '...' : cacheKey}`);
  const queryPromise = queryFn().then(result => {
    const queryTime = Date.now() - queryStartTime;
    const dataSize = result.data ? JSON.stringify(result.data).length : 0;
    
    // Cache successful results
    if (result.data !== null && !result.error) {
      console.log(`[SupabaseCache] 💾 STORING IN CACHE: ${cacheKey.length > 60 ? cacheKey.substring(0, 60) + '...' : cacheKey} (${(dataSize / 1024).toFixed(2)}KB, ${queryTime}ms)`);
      setCached(cacheKey, result.data, ttl).then(() => {
        console.log(`[SupabaseCache] ✅ CACHE STORED: ${cacheKey.length > 60 ? cacheKey.substring(0, 60) + '...' : cacheKey}`);
      }).catch(console.warn);
    } else {
      console.log(`[SupabaseCache] ⚠️ NOT CACHING (error or null data): ${cacheKey.length > 60 ? cacheKey.substring(0, 60) + '...' : cacheKey}`);
    }
    
    cacheLogger.log(cacheKey, false, dataSize, queryTime);
    pendingRequests.delete(cacheKey);
    return result;
  }).catch(error => {
    const queryTime = Date.now() - queryStartTime;
    cacheLogger.log(cacheKey, false, 0, queryTime);
    pendingRequests.delete(cacheKey);
    throw error;
  });

  pendingRequests.set(cacheKey, queryPromise);

  try {
    const result = await queryPromise;
    return { ...result, fromCache: false };
  } catch (error) {
    pendingRequests.delete(cacheKey);
    return { data: null, error, fromCache: false };
  }
}

/**
 * Cached select query wrapper
 */
export async function cachedSelect<T>(
  table: string,
  select: string = '*',
  filters?: (builder: PostgrestFilterBuilder<any, any, any>) => PostgrestFilterBuilder<any, any, any>,
  options: {
    ttl?: number;
    skipCache?: boolean;
    forceRefresh?: boolean;
  } = {}
): Promise<{ data: T[] | null; error: any; fromCache: boolean }> {
  const cacheKey = generateCacheKey(table, { select, filters: filters?.toString() || '' });

  return cachedQuery(
    async () => {
      let query = supabase.from(table).select(select);
      if (filters) {
        query = filters(query);
      }
      const result = await query;
      return { data: result.data as T[] | null, error: result.error };
    },
    cacheKey,
    options
  );
}

/**
 * Cached single row query
 */
export async function cachedSingle<T>(
  table: string,
  select: string = '*',
  filters?: (builder: PostgrestFilterBuilder<any, any, any>) => PostgrestFilterBuilder<any, any, any>,
  options: {
    ttl?: number;
    skipCache?: boolean;
    forceRefresh?: boolean;
  } = {}
): Promise<{ data: T | null; error: any; fromCache: boolean }> {
  const result = await cachedSelect<T>(table, select, filters, options);
  return {
    data: result.data?.[0] || null,
    error: result.error,
    fromCache: result.fromCache,
  };
}

/**
 * Cached RPC call
 */
export async function cachedRpc<T>(
  functionName: string,
  params: Record<string, any> = {},
  options: {
    ttl?: number;
    skipCache?: boolean;
    forceRefresh?: boolean;
  } = {}
): Promise<{ data: T | null; error: any; fromCache: boolean }> {
  const cacheKey = generateCacheKey(`rpc:${functionName}`, params);

  return cachedQuery(
    async () => {
      const result = await supabase.rpc(functionName, params);
      return { data: result.data as T | null, error: result.error };
    },
    cacheKey,
    options
  );
}

/**
 * Invalidate cache for a table
 */
export async function invalidateTable(table: string): Promise<void> {
  await clearCache(table);
}

/**
 * Prefetch data into cache
 */
export async function prefetchQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  cacheKey: string,
  ttl: number = CACHE_CONFIG.DEFAULT_TTL
): Promise<void> {
  try {
    const result = await queryFn();
    if (result.data !== null && !result.error) {
      await setCached(cacheKey, result.data, ttl);
    }
  } catch (error) {
    console.warn('[SupabaseCache] Prefetch failed:', error);
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  memoryEntries: number;
  persistentEntries: number;
  memorySize: number;
}> {
  const keys = await AsyncStorage.getAllKeys();
  const cacheKeys = keys.filter(key => key.startsWith(CACHE_CONFIG.CACHE_PREFIX));

  return {
    memoryEntries: memoryCache.size,
    persistentEntries: cacheKeys.length,
    memorySize: memoryCache.size,
  };
}

// Export cache config for use in other modules
export { CACHE_CONFIG };

