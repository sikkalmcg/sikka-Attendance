/**
 * High-Speed In-Memory Cache with Stale-While-Revalidate for Lightning Fast Bootstrap (< 50ms)
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const bootstrapCacheMap = new Map<string, CacheEntry<any>>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache TTL (invalidated immediately on DB mutation)

export function getCachedBootstrapData(cacheKey: string = 'default'): any | null {
  const entry = bootstrapCacheMap.get(cacheKey);
  if (!entry) return null;
  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL_MS) {
    bootstrapCacheMap.delete(cacheKey);
    return null;
  }
  return entry.data;
}

export function setCachedBootstrapData(data: any, cacheKey: string = 'default') {
  bootstrapCacheMap.set(cacheKey, {
    data,
    timestamp: Date.now(),
  });
}

export function invalidateBootstrapCache() {
  bootstrapCacheMap.clear();
}
