import Joi from 'joi';
import { SharePermission } from '@/models/Share.model';

/** Upper bounds keep a single bulk transaction from locking too many rows at once. */
const MAX_FILES_PER_REQUEST = 200;
const MAX_RECIPIENTS_PER_REQUEST = 50;

const fileIdsValidation = Joi.array()
    .items(Joi.string().uuid().messages({
        'string.guid': 'Each file ID must be a valid UUID.'
    }))
    .min(1)
    .max(MAX_FILES_PER_REQUEST)
    .unique()
    .required()
    .messages({
        'array.base': 'File IDs must be an array.',
        'array.min': 'At least one file ID is required.',
        'array.max': `Too many file IDs, max ${MAX_FILES_PER_REQUEST} per request.`,
        'array.unique': 'Duplicate file IDs are not allowed.',
        'any.required': 'File IDs are required.'
    });

const bulkDeleteValidation = Joi.object({
    file_ids: fileIdsValidation
});

const bulkMoveValidation = Joi.object({
    file_ids: fileIdsValidation,
    target_folder_id: Joi.string()
        .uuid()
        .allow(null)
        .required()
        .messages({
            'string.guid': 'Invalid target folder ID.',
            'any.required': 'Target folder ID is required. Use null to move items to the root.'
        })
});

const bulkShareValidation = Joi.object({
    file_ids: fileIdsValidation,
    shared_with_user_ids: Joi.array()
        .items(Joi.string().uuid().messages({
            'string.guid': 'Each recipient user ID must be a valid UUID.'
        }))
        .min(1)
        .max(MAX_RECIPIENTS_PER_REQUEST)
        .unique()
        .required()
        .messages({
            'array.base': 'Recipient user IDs must be an array.',
            'array.min': 'At least one recipient user ID is required.',
            'array.max': `Too many recipients, max ${MAX_RECIPIENTS_PER_REQUEST} per request.`,
            'array.unique': 'Duplicate recipient user IDs are not allowed.',
            'any.required': 'Recipient user IDs are required.'
        }),
    permission_level: Joi.string()
        .valid(...Object.values(SharePermission))
        .required()
        .messages({
            'any.only': "Permission level must be one of 'view', 'edit', or 'admin'.",
            'any.required': 'Permission level is required.'
        }),
    message: Joi.string()
        .allow(null, '')
        .optional()
        .messages({
            'string.base': 'Message must be a string.'
        }),
    expires_at: Joi.date()
        .allow(null)
        .optional()
        .messages({
            'date.base': 'Expires at must be a date.'
        })
});

export default {
    bulkDeleteValidation,
    bulkMoveValidation,
    bulkShareValidation,
};
