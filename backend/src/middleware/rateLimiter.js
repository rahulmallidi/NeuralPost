import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redisConnection from '../config/redis.js';

// Bypass all rate limiting in the test environment so tests don't trip the counters
const skipInTest = () => process.env.NODE_ENV === 'test';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  store: new RedisStore({
    sendCommand: (...args) => redisConnection.call(...args),
  }),
  message: { error: 'Too many requests, please try again later.' },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  store: new RedisStore({
    sendCommand: (...args) => redisConnection.call(...args),
  }),
  message: { error: 'Too many authentication attempts, please try again later.' },
});

export const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  skip: skipInTest,
  store: new RedisStore({
    sendCommand: (...args) => redisConnection.call(...args),
  }),
  message: { error: 'Search rate limit exceeded.' },
});
