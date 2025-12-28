import type { Context } from "hono";
import db from "@/config/database";
import res from "@/utils/response";
import crypto from "crypto";

export class ApiTokenController {
    public static async generateToken(c: Context) {
        try {
            const user = c.get("user");
            if (!user) {
                return res.FailureResponse(c, 401, { message: "User not found." });
            }
            const { name, expires_at } = await c.req.json();
            if (!name) {
                return res.FailureResponse(c, 400, { message: "Name is required." });
            }
            // Generate a random token
            const token = crypto.randomBytes(32).toString("hex");
            const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

            const apiToken = await db.ApiToken.create({
                user_id: user.id,
                name: name,
                token_hash: tokenHash,
                expires_at: expires_at ? expires_at : undefined,
                is_active: true,
            });

            return res.SuccessResponse(c, 201, {
                message: "API token generated successfully.",
                data: {
                    id: apiToken.id,
                    name: apiToken.name,
                    token: token, // Return the raw token only once
                    expires_at: apiToken.expires_at,
                    created_at: apiToken.created_at,
                },
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return res.FailureResponse(c, 500, { message: "Failed to generate API token.", error: errorMessage });
        }
    }

    public static async listTokens(c: Context) {
        try {
            const user = c.get("user");
            if (!user) {
                return res.FailureResponse(c, 401, { message: "User not found." });
            }

            const tokens = await db.ApiToken.findAll({
                where: { user_id: user.id },
                attributes: ["id", "name", "last_used_at", "expires_at", "created_at", "is_active", "usage_count"],
                order: [["created_at", "DESC"]],
            });

            return res.SuccessResponse(c, 200, {
                message: "API tokens retrieved successfully.",
                data: tokens,
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return res.FailureResponse(c, 500, { message: "Failed to retrieve API tokens.", error: errorMessage });
        }
    }

    public static async revokeToken(c: Context) {
        try {
            const user = c.get("user");
            if (!user) {
                return res.FailureResponse(c, 401, { message: "User not found." });
            }
            const tokenId = c.req.param("id");

            const token = await db.ApiToken.findOne({
                where: { id: tokenId, user_id: user.id },
            });

            if (!token) {
                return res.FailureResponse(c, 404, { message: "API token not found." });
            }

            await token.destroy();

            return res.SuccessResponse(c, 200, { message: "API token revoked successfully.", data: {} });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return res.FailureResponse(c, 500, { message: "Failed to revoke API token.", error: errorMessage });
        }
    }
}

export default ApiTokenController;
