import type { Context, Next } from 'hono';
import { ValidationError, type ObjectSchema } from 'joi';
import res from '@/utils/response';
export type InferSchemaType<T extends ObjectSchema> = T extends ObjectSchema<infer U> ? U : never;


export function validateBody<T extends ObjectSchema>(schema: T) {
    return async (c: Context, next: Next) => {
        try {
            const body = await c.req.json();
            const { value: cleaned, error } = schema.validate(body, { abortEarly: false, stripUnknown: true });
            if (error) {
                const formattedErrors: Record<string, string> = {};

                error.details.forEach((err) => {
                    const key = err.path.join('.') || 'unknown';
                    formattedErrors[key] = err.message;
                });
                return res.FailureResponse(c, 422, {
                    errors: formattedErrors,
                    message: 'Validation failed',
                })
            }

            // Put the cleaned, validated payload back on context
            c.set('validated', cleaned);
            await next();
        } catch (err) {
            const errors = err instanceof ValidationError ? err.details.map(d => d.message) : err;
            return c.json({ success: false, errors }, 400);
        }
    };
}

export function validateParams<T extends ObjectSchema>(schema: T) {
    return async (c: Context, next: Next) => {
        try {
            const params = c.req.param();
            const { value: cleaned, error } = schema.validate(params, { abortEarly: false, stripUnknown: true });
            if (error) {
                return res.FailureResponse(c, 422, {
                    errors: error.details.map((d) => d.message),
                    message: 'Parameter validation failed',
                })
            }

            // Put the cleaned, validated params back on context
            c.set('validatedParams', cleaned);
            await next();
        } catch (err) {
            const errors = err instanceof ValidationError ? err.details.map(d => d.message) : err;
            return c.json({ success: false, errors }, 400);
        }
    };
}

export function validateQuery<T extends ObjectSchema>(schema: T) {
    return async (c: Context, next: Next) => {
        try {
            const query = c.req.query();
            const { value: cleaned, error } = schema.validate(query, { abortEarly: false, stripUnknown: true });
            if (error) {
                return res.FailureResponse(c, 422, {
                    errors: error.details.map((d) => d.message),
                    message: 'Query validation failed',
                })
            }

            // Put the cleaned, validated query back on context
            c.set('validatedQuery', cleaned);
            await next();
        } catch (err) {
            const errors = err instanceof ValidationError ? err.details.map(d => d.message) : err;
            return c.json({ success: false, errors }, 400);
        }
    };
}