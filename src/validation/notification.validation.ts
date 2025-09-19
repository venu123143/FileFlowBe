import Joi from 'joi';

const getNotificationsValidation = Joi.object({
    limit: Joi.number().integer().min(1).max(100)
        .optional()
        .default(20)
        .messages({
            'number.base': 'Limit should be a number',
            'number.integer': 'Limit should be an integer',
            'number.min': 'Limit should be at least 1',
            'number.max': 'Limit cannot exceed 100',
        }),
    offset: Joi.number().integer().min(0)
        .optional()
        .default(0)
        .messages({
            'number.base': 'Offset should be a number',
            'number.integer': 'Offset should be an integer',
            'number.min': 'Offset should be zero or greater',
        }),
    unreadOnly: Joi.boolean()
        .optional()
        .default(false)
        .messages({
            'boolean.base': 'Unread only filter should be a boolean value',
        }),
});

const notificationIdValidation = Joi.object({
    notificationId: Joi.string().guid({ version: ['uuidv4'] })
        .required()
        .messages({
            'string.base': 'Notification ID should be a string',
            'string.guid': 'Notification ID is invalid. Please provide a valid UUID',
            'any.required': 'Notification ID is required',
        }),
});

export default {
    getNotificationsValidation,
    notificationIdValidation,
};