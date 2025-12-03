/**
 * Cache Performance Logger
 * 
 * Tracks cache hits, misses, egress saved, and performance metrics
 */

interface CacheLog {
  key: string;
  hit: boolean;
  timestamp: number;
  dataSize?: number;
  queryTime?: number;
}

interface CacheStats {
  totalQueries: number;
  cacheHits: number;
  cacheMisses: number;
  totalDataSize: number;
  cachedDataSize: number;
  totalQueryTime: number;
  cachedQueryTime: number;
  egressSaved: number; // bytes
  hitRate: number; // percentage
}

class CacheLogger {
  private logs: CacheLog[] = [];
  private stats: CacheStats = {
    totalQueries: 0,
    cacheHits: 0,
    cacheMisses: 0,
    totalDataSize: 0,
    cachedDataSize: 0,
    totalQueryTime: 0,
    cachedQueryTime: 0,
    egressSaved: 0,
    hitRate: 0,
  };

  private maxLogs = 1000; // Keep last 1000 logs

  /**
   * Log a cache operation
   */
  log(key: string, hit: boolean, dataSize?: number, queryTime?: number) {
    const log: CacheLog = {
      key,
      hit,
      timestamp: Date.now(),
      dataSize,
      queryTime,
    };

    this.logs.push(log);
    
    // Keep only last maxLogs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Update stats
    this.stats.totalQueries++;
    if (hit) {
      this.stats.cacheHits++;
      if (dataSize) {
        this.stats.cachedDataSize += dataSize;
      }
      if (queryTime) {
        this.stats.cachedQueryTime += queryTime;
      }
    } else {
      this.stats.cacheMisses++;
      if (dataSize) {
        this.stats.totalDataSize += dataSize;
        this.stats.egressSaved += 0; // No save on miss
      }
      if (queryTime) {
        this.stats.totalQueryTime += queryTime;
      }
    }

    // Calculate egress saved (data served from cache)
    if (hit && dataSize) {
      this.stats.egressSaved += dataSize;
    }

    // Update hit rate
    this.stats.hitRate = this.stats.totalQueries > 0
      ? (this.stats.cacheHits / this.stats.totalQueries) * 100
      : 0;

    // Console log for debugging
    const status = hit ? '✅ CACHE HIT' : '❌ CACHE MISS';
    const sizeStr = dataSize ? ` (${this.formatBytes(dataSize)})` : '';
    const timeStr = queryTime ? ` [${queryTime.toFixed(0)}ms]` : '';
    const shortKey = key.length > 80 ? key.substring(0, 80) + '...' : key;
    console.log(`[CacheLogger] ${status} #${this.stats.totalQueries} - ${shortKey}${sizeStr}${timeStr}`);
    console.log(`[CacheLogger] 📊 Stats: ${this.stats.cacheHits} hits / ${this.stats.cacheMisses} misses (${this.stats.hitRate.toFixed(1)}% hit rate)`);

    // Log stats every 10 queries
    if (this.stats.totalQueries % 10 === 0) {
      this.logStats();
    }
  }

  /**
   * Get current statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get recent logs
   */
  getRecentLogs(count: number = 20): CacheLog[] {
    return this.logs.slice(-count);
  }

  /**
   * Reset statistics
   */
  reset() {
    this.logs = [];
    this.stats = {
      totalQueries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalDataSize: 0,
      cachedDataSize: 0,
      totalQueryTime: 0,
      cachedQueryTime: 0,
      egressSaved: 0,
      hitRate: 0,
    };
    console.log('[CacheLogger] Statistics reset');
  }

  /**
   * Log current statistics
   */
  logStats() {
    const avgQueryTime = this.stats.totalQueries > 0
      ? this.stats.totalQueryTime / this.stats.totalQueries
      : 0;
    const avgCachedTime = this.stats.cacheHits > 0
      ? this.stats.cachedQueryTime / this.stats.cacheHits
      : 0;
    const speedup = avgQueryTime > 0 && avgCachedTime > 0
      ? (avgQueryTime / avgCachedTime).toFixed(1)
      : 'N/A';

    console.log('\n📊 [CacheLogger] Statistics:');
    console.log(`   Total Queries: ${this.stats.totalQueries}`);
    console.log(`   Cache Hits: ${this.stats.cacheHits} (${this.stats.hitRate.toFixed(1)}%)`);
    console.log(`   Cache Misses: ${this.stats.cacheMisses}`);
    console.log(`   Egress Saved: ${this.formatBytes(this.stats.egressSaved)}`);
    console.log(`   Avg Query Time: ${avgQueryTime.toFixed(0)}ms`);
    console.log(`   Avg Cached Time: ${avgCachedTime.toFixed(0)}ms`);
    console.log(`   Speedup: ${speedup}x`);
    console.log('');
  }

  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  /**
   * Get formatted stats for display
   */
  getFormattedStats() {
    const avgQueryTime = this.stats.totalQueries > 0
      ? this.stats.totalQueryTime / this.stats.totalQueries
      : 0;
    const avgCachedTime = this.stats.cacheHits > 0
      ? this.stats.cachedQueryTime / this.stats.cacheHits
      : 0;
    const speedup = avgQueryTime > 0 && avgCachedTime > 0
      ? (avgQueryTime / avgCachedTime).toFixed(1)
      : 'N/A';

    return {
      ...this.stats,
      avgQueryTime: avgQueryTime.toFixed(0),
      avgCachedTime: avgCachedTime.toFixed(0),
      speedup,
      egressSavedFormatted: this.formatBytes(this.stats.egressSaved),
      totalDataSizeFormatted: this.formatBytes(this.stats.totalDataSize),
      cachedDataSizeFormatted: this.formatBytes(this.stats.cachedDataSize),
    };
  }
}

// Singleton instance
export const cacheLogger = new CacheLogger();

