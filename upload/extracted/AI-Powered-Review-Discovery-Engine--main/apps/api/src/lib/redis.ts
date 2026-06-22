import Redis from 'ioredis';

import { env } from '@review-engine/shared';

let redisErrorLogged = false;

export const redis = new Redis(env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times) {
    // Stop retrying after 3 attempts to avoid log spam
    if (times > 3) {
      if (!redisErrorLogged) {
        console.warn('Redis unavailable — server continuing without Redis features');
        redisErrorLogged = true;
      }
      return null;
    }
    return Math.min(times * 500, 2000);
  },
});

redis.on('error', (err) => {
  if (!redisErrorLogged) {
    console.warn(
      'Redis connection error - server will continue without Redis features:',
      err.message
    );
    redisErrorLogged = true;
  }
});
