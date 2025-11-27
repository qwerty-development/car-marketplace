/**
 * CachedImage - A high-performance cached image component
 * 
 * This component wraps expo-image with aggressive caching to minimize
 * Supabase egress bandwidth usage. Images are cached to disk by default
 * and reused across app sessions.
 * 
 * Features:
 * - Disk caching (default) - persists across app restarts
 * - Memory caching for frequently accessed images
 * - BlurHash/ThumbHash placeholder support
 * - Automatic transition animations
 * - Prefetching support for lists
 */

import React, { memo, useCallback } from 'react';
import { Image, ImageProps, ImageContentFit } from 'expo-image';
import { StyleProp, ImageStyle, ViewStyle } from 'react-native';

// Default blurhash for loading states (neutral gray)
const DEFAULT_BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0LOR*WB';

export type CachePolicy = 'none' | 'disk' | 'memory' | 'memory-disk';

export interface CachedImageProps {
  /** The image source - can be a URI string, require(), or ImageSource object */
  source: string | number | { uri: string; headers?: Record<string, string> };
  /** Style for the image */
  style?: StyleProp<ImageStyle | ViewStyle>;
  /** How the image should fit its container */
  contentFit?: ImageContentFit;
  /** Cache policy - 'disk' by default for bandwidth savings */
  cachePolicy?: CachePolicy;
  /** Placeholder blurhash string for loading state */
  placeholder?: string | { blurhash: string } | { thumbhash: string };
  /** Transition duration in ms when image loads */
  transition?: number;
  /** Priority for loading - 'high' for visible images */
  priority?: 'low' | 'normal' | 'high';
  /** Callback when image loads successfully */
  onLoad?: () => void;
  /** Callback when image fails to load */
  onError?: (error: { error: string }) => void;
  /** Whether to allow downscaling for performance */
  allowDownscaling?: boolean;
  /** Accessibility label */
  accessibilityLabel?: string;
  /** Key for recycling in lists (FlashList, FlatList) */
  recyclingKey?: string;
  /** Tint color for template images */
  tintColor?: string;
  /** Additional props to pass to expo-image */
  [key: string]: any;
}

/**
 * CachedImage component with aggressive disk caching
 * 
 * @example
 * ```tsx
 * // Basic usage
 * <CachedImage 
 *   source={{ uri: imageUrl }} 
 *   style={{ width: 100, height: 100 }} 
 * />
 * 
 * // With placeholder
 * <CachedImage 
 *   source={{ uri: imageUrl }}
 *   placeholder={blurhashString}
 *   style={{ width: 100, height: 100 }}
 * />
 * 
 * // High priority for hero images
 * <CachedImage
 *   source={{ uri: heroImageUrl }}
 *   priority="high"
 *   cachePolicy="memory-disk"
 *   style={{ width: '100%', height: 300 }}
 * />
 * ```
 */
const CachedImage = memo<CachedImageProps>(({
  source,
  style,
  contentFit = 'cover',
  cachePolicy = 'disk', // Disk cache by default for bandwidth savings
  placeholder,
  transition = 200, // Smooth transition by default
  priority = 'normal',
  onLoad,
  onError,
  allowDownscaling = true,
  accessibilityLabel,
  recyclingKey,
  tintColor,
  ...rest
}) => {
  // Normalize source to ImageSource format
  const normalizedSource = typeof source === 'string' 
    ? { uri: source } 
    : source;

  // Normalize placeholder
  const normalizedPlaceholder = placeholder 
    ? (typeof placeholder === 'string' ? { blurhash: placeholder } : placeholder)
    : undefined;

  const handleLoad = useCallback(() => {
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback((event: { error: string }) => {
    console.warn('[CachedImage] Failed to load image:', 
      typeof normalizedSource === 'object' && 'uri' in normalizedSource 
        ? normalizedSource.uri 
        : 'local resource',
      event.error
    );
    onError?.(event);
  }, [normalizedSource, onError]);

  return (
    <Image
      source={normalizedSource}
      style={style}
      contentFit={contentFit}
      cachePolicy={cachePolicy}
      placeholder={normalizedPlaceholder}
      transition={transition}
      priority={priority}
      onLoad={handleLoad}
      onError={handleError}
      allowDownscaling={allowDownscaling}
      accessibilityLabel={accessibilityLabel}
      recyclingKey={recyclingKey}
      tintColor={tintColor}
      {...rest}
    />
  );
});

CachedImage.displayName = 'CachedImage';

export default CachedImage;

/**
 * Prefetch images to cache them before they're displayed
 * Useful for list items, carousels, or predictive loading
 * 
 * @param urls - Array of image URLs to prefetch
 * @param cachePolicy - Cache policy for prefetched images
 * @returns Promise that resolves when all images are prefetched
 * 
 * @example
 * ```tsx
 * // Prefetch car images when user approaches a listing
 * useEffect(() => {
 *   if (nearbyCarImages.length > 0) {
 *     prefetchImages(nearbyCarImages);
 *   }
 * }, [nearbyCarImages]);
 * ```
 */
export const prefetchImages = async (
  urls: string[],
  cachePolicy: 'disk' | 'memory' | 'memory-disk' = 'disk'
): Promise<boolean> => {
  try {
    const validUrls = urls.filter(url => url && typeof url === 'string');
    if (validUrls.length === 0) return true;
    
    return await Image.prefetch(validUrls, cachePolicy);
  } catch (error) {
    console.warn('[CachedImage] Prefetch failed:', error);
    return false;
  }
};

/**
 * Clear all cached images from disk
 * Useful for freeing up storage or forcing fresh downloads
 * 
 * @returns Promise that resolves to true if successful
 */
export const clearImageDiskCache = async (): Promise<boolean> => {
  try {
    return await Image.clearDiskCache();
  } catch (error) {
    console.error('[CachedImage] Failed to clear disk cache:', error);
    return false;
  }
};

/**
 * Clear all cached images from memory
 * Useful for reducing memory pressure
 * 
 * @returns Promise that resolves to true if successful
 */
export const clearImageMemoryCache = async (): Promise<boolean> => {
  try {
    return await Image.clearMemoryCache();
  } catch (error) {
    console.error('[CachedImage] Failed to clear memory cache:', error);
    return false;
  }
};

/**
 * Check if an image exists in the disk cache
 * 
 * @param url - The image URL to check
 * @returns Promise that resolves to the cached path or null
 */
export const getImageCachePath = async (url: string): Promise<string | null> => {
  try {
    return await Image.getCachePathAsync(url);
  } catch (error) {
    return null;
  }
};
