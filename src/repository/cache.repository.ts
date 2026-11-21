import { Queue, type Job, type JobsOptions } from 'bullmq';
import config from '@/config/config';
import {
    CacheWarmStatus,
    CacheJobType,
} from '@/types/cache.types';
import type {
    CacheWarmJobData,
    CacheWarmResult,
    CacheWarmBatchResult,
    CacheJobStatus,
} from '@/types/cache.types';
import { CACHE_QUEUE_NAME, CACHE_JOB_NAME } from '@/types/cache.types';

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

const defaultJobOptions: JobsOptions = {
    attempts: 5,
    backoff: {
        type: 'exponential',
        delay: 5000,
    },
    // Keep completed jobs for metrics - store last 100 completed and 50 failed
    removeOnComplete: 100,
    removeOnFail: 50,
    priority: 5,
    lifo: false,
};

export const cacheQueue = new Queue<CacheWarmJobData>(CACHE_QUEUE_NAME, {
    connection,
    defaultJobOptions,
});

export interface CacheJobRecord {
    jobId: string;
    jobType: CacheJobType;
    objectKeys: string[];
    requestedBy?: string;
    status: CacheWarmStatus;
    results: CacheWarmResult[];
    progress: {
        total: number;
        completed: number;
        failed: number;
        skipped: number;
    };
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date;
}

export const addCacheWarmJob = async (objectKeys: string[], jobType: CacheJobType = CacheJobType.WARM, requestedBy?: string, priority?: number): Promise<string> => {
    const job = await cacheQueue.add(CACHE_JOB_NAME, { objectKeys, jobType, requestedBy }, {
        priority: priority ?? 5,
    });

    if (!job.id) {
        throw new Error('Failed to create cache warm job');
    }

    return job.id;
};

export const getJobStatus = async (jobId: string): Promise<CacheJobStatus | null> => {
    const job = await cacheQueue.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();
    const progress = job.progress as CacheJobStatus['progress'] || { total: 0, completed: 0, failed: 0, skipped: 0 };
    const result = job.returnvalue as CacheWarmBatchResult | undefined;

    let status: CacheWarmStatus;
    switch (state) {
        case 'waiting':
        case 'delayed':
            status = CacheWarmStatus.PENDING;
            break;
        case 'active':
            status = CacheWarmStatus.WARMING;
            break;
        case 'completed':
            status = result?.summary.failed === result?.totalRequested ? CacheWarmStatus.FAILED : CacheWarmStatus.WARMED;
            break;
        case 'failed':
            status = CacheWarmStatus.FAILED;
            break;
        default:
            status = CacheWarmStatus.PENDING;
    }

    return {
        jobId: job.id!,
        status,
        progress,
        results: result?.results || [],
        createdAt: new Date(job.timestamp),
        updatedAt: new Date(job.finishedOn || Date.now()),
        completedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
    };
};

export const listJobs = async (status?: CacheWarmStatus, jobType?: CacheJobType, page: number = 1, limit: number = 20): Promise<{ jobs: CacheJobStatus[]; metadata: { total: number; page: number; totalPages: number } }> => {
    try {
        const statuses = status ? [status] : ['waiting', 'active', 'completed', 'failed', 'delayed'];
        const jobs: Job<CacheWarmJobData>[] = [];

        for (const s of statuses) {
            const batch = await cacheQueue.getJobs([s as any], (page - 1) * limit, page * limit - 1);
            jobs.push(...batch);
        }

        const filteredJobs = jobType
            ? jobs.filter(j => j.data?.jobType === jobType)
            : jobs;

        filteredJobs.sort((a, b) => b.timestamp - a.timestamp);

        const paginatedJobs = filteredJobs.slice(0, limit);

        const jobStatuses = await Promise.all(
            paginatedJobs.map(async (job) => {
                if (!job.id) return null;
                return getJobStatus(job.id);
            })
        );

        return {
            jobs: jobStatuses.filter((j): j is CacheJobStatus => j !== null),
            metadata: {
                total: filteredJobs.length,
                page,
                totalPages: Math.ceil(filteredJobs.length / limit),
            }
        };
    } catch (error: any) {
        console.error('Error in listJobs:', error);
        throw error;
    }
};

export const cancelJob = async (jobId: string): Promise<boolean> => {
    const job = await cacheQueue.getJob(jobId);
    if (!job) return false;

    const state = await job.getState();
    if (state === 'completed' || state === 'failed') return false;

    await job.remove();
    return true;
};

export const getQueueMetrics = async () => {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
        cacheQueue.getWaitingCount(),
        cacheQueue.getActiveCount(),
        cacheQueue.getCompletedCount(),
        cacheQueue.getFailedCount(),
        cacheQueue.getDelayedCount(),
    ]);

    return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + completed + failed + delayed,
    };
};

export default {
    cacheQueue,
    addCacheWarmJob,
    getJobStatus,
    listJobs,
    cancelJob,
    getQueueMetrics,
};