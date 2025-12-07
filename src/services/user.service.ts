import constants from "@/global/constants";
import jwt from "@/utils/jwt-token";
import { type IUserSessionAttributes } from "@/models/UserSession.model";
import userRepository from "@/repository/user.repository";
import { type IUserAttributes } from "@/models/User.model";
import redisConn from "@/config/redis.config";
import redisConstants from "@/global/redis-constants";
import bcryptjs from "bcryptjs";
import authService from "@/services/auth.service";


async function generateSession(user: IUserAttributes, metadata?: Record<string, any>): Promise<{ jwt_token: string; refresh_token: string; expiresAt: number; refreshExpiresAt: number }> {
    // Use the new auth service to generate token pair
    const tokenPair = await authService.generateTokenPair(user, metadata);

    // Still save the access token session for backward compatibility
    const login_details: IUserSessionAttributes = {
        session_token: tokenPair.accessToken,
        user_id: user.id,
        expires_at: new Date(tokenPair.accessTokenExpiresAt * 1000),
        is_active: true,
        device_token: null,
        metadata: metadata ? metadata : null,
    };
    await userRepository.saveSession(login_details);

    // Store session info in Redis with a dynamic key
    const client = redisConn.getClient();
    const sessionKey = `${redisConstants.USER_SESSION_PREFIX}${user.id}:${tokenPair.accessToken}`;
    // Store with TTL matching token expiry
    await client.set(sessionKey, JSON.stringify({ login_details, user }), 'EX', constants.ACCESS_TOKEN_EXPIRY_TIME);

    return {
        jwt_token: tokenPair.accessToken,
        refresh_token: tokenPair.refreshToken,
        expiresAt: tokenPair.accessTokenExpiresAt,
        refreshExpiresAt: tokenPair.refreshTokenExpiresAt
    };
}

async function logout(userId: string, sessionToken: string): Promise<boolean> {
    // 1. Delete session from database completely
    await userRepository.deleteSessionByToken(sessionToken);

    // 2. Delete session from Redis
    const client = redisConn.getClient();
    const sessionKey = `${redisConstants.USER_SESSION_PREFIX}${userId}:${sessionToken}`;
    await client.del(sessionKey);

    return true;
}


async function logoutAllSessions(userId: string): Promise<boolean> {
    // 1. Deactivate all active sessions for the user in database
    const activeSessions = await userRepository.findActiveSessionsByUserId(userId);

    for (const session of activeSessions) {
        await userRepository.deactivateSessionByToken(session.session_token);
    }

    // 2. Delete session from Redis
    const client = redisConn.getClient();
    const sessionPattern = `${redisConstants.USER_SESSION_PREFIX}${userId}:*`;
    const keys = await client.keys(sessionPattern);
    if (keys.length > 0) {
        await client.del(...keys); // delete all at once
    }

    // 3. Also revoke all refresh tokens
    await authService.revokeAllUserTokens(userId);

    return true;
}


function parseJson<T>(value: string): T {
    return JSON.parse(value) as T;
}


const isAccountLocked = (user: any): boolean => {
    return user.locked_until && new Date(user.locked_until) > new Date();
}


const hashPassword = async (plainPassword: string): Promise<string> => {
    // Generate a salt and Hash the password with the salt
    const salt = await bcryptjs.genSalt(constants.SALT_ROUNDS);
    return await bcryptjs.hash(plainPassword, salt);
}

const verifyPassword = async (plainPassword: string, hashedPassword: string): Promise<boolean> => {
    return await bcryptjs.compare(plainPassword, hashedPassword);
}

// Generate a salt and Hash the PIN with the salt
const hashPin = async (plainPin: string): Promise<string> => {
    const salt = await bcryptjs.genSalt(constants.SALT_ROUNDS);
    return await bcryptjs.hash(plainPin, salt);
}

const verifyPin = async (user: IUserAttributes, pin: string): Promise<boolean> => {
    if (!user.pin_hash) {
        return false;
    }
    return await bcryptjs.compare(pin, user.pin_hash);
}

const setPin = async (userId: string, pin: string): Promise<boolean> => {
    const pinHash = await hashPin(pin);
    return await userRepository.updatePin(userId, pinHash);
}

export default {
    generateSession,
    logout,
    verifyPin,
    setPin,
    hashPin,
    logoutAllSessions,
    parseJson,
    isAccountLocked,
    hashPassword,
    verifyPassword
}