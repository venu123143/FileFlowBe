import { type Context } from 'hono';
import { UserRole, type IUserAttributes } from '@/models/User.model';
import res from '@/utils/response';
import { canUserAccessStoragePaths } from '@/utils/file-access';
import {
    addCacheWarmJob,
    getJobStatus,
    listJobs,
    cancelJob,
    getQueueMetrics,
} from '@/repository/cache.repository';
import { CacheJobType, CacheWarmStatus } from '@/types/cache.types';
import type { WarmVideoInput, RefreshVideoInput, GetJobStatusInput, ListJobsInput } from '@/validation/cache.validation';

const warmVideo = async (c: Context) => {
    const user = c.get('user') as IUserAttributes;
    const validated = c.get('validated') as WarmVideoInput;
    const { objectKeys } = validated;

    try {
        const hasAccess = await canUserAccessStoragePaths(user, objectKeys, 'read');
        if (!hasAccess) {
            return res.FailureResponse(c, 403, {
                message: 'Forbidden: you do not have permission to warm one or more requested files',
            });
        }

        const jobId = await addCacheWarmJob(objectKeys, CacheJobType.WARM, user?.id, 5);

        return res.SuccessResponse(c, 202, {
            message: 'Cache warming job queued successfully',
            data: {
                jobId,
                status: CacheWarmStatus.PENDING,
                message: 'Job has been queued for background processing',
                totalRequested: objectKeys.length,
            },
        });
    } catch (error: any) {
        return res.FailureResponse(c, 500, {
            message: 'Failed to queue cache warming job',
            error: error.message,
        });
    }
};

const refreshVideo = async (c: Context) => {
    const user = c.get('user') as IUserAttributes;
    const validated = c.get('validated') as RefreshVideoInput;
    const { objectKeys } = validated;

    try {
        const hasAccess = await canUserAccessStoragePaths(user, objectKeys, 'read');
        if (!hasAccess) {
            return res.FailureResponse(c, 403, {
                message: 'Forbidden: you do not have permission to refresh one or more requested files',
            });
        }

        const jobId = await addCacheWarmJob(objectKeys, CacheJobType.REFRESH, user?.id, 10);

        return res.SuccessResponse(c, 202, {
            message: 'Cache refresh job queued successfully',
            data: {
                jobId,
                status: CacheWarmStatus.PENDING,
                message: 'Job has been queued for background processing (purge + warm)',
                totalRequested: objectKeys.length,
            },
        });
    } catch (error: any) {
        return res.FailureResponse(c, 500, {
            message: 'Failed to queue cache refresh job',
            error: error.message,
        });
    }
};

const getJobStatusHandler = async (c: Context) => {
    const user = c.get('user') as IUserAttributes;
    const validated = c.get('validatedParams') as GetJobStatusInput;
    const { jobId } = validated;

    try {
        const jobStatus = await getJobStatus(jobId, {
            userId: user.id,
            isAdmin: user.role === UserRole.ADMIN,
        });

        if (!jobStatus) {
            return res.FailureResponse(c, 404, {
                message: 'Cache job not found',
            });
        }

        return res.SuccessResponse(c, 200, {
            message: 'Job status retrieved successfully',
            data: jobStatus,
        });
    } catch (error: any) {
        return res.FailureResponse(c, 500, {
            message: 'Failed to retrieve job status',
            error: error.message,
        });
    }
};

const listJobsHandler = async (c: Context) => {
    try {
        const user = c.get('user') as IUserAttributes;
        const validated = c.get('validatedQuery') as ListJobsInput | undefined;
        const { status, jobType, page, limit } = validated || {};

        // Ensure page and limit are numbers
        const pageNum = page ? parseInt(String(page), 10) : 1;
        const limitNum = limit ? parseInt(String(limit), 10) : 20;
        const requestedByFilter = user.role === UserRole.ADMIN ? undefined : user.id;

        const result = await listJobs(status, jobType, pageNum, limitNum, requestedByFilter);

        return res.SuccessResponse(c, 200, {
            message: 'Jobs retrieved successfully',
            data: result,
        });
    } catch (error: any) {
        console.error('Error in listJobsHandler:', error);
        return res.FailureResponse(c, 500, {
            message: 'Failed to retrieve jobs',
            error: error.message,
        });
    }
};

const cancelJobHandler = async (c: Context) => {
    const user = c.get('user') as IUserAttributes;
    const validated = c.get('validatedParams') as GetJobStatusInput;
    const { jobId } = validated;

    try {
        const cancelled = await cancelJob(jobId, {
            userId: user.id,
            isAdmin: user.role === UserRole.ADMIN,
        });

        if (!cancelled) {
            return res.FailureResponse(c, 404, {
                message: 'Job not found or cannot be cancelled (already completed/failed)',
            });
        }

        return res.SuccessResponse(c, 200, {
            message: 'Job cancelled successfully',
            data: { jobId },
        });
    } catch (error: any) {
        return res.FailureResponse(c, 500, {
            message: 'Failed to cancel job',
            error: error.message,
        });
    }
};

const getQueueMetricsHandler = async (c: Context) => {
    try {
        const metrics = await getQueueMetrics();

        return res.SuccessResponse(c, 200, {
            message: 'Queue metrics retrieved successfully',
            data: metrics,
        });
    } catch (error: any) {
        return res.FailureResponse(c, 500, {
            message: 'Failed to retrieve queue metrics',
            error: error.message,
        });
    }
};

export default {
    warmVideo,
    refreshVideo,
    getJobStatus: getJobStatusHandler,
    listJobs: listJobsHandler,
    cancelJob: cancelJobHandler,
    getQueueMetrics: getQueueMetricsHandler,
};