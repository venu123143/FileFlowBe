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


export default {
    loginValidation,
    signupValidation
}