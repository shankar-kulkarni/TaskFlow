import { Redis } from 'ioredis';

const memoryCounters = new Map<string, { count: number; expiresAt: number }>();

const redisUrl = process.env.REDIS_URL;
const redis = redisUrl ? new Redis(redisUrl, { maxRetriesPerRequest: 1, enableOfflineQueue: false }) : null;

const getNow = () => Date.now();

export const incrementDailyCounter = async (key: string): Promise<number> => {
  return incrementCounter(key, 1, 86400);
};

export const incrementMonthlyCounter = async (key: string, amount: number): Promise<number> => {
  return incrementCounter(key, amount, 31 * 86400);
};

const incrementCounter = async (key: string, amount: number, expiresInSeconds: number): Promise<number> => {
  if (redis) {
    try {
      const count = await redis.incrby(key, amount);
      await redis.expire(key, expiresInSeconds);
      return count;
    } catch {
      // Fallback to in-memory for local resilience
    }
  }

  const now = getNow();
  const existing = memoryCounters.get(key);
  if (!existing || existing.expiresAt < now) {
    memoryCounters.set(key, { count: amount, expiresAt: now + expiresInSeconds * 1000 });
    return amount;
  }

  existing.count += amount;
  memoryCounters.set(key, existing);
  return existing.count;
};
