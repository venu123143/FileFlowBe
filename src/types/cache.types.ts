export enum CacheWarmStatus {
    PENDING = 'pending',
    WARMING = 'warming',
    WARMED = 'warmed',
    FAILED = 'failed',
    SKIPPED = 'skipped',
}

export enum CacheJobType {
    WARM = 'warm',
    REFRESH = 'refresh',
}

export enum CacheHitStatus {
    HIT = 'HIT',
    MISS = 'MISS',
    EXPIRED = 'EXPIRED',
    STALE = 'STALE',
    BYPASS = 'BYPASS',
    DYNAMIC = 'DYNAMIC',
    UNKNOWN = 'UNKNOWN',
    ERROR = 'ERROR',
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
    cacheHitStatus?: CacheHitStatus;
    totalBytes?: number;
    cacheStatus?: string;
    httpStatus?: number;
    error?: string;
    startedAt: Date;
    completedAt?: Date;
    durationMs?: number;
    retried?: boolean;
}

export interface CacheWarmBatchResult {
    jobId: string;
    totalRequested: number;
    results: CacheWarmResult[];
    summary: {
        warmed: number;
        failed: number;
        skipped: number;
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
    jobType: CacheJobType;
    status: CacheWarmStatus;
    progress: {
        total: number;
        completed: number;
        failed: number;
        skipped: number;
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
    purgeId?: string;
}

export interface CacheQueueMetrics {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    total: number;
}

export const CACHE_QUEUE_NAME = 'fileflow-cache-warm-queue';
export const CACHE_JOB_NAME = 'cache-warm-job';
export const CACHE_WORKER_CONCURRENCY = 3;
export const CACHE_WARM_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
export const MAX_OBJECT_KEY_LENGTH = 1024;
export const CLOUDFLARE_PURGE_TIMEOUT_MS = 30 * 1000; // 30 seconds
export const CLOUDFLARE_PURGE_PROPAGATION_DELAY_MS = 2000; // 2 seconds base delay
export const MAX_RETRIES_PER_ITEM = 2;