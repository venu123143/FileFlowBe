import Joi from "joi";

const loginValidation = Joi.object({
    email: Joi.string()
        .email()
        .required()
        .messages({
            "string.base": "Email must be a text value",
            "string.empty": "Email is required",
            "string.email": "Email must be a valid email address",
            "any.required": "Email is required"
        }),

    password: Joi.string()
        .min(6)
        .required()
        .messages({
            "string.base": "Password must be a text value",
            "string.empty": "Password is required",
            "string.min": "Password must be at least {#limit} characters long",
            "any.required": "Password is required"
        }),
});

const signupValidation = Joi.object({
    email: Joi.string()
        .email()
        .required()
        .messages({
            "string.base": "Email must be a text value",
            "string.empty": "Email is required",
            "string.email": "Email must be a valid email address",
            "any.required": "Email is required"
        }),

    password: Joi.string()
        .min(6)
        .required()
        .messages({
            "string.base": "Password must be a text value",
            "string.empty": "Password is required",
            "string.min": "Password must be at least {#limit} characters long",
            "any.required": "Password is required"
        }),

    display_name: Joi.string()
        .max(100)
        .optional()
        .messages({
            "string.base": "Display name must be a text value",
            "string.max": "Display name must not exceed {#limit} characters"
        }),

    avatar_url: Joi.string()
        .optional()
        .messages({
            "string.base": "Avatar URL must be a text value",
        })
});

const getAllUsersValidation = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().max(255).trim().allow(""),
    is_active: Joi.boolean(),
    email_verified: Joi.boolean(),
});

const setPinValidation = Joi.object({
    pin: Joi.string()
        .length(4)
        .pattern(/^\d+$/)
        .required()
        .messages({
            "string.base": "Pin must be a text value",
            "string.empty": "Pin is required",
            "string.length": "Pin must be exactly 4 digits",
            "string.pattern.base": "Pin must contain only digits",
            "any.required": "Pin is required"
        }),
});

const verifyPinValidation = Joi.object({
    pin: Joi.string()
        .length(4)
        .pattern(/^\d+$/)
        .required()
        .messages({
            "string.base": "Pin must be a text value",
            "string.empty": "Pin is required",
            "string.length": "Pin must be exactly 4 digits",
            "string.pattern.base": "Pin must contain only digits",
            "any.required": "Pin is required"
        }),
});

const changePinValidation = Joi.object({
    old_pin: Joi.string()
        .length(4)
        .pattern(/^\d+$/)
        .required()
        .messages({
            "string.base": "Old pin must be a text value",
            "string.empty": "Old pin is required",
            "string.length": "Old pin must be exactly 4 digits",
            "string.pattern.base": "Old pin must contain only digits",
            "any.required": "Old pin is required"
        }),

    new_pin: Joi.string()
        .length(4)
        .pattern(/^\d+$/)
        .required()
        .messages({
            "string.base": "New pin must be a text value",
            "string.empty": "New pin is required",
            "string.length": "New pin must be exactly 4 digits",
            "string.pattern.base": "New pin must contain only digits",
            "any.required": "New pin is required"
        }),
});

export default {
    loginValidation,
    signupValidation,
    getAllUsersValidation,
    setPinValidation,
    verifyPinValidation,
    changePinValidation
}