const Redis = require('ioredis');

let redis;

function getRedisClient() {
    if (!redis) {
        const url = process.env.REDIS_URL || 'redis://localhost:6379';
        redis = new Redis(url, {
            lazyConnect: true,
            maxRetriesPerRequest: 3,
            retryStrategy(times) {
                if (times > 3) return null; // stop retrying
                return Math.min(times * 200, 2000);
            },
        });
        redis.on('error', (err) => {
            console.warn('[Redis] Connection error (using in-memory fallback):', err.message);
        });
    }
    return redis;
}

// In-memory fallback store when Redis is unavailable
const memStore = {};

async function safeGet(key) {
    try {
        return await getRedisClient().get(key);
    } catch {
        return memStore[key] || null;
    }
}

async function safeIncr(key, ttl) {
    try {
        const val = await getRedisClient().incr(key);
        if (val === 1) await getRedisClient().expire(key, ttl);
        return val;
    } catch {
        memStore[key] = (memStore[key] || 0) + 1;
        return memStore[key];
    }
}

async function safeSadd(key, member, ttl) {
    try {
        await getRedisClient().sadd(key, member);
        await getRedisClient().expire(key, ttl);
        return await getRedisClient().scard(key);
    } catch {
        const setKey = `__set_${key}`;
        if (!memStore[setKey]) memStore[setKey] = new Set();
        memStore[setKey].add(member);
        return memStore[setKey].size;
    }
}

/**
 * Get velocity (attempts per minute) for a given IP
 */
async function getVelocity(ip) {
    const key = `vel:${ip}`;
    return await safeIncr(key, 60);
}

/**
 * Get number of unique accounts attempted from an IP in the last hour
 */
async function getUniqueAccounts(ip, username) {
    const key = `uniq:${ip}`;
    return await safeSadd(key, username, 3600);
}

/**
 * Track failed attempts for fail_ratio calculation
 * Returns { recentFails, recentTotal }
 */
async function trackFailedAttempt(ip, username, failed) {
    const now = Date.now();
    const windowMs = 5 * 60 * 1000; // 5 minutes
    const failKey = `fails:${ip}:${username}`;
    const totalKey = `total:${ip}:${username}`;

    try {
        const r = getRedisClient();
        // Use sorted sets with score = timestamp
        const pipeline = r.pipeline();
        if (failed) pipeline.zadd(failKey, now, now.toString());
        pipeline.zadd(totalKey, now, now.toString());
        // Remove old entries
        pipeline.zremrangebyscore(failKey, 0, now - windowMs);
        pipeline.zremrangebyscore(totalKey, 0, now - windowMs);
        pipeline.zcard(failKey);
        pipeline.zcard(totalKey);
        // Set TTL
        pipeline.expire(failKey, 300);
        pipeline.expire(totalKey, 300);
        const results = await pipeline.exec();

        const recentFails = results[4][1] || 0;
        const recentTotal = results[5][1] || 0;
        return { recentFails, recentTotal };
    } catch {
        const failKey2 = `__fails_${ip}_${username}`;
        const totalKey2 = `__total_${ip}_${username}`;
        if (failed) memStore[failKey2] = (memStore[failKey2] || 0) + 1;
        memStore[totalKey2] = (memStore[totalKey2] || 0) + 1;
        return {
            recentFails: memStore[failKey2] || 0,
            recentTotal: memStore[totalKey2] || 0
        };
    }
}

module.exports = { getVelocity, getUniqueAccounts, trackFailedAttempt };
