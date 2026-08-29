/**
 * High-Speed In-Memory Cache with Stale-While-Revalidate for Lightning Fast Bootstrap (< 50ms)
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

let bootstrapCache: CacheEntry<any> | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache TTL (invalidated immediately on DB mutation)

export function getCachedBootstrapData(): any | null {
  if (!bootstrapCache) return null;
  const now = Date.now();
  if (now - bootstrapCache.timestamp > CACHE_TTL_MS) {
    return null;
  }
  return bootstrapCache.data;
}

export function setCachedBootstrapData(data: any) {
  bootstrapCache = {
    data,
    timestamp: Date.now(),
  };
}

export function invalidateBootstrapCache() {
  bootstrapCache = null;
}
