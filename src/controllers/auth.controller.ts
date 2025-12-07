import type { Context } from "hono";
import res from "@/utils/response";
import authService from "@/services/auth.service";
import type { InferSchemaType } from "@/utils/validation";
import authDtoValidation from "@/validation/auth.validation";

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
const refreshToken = async (c: Context) => {
    try {
        type RefreshTokenBody = InferSchemaType<typeof authDtoValidation.refreshTokenValidation>;
        const { refresh_token } = c.get('validated') as RefreshTokenBody;

        // Get metadata
        const ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || c.env?.ip;
        const userAgent = c.req.header("user-agent");

        // Rotate the refresh token
        const tokenPair = await authService.rotateRefreshToken(refresh_token, { ip, userAgent });

        return res.SuccessResponse(c, 200, {
            message: "Token refreshed successfully",
            data: {
                access_token: tokenPair.accessToken,
                refresh_token: tokenPair.refreshToken,
                expires_at: tokenPair.accessTokenExpiresAt,
                refresh_expires_at: tokenPair.refreshTokenExpiresAt,
            },
        });
    } catch (error) {
        console.error("Refresh token error:", error);
        return res.FailureResponse(c, 401, {
            message: error instanceof Error ? error.message : "Invalid or expired refresh token",
        });
    }
};

/**
 * POST /auth/revoke
 * Revoke a specific refresh token (logout from single device)
 */
const revokeToken = async (c: Context) => {
    try {
        type RevokeTokenBody = InferSchemaType<typeof authDtoValidation.revokeTokenValidation>;
        const { refresh_token } = c.get('validated') as RevokeTokenBody;

        const success = await authService.revokeRefreshToken(refresh_token);

        if (!success) {
            return res.FailureResponse(c, 404, {
                message: "Refresh token not found",
            });
        }

        return res.SuccessResponse(c, 200, {
            message: "Refresh token revoked successfully",
            data: {},
        });
    } catch (error) {
        console.error("Revoke token error:", error);
        return res.FailureResponse(c, 500, {
            message: "Failed to revoke token",
        });
    }
};

/**
 * POST /auth/revoke-all
 * Revoke all refresh tokens for the authenticated user (logout from all devices)
 */
const revokeAllTokens = async (c: Context) => {
    try {
        const user = c.get('user');
        if (!user) {
            return res.FailureResponse(c, 401, {
                message: "User not authenticated.",
            });
        }

        const count = await authService.revokeAllUserTokens(user.id);

        return res.SuccessResponse(c, 200, {
            message: "All refresh tokens revoked successfully",
            data: {
                revoked_count: count,
            },
        });
    } catch (error) {
        console.error("Revoke all tokens error:", error);
        return res.FailureResponse(c, 500, {
            message: "Failed to revoke all tokens",
        });
    }
};

/**
 * GET /auth/sessions
 * Get all active refresh tokens (sessions) for the authenticated user
 */
const getActiveSessions = async (c: Context) => {
    try {
        const user = c.get('user');
        if (!user) {
            return res.FailureResponse(c, 401, {
                message: "User not authenticated.",
            });
        }

        const sessions = await authService.getActiveRefreshTokens(user.id);

        // Map to user-friendly format (don't expose token hashes)
        const sessionData = sessions.map(session => ({
            id: session.id,
            created_at: session.created_at,
            expires_at: session.expires_at,
            last_used_at: session.last_used_at,
            ip: session.ip,
            user_agent: session.user_agent,
        }));

        return res.SuccessResponse(c, 200, {
            message: "Active sessions retrieved successfully",
            data: {
                sessions: sessionData,
                total: sessionData.length,
            },
        });
    } catch (error) {
        console.error("Get active sessions error:", error);
        return res.FailureResponse(c, 500, {
            message: "Failed to retrieve active sessions",
        });
    }
};

export default {
    refreshToken,
    revokeToken,
    revokeAllTokens,
    getActiveSessions,
};
