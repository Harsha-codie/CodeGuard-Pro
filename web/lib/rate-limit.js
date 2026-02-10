/**
 * Simple in-memory rate limiter for API routes.
 * Limits requests per IP address with a sliding window.
 * 
 * Usage in API routes:
 *   import { rateLimit, rateLimitStrict } from '@/lib/rate-limit';
 *   
 *   export async function POST(request) {
 *       const limited = rateLimit(request);
 *       if (limited) return limited;
 *       // ... handle request
 *   }
 */

// In-memory store for rate limiting (resets on server restart)
const rateLimitStore = new Map();

// Clean up old entries every 5 minutes
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
 * 
 * @param {Request} request - The incoming request
 * @param {Object} options - Rate limit configuration
 * @param {number} options.maxRequests - Maximum requests per window (default: 60)
 * @param {number} options.windowMs - Time window in milliseconds (default: 60000 = 1 min)
 * @param {string} options.keyPrefix - Prefix for the rate limit key (default: 'global')
 */
export function rateLimit(request, options = {}) {
    const {
        maxRequests = 60,
        windowMs = 60 * 1000,  // 1 minute
        keyPrefix = 'global',
    } = options;

    // Get client IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
        || request.headers.get('x-real-ip') 
        || 'unknown';

    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();

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
                    'X-RateLimit-Reset': String(Math.ceil(record.resetTime / 1000)),
                },
            }
        );
    }

    return null; // Allowed
}

/**
 * Strict rate limit for sensitive endpoints (webhooks, auth).
 * 30 requests per minute.
 */
export function rateLimitStrict(request) {
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
export function rateLimitWrite(request) {
    return rateLimit(request, {
        maxRequests: 10,
        windowMs: 60 * 1000,
        keyPrefix: 'write',
    });
}
