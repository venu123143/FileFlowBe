// import { getCookie, setCookie } from 'hono/cookie';
import type { MiddlewareHandler, Context, Next } from "hono";
import res from "@/utils/response";
import jwt from "@/utils/jwt-token";
import db from "@/config/database";
import redisConn from "@/config/redis.config";
import redisConstants from "@/global/redis-constants";
import { type ISessionData } from "@/types/hono";
import authService from "@/services/user.service";

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

    try {
        // Verify the JWT token (throws if invalid or expired)
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
        // Proceed to the next middleware or route handler
        await next();

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return res.FailureResponse(c, 401, { message: "Login expired.", error: errorMessage });
    }
};

export default {
    authMiddleware,
};