/**
 * LRU (Least Recently Used) Cache implementation for API responses
 */

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  hits: number;
}

export class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private readonly maxSize: number;
  private readonly ttl: number; // Time to live in milliseconds

  constructor(maxSize = 100, ttlMinutes = 60) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttlMinutes * 60 * 1000;
  }

  /**
   * Generate cache key from query and filters
   */
  static generateKey(query: string, filters?: any): string {
    const normalizedQuery = query.toLowerCase().trim();
    const filterStr = filters ? JSON.stringify(filters) : '';
    return `${normalizedQuery}:${filterStr}`;
  }

  /**
   * Get value from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    entry.hits++;
    this.cache.set(key, entry);

    console.log(`[Cache] Hit for key: ${key.substring(0, 50)}... (hits: ${entry.hits})`);
    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T): void {
    // Remove oldest entry if cache is full
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
        console.log(`[Cache] Evicted oldest entry: ${firstKey.substring(0, 50)}...`);
      }
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      hits: 0
    });

    console.log(`[Cache] Stored key: ${key.substring(0, 50)}... (size: ${this.cache.size}/${this.maxSize})`);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    console.log('[Cache] Cleared all entries');
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    entries: Array<{ key: string; hits: number; age: number }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key: key.substring(0, 50),
      hits: entry.hits,
      age: Math.floor((Date.now() - entry.timestamp) / 1000) // age in seconds
    }));

    const totalHits = entries.reduce((sum, e) => sum + e.hits, 0);

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.cache.size > 0 ? totalHits / this.cache.size : 0,
      entries: entries.sort((a, b) => b.hits - a.hits).slice(0, 10) // top 10 by hits
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[Cache] Cleaned up ${removed} expired entries`);
    }
  }
}

// Singleton instance for response cache
let responseCache: LRUCache<any> | null = null;

export function getResponseCache(): LRUCache<any> {
  if (!responseCache) {
    responseCache = new LRUCache<any>(
      parseInt(process.env.CACHE_MAX_SIZE || '100'),
      parseInt(process.env.CACHE_TTL_MINUTES || '60')
    );

    // Set up periodic cleanup
    setInterval(() => {
      responseCache?.cleanup();
    }, 5 * 60 * 1000); // Clean up every 5 minutes
  }

  return responseCache;
}

/**
 * Cache decorator for async functions
 */
export function withCache<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyGenerator: (...args: Parameters<T>) => string
): T {
  const cache = getResponseCache();

  return (async (...args: Parameters<T>) => {
    const key = keyGenerator(...args);
    
    // Check cache first
    const cached = cache.get(key);
    if (cached !== null) {
      return cached;
    }

    // Execute function and cache result
    const result = await fn(...args);
    cache.set(key, result);
    
    return result;
  }) as T;
}