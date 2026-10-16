import Redis, { RedisOptions } from 'ioredis';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export const redisConfig: RedisOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
};

let redisClient: Redis | null = null;

export const getRedisClient = (): Redis => {
  if (!redisClient) {
    redisClient = new Redis(redisConfig);

    redisClient.on('connect', () => {
      logger.info('Connected to Redis server');
    });

    redisClient.on('error', (err) => {
      logger.error({ err }, 'Redis connection error');
    });
  }

  return redisClient;
};

export const createRedisConnection = (): Redis => {
  return new Redis(redisConfig);
};
