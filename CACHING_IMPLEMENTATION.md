# Production-Ready Caching Implementation

This document outlines the aggressive caching strategy implemented to minimize Supabase egress costs and optimize app performance.

## Overview

The app now implements a multi-layered caching strategy:

1. **Supabase Query Cache** - Aggressive caching with request deduplication
2. **React Query Cache** - 24-hour stale time with 7-day cache retention
3. **Image Caching** - Disk-based caching for all images
4. **Smart Prefetching** - Predictive loading of data and images
5. **Lazy Loading** - Super lazy rendering of list items

## Key Features

### 1. Aggressive Query Caching (`utils/supabaseCache.ts`)

- **Default TTL**: 24 hours for most queries
- **Short TTL**: 5 minutes for frequently changing data (new arrivals)
- **Long TTL**: 7 days for static data (brands, categories)
- **Request Deduplication**: Prevents duplicate concurrent requests
- **Persistent Storage**: Cache persists across app restarts using AsyncStorage
- **Memory + Disk**: Two-tier caching for fast access

**Usage:**
```typescript
import { cachedSelect, cachedSingle, cachedRpc } from '@/utils/supabaseCache';

// Cached select query
const { data, error, fromCache } = await cachedSelect(
  'cars',
  '*',
  (query) => query.eq('status', 'available'),
  { ttl: 24 * 60 * 60 * 1000 } // 24 hours
);
```

### 2. React Query Configuration (`utils/queryClient.ts`)

- **Stale Time**: 24 hours (data considered fresh)
- **Cache Time**: 7 days (keep unused data)
- **No Auto-Refetch**: Disabled refetch on mount, focus, or reconnect
- **Request Deduplication**: Built-in via React Query

**Usage:**
```typescript
import { queryClient } from '@/utils/queryClient';

// Already configured in app/_layout.tsx
// All useQuery hooks automatically benefit from aggressive caching
```

### 3. Smart Prefetching (`utils/smartPrefetch.ts`)

- **Predictive Loading**: Prefetches next page before user reaches end
- **Image Prefetching**: Loads images for visible items
- **Network Aware**: Only prefetches on good connections
- **Bandwidth Optimized**: Limits concurrent prefetches

**Usage:**
```typescript
import { prefetchCarImages, prefetchNextPage, prefetchCarDetails } from '@/utils/smartPrefetch';

// Prefetch car images
await prefetchCarImages(cars, { startIndex: 0, count: 10 });

// Prefetch next page
await prefetchNextPage('cars', currentPage, filters, sortOption);

// Prefetch car details
await prefetchCarDetails(carId, 'cars');
```

### 4. Lazy Loading (`utils/lazyLoading.ts`)

- **Ultra Lazy**: Renders only 3-5 items initially
- **Memory Efficient**: Removes off-screen views
- **Smooth Scrolling**: Optimized batch rendering

**Usage:**
```typescript
import { LAZY_FLATLIST_PROPS, getOptimizedFlatListProps } from '@/utils/lazyLoading';

<FlatList
  {...LAZY_FLATLIST_PROPS}
  data={cars}
  renderItem={renderCar}
/>
```

### 5. Image Caching (`utils/CachedImage.tsx`)

- **Disk Cache**: Default policy for all images
- **Memory Cache**: For frequently accessed images
- **BlurHash Placeholders**: Smooth loading experience
- **Prefetching Support**: Preload images before display

**Usage:**
```typescript
import CachedImage from '@/utils/CachedImage';

<CachedImage
  source={{ uri: imageUrl }}
  cachePolicy="disk" // Default
  style={{ width: 100, height: 100 }}
/>
```

## Implementation Details

### Cache Invalidation

Cache is automatically invalidated when:
- Data is updated via mutations
- User manually refreshes (pull-to-refresh)
- Cache TTL expires

To manually invalidate:
```typescript
import { invalidateTable, clearCache } from '@/utils/supabaseCache';

// Invalidate all cars cache
await invalidateTable('cars');

// Clear all cache
await clearCache();
```

### Cache Statistics

Monitor cache usage:
```typescript
import { getCacheStats } from '@/utils/supabaseCache';

const stats = await getCacheStats();
console.log('Memory entries:', stats.memoryEntries);
console.log('Persistent entries:', stats.persistentEntries);
```

## Performance Optimizations

### FlatList Optimizations

All FlatLists now use:
- `initialNumToRender: 5` - Render only 5 items initially
- `maxToRenderPerBatch: 5` - Render 5 per batch
- `windowSize: 5` - Keep 5 windows rendered
- `removeClippedSubviews: true` - Remove off-screen views
- `onEndReachedThreshold: 0.3` - Trigger earlier for smoother loading

### Request Deduplication

- Supabase queries: Automatic via `supabaseCache.ts`
- React Query: Built-in deduplication
- Prevents duplicate requests when multiple components fetch same data

### Bandwidth Savings

Expected reductions:
- **Initial Load**: 80-90% reduction (served from cache)
- **Subsequent Loads**: 95%+ reduction (cache hits)
- **Image Loading**: 90%+ reduction (disk cache)
- **Total Egress**: 70-85% reduction overall

## Migration Guide

### For Existing Components

1. **Replace direct Supabase calls** with cached versions:
```typescript
// Before
const { data } = await supabase.from('cars').select('*');

// After
const { data } = await cachedSelect('cars', '*');
```

2. **Add lazy loading props** to FlatLists:
```typescript
// Before
<FlatList data={cars} renderItem={renderCar} />

// After
<FlatList {...LAZY_FLATLIST_PROPS} data={cars} renderItem={renderCar} />
```

3. **Use CachedImage** instead of Image:
```typescript
// Before
<Image source={{ uri: url }} />

// After
<CachedImage source={{ uri: url }} />
```

4. **Add prefetching** for better UX:
```typescript
useEffect(() => {
  if (cars.length > 0) {
    prefetchCarImages(cars.slice(0, 10));
  }
}, [cars]);
```

## Monitoring

### Cache Hit Rate

Monitor cache effectiveness:
- Check `fromCache` flag in query results
- Log cache statistics periodically
- Monitor Supabase egress metrics

### Performance Metrics

Track:
- Time to first render
- Time to interactive
- Scroll performance
- Memory usage
- Network requests

## Best Practices

1. **Use appropriate TTLs**:
   - Static data (brands): 7 days
   - Regular data (cars): 24 hours
   - Dynamic data (new arrivals): 5 minutes

2. **Prefetch strategically**:
   - Prefetch next page when user is 70% through current page
   - Prefetch images for visible items only
   - Don't prefetch on slow connections

3. **Invalidate wisely**:
   - Only invalidate when data actually changes
   - Use table-level invalidation for related data
   - Avoid clearing entire cache unless necessary

4. **Monitor cache size**:
   - Keep cache under 50MB
   - Clean old entries periodically
   - Monitor AsyncStorage usage

## Troubleshooting

### Cache Not Working

1. Check if cache key is consistent
2. Verify TTL hasn't expired
3. Check AsyncStorage permissions
4. Review cache invalidation logic

### Memory Issues

1. Reduce `windowSize` in FlatList
2. Lower `maxToRenderPerBatch`
3. Clear cache periodically
4. Monitor memory usage

### Stale Data

1. Reduce TTL for dynamic data
2. Add manual refresh option
3. Implement cache invalidation on mutations
4. Use shorter TTL for user-specific data

## Future Enhancements

- [ ] Implement cache compression
- [ ] Add cache analytics dashboard
- [ ] Implement cache warming on app start
- [ ] Add offline-first support
- [ ] Implement cache versioning

