
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



export default {
    createFolderValidation,
    updateFolderValidation,
};