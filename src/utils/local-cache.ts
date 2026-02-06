/**
 * Cloudflare Cache API wrapper
 * Works with Hono + Cloudflare Workers
 */
class CacheAPI {
  private cache: Cache;
  private namespace: string;

  constructor(namespace: string) {
    this.cache = caches.default;
    this.namespace = namespace;
  }

  private buildRequest(key: string): Request {
    const safeKey = encodeURIComponent(key);
    return new Request(`https://cache.local/${this.namespace}/${safeKey}`);
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    const req = this.buildRequest(key);
    const res = await this.cache.match(req);

    if (!res) return undefined;

    try {
      return (await res.json()) as T;
    } catch {
      // Corrupted or non-JSON cache entry
      return undefined;
    }
  }

  async set(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
    const req = this.buildRequest(key);

    const res = new Response(JSON.stringify(value), {
      headers: {
        "Content-Type": "application/json",
        // TTL is best-effort in Cloudflare Cache
        "Cache-Control": `public, max-age=${ttlSeconds}`,
      },
    });

    await this.cache.put(req, res);
  }

  async del(key: string): Promise<void> {
    const req = this.buildRequest(key);
    await this.cache.delete(req);
  }

  async has(key: string): Promise<boolean> {
    const req = this.buildRequest(key);
    return !!(await this.cache.match(req));
  }
}

const cacheInstances: Record<string, CacheAPI> = {};

export const getSingletonCacheInstance = (
  instanceName: string,
  maxSize?: number,
): CacheAPI => {
  if (!cacheInstances[instanceName]) {
    cacheInstances[instanceName] = new CacheAPI(instanceName);
  }
  return cacheInstances[instanceName];
};
