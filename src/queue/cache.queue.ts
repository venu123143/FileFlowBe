import { Worker, QueueEvents, type Job } from 'bullmq';
import config from '@/config/config';
import cacheService from '@/services/cache.service';
import { CacheJobType, CacheWarmStatus } from '@/types/cache.types';
import type { CacheWarmJobData, CacheWarmBatchResult } from '@/types/cache.types';

const connection = {
    url: config.REDIS_URL,
};

export const cacheWorker = new Worker<CacheWarmJobData, CacheWarmBatchResult>('fileflow-cache-warm-queue',
    async (job: Job<CacheWarmJobData>) => {
        const { objectKeys, jobType, requestedBy } = job.data;
        const startTime = Date.now();
        const jobId = job.id ?? 'unknown';

        console.log(`[CacheWorker] Processing ${jobType} job ${jobId} for ${objectKeys.length} object(s), requested by ${requestedBy || 'unknown'}`);

        await job.updateProgress({ total: objectKeys.length, completed: 0, failed: 0, });

        const results: CacheWarmBatchResult['results'] = [];

        for (let i = 0; i < objectKeys.length; i++) {
            const objectKey = objectKeys[i];
            if (!objectKey) continue;

            await job.updateProgress({
                total: objectKeys.length,
                completed: i,
                failed: results.filter(r => r.status === CacheWarmStatus.FAILED).length,
            });

            let result;
            if (jobType === CacheJobType.REFRESH) {
                result = await cacheService.refreshVideo(objectKey);
            } else {
                result = await cacheService.warmVideo(objectKey);
            }

            results.push(result);

            console.log(`[CacheWorker] ${jobType} for ${objectKey}: ${result.status} (${result.durationMs}ms)`);
        }

        const warmed = results.filter(r => r.status === CacheWarmStatus.WARMED).length;
        const failed = results.filter(r => r.status === CacheWarmStatus.FAILED).length;

        await job.updateProgress({
            total: objectKeys.length,
            completed: objectKeys.length,
            failed,
        });

        const duration = Date.now() - startTime;
        console.log(`[CacheWorker] Job ${jobId} completed in ${duration}ms: ${warmed} warmed, ${failed} failed`);

        const batchResult = {
            jobId,
            totalRequested: objectKeys.length,
            results,
            summary: {
                warmed,
                failed,
                pending: 0,
            },
        };

        // Throw if ALL items failed so BullMQ can retry according to backoff policy
        if (warmed === 0 && failed > 0) {
            const errorMessages = results.filter(r => r.error).map(r => r.error).join('; ');
            throw new Error(`All ${failed} object(s) failed: ${errorMessages}`);
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
    }
);

const queueEvents = new QueueEvents('fileflow-cache-warm-queue', { connection });
queueEvents.setMaxListeners(1);

queueEvents.on('completed', ({ jobId, returnvalue }) => {
    const result = returnvalue as unknown as CacheWarmBatchResult;
    console.log(`[CacheWorker] Job ${jobId} completed: ${result.summary.warmed} warmed, ${result.summary.failed} failed`);
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
    console.warn(`[CacheWorker] Job ${jobId} stalled`);
});

export default cacheWorker;