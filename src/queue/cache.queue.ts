import { Worker, QueueEvents, type Job } from 'bullmq';
import config from '@/config/config';
import cacheService from '@/services/cache.service';
import { CacheJobType, CacheWarmStatus } from '@/types/cache.types';
import type { CacheWarmJobData, CacheWarmBatchResult } from '@/types/cache.types';

const connection = {
    host: new URL(config.REDIS_URL).hostname,
    port: parseInt(new URL(config.REDIS_URL).port || '6379'),
    password: new URL(config.REDIS_URL).password || undefined,
    db: parseInt(new URL(config.REDIS_URL).pathname.slice(1) || '0'),
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
        if (times > 3) return null;
        return Math.min(2 ** times * 100, 3000);
    },
    enableReadyCheck: true,
    lazyConnect: true,
};

export const cacheWorker = new Worker<CacheWarmJobData, CacheWarmBatchResult>(
    'fileflow-cache-warm-queue',
    async (job: Job<CacheWarmJobData>) => {
        const { objectKeys, jobType, requestedBy } = job.data;
        const startTime = Date.now();
        const jobId = job.id ?? 'unknown';

        console.log(`[CacheWorker] Processing ${jobType} job ${jobId} for ${objectKeys.length} object(s), requested by ${requestedBy || 'unknown'}`);

        // Initialize progress with actual valid items count
        const validKeys = objectKeys.filter(k => k && k.trim() !== '');
        const skippedCount = objectKeys.length - validKeys.length;

        await job.updateProgress({
            total: objectKeys.length,
            completed: 0,
            failed: 0,
            skipped: skippedCount,
        });

        const results: CacheWarmBatchResult['results'] = [];
        let processedCount = 0;

        for (let i = 0; i < objectKeys.length; i++) {
            const objectKey = objectKeys[i];

            // Handle invalid/empty keys
            if (!objectKey || objectKey.trim() === '') {
                results.push({
                    objectKey: objectKey || '',
                    status: CacheWarmStatus.SKIPPED,
                    error: 'Empty or invalid object key',
                    startedAt: new Date(),
                    completedAt: new Date(),
                    durationMs: 0,
                });
                continue;
            }

            // Update progress before processing
            await job.updateProgress({
                total: objectKeys.length,
                completed: processedCount,
                failed: results.filter(r => r.status === CacheWarmStatus.FAILED).length,
                skipped: results.filter(r => r.status === CacheWarmStatus.SKIPPED).length,
            });

            let result;
            if (jobType === CacheJobType.REFRESH) {
                result = await cacheService.refreshVideo(objectKey);
            } else {
                result = await cacheService.warmVideo(objectKey);
            }

            results.push(result);
            processedCount++;

            console.log(`[CacheWorker] ${jobType} for ${objectKey}: ${result.status} (${result.durationMs}ms, cache: ${result.cacheStatus || 'unknown'})`);
        }

        const warmed = results.filter(r => r.status === CacheWarmStatus.WARMED).length;
        const failed = results.filter(r => r.status === CacheWarmStatus.FAILED).length;
        const skipped = results.filter(r => r.status === CacheWarmStatus.SKIPPED).length;

        // Final progress update
        await job.updateProgress({
            total: objectKeys.length,
            completed: processedCount,
            failed,
            skipped,
        });

        const duration = Date.now() - startTime;
        console.log(`[CacheWorker] Job ${jobId} completed in ${duration}ms: ${warmed} warmed, ${failed} failed, ${skipped} skipped`);

        const batchResult: CacheWarmBatchResult = {
            jobId,
            totalRequested: objectKeys.length,
            results,
            summary: {
                warmed,
                failed,
                skipped,
                pending: 0,
            },
        };

        // Throw if ALL valid items failed so BullMQ can retry according to backoff policy
        if (warmed === 0 && (failed > 0 || skipped > 0) && (failed + skipped) === objectKeys.length) {
            const errorMessages = results
                .filter(r => r.error)
                .map(r => r.error)
                .join('; ');
            throw new Error(`All ${objectKeys.length} object(s) failed: ${errorMessages}`);
        }

        return batchResult;
    },
    {
        connection,
        concurrency: 3,
        limiter: {
            max: 10,
            duration: 60000,
        },
        // Remove stalled jobs after 30 minutes
        stalledInterval: 30 * 60 * 1000,
    }
);

// QueueEvents for monitoring - only one instance
const queueEvents = new QueueEvents('fileflow-cache-warm-queue', { connection });
queueEvents.setMaxListeners(1);

queueEvents.on('completed', ({ jobId, returnvalue }) => {
    const result = returnvalue as unknown as CacheWarmBatchResult;
    console.log(`[CacheWorker] Job ${jobId} completed: ${result.summary.warmed} warmed, ${result.summary.failed} failed, ${result.summary.skipped} skipped`);
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
    console.error(`[CacheWorker] Job ${jobId} failed: ${failedReason}`);
});

queueEvents.on('error', (error) => {
    console.error('[CacheWorker] Queue events error:', error);
});

cacheWorker.on('error', (error) => {
    console.error('[CacheWorker] Worker error:', error);
});

cacheWorker.on('stalled', (jobId) => {
    console.warn(`[CacheWorker] Job ${jobId} stalled - may need investigation`);
});

cacheWorker.on('drained', () => {
    console.log('[CacheWorker] All jobs processed, queue drained');
});

export default cacheWorker;