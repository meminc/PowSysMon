// src/lib/db/redis.js
import Redis from 'ioredis';

const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    retryStrategy: (times) => Math.min(times * 50, 2000),
    maxRetriesPerRequest: 3,
});

redis.on('connect', () => {
    console.log('Redis connected successfully');
});

redis.on('error', (err) => {
    console.error('Redis connection error:', err);
});

export default redis;

// Cache helpers
export const cache = {
    get: async (key) => {
        try {
            const value = await redis.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error('Cache get error:', error);
            return null;
        }
    },
    
    set: async (key, value, ttl = 60) => {
        try {
            await redis.set(key, JSON.stringify(value), 'EX', ttl);
            return true;
        } catch (error) {
            console.error('Cache set error:', error);
            return false;
        }
    },
    
    delete: async (key) => {
        try {
            await redis.del(key);
            return true;
        } catch (error) {
            console.error('Cache delete error:', error);
        return false;
        }
    },
    
    invalidatePattern: async (pattern) => {
        try {
            const keys = await redis.keys(pattern);
            if (keys.length > 0) {
                await redis.del(...keys);
            }
            return true;
        } catch (error) {
            console.error('Cache invalidate pattern error:', error);
        return false;
        }
    },

    // Increment counter (useful for rate limiting)
    incr: async (key, ttl = null) => {
        try {
            const value = await redis.incr(key);
            if (ttl && value === 1) {
                await redis.expire(key, ttl);
            }
            return value;
        } catch (error) {
            console.error('Cache incr error:', error);
        return null;
        }
    }
};

// Check Redis connection
export const checkConnection = async () => {
    try {
        await redis.ping();
        return { connected: true };
    } catch (error) {
        return { connected: false, error: error.message };
    }
};