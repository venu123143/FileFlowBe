import Joi from 'joi';

const favoriteIdValidation = Joi.object({
    favoriteId: Joi.string()
        .uuid()
        .required()
        .messages({
            'string.guid': 'Favorite ID must be a valid UUID',
            'any.required': 'Favorite ID is required',
        }),
});

const favoriteFileIdValidation = Joi.object({
    fileId: Joi.string()
        .uuid()
        .required()
        .messages({
            'string.guid': 'File ID must be a valid UUID',
            'any.required': 'File ID is required',
        }),
});

const createFavoriteValidation = Joi.object({
    file_id: Joi.string()
        .uuid()
        .optional()
        .messages({
            'string.guid': 'File ID must be a valid UUID',
        }),
    storage_path: Joi.string()
        .trim()
        .min(1)
        .max(2048)
        .optional()
        .messages({
            'string.empty': 'Storage path is required',
            'string.min': 'Storage path is required',
            'string.max': 'Storage path cannot exceed 2048 characters',
        }),
})
    .xor('file_id', 'storage_path')
    .messages({
        'object.missing': 'Either file_id or storage_path is required',
        'object.xor': 'Provide either file_id or storage_path, not both',
    });

const updateFavoriteValidation = Joi.object({
    file_id: Joi.string()
        .uuid()
        .required()
        .messages({
            'string.guid': 'File ID must be a valid UUID',
            'any.required': 'File ID is required',
        }),
});

const getFavoritesValidation = Joi.object({
    page: Joi.number()
        .integer()
        .min(1)
        .optional()
        .default(1)
        .messages({
            'number.base': 'Page should be a number',
            'number.integer': 'Page should be an integer',
            'number.min': 'Page should be at least 1',
        }),
    limit: Joi.number()
        .integer()
        .min(1)
        .max(100)
        .optional()
        .default(20)
        .messages({
            'number.base': 'Limit should be a number',
            'number.integer': 'Limit should be an integer',
            'number.min': 'Limit should be at least 1',
            'number.max': 'Limit cannot exceed 100',
        }),
    search: Joi.string()
        .trim()
        .min(1)
        .max(255)
        .optional()
        .messages({
            'string.min': 'Search text cannot be empty',
            'string.max': 'Search text cannot exceed 255 characters',
        }),
    sortBy: Joi.string()
        .valid('created_at', 'name')
        .optional()
        .default('created_at')
        .messages({
            'any.only': 'Sort by must be one of created_at or name',
        }),
    sortOrder: Joi.string()
        .valid('ASC', 'DESC', 'asc', 'desc')
        .optional()
        .default('DESC')
        .messages({
            'any.only': 'Sort order must be ASC or DESC',
        }),
});

export default {
    favoriteIdValidation,
    favoriteFileIdValidation,
    createFavoriteValidation,
    updateFavoriteValidation,
    getFavoritesValidation,
};
