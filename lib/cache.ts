import { createClient, type RedisClientType } from "redis";

type MemoryEntry = {
  value: string;
  expiresAt: number;
};

export type CacheStore = "redis" | "memory" | "none";

export type CachedValue<T> = {
  value: T;
  hit: boolean;
  store: CacheStore;
};

export type CacheInvalidationResult = {
  redisDeleted: number;
  memoryDeleted: number;
};

const memoryCache = new Map<string, MemoryEntry>();

let redisClient: RedisClientType | null = null;
let redisConnectAttempted = false;

function nowMs(): number {
  return Date.now();
}

function readMemory<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= nowMs()) {
    memoryCache.delete(key);
    return null;
  }

  try {
    return JSON.parse(entry.value) as T;
  } catch {
    memoryCache.delete(key);
    return null;
  }
}

function writeMemory<T>(key: string, value: T, ttlSeconds: number): void {
  memoryCache.set(key, {
    value: JSON.stringify(value),
    expiresAt: nowMs() + ttlSeconds * 1000
  });
}

async function getRedisClient(): Promise<RedisClientType | null> {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    return null;
  }

  if (redisClient?.isOpen) {
    return redisClient;
  }

  if (redisConnectAttempted && !redisClient?.isOpen) {
    return null;
  }

  redisConnectAttempted = true;

  try {
    redisClient = createClient({ url: redisUrl });
    redisClient.on("error", () => {
      // No-op: individual cache operations gracefully fall back to memory.
    });
    await redisClient.connect();
    return redisClient;
  } catch {
    return null;
  }
}

async function readRedis<T>(key: string): Promise<T | null> {
  const client = await getRedisClient();
  if (!client) {
    return null;
  }

  try {
    const payload = await client.get(key);
    if (!payload) {
      return null;
    }

    return JSON.parse(payload) as T;
  } catch {
    return null;
  }
}

async function writeRedis<T>(key: string, value: T, ttlSeconds: number): Promise<boolean> {
  const client = await getRedisClient();
  if (!client) {
    return false;
  }

  try {
    await client.set(key, JSON.stringify(value), {
      EX: ttlSeconds
    });
    return true;
  } catch {
    return false;
  }
}

export async function getOrSetCache<T>(
  key: string,
  ttlSeconds: number,
  producer: () => Promise<T>
): Promise<CachedValue<T>> {
  const redisCached = await readRedis<T>(key);
  if (redisCached !== null) {
    return {
      value: redisCached,
      hit: true,
      store: "redis"
    };
  }

  const memoryCached = readMemory<T>(key);
  if (memoryCached !== null) {
    return {
      value: memoryCached,
      hit: true,
      store: "memory"
    };
  }

  const fresh = await producer();

  const wroteToRedis = await writeRedis(key, fresh, ttlSeconds);
  if (!wroteToRedis) {
    writeMemory(key, fresh, ttlSeconds);
    return {
      value: fresh,
      hit: false,
      store: "memory"
    };
  }

  return {
    value: fresh,
    hit: false,
    store: "redis"
  };
}

function invalidateMemoryByPrefix(prefix: string): number {
  let deleted = 0;

  for (const key of memoryCache.keys()) {
    if (!key.startsWith(prefix)) {
      continue;
    }

    memoryCache.delete(key);
    deleted += 1;
  }

  return deleted;
}

async function invalidateRedisByPrefix(prefix: string): Promise<number> {
  const client = await getRedisClient();
  if (!client) {
    return 0;
  }

  let deleted = 0;

  try {
    for await (const key of client.scanIterator({
      MATCH: `${prefix}*`,
      COUNT: 100
    })) {
      const keys = Array.isArray(key) ? key : [key];
      if (keys.length === 0) {
        continue;
      }

      deleted += await client.del(keys);
    }
  } catch {
    return deleted;
  }

  return deleted;
}

export async function invalidateCacheByPrefixes(
  prefixes: string[]
): Promise<CacheInvalidationResult> {
  let memoryDeleted = 0;
  let redisDeleted = 0;

  for (const prefix of prefixes) {
    memoryDeleted += invalidateMemoryByPrefix(prefix);
    redisDeleted += await invalidateRedisByPrefix(prefix);
  }

  return {
    redisDeleted,
    memoryDeleted
  };
}

export async function invalidatePatientProfileCaches(): Promise<CacheInvalidationResult> {
  return invalidateCacheByPrefixes(["profile-options", "profile-summary:"]);
}
