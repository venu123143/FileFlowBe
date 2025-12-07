import crypto from 'crypto';
import config from '@/config/config';

/**
 * Hash a refresh token using HMAC-SHA256
 * This is used to securely store refresh tokens in the database
 * @param token - The raw refresh token to hash
 * @returns The hashed token as a hex string
 */
export function hashRefreshToken(token: string): string {
    return crypto.createHmac('sha256', config.REFRESH_TOKEN_HASH_SECRET).update(token).digest('hex');
}

/**
 * Verify if a raw token matches a stored hash
 * @param token - The raw token to verify
 * @param hash - The stored hash to compare against
 * @returns True if the token matches the hash
 */
export function verifyRefreshTokenHash(token: string, hash: string): boolean {
    const computedHash = hashRefreshToken(token);
    return crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(hash, 'hex'));
}

export default {
    hashRefreshToken,
    verifyRefreshTokenHash
};
