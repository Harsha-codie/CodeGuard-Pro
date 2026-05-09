/**
 * Health Check API
 * Returns system status including Redis, database, and queue information.
 * 
 * GET /api/health - Get system health status
 */
import { getRedisStatus } from '../../../lib/rate-limit';

export async function GET(request) {
    const startTime = Date.now();
    const status = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: {},
    };

    // Check Redis
    try {
        const redisStatus = await getRedisStatus();
        status.services.redis = {
            status: redisStatus.connected ? 'connected' : 'fallback',
            mode: redisStatus.mode,
            ...(redisStatus.error && { error: redisStatus.error }),
        };
    } catch (err) {
        status.services.redis = { status: 'error', error: err.message };
    }

    // Check Database
    try {
        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();
        await prisma.$queryRaw`SELECT 1`;
        await prisma.$disconnect();
        status.services.database = { status: 'connected' };
    } catch (err) {
        status.services.database = { status: 'error', error: err.message };
        status.status = 'degraded';
    }

    // Check Queue status (if Redis available)
    if (status.services.redis?.mode === 'redis') {
        try {
            const { Queue } = await import('bullmq');
            const redisConnection = process.env.REDIS_URL 
                ? { url: process.env.REDIS_URL }
                : { 
                    host: process.env.REDIS_HOST || 'localhost', 
                    port: parseInt(process.env.REDIS_PORT || '6379'), 
                    password: process.env.REDIS_PASSWORD || undefined 
                };
            
            const queue = new Queue('compliance-analysis', { connection: redisConnection });
            const [waiting, active, completed, failed] = await Promise.all([
                queue.getWaitingCount(),
                queue.getActiveCount(),
                queue.getCompletedCount(),
                queue.getFailedCount(),
            ]);
            await queue.close();
            
            status.services.queue = {
                status: 'connected',
                jobs: { waiting, active, completed, failed },
            };
        } catch (err) {
            status.services.queue = { status: 'unavailable', error: err.message };
        }
    } else {
        status.services.queue = { status: 'not-configured', mode: 'inline' };
    }

    // Response time
    status.responseTime = `${Date.now() - startTime}ms`;

    // Determine overall status
    const hasErrors = Object.values(status.services).some(s => s.status === 'error');
    if (hasErrors) status.status = 'unhealthy';

    return Response.json(status, {
        status: status.status === 'healthy' ? 200 : status.status === 'degraded' ? 200 : 503,
        headers: {
            'Cache-Control': 'no-store',
        },
    });
}
