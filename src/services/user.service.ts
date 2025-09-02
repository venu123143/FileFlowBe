import constants from "@/global/constants";
import jwt from "@/utils/jwt-token";
import { type IUserSessionAttributes } from "@/models/UserSession.model";
import userRepository from "@/repository/user.repository";
import { type IUserAttributes } from "@/models/User.model";
import redisConn from "@/config/redis.config";
import redisConstants from "@/global/redis-constants";
import bcryptjs from "bcryptjs";


async function generateSession(user: IUserAttributes, metadata?: Record<string, any>): Promise<{ jwt_token: string; expiresAt: number }> {
    const issuedAt = Math.floor(Date.now() / 1000); // seconds
    const expiresIn = constants.TOKEN_EXPIRY_TIME; // e.g. 3600 for 1 hour
    const expiresAt = issuedAt + expiresIn;

    const payload = {
        id: user.id,
        email: user.email,
    };
    const jwt_token = await jwt.generateJwtToken(payload, expiresIn);
    const login_details: IUserSessionAttributes = {
        session_token: jwt_token,
        user_id: payload.id,
        expires_at: new Date(expiresAt * 1000),
        is_active: true,
        device_token: null,
        metadata: metadata ? metadata : null,
    };
    await userRepository.saveSession(login_details);

    // Store session info in Redis with a dynamic key
    const client = redisConn.getClient();
    const sessionKey = `${redisConstants.USER_SESSION_PREFIX}${user.id}:${jwt_token}`;
    // Store with TTL matching token expiry
    await client.set(sessionKey, JSON.stringify({ login_details, user }), 'EX', expiresIn);
    return { jwt_token, expiresAt };
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

export default {
    generateSession,
    logout,
    logoutAllSessions,
    parseJson,
    isAccountLocked,
    hashPassword,
    verifyPassword
}