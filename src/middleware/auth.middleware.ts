// import { getCookie, setCookie } from 'hono/cookie';
import type { MiddlewareHandler, Context, Next } from "hono";
import res from "@/utils/response";
import jwt from "@/utils/jwt-token";
import db from "@/config/database";
import redisConn from "@/config/redis.config";
import redisConstants from "@/global/redis-constants";
import { getValidPinSession } from "@/core/session";
import crypto from "crypto";
import { UserRole, type IUserAttributes } from "@/models/User.model";
import { ConnectionError, ConnectionRefusedError, HostNotFoundError, HostNotReachableError, InvalidConnectionError, ConnectionTimedOutError } from "sequelize";

/**
 * Check if an error is a transient database connection error
 */
function isTransientDbError(error: unknown): boolean {
    if (!error) return false;
    
    if (error instanceof ConnectionError ||
        error instanceof ConnectionRefusedError ||
        error instanceof HostNotFoundError ||
        error instanceof HostNotReachableError ||
        error instanceof InvalidConnectionError ||
        error instanceof ConnectionTimedOutError) {
        return true;
    }
    
    if (error instanceof Error) {
        const message = error.message;
        return message.includes('Connection terminated unexpectedly') ||
               message.includes('Connection reset by peer') ||
               message.includes('Broken pipe') ||
               message.includes('ECONNRESET') ||
               message.includes('ETIMEDOUT') ||
               message.includes('socket hang up') ||
               message.includes('Connection lost') ||
               message.includes('connection terminated');
    }
    
    return false;
}



const verifyBearerToken = async (c: Context, token: string, next: Next) => {
    try {
        const jwt_decode = jwt.verifyJwtToken(token);

        // Check if access token exists in Redis (fast validation)
        const client = redisConn.getClient();
        const redisKey = `${redisConstants.ACCESS_TOKEN_PREFIX}${jwt_decode.id}:${token}`;
        const tokenData = await client.get(redisKey);

        if (!tokenData) {
            return res.FailureResponse(c, 401, { message: "Session expired or invalid." });
        }

        // Verify user exists in database
        const find_user = await db.User.findOne({ where: { id: jwt_decode.id }, raw: true });
        if (!find_user) {
            return res.FailureResponse(c, 401, { message: "Login expired." });
        }

        // Attach the user object to the context for downstream handlers
        c.set("user", find_user);
        c.set("session_id", jwt_decode.sid ?? null);
    } catch (error) {
        // Handle transient database errors - return 503 so client can retry
        if (isTransientDbError(error)) {
            console.error("Transient DB error in verifyBearerToken:", error);
            return res.FailureResponse(c, 503, { 
                message: "Service temporarily unavailable. Please retry.", 
                retryable: true 
            });
        }
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        return res.FailureResponse(c, 401, { message: "Login expired.", error: errorMessage });
    }

    await next();
}


const verifyApiToken = async (c: Context, token: string, next: Next) => {
    try {
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

        const apiToken = await db.ApiToken.findOne({
            where: { token_hash: tokenHash, is_active: true }
        });

        if (!apiToken) {
            return res.FailureResponse(c, 401, { message: "Invalid API token." });
        }

        // Check expiry
        if (apiToken.expires_at && new Date() > apiToken.expires_at) {
            return res.FailureResponse(c, 401, { message: "API token expired." });
        }

        // Update last_used_at and increment usage_count
        await apiToken.update({
            last_used_at: new Date(),
            usage_count: (apiToken.usage_count || 0) + 1
        });

        // Get user
        const user = await db.User.findByPk(apiToken.user_id);
        if (!user) {
            return res.FailureResponse(c, 401, { message: "User not found." });
        }

        c.set("user", user);
    } catch (error) {
        // Handle transient database errors - return 503 so client can retry
        if (isTransientDbError(error)) {
            console.error("Transient DB error in verifyApiToken:", error);
            return res.FailureResponse(c, 503, { 
                message: "Service temporarily unavailable. Please retry.", 
                retryable: true 
            });
        }
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        return res.FailureResponse(c, 401, { message: "Invalid API token.", error: errorMessage });
    }

    await next();
}


/**
 * Authentication middleware for protecting routes.
 * Checks for a valid Bearer token in the Authorization header, verifies the JWT,
 * fetches the user from the database, and attaches the user to the context.
 * If authentication fails, returns a 401 response.
 */
const authMiddleware: MiddlewareHandler = async (c: Context, next: Next) => {
    // Get the Authorization header from the request
    const authorization = c.req.header("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
        return res.FailureResponse(c, 401, { message: "Login expired." });
    }

    // Extract the token from the header
    const token = authorization.split(" ")[1];
    if (!token) {
        return res.FailureResponse(c, 401, { message: "Login expired." });
    }

    // Check if token is JWT (contains dots)
    if (token.includes('.')) {
        return await verifyBearerToken(c, token, next);
    } else {
        return await verifyApiToken(c, token, next);
    }
};

/**
 * PIN Session Verification Middleware
 * Verifies that the user has a valid PIN session (20 minutes expiry)
 * This middleware should be used after authMiddleware and session middleware
 */
const pinSessionMiddleware: MiddlewareHandler = async (c: Context, next: Next) => {
    try {
        // Get session from context (set by session middleware)
        // The session middleware automatically reads the 'fileflow_session' cookie
        const session = c.get('session');

        if (!session) {
            return res.FailureResponse(c, 401, {
                message: "Session not available. Please verify your PIN."
            });
        }

        // Get valid PIN session (checks expiry automatically)
        const pinSession = await getValidPinSession(session);

        if (!pinSession) {
            return res.FailureResponse(c, 403, {
                message: "PIN not verified or session expired. Please verify your PIN to continue."
            });
        }

        // Verify that the user in PIN session matches the authenticated user
        const user = c.get('user');
        if (user && pinSession.user_id !== user.id) {
            return res.FailureResponse(c, 401, {
                message: "PIN session user mismatch."
            });
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return res.FailureResponse(c, 500, {
            message: "Error verifying PIN session.",
            error: errorMessage
        });
    }

    // PIN session is valid, proceed to next middleware/route
    await next();
};

function checkPermissions(roles: UserRole[]) {
    return async (c: Context, next: Next) => {
        const user = c.get('user') as IUserAttributes;

        if (!user) {
            return res.FailureResponse(c, 401, { message: "Unauthorized." });
        }

        if (!roles.includes(user.role)) {
            return res.FailureResponse(c, 403, {
                message: "Forbidden, you don't have permission to perform this action."
            });
        }

        await next(); // ✅ IMPORTANT
    };
}



export default {
    authMiddleware,
    checkPermissions,
    pinSessionMiddleware,
};