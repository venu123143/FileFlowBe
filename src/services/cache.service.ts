import config from '@/config/config';
import constants from '@/global/constants';
import s3Service from '@/config/s3.config';
import {
    CacheWarmStatus,
    CacheJobType,
    CacheHitStatus,
    CACHE_WARM_TIMEOUT_MS,
    CLOUDFLARE_PURGE_TIMEOUT_MS,
    CLOUDFLARE_PURGE_PROPAGATION_DELAY_MS,
    MAX_RETRIES_PER_ITEM,
} from '@/types/cache.types';
import type {
    CacheWarmJobData,
    CacheWarmResult,
    CacheWarmBatchResult,
    PurgeResult,
} from '@/types/cache.types';

interface CloudflarePurgeResponse {
    success: boolean;
    errors: Array<{ code: number; message: string }>;
    messages: Array<{ code: number; message: string }>;
    result: { id: string };
}

interface CacheAttemptResult {
    result: CacheWarmResult;
    shouldRetry: boolean;
}

export class CacheService {
    private readonly cdnBaseUrl: string;
    private readonly cloudflareApiUrl: string;
    private readonly cloudflareToken: string;
    private readonly cloudflareZoneId: string;

    constructor() {
        this.cdnBaseUrl = config.S3.CDN_URL.replace(/\/$/, '');
        this.cloudflareApiUrl = constants.CLOUDFLARE_BASE_URL;
        this.cloudflareToken = config.CLOUDFLARE.API_TOKEN;
        this.cloudflareZoneId = config.CLOUDFLARE.ZONE_ID;
    }

    private buildCdnUrl(objectKey: string): string {
        return `${this.cdnBaseUrl}/${objectKey}`;
    }

