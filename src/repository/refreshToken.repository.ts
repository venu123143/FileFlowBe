import db from "@/config/database";
import { type IRefreshTokenAttributes } from "@/models/RefreshToken.model";
import { Op } from "sequelize";

/**
 * Create a new refresh token record
 */
const createRefreshToken = async (tokenData: IRefreshTokenAttributes) => {
    return await db.RefreshToken.create(tokenData);
};

/**
 * Find a refresh token by its hash
 */
const findRefreshTokenByHash = async (tokenHash: string) => {
    return await db.RefreshToken.findOne({
        where: { token_hash: tokenHash },
        raw: true
    });
};

/**
 * Find a refresh token by its ID
 */
const findRefreshTokenById = async (id: string) => {
    return await db.RefreshToken.findOne({
        where: { id },
        raw: true
    });
};

/**
 * Update a refresh token (mark as revoked, set replaced_by, etc.)
 */
const updateRefreshToken = async (id: string, updates: Partial<IRefreshTokenAttributes>) => {
    const [affectedRows] = await db.RefreshToken.update(updates, {
        where: { id }
    });
    return affectedRows > 0;
};

/**
 * Revoke a specific refresh token by ID
 */
const revokeRefreshTokenById = async (id: string) => {
    return await updateRefreshToken(id, {
        revoked: true,
        last_used_at: new Date()
    });
};

/**
 * Revoke all refresh tokens for a user
 */
const revokeAllRefreshTokensForUser = async (userId: string) => {
    const [affectedRows] = await db.RefreshToken.update(
        { revoked: true },
        { where: { user_id: userId } }
    );
    return affectedRows;
};

/**
 * Find all active (non-revoked, non-expired) refresh tokens for a user
 */
const findActiveRefreshTokensForUser = async (userId: string) => {
    return await db.RefreshToken.findAll({
        where: {
            user_id: userId,
            revoked: false,
            expires_at: { [Op.gt]: new Date() }
        },
        raw: true,
        order: [["created_at", "DESC"]]
    });
};

/**
 * Delete expired refresh tokens (cleanup job)
 */
const deleteExpiredRefreshTokens = async () => {
    const result = await db.RefreshToken.destroy({
        where: {
            expires_at: { [Op.lt]: new Date() }
        }
    });
    return result;
};

/**
 * Delete old revoked tokens (cleanup job)
 * Deletes revoked tokens older than specified days
 */
const deleteOldRevokedTokens = async (daysOld: number = 30) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await db.RefreshToken.destroy({
        where: {
            revoked: true,
            created_at: { [Op.lt]: cutoffDate }
        }
    });
    return result;
};

export default {
    createRefreshToken,
    findRefreshTokenByHash,
    findRefreshTokenById,
    updateRefreshToken,
    revokeRefreshTokenById,
    revokeAllRefreshTokensForUser,
    findActiveRefreshTokensForUser,
    deleteExpiredRefreshTokens,
    deleteOldRevokedTokens
};
