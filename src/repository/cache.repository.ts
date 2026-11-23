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
    url: config.REDIS_URL,
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

const mapJobToStatus = async (job: Job<CacheWarmJobData>): Promise<CacheJobStatus> => {
    const state = await job.getState();
    const progress = (job.progress as CacheJobStatus['progress']) || { total: 0, completed: 0, failed: 0, skipped: 0 };
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
            if (result && result.totalRequested > 0 && result.summary.failed === result.totalRequested) {
                status = CacheWarmStatus.FAILED;
            } else if (result && result.totalRequested > 0 && result.summary.skipped === result.totalRequested) {
                status = CacheWarmStatus.SKIPPED;
            } else {
                status = CacheWarmStatus.WARMED;
            }
            break;
        case 'failed':
            status = CacheWarmStatus.FAILED;
            break;
        default:
            status = CacheWarmStatus.PENDING;
    }

    return {
        jobId: job.id!,
        jobType: job.data?.jobType || CacheJobType.WARM,
        status,
        progress,
        results: result?.results || [],
        createdAt: new Date(job.timestamp),
        updatedAt: new Date(job.finishedOn || Date.now()),
        completedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
    };
};

const getBullMqStatesForStatus = (status?: CacheWarmStatus): Array<'waiting' | 'active' | 'completed' | 'failed' | 'delayed'> => {
    switch (status) {
        case CacheWarmStatus.PENDING:
            return ['waiting', 'delayed'];
        case CacheWarmStatus.WARMING:
            return ['active'];
        case CacheWarmStatus.WARMED:
        case CacheWarmStatus.SKIPPED:
            return ['completed'];
        case CacheWarmStatus.FAILED:
            return ['failed', 'completed'];
        default:
            return ['waiting', 'active', 'completed', 'failed', 'delayed'];
    }
};

export const getJobStatus = async (
    jobId: string,
    requester?: { userId: string; isAdmin: boolean }
): Promise<CacheJobStatus | null> => {
    const job = await cacheQueue.getJob(jobId);
    if (!job) return null;

    if (requester && !requester.isAdmin && job.data?.requestedBy !== requester.userId) {
        return null;
    }

    return mapJobToStatus(job);
};

export const listJobs = async (
    status?: CacheWarmStatus,
    jobType?: CacheJobType,
    page: number = 1,
    limit: number = 20,
    requestedBy?: string
): Promise<{ jobs: CacheJobStatus[]; metadata: { total: number; page: number; limit: number; totalPages: number } }> => {
    try {
        const bullStates = getBullMqStatesForStatus(status);
        const jobs = await cacheQueue.getJobs(bullStates, 0, -1);

        let filteredJobs = jobs.filter((job): job is Job<CacheWarmJobData> => Boolean(job?.id));
        if (jobType) {
            filteredJobs = filteredJobs.filter(j => j.data?.jobType === jobType);
        }
        if (requestedBy) {
            filteredJobs = filteredJobs.filter(j => j.data?.requestedBy === requestedBy);
        }

        filteredJobs.sort((a, b) => b.timestamp - a.timestamp);

        const mappedJobs = await Promise.all(filteredJobs.map(mapJobToStatus));
        const statusFiltered = status
            ? mappedJobs.filter(j => j.status === status)
            : mappedJobs;

        const total = statusFiltered.length;
        const start = (page - 1) * limit;
        const paginatedJobs = statusFiltered.slice(start, start + limit);

        return {
            jobs: paginatedJobs,
            metadata: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            }
        };
    } catch (error: any) {
        console.error('Error in listJobs:', error);
        throw error;
    }
};

export const cancelJob = async (
    jobId: string,
    requester?: { userId: string; isAdmin: boolean }
): Promise<boolean> => {
    const job = await cacheQueue.getJob(jobId);
    if (!job) return false;

    if (requester && !requester.isAdmin && job.data?.requestedBy !== requester.userId) {
        return false;
    }

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