    private validateObjectKey(objectKey: string): boolean {
        if (!objectKey || objectKey.trim() === '') return false;
        if (objectKey.length > 1024) return false;
        // Allow S3-compatible key patterns: alphanumeric, dots, dashes, underscores, forward slashes
        // Must not start with slash, must not contain path traversal
        if (!/^[a-zA-Z0-9._/-]+$/.test(objectKey)) return false;
        if (objectKey.includes('..') || objectKey.startsWith('/') || objectKey.endsWith('/')) return false;
        // Must have at least one non-slash character
        if (!objectKey.replace(/\//g, '').length) return false;
        return true;
    }

    private parseCacheHitStatus(cfCacheStatus: string | null): CacheHitStatus {
        if (!cfCacheStatus) return CacheHitStatus.UNKNOWN;

        const status = cfCacheStatus.toUpperCase();
        switch (status) {
            case 'HIT':
                return CacheHitStatus.HIT;
            case 'MISS':
                return CacheHitStatus.MISS;
            case 'EXPIRED':
                return CacheHitStatus.EXPIRED;
            case 'STALE':
                return CacheHitStatus.STALE;
            case 'BYPASS':
                return CacheHitStatus.BYPASS;
            case 'DYNAMIC':
                return CacheHitStatus.DYNAMIC;
            default:
                return CacheHitStatus.UNKNOWN;
        }
    }

    private isCacheableResponse(response: Response): boolean {
        const cacheControl = response.headers.get('cache-control') || '';
        if (cacheControl.includes('no-store') || cacheControl.includes('private')) {
            return false;
        }
        // Check for non-cacheable status codes
        if (response.status === 301 || response.status === 302 || response.status === 303 || response.status === 307 || response.status === 308) {
            return false;
        }
        return true;
    }

    private async attemptWarmVideo(objectKey: string, attemptNumber: number = 1): Promise<CacheAttemptResult> {
        const startedAt = new Date();
        const url = this.buildCdnUrl(objectKey);
        if (!this.validateObjectKey(objectKey)) {
            return {
                result: {
                    objectKey,
                    status: CacheWarmStatus.SKIPPED,
                    cacheHitStatus: CacheHitStatus.ERROR,
                    error: 'Invalid object key format',
                    startedAt,
                    completedAt: new Date(),
                    durationMs: Date.now() - startedAt.getTime(),
                },
                shouldRetry: false,
            };
        }

        // Verify object exists in S3 before attempting to warm
        const exists = await this.checkVideoExists(objectKey);
        if (!exists) {
            return {
                result: {
                    objectKey,
                    status: CacheWarmStatus.FAILED,
                    cacheHitStatus: CacheHitStatus.ERROR,
                    error: 'Object not found in storage',
                    startedAt,
                    completedAt: new Date(),
                    durationMs: Date.now() - startedAt.getTime(),
                },
                shouldRetry: false,
            };
        }

        try {
            const response = await fetch(url, {
                method: 'GET',
                // Use AbortSignal.timeout for modern environments
                signal: AbortSignal.timeout(CACHE_WARM_TIMEOUT_MS),
                headers: {
                    'Accept': '*/*',
                    'User-Agent': 'FileFlow-CacheWarmer/1.0',
                },
            });

            if (!response.ok) {
                throw new Error(`CDN warming failed: HTTP ${response.status} ${response.statusText}`);
            }

            if (!response.body) {
                throw new Error('CDN returned an empty response body');
            }

            // Check if response is actually cacheable
            const isCacheable = this.isCacheableResponse(response);

            const reader = response.body.getReader();
            let totalBytes = 0;

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    totalBytes += value.byteLength;
                }
            } finally {
                reader.releaseLock();
            }

            const cfCacheStatus = response.headers.get('cf-cache-status');
            const cacheHitStatus = this.parseCacheHitStatus(cfCacheStatus);
            const completedAt = new Date();

            // Determine status based on cache hit status and cacheability
            let status: CacheWarmStatus;
            if (!isCacheable) {
                status = CacheWarmStatus.FAILED;
            } else if (cacheHitStatus === CacheHitStatus.HIT) {
                // Already cached - this is fine for warming purposes
                status = CacheWarmStatus.WARMED;
            } else if (cacheHitStatus === CacheHitStatus.MISS || cacheHitStatus === CacheHitStatus.EXPIRED) {
                // Fetched from origin, now cached at edge - this is what we want
                status = CacheWarmStatus.WARMED;
            } else if (cacheHitStatus === CacheHitStatus.BYPASS || cacheHitStatus === CacheHitStatus.DYNAMIC) {
                // Cache bypassed or non-cacheable
                status = CacheWarmStatus.FAILED;
            } else {
                // Unknown or other status - treat as warmed if we got a successful response
                status = CacheWarmStatus.WARMED;
            }

            return {
                result: {
                    objectKey,
                    status,
                    cacheHitStatus,
                    totalBytes,
                    cacheStatus: cfCacheStatus || 'unknown',
                    httpStatus: response.status,
                    startedAt,
                    completedAt,
                    durationMs: completedAt.getTime() - startedAt.getTime(),
                },
                shouldRetry: false,
            };
        } catch (error: any) {
            const completedAt = new Date();

            let errorMessage = error.message;
            let shouldRetry = attemptNumber < MAX_RETRIES_PER_ITEM;

            if (error.name === 'AbortError' || error.name === 'TimeoutError' || error.message?.includes('timeout')) {
                errorMessage = `Warming timed out after ${CACHE_WARM_TIMEOUT_MS / 1000 / 60} minutes`;
                shouldRetry = attemptNumber < MAX_RETRIES_PER_ITEM;
            }

            // Don't retry on 4xx errors (except 429)
            if (error.message.includes('HTTP 4')) {
                const statusMatch = error.message.match(/HTTP (\d{3})/);
                if (statusMatch) {
                    const status = parseInt(statusMatch[1], 10);
                    if (status >= 400 && status < 500 && status !== 429) {
                        shouldRetry = false;
                    }
                }
            }

            return {
                result: {
                    objectKey,
                    status: CacheWarmStatus.FAILED,
                    cacheHitStatus: CacheHitStatus.ERROR,
                    error: errorMessage,
                    startedAt,
                    completedAt,
                    durationMs: completedAt.getTime() - startedAt.getTime(),
                    retried: attemptNumber > 1,
                },
                shouldRetry,
            };
        }
    }

    async warmVideo(objectKey: string): Promise<CacheWarmResult> {
        let lastResult: CacheWarmResult | null = null;

        for (let attempt = 1; attempt <= MAX_RETRIES_PER_ITEM; attempt++) {
            const { result, shouldRetry } = await this.attemptWarmVideo(objectKey, attempt);
            lastResult = result;

            if (!shouldRetry || result.status === CacheWarmStatus.WARMED || result.status === CacheWarmStatus.SKIPPED) {
                return result;
            }

            // Wait before retry with exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, attempt - 1), 5000)));
        }

        return lastResult!;
    }

