import config from '@/config/config';
import constants from '@/global/constants';
import s3Service from '@/config/s3.config';
import {
    CacheWarmStatus,
    CacheJobType,
    CACHE_WARM_TIMEOUT_MS,
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
        if (!/^[a-zA-Z0-9_\-/.]+$/.test(objectKey)) return false;
        if (objectKey.includes('..') || objectKey.startsWith('/')) return false;
        return true;
    }

    async warmVideo(objectKey: string): Promise<CacheWarmResult> {
        const startedAt = new Date();
        const url = this.buildCdnUrl(objectKey);

        if (!this.validateObjectKey(objectKey)) {
            return {
                objectKey,
                status: CacheWarmStatus.FAILED,
                error: 'Invalid object key format',
                startedAt,
                completedAt: new Date(),
                durationMs: Date.now() - startedAt.getTime(),
            };
        }

        try {
            const response = await fetch(url, {
                method: 'GET',
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

            const cacheStatus = response.headers.get('cf-cache-status') || 'unknown';
            const completedAt = new Date();

            return {
                objectKey,
                status: CacheWarmStatus.WARMED,
                totalBytes,
                cacheStatus,
                httpStatus: response.status,
                startedAt,
                completedAt,
                durationMs: completedAt.getTime() - startedAt.getTime(),
            };
        } catch (error: any) {
            const completedAt = new Date();

            let errorMessage = error.message;
            if (error.name === 'AbortError' || error.name === 'TimeoutError' || error.message?.includes('timeout')) {
                errorMessage = `Warming timed out after ${CACHE_WARM_TIMEOUT_MS / 1000 / 60} minutes`;
            }

            return {
                objectKey,
                status: CacheWarmStatus.FAILED,
                error: errorMessage,
                startedAt,
                completedAt,
                durationMs: completedAt.getTime() - startedAt.getTime(),
            };
        }
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
                    headers: {
                        'Authorization': `Bearer ${this.cloudflareToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ files: [url] }),
                }
            );

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
        const purgeResult = await this.purgeVideo(objectKey);

        if (!purgeResult.success) {
            return {
                objectKey,
                status: CacheWarmStatus.FAILED,
                error: `Purge failed: ${purgeResult.errors?.join(', ')}`,
                startedAt: new Date(),
                completedAt: new Date(),
                durationMs: 0,
            };
        }

        await new Promise(resolve => setTimeout(resolve, 500));

        return this.warmVideo(objectKey);
    }

    async processWarmJob(jobData: CacheWarmJobData): Promise<CacheWarmBatchResult> {
        const { objectKeys, jobType, requestedBy } = jobData;
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

        return {
            jobId: '',
            totalRequested: objectKeys.length,
            results,
            summary: {
                warmed,
                failed,
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