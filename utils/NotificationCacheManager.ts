// utils/NotificationCacheManager.ts
interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
  }
  
  interface TokenVerificationCache {
    isValid: boolean;
    tokenId?: string;
    token?: string;
    signedIn?: boolean;
  }
  
  /**
   * In-memory cache manager for notification-related data
   * Reduces redundant database queries and improves performance
   */
  export class NotificationCacheManager {
    private static instance: NotificationCacheManager;
    private cache: Map<string, CacheEntry<any>> = new Map();
    private cleanupInterval: NodeJS.Timer | null = null;
    
    // Cache TTL configurations (in milliseconds)
    private static readonly TTL = {
      TOKEN_VERIFICATION: 5 * 60 * 1000, // 5 minutes
      UNREAD_COUNT: 30 * 1000, // 30 seconds
      PERMISSIONS: 10 * 60 * 1000, // 10 minutes
      USER_TOKENS: 2 * 60 * 1000, // 2 minutes
    } as const;
  
    private constructor() {
      // Start cleanup interval to remove expired entries
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, 60 * 1000); // Run cleanup every minute
    }
  
    public static getInstance(): NotificationCacheManager {
      if (!NotificationCacheManager.instance) {
        NotificationCacheManager.instance = new NotificationCacheManager();
      }
      return NotificationCacheManager.instance;
    }
  
    /**
     * Store data in cache with TTL
     */
    public set<T>(key: string, data: T, ttl: number): void {
      this.cache.set(key, {
        data,
        timestamp: Date.now(),
        ttl,
      });
    }
  
    /**
     * Retrieve data from cache if not expired
     */
    public get<T>(key: string): T | null {
      const entry = this.cache.get(key);
      
      if (!entry) {
        return null;
      }
  
      const now = Date.now();
      const isExpired = now - entry.timestamp > entry.ttl;
  
      if (isExpired) {
        this.cache.delete(key);
        return null;
      }
  
      return entry.data as T;
    }
  
    /**
     * Check if cache has valid (non-expired) entry
     */
    public has(key: string): boolean {
      const data = this.get(key);
      return data !== null;
    }
  
    /**
     * Invalidate specific cache entry
     */
    public invalidate(key: string): void {
      this.cache.delete(key);
    }
  
    /**
     * Invalidate all cache entries matching a pattern
     */
    public invalidatePattern(pattern: string): void {
      const regex = new RegExp(pattern);
      for (const key of this.cache.keys()) {
        if (regex.test(key)) {
          this.cache.delete(key);
        }
      }
    }
  
    /**
     * Clear all cache entries
     */
    public clear(): void {
      this.cache.clear();
    }
  
    /**
     * Cleanup expired entries
     */
    private cleanup(): void {
      const now = Date.now();
      
      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.timestamp > entry.ttl) {
          this.cache.delete(key);
        }
      }
    }
  
    /**
     * Cache key generators for consistency
     */
    public static keys = {
      tokenVerification: (userId: string) => `token_verification_${userId}`,
      unreadCount: (userId: string) => `unread_count_${userId}`,
      permissions: () => 'notification_permissions',
      userTokens: (userId: string) => `user_tokens_${userId}`,
      tokenStatus: (userId: string, token: string) => `token_status_${userId}_${token}`,
    };
  
    /**
     * Specialized cache methods for token verification
     */
    public cacheTokenVerification(
      userId: string, 
      verification: TokenVerificationCache
    ): void {
      this.set(
        NotificationCacheManager.keys.tokenVerification(userId),
        verification,
        NotificationCacheManager.TTL.TOKEN_VERIFICATION
      );
    }
  
    public getCachedTokenVerification(
      userId: string
    ): TokenVerificationCache | null {
      return this.get<TokenVerificationCache>(
        NotificationCacheManager.keys.tokenVerification(userId)
      );
    }
  
    /**
     * Destroy cache manager and clean up resources
     */
    public destroy(): void {
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }
      this.clear();
    }
  }
  
  // Export singleton instance
  export const notificationCache = NotificationCacheManager.getInstance();