    async purgeVideo(objectKey: string): Promise<PurgeResult> {
        if (!this.cloudflareToken || !this.cloudflareZoneId) {
            return {
                success: false,
                errors: ['Cloudflare credentials not configured'],
                purgedUrls: [],
            };
        }

        if (!this.validateObjectKey(objectKey)) {
            return {
                success: false,
                errors: ['Invalid object key format'],
                purgedUrls: [],
            };
        }

        const url = this.buildCdnUrl(objectKey);

        try {
            const response = await fetch(
                `${this.cloudflareApiUrl}/zones/${this.cloudflareZoneId}/purge_cache`,
                {
                    method: 'POST',
                    signal: AbortSignal.timeout(CLOUDFLARE_PURGE_TIMEOUT_MS),
                    headers: {
                        'Authorization': `Bearer ${this.cloudflareToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ files: [url] }),
                }
            );

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error');
                throw new Error(`Cloudflare API HTTP ${response.status}: ${errorText}`);
            }

            const result = await response.json() as CloudflarePurgeResponse;

            if (!result.success) {
                const errors = result.errors?.map(e => e.message) || ['Unknown Cloudflare API error'];
                return {
                    success: false,
                    errors,
                    purgedUrls: [url],
                };
            }

            return {
                success: true,
                purgedUrls: [url],
                purgeId: result.result?.id,
            };
        } catch (error: any) {
            return {
                success: false,
                errors: [error.message],
                purgedUrls: [url],
            };
        }
    }

    async refreshVideo(objectKey: string): Promise<CacheWarmResult> {
        const startedAt = new Date();

        // Verify object exists before attempting refresh
        const exists = await this.checkVideoExists(objectKey);
        if (!exists) {
            return {
                objectKey,
                status: CacheWarmStatus.FAILED,
                cacheHitStatus: CacheHitStatus.ERROR,
                error: 'Object not found in storage',
                startedAt,
                completedAt: new Date(),
                durationMs: Date.now() - startedAt.getTime(),
            };
        }

        // Step 1: Purge the CDN cache
        const purgeResult = await this.purgeVideo(objectKey);

        if (!purgeResult.success) {
            return {
                objectKey,
                status: CacheWarmStatus.FAILED,
                cacheHitStatus: CacheHitStatus.ERROR,
                error: `Purge failed: ${purgeResult.errors?.join(', ')}`,
                startedAt,
                completedAt: new Date(),
                durationMs: Date.now() - startedAt.getTime(),
            };
        }

        // Step 2: Wait for purge to propagate with exponential backoff
        // Start with base delay and increase if needed
        let propagationDelay = CLOUDFLARE_PURGE_PROPAGATION_DELAY_MS;
        const maxPropagationDelay = 10000; // 10 seconds max

        for (let attempt = 1; attempt <= 3; attempt++) {
            await new Promise(resolve => setTimeout(resolve, propagationDelay));

            // Quick HEAD request to check if purge propagated
            try {
                const checkResponse = await fetch(this.buildCdnUrl(objectKey), { method: 'HEAD' });
                const cfCacheStatus = checkResponse.headers.get('cf-cache-status');
                if (cfCacheStatus && cfCacheStatus.toUpperCase() === 'MISS') {
                    // Purge has propagated (MISS means it's not in cache)
                    break;
                }
            } catch {
                // Ignore check errors, continue with warming
            }

            // Exponential backoff for next attempt
            propagationDelay = Math.min(propagationDelay * 2, maxPropagationDelay);
        }

        // Step 3: Warm the cache by fetching the object
        const warmResult = await this.warmVideo(objectKey);

        // Update timing to reflect total refresh duration
        const completedAt = new Date();
        return {
            ...warmResult,
            startedAt,
            completedAt,
            durationMs: completedAt.getTime() - startedAt.getTime(),
        };
    }

    async processWarmJob(jobData: CacheWarmJobData): Promise<CacheWarmBatchResult> {
        const { objectKeys, jobType } = jobData;
        const results: CacheWarmResult[] = [];

        for (const objectKey of objectKeys) {
            let result: CacheWarmResult;

            if (jobType === CacheJobType.REFRESH) {
                result = await this.refreshVideo(objectKey);
            } else {
                result = await this.warmVideo(objectKey);
            }

            results.push(result);
        }

        const warmed = results.filter(r => r.status === CacheWarmStatus.WARMED).length;
        const failed = results.filter(r => r.status === CacheWarmStatus.FAILED).length;
        const skipped = results.filter(r => r.status === CacheWarmStatus.SKIPPED).length;

        return {
            jobId: '',
            totalRequested: objectKeys.length,
            results,
            summary: {
                warmed,
                failed,
                skipped,
                pending: 0,
            },
        };
    }

    async checkVideoExists(objectKey: string): Promise<boolean> {
        if (!this.validateObjectKey(objectKey)) return false;

        try {
            const metadata = await s3Service.getMetadata(objectKey);
            return !!metadata.contentLength;
        } catch {
            return false;
        }
    }
}

export default new CacheService();