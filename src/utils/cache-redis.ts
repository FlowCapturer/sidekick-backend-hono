import { Redis } from "@upstash/redis/cloudflare";
import { Bindings } from "../types";

let redis: Redis | undefined;

function getRedis(env: Bindings): Redis {
  if (!redis) {
    redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

export async function getRedisValue<T = unknown>(
  env: Bindings,
  key: string,
): Promise<T | null> {
  return await getRedis(env).get<T>(key);
}

export async function setRedisValue(
  env: Bindings,
  key: string,
  value: unknown,
  ttlSeconds?: number,
): Promise<void> {
  if (ttlSeconds) {
    await getRedis(env).set(key, value, { ex: ttlSeconds });
  } else {
    await getRedis(env).set(key, value);
  }
}

export async function delRedisValue(env: Bindings, key: string): Promise<void> {
  await getRedis(env).del(key);
}
