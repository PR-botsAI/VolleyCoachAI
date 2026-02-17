import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  lazyConnect: true,
});

redis.on("error", (err) => {
  console.error("[Redis] Connection error:", err.message);
});

redis.on("connect", () => {
  console.log("[Redis] Connected successfully");
});

/**
 * Get a cached value by key. Returns null if not found or on error.
 */
export async function getCache<T = unknown>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(`[Redis] getCache error for key "${key}":`, err);
    return null;
  }
}

/**
 * Set a cached value with optional TTL in seconds.
 */
export async function setCache(
  key: string,
  value: unknown,
  ttlSeconds: number = 300
): Promise<void> {
  try {
    const serialized = JSON.stringify(value);
    if (ttlSeconds > 0) {
      await redis.set(key, serialized, "EX", ttlSeconds);
    } else {
      await redis.set(key, serialized);
    }
  } catch (err) {
    console.error(`[Redis] setCache error for key "${key}":`, err);
  }
}

/**
 * Delete a cached value by key.
 */
export async function deleteCache(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (err) {
    console.error(`[Redis] deleteCache error for key "${key}":`, err);
  }
}

/**
 * Increment a counter by key, with optional TTL on first creation.
 * Returns the new counter value.
 */
export async function incrementCounter(
  key: string,
  ttlSeconds: number = 3600
): Promise<number> {
  try {
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.ttl(key);
    const results = await pipeline.exec();

    if (!results) return 0;

    const newValue = results[0]?.[1] as number;
    const currentTtl = results[1]?.[1] as number;

    // Set TTL only if the key doesn't already have one (first increment)
    if (currentTtl === -1 && ttlSeconds > 0) {
      await redis.expire(key, ttlSeconds);
    }

    return newValue;
  } catch (err) {
    console.error(`[Redis] incrementCounter error for key "${key}":`, err);
    return 0;
  }
}

/**
 * Gracefully close the Redis connection.
 */
export async function closeRedis(): Promise<void> {
  try {
    await redis.quit();
    console.log("[Redis] Connection closed");
  } catch (err) {
    console.error("[Redis] Error closing connection:", err);
  }
}
