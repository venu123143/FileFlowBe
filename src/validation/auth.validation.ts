import Joi from "joi";

/**
 * Validation schema for refresh token endpoint
 */
const refreshTokenValidation = Joi.object({
    refresh_token: Joi.string()
        .required()
        .messages({
            "string.base": "Refresh token must be a text value",
            "string.empty": "Refresh token is required",
            "any.required": "Refresh token is required"
        }),
});

/**
 * Validation schema for revoking a specific token
 */
const revokeTokenValidation = Joi.object({
    refresh_token: Joi.string()
        .required()
        .messages({
            "string.base": "Refresh token must be a text value",
            "string.empty": "Refresh token is required",
            "any.required": "Refresh token is required"
        }),
});

export default {
    refreshTokenValidation,
    revokeTokenValidation,
};
