export enum CacheWarmStatus {
    PENDING = 'pending',
    WARMING = 'warming',
    WARMED = 'warmed',
    FAILED = 'failed',
}

export enum CacheJobType {
    WARM = 'warm',
    REFRESH = 'refresh',
}

export interface CacheWarmJobData {
    objectKeys: string[];
    jobType: CacheJobType;
    requestedBy?: string;
    priority?: number;
}

export interface CacheWarmResult {
    objectKey: string;
    status: CacheWarmStatus;
    totalBytes?: number;
    cacheStatus?: string;
    httpStatus?: number;
    error?: string;
    startedAt: Date;
    completedAt?: Date;
    durationMs?: number;
}

export interface CacheWarmBatchResult {
    jobId: string;
    totalRequested: number;
    results: CacheWarmResult[];
    summary: {
        warmed: number;
        failed: number;
        pending: number;
    };
}

export interface WarmVideoRequest {
    objectKeys: string[];
}

export interface RefreshVideoRequest {
    objectKeys: string[];
}

export interface CacheWarmResponse {
    jobId: string;
    status: CacheWarmStatus;
    message: string;
    totalRequested: number;
}

export interface CacheJobStatus {
    jobId: string;
    status: CacheWarmStatus;
    progress: {
        total: number;
        completed: number;
        failed: number;
    };
    results: CacheWarmResult[];
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date;
}

export interface PurgeResult {
    success: boolean;
    errors?: string[];
    purgedUrls: string[];
}

export const CACHE_QUEUE_NAME = 'fileflow-cache-warm-queue';
export const CACHE_JOB_NAME = 'cache-warm-job';
export const CACHE_WORKER_CONCURRENCY = 3;
export const CACHE_WARM_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
export const MAX_OBJECT_KEY_LENGTH = 1024;