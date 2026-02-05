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
    return new Request(`https://cache.local/${this.namespace}/${key}`);
  }

  async get<T = any>(key: string): Promise<T | undefined> {
    const req = this.buildRequest(key);
    const res = await this.cache.match(req);

    if (!res) return undefined;

    return await res.json<T>();
  }

  async set(key: string, value: any, ttlSeconds = 60): Promise<void> {
    const req = this.buildRequest(key);

    const res = new Response(JSON.stringify(value), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `max-age=${ttlSeconds}`,
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
    const res = await this.cache.match(req);
    return !!res;
  }

  /**
   * ❌ NOT SUPPORTED by Cache API
   * These exist in LRU but not here:
   * - size()
   * - keys()
   * - getAllValues()
   */
}

const cacheInstances: Record<string, CacheAPI> = {};

export const getSingletonCacheInstance = async (
  instanceName: string,
  maxSize?: number,
): Promise<CacheAPI> => {
  if (!cacheInstances[instanceName]) {
    cacheInstances[instanceName] = new CacheAPI(instanceName);
  }
  return cacheInstances[instanceName];
};
