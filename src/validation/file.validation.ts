
import Joi from 'joi';
import { AccessLevel } from '@/models/File.model';
const createFolderValidation = Joi.object({
    name: Joi.string().trim()
        .min(1)
        .max(255)
        .pattern(/^[^<>:"/\\|?*]+$/)
        .required()
        .messages({
            'string.empty': 'Folder name is required',
            'string.min': 'Folder name is required',
            'string.max': 'Folder name is too long',
            'string.pattern.base': 'Folder name contains invalid characters'
        }),
    parent_id: Joi.string()
        .uuid()
        .optional()
        .messages({
            'string.guid': 'Invalid parent folder ID'
        }),
    access_level: Joi.string()
        .valid(...Object.values(AccessLevel))
        .optional(),
    description: Joi.string()
        .max(255)
        .optional()
        .messages({
            'string.max': 'Description is too long, max 255 characters.'
        }),
    tags: Joi.array()
        .items(Joi.string().max(50).messages({
            'string.max': 'Tag is too long, max 50 characters.'
        }))
        .max(20)
        .optional()
        .messages({
            'array.max': 'Too many tags, max 20 tags.'
        })
});

const updateFolderValidation = Joi.object({
    name: Joi.string().trim()
        .min(1)
        .max(255)
        .pattern(/^[^<>:"/\\|?*]+$/)
        .optional()
        .messages({
            'string.min': 'Folder name is required',
            'string.max': 'Folder name is too long, max 255 characters.',
            'string.pattern.base': 'Folder name contains invalid characters'
        }),
    access_level: Joi.string()
        .valid(...Object.values(AccessLevel))
        .optional(),
    description: Joi.string()
        .max(255)
        .optional()
        .messages({
            'string.max': 'Description is too long'
        }),
    tags: Joi.array()
        .items(Joi.string().max(50).messages({
            'string.max': 'Tag is too long'
        }))
        .max(20)
        .optional()
        .messages({
            'array.max': 'Too many tags'
        })
});

const renameFolderValidation = Joi.object({
    name: Joi.string().trim()
        .min(1)
        .max(255)
        .pattern(/^[^<>:"/\\|?*]+$/)
        .required()
        .messages({
            'string.empty': 'Folder name is required',
            'string.min': 'Folder name is required',
            'string.max': 'Folder name is too long',
            'string.pattern.base': 'Folder name contains invalid characters'
        })
});

const moveFileValidation = Joi.object({
    target_folder_id: Joi.string()
        .uuid()
        .allow(null) // accepts null
        .messages({
            'string.guid': 'Invalid target folder ID',
        })
});


const fileInfoValidation = Joi.object({
    file_type: Joi.string()
        .required()
        .messages({
            "string.base": "File type must be a string (e.g., 'image/png').",
            "any.required": "File type is required."
        }),

    file_size: Joi.number()
        .integer()
        .min(1)
        .required()
        .messages({
            "number.base": "File size must be a number in bytes.",
            "number.min": "File size must be greater than 0.",
            "any.required": "File size is required."
        }),

    storage_path: Joi.string()
        .required()
        .messages({
            "string.base": "Storage path must be a valid string.",
            "any.required": "Storage path is required."
        }),

    thumbnail_path: Joi.string()
        .allow(null, "")
        .optional()
        .messages({
            "string.base": "Thumbnail path must be a valid string."
        }),

    duration: Joi.number()
        .min(0)
        .allow(null)
        .optional()
        .messages({
            "number.base": "Duration must be a number in seconds.",
            "number.min": "Duration cannot be negative."
        }),
});


const createFileValidation = Joi.object({
    name: Joi.string()
        .max(255)
        .required()
        .messages({
            "string.base": "File name must be a string.",
            "string.max": "File name must not exceed 255 characters.",
            "any.required": "File name is required."
        }),

    parent_id: Joi.string()
        .uuid()
        .allow(null)
        .optional()
        .messages({
            "string.guid": "Parent folder ID must be a valid UUID."
        }),
    access_level: Joi.string()
        .valid(...Object.values(AccessLevel))
        .default(AccessLevel.PRIVATE)
        .messages({
            "any.only": "Access level must be one of 'public', 'private', or 'protected'."
        }),

    description: Joi.string()
        .allow(null, "")
        .optional()
        .messages({
            "string.base": "Description must be a string."
        }),

    tags: Joi.array()
        .items(Joi.string().max(50).messages({
            "string.base": "Each tag must be a string.",
            "string.max": "Each tag must not exceed 50 characters."
        }))
        .default([])
        .messages({
            "array.base": "Tags must be an array of strings."
        }),

    file_info: fileInfoValidation.required().messages({
        "any.required": "File information is required."
    }),
});


export default {
    createFolderValidation,
    updateFolderValidation,
    renameFolderValidation,
    moveFileValidation,
    createFileValidation,
};