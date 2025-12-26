import Joi from 'joi';

// Validation for initiateUpload endpoint
const initiateUploadValidation = Joi.object({
    fileName: Joi.string()
        .trim()
        .min(1)
        .max(255)
        .pattern(/^[^<>:"/\\|?*]+$/)
        .required()
        .messages({
            'string.empty': 'File name is required',
            'string.min': 'File name cannot be empty',
            'string.max': 'File name is too long (maximum 255 characters)',
            'string.pattern.base': 'File name contains invalid characters. Please avoid: < > : " / \\ | ? *',
            'any.required': 'File name is required'
        }),
    
    mimeType: Joi.string()
        .pattern(/^[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_.]*$/)
        .required()
        .messages({
            'string.pattern.base': 'Invalid file type format. Please use format like: image/png, video/mp4, application/pdf',
            'any.required': 'File type is required'
        })
});

// Validation for uploadChunk endpoint (form data validation)
const uploadChunkValidation = Joi.object({
    key: Joi.string()
        .min(1)
        .required()
        .messages({
            'string.empty': 'File key is required',
            'string.min': 'File key cannot be empty',
            'any.required': 'File key is required'
        }),
    
    metadata: Joi.string()
        .required()
        .messages({
            'string.empty': 'Upload metadata is required',
            'any.required': 'Upload metadata is required'
        }),
    
    chunk: Joi.any()
        .required()
        .messages({
            'any.required': 'File chunk is required'
        })
});

// Validation for completeUpload endpoint
const completeUploadValidation = Joi.object({
    key: Joi.string()
        .min(1)
        .required()
        .messages({
            'string.empty': 'File key is required',
            'string.min': 'File key cannot be empty',
            'any.required': 'File key is required'
        }),
    
    parts: Joi.array()
        .items(
            Joi.object({
                ETag: Joi.string()
                    .required()
                    .messages({
                        'string.empty': 'ETag is required for each part',
                        'any.required': 'ETag is required for each part'
                    }),
                PartNumber: Joi.number()
                    .integer()
                    .min(1)
                    .required()
                    .messages({
                        'number.base': 'Part number must be a number',
                        'number.integer': 'Part number must be a whole number',
                        'number.min': 'Part number must be at least 1',
                        'any.required': 'Part number is required for each part'
                    })
            })
        )
        .min(1)
        .required()
        .messages({
            'array.base': 'Parts must be an array',
            'array.min': 'At least one part is required',
            'any.required': 'Parts array is required'
        })
});

// Validation for abortUpload endpoint
const abortUploadValidation = Joi.object({
    key: Joi.string()
        .min(1)
        .required()
        .messages({
            'string.empty': 'File key is required',
            'string.min': 'File key cannot be empty',
            'any.required': 'File key is required'
        })
});

// Validation for getPartsByUploadKey endpoint (query parameters)
const getPartsValidation = Joi.object({
    key: Joi.string()
        .min(1)
        .required()
        .messages({
            'string.empty': 'File key is required',
            'string.min': 'File key cannot be empty',
            'any.required': 'File key is required'
        })
});

// Validation for file operations (get/delete by fileName)
const fileNameValidation = Joi.object({
    fileName: Joi.string()
        .min(1)
        .max(1000)
        // .pattern(/^[^<>:"/\\|?*]+$/)
        .required()
        .messages({
            'string.empty': 'File name is required',
            'string.min': 'File name cannot be empty',
            'string.max': 'File name is too long (maximum 255 characters)',
            'string.pattern.base': 'File name contains invalid characters. Please avoid: < > : " / \\ | ? *',
            'any.required': 'File name is required'
        })
});

// Validation for uploadId parameter
const uploadIdValidation = Joi.object({
    uploadId: Joi.string()
        .min(1)
        .required()
        .messages({
            'string.empty': 'Upload ID is required',
            'string.min': 'Upload ID cannot be empty',
            'any.required': 'Upload ID is required'
        })
});

export default {
    initiateUploadValidation,
    uploadChunkValidation,
    completeUploadValidation,
    abortUploadValidation,
    getPartsValidation,
    fileNameValidation,
    uploadIdValidation
};
