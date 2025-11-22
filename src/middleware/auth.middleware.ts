// import { getCookie, setCookie } from 'hono/cookie';
import type { MiddlewareHandler, Context, Next } from "hono";
import res from "@/utils/response";
import jwt from "@/utils/jwt-token";
import db from "@/config/database";
import redisConn from "@/config/redis.config";
import redisConstants from "@/global/redis-constants";
import { type ISessionData } from "@/types/hono";
import authService from "@/services/user.service";
import { getValidPinSession } from "@/core/session";
import crypto from "crypto";



const verifyBearerToken = async (c: Context, token: string) => {
    try {
        const jwt_decode = jwt.verifyJwtToken(token);

        // 2️⃣ Check Redis session
        const client = redisConn.getClient();
        const sessionKey = `${redisConstants.USER_SESSION_PREFIX}${jwt_decode.id}:${token}`;
        const sessionData = await client.get(sessionKey);

        if (!sessionData) {
            return res.FailureResponse(c, 401, { message: "Session expired or invalid." });
        }

        const { login_details } = authService.parseJson<ISessionData>(sessionData);

        // Ensure the token matches the stored session
        if (login_details.session_token !== token || !login_details.is_active) {
            return res.FailureResponse(c, 401, { message: "Invalid or inactive session." });
        }
        const find_user = await db.User.findOne({ where: { id: jwt_decode.id }, raw: true });
        if (!find_user) {
            return res.FailureResponse(c, 401, { message: "Login expired." });
        }
        // Attach the user object to the context for downstream handlers
        c.set("user", find_user);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return res.FailureResponse(c, 401, { message: "Login expired.", error: errorMessage });
    }
}


const verifyApiToken = async (c: Context, token: string) => {
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
        const errorMessage = error instanceof Error ? error.message : String(error);
        return res.FailureResponse(c, 401, { message: "Invalid API token.", error: errorMessage });
    }
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
        await verifyBearerToken(c, token);
        await next();
    } else {
        await verifyApiToken(c, token);
        await next();
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

        // PIN session is valid, proceed to next middleware/route
        await next();
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return res.FailureResponse(c, 500, {
            message: "Error verifying PIN session.",
            error: errorMessage
        });
    }
};

export default {
    authMiddleware,
    pinSessionMiddleware,
};