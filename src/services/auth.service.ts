import constants from "@/global/constants";
import jwt from "@/utils/jwt-token";
import { hashRefreshToken } from "@/utils/token-hash";
import refreshTokenRepository from "@/repository/refreshToken.repository";
import redisConn from "@/config/redis.config";
import redisConstants from "@/global/redis-constants";
import { type IUserAttributes } from "@/models/User.model";

interface RefreshTokenMetadata {
    ip?: string;
    userAgent?: string;
}

interface TokenPair {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: number;
    refreshTokenExpiresAt: number;
}

/**
 * Generate both access token and refresh token for a user
 * Stores refresh token in database (hashed) and Redis
 */
async function generateTokenPair(user: IUserAttributes, metadata?: RefreshTokenMetadata): Promise<TokenPair> {
    const issuedAt = Math.floor(Date.now() / 1000);
    const accessTokenExpiresIn = constants.ACCESS_TOKEN_EXPIRY_TIME;
    const refreshTokenExpiresIn = constants.REFRESH_TOKEN_EXPIRY_TIME;

    const accessTokenExpiresAt = issuedAt + accessTokenExpiresIn;
    const refreshTokenExpiresAt = issuedAt + refreshTokenExpiresIn;

    const payload = {
        id: user.id,
        email: user.email,
        role: user.role,
    };

    // Generate tokens
    const accessToken = await jwt.generateJwtToken(payload, accessTokenExpiresIn);
    const rawRefreshToken = await jwt.generateRefreshToken(payload, refreshTokenExpiresIn);

    // Hash the refresh token for storage
    const tokenHash = hashRefreshToken(rawRefreshToken);

    // Save refresh token to database
    const refreshTokenRecord = await refreshTokenRepository.createRefreshToken({
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: new Date(refreshTokenExpiresAt * 1000),
        revoked: false,
        ip: metadata?.ip,
        user_agent: metadata?.userAgent,
    });

    // Store access token in Redis with TTL for fast validation
    const client = redisConn.getClient();
    const redisKey = `${redisConstants.ACCESS_TOKEN_PREFIX}${user.id}:${accessToken}`;
    await client.set(
        redisKey,
        JSON.stringify({
            userId: user.id,
            email: user.email,
            role: user.role,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(accessTokenExpiresAt * 1000).toISOString(),
        }),
        'EX',
        accessTokenExpiresIn
    );

    return {
        accessToken,
        refreshToken: rawRefreshToken,
        accessTokenExpiresAt,
        refreshTokenExpiresAt,
    };
}

/**
 * Rotate refresh token - validates old token and issues new token pair
 * Implements token rotation and reuse detection
 */
async function rotateRefreshToken(oldRefreshToken: string, metadata?: RefreshTokenMetadata): Promise<TokenPair> {
    try {
        // 1. Verify JWT signature and expiry
        const payload = jwt.verifyRefreshToken(oldRefreshToken);
        const userId = payload.id;

        // 2. Hash the token and find it in database
        const tokenHash = hashRefreshToken(oldRefreshToken);
        const savedToken = await refreshTokenRepository.findRefreshTokenByHash(tokenHash);

        // 3. Token not found - possible reuse attack
        if (!savedToken) {
            // Revoke all tokens for this user as a security measure
            await revokeAllUserTokens(userId);
            throw new Error('Refresh token not found - possible reuse detected. All tokens revoked.');
        }

        // 4. Token already revoked - reuse detected
        if (savedToken.revoked) {
            // Revoke all tokens for this user
            await revokeAllUserTokens(userId);
            throw new Error('Refresh token has been revoked - possible token reuse. All tokens revoked.');
        }

        // 5. Token expired
        if (savedToken.expires_at.getTime() < Date.now()) {
            throw new Error('Refresh token expired');
        }

        // 6. Generate new token pair
        const user: IUserAttributes = {
            id: userId,
            email: payload.email,
            role: payload.role,
        } as IUserAttributes;

        const newTokenPair = await generateTokenPair(user, metadata);

        // 7. Mark old token as revoked and link to new token
        // We need to get the new token's ID from the hash
        const newTokenHash = hashRefreshToken(newTokenPair.refreshToken);
        const newTokenRecord = await refreshTokenRepository.findRefreshTokenByHash(newTokenHash);

        await refreshTokenRepository.updateRefreshToken(savedToken.id!, {
            revoked: true,
            replaced_by: newTokenRecord?.id,
            last_used_at: new Date(),
        });

        // Note: Access tokens in Redis will expire automatically via TTL
        // No need to manually delete them during refresh token rotation

        return newTokenPair;
    } catch (err) {
        // Re-throw with context
        throw err;
    }
}

/**
 * Revoke a specific refresh token
 */
async function revokeRefreshToken(refreshToken: string): Promise<boolean> {
    try {
        // const tokenHash = hashRefreshToken(refreshToken);
        const savedToken = await refreshTokenRepository.findRefreshTokenByHash(refreshToken);

        if (!savedToken) {
            return false;
        }

        // Mark as revoked in database
        await refreshTokenRepository.revokeRefreshTokenById(savedToken.id!);

        // Note: Access tokens in Redis will expire automatically via TTL
        // Refresh tokens are only stored in database, not in Redis

        return true;
    } catch (err) {
        throw err;
    }
}

/**
 * Revoke all refresh tokens for a user
 */
async function revokeAllUserTokens(userId: string): Promise<number> {
    // Revoke in database
    const count = await refreshTokenRepository.revokeAllRefreshTokensForUser(userId);
    return count;
}

/**
 * Get all active refresh tokens for a user
 */
async function getActiveRefreshTokens(userId: string) {
    return await refreshTokenRepository.findActiveRefreshTokensForUser(userId);
}

/**
 * Cleanup expired and old revoked tokens (for cron job)
 */
async function cleanupTokens() {
    const expiredCount = await refreshTokenRepository.deleteExpiredRefreshTokens();
    const oldRevokedCount = await refreshTokenRepository.deleteOldRevokedTokens(30);

    return {
        expiredDeleted: expiredCount,
        oldRevokedDeleted: oldRevokedCount,
    };
}

export default {
    generateTokenPair,
    rotateRefreshToken,
    revokeRefreshToken,
    revokeAllUserTokens,
    getActiveRefreshTokens,
    cleanupTokens,
};
