import Joi from 'joi';
import { CacheJobType, CacheWarmStatus, MAX_OBJECT_KEY_LENGTH } from '@/types/cache.types';

const objectKeySchema = Joi.string()
    .min(1)
    .max(MAX_OBJECT_KEY_LENGTH)
    .pattern(/^[a-zA-Z0-9_\-/.]+$/)
    .messages({
        'string.empty': 'Object key cannot be empty',
        'string.max': `Object key exceeds maximum length of ${MAX_OBJECT_KEY_LENGTH}`,
        'string.pattern.base': 'Object key contains invalid characters',
    });

export const warmVideoSchema = Joi.object({
    objectKeys: Joi.array().items(objectKeySchema)
        .min(1)
        .max(100)
        .required()
        .messages({
            'array.min': 'At least one object key is required',
            'array.max': 'Maximum 100 object keys per request',
            'any.required': 'objectKeys is required',
        }),
});

export const refreshVideoSchema = Joi.object({
    objectKeys: Joi.array().items(objectKeySchema)
        .min(1)
        .max(100)
        .required()
        .messages({
            'array.min': 'At least one object key is required',
            'array.max': 'Maximum 100 object keys per request',
            'any.required': 'objectKeys is required',
        }),
});

export const getJobStatusSchema = Joi.object({
    params: Joi.object({
        jobId: Joi.string().uuid().required().messages({
            'string.guid': 'Invalid job ID format',
            'any.required': 'jobId is required',
        }),
    }),
});

export const listJobsSchema = Joi.object({
    query: Joi.object({
        status: Joi.string().valid(...Object.values(CacheWarmStatus)).optional(),
        jobType: Joi.string().valid(...Object.values(CacheJobType)).optional(),
        page: Joi.number().integer().positive().default(1),
        limit: Joi.number().integer().positive().max(100).default(20),
    }),
});

// Type inference for Joi schemas
export type WarmVideoInput = {
    objectKeys: string[];
};
export type RefreshVideoInput = {
    objectKeys: string[];
};
export type GetJobStatusInput = {
    jobId: string;
};
export type ListJobsInput = {
    status?: CacheWarmStatus;
    jobType?: CacheJobType;
    page?: number;
    limit?: number;
};