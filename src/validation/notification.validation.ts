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
    cursor: Joi.string()
        .optional()
        .messages({
            'string.base': 'Cursor should be a string',
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