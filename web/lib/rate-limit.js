/**
 * Hybrid Rate Limiter - Redis with in-memory fallback
 * 
 * Uses Redis for distributed rate limiting in production (multiple instances).
 * Falls back to in-memory store if Redis is unavailable.
 * 
 * Usage in API routes:
 *   import { rateLimit, rateLimitStrict } from '@/lib/rate-limit';
 *   
 *   export async function POST(request) {
 *       const limited = await rateLimit(request);
 *       if (limited) return limited;
 *       // ... handle request
 *   }
 * 
 * Environment Variables:
 *   REDIS_HOST / REDIS_URL - Redis connection (optional)
 */

// In-memory fallback store
const rateLimitStore = new Map();

// Redis client singleton (lazy initialized)
let redisClient = null;
let redisAvailable = false;
let redisChecked = false;

/**
 * Initialize Redis client if available
 */
async function getRedisClient() {
    if (redisChecked) return redisAvailable ? redisClient : null;
    
    const redisUrl = process.env.REDIS_URL;
    const redisHost = process.env.REDIS_HOST;
    
    if (!redisUrl && !redisHost) {
        redisChecked = true;
        console.log('[RateLimit] No Redis configured, using in-memory store');
        return null;
    }
    
    try {
        const Redis = (await import('ioredis')).default;
        
        if (redisUrl) {
            redisClient = new Redis(redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true });
        } else {
            redisClient = new Redis({
                host: redisHost,
                port: parseInt(process.env.REDIS_PORT || '6379'),
                password: process.env.REDIS_PASSWORD || undefined,
                maxRetriesPerRequest: 1,
                lazyConnect: true,
            });
        }
        
        await redisClient.connect();
        redisAvailable = true;
        redisChecked = true;
        console.log('[RateLimit] Connected to Redis');
        
        // Handle disconnection
        redisClient.on('error', (err) => {
            console.error('[RateLimit] Redis error:', err.message);
            redisAvailable = false;
        });
        
        redisClient.on('reconnecting', () => {
            console.log('[RateLimit] Reconnecting to Redis...');
        });
        
        redisClient.on('ready', () => {
            redisAvailable = true;
            console.log('[RateLimit] Redis reconnected');
        });
        
        return redisClient;
    } catch (err) {
        console.log(`[RateLimit] Redis unavailable (${err.message}), using in-memory store`);
        redisChecked = true;
        redisAvailable = false;
        return null;
    }
}

// Clean up old entries from in-memory store every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of rateLimitStore.entries()) {
        if (now - data.resetTime > 0) {
            rateLimitStore.delete(key);
        }
    }
}, 5 * 60 * 1000);

/**
 * Rate limit check. Returns a 429 Response if rate limited, or null if allowed.
 * Now async to support Redis.
 * 
 * @param {Request} request - The incoming request
 * @param {Object} options - Rate limit configuration
 * @param {number} options.maxRequests - Maximum requests per window (default: 60)
 * @param {number} options.windowMs - Time window in milliseconds (default: 60000 = 1 min)
 * @param {string} options.keyPrefix - Prefix for the rate limit key (default: 'global')
 */
export async function rateLimit(request, options = {}) {
    const {
        maxRequests = 60,
        windowMs = 60 * 1000,  // 1 minute
        keyPrefix = 'global',
    } = options;

    // Get client IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
        || request.headers.get('x-real-ip') 
        || 'unknown';

    const key = `ratelimit:${keyPrefix}:${ip}`;
    const now = Date.now();

    // Try Redis first
    const redis = await getRedisClient();
    
    if (redis && redisAvailable) {
        try {
            // Use Redis MULTI for atomic operations
            const windowKey = `${key}:window`;
            const countKey = `${key}:count`;
            
            const results = await redis.multi()
                .get(windowKey)
                .get(countKey)
                .exec();
            
            const windowStart = results[0][1] ? parseInt(results[0][1]) : null;
            let count = results[1][1] ? parseInt(results[1][1]) : 0;
            
            const windowExpired = !windowStart || now > windowStart + windowMs;
            
            if (windowExpired) {
                // New window - reset
                const ttlSeconds = Math.ceil(windowMs / 1000);
                await redis.multi()
                    .set(windowKey, now, 'EX', ttlSeconds)
                    .set(countKey, 1, 'EX', ttlSeconds)
                    .exec();
                return null; // Allowed
            }
            
            // Increment count
            count = await redis.incr(countKey);
            
            if (count > maxRequests) {
                const resetTime = windowStart + windowMs;
                const retryAfter = Math.ceil((resetTime - now) / 1000);
                return createRateLimitResponse(maxRequests, retryAfter, resetTime);
            }
            
            return null; // Allowed
        } catch (err) {
            console.error('[RateLimit] Redis error, falling back:', err.message);
            // Fall through to in-memory
        }
    }

    // In-memory fallback
    let record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
        // New window
        record = {
            count: 1,
            resetTime: now + windowMs,
        };
        rateLimitStore.set(key, record);
        return null; // Allowed
    }

    record.count++;

    if (record.count > maxRequests) {
        const retryAfter = Math.ceil((record.resetTime - now) / 1000);
        return createRateLimitResponse(maxRequests, retryAfter, record.resetTime);
    }

    return null; // Allowed
}

/**
 * Create a 429 rate limit response
 */
function createRateLimitResponse(maxRequests, retryAfter, resetTime) {
    return new Response(
        JSON.stringify({
            error: 'Too Many Requests',
            message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
            retryAfter,
        }),
        {
            status: 429,
            headers: {
                'Content-Type': 'application/json',
                'Retry-After': String(retryAfter),
                'X-RateLimit-Limit': String(maxRequests),
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': String(Math.ceil(resetTime / 1000)),
            },
        }
    );
}

/**
 * Strict rate limit for sensitive endpoints (webhooks, auth).
 * 30 requests per minute.
 */
export async function rateLimitStrict(request) {
    return rateLimit(request, {
        maxRequests: 30,
        windowMs: 60 * 1000,
        keyPrefix: 'strict',
    });
}

/**
 * Very strict rate limit for write operations.
 * 10 requests per minute.
 */
export async function rateLimitWrite(request) {
    return rateLimit(request, {
        maxRequests: 10,
        windowMs: 60 * 1000,
        keyPrefix: 'write',
    });
}

/**
 * Get Redis connection status for health checks
 */
export async function getRedisStatus() {
    const redis = await getRedisClient();
    if (!redis || !redisAvailable) {
        return { connected: false, mode: 'in-memory' };
    }
    
    try {
        const pong = await redis.ping();
        return { connected: pong === 'PONG', mode: 'redis' };
    } catch (err) {
        return { connected: false, mode: 'in-memory', error: err.message };
    }
}
