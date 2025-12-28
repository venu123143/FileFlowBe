import { sessionMiddleware, type Session, CookieStore, type SessionOptions } from 'hono-sessions';
import config from '@/config/config';
import constants from '@/global/constants';


/**
 * Session Middleware Configuration
 * 
 * Store Types:
 * - MemoryStore: Stores session data in server RAM. Cookie contains only a session ID.
 *   Pros: Can store large amounts of data, faster for large sessions
 *   Cons: Requires server memory, lost on server restart, not scalable across multiple servers
 * 
 * - CookieStore: Stores ALL session data directly in the encrypted cookie itself.
 *   Pros: Stateless (no server storage), works across multiple servers, simpler
 *   Cons: Limited by cookie size (~4KB), all data sent with every request
 * 
 */
const cookieOptions: SessionOptions['cookieOptions'] = {
    // domain: config.ENVIRONMENT === 'development' ? 'localhost' : undefined,
    path: '/',
    sameSite: config.ENVIRONMENT === 'production' ? 'none' : 'lax', // 'lax' for local dev, 'none' for production (requires HTTPS)
    httpOnly: config.ENVIRONMENT === 'development' ? true : false, // Set to true in production for better security
    secure: config.ENVIRONMENT === 'production', // true for HTTPS, false for local HTTP
    maxAge: 1000 * 60 * 20, // 20 minutes
}

const session = sessionMiddleware({
    store: new CookieStore(),
    sessionCookieName: 'fileflow_session',
    encryptionKey: config.SESSION_SECRET,
    cookieOptions: cookieOptions
})

/**
 * Set any data to session by key
 * This automatically saves the session to the 'fileflow_session' cookie
 * The cookie is encrypted and set with the configured options (20 min expiry, httpOnly, secure)
 */
export const setSessionData = async <T>(session: Session, key: string, data: T): Promise<void> => {
    await session.set(key, data);
};

// Get any data from session by key
export const getSessionData = async <T = unknown>(session: Session, key: string): Promise<T | undefined> => {
    return await session.get(key) as T | undefined;
};

// Remove any data from session by key
export const removeSessionData = async (session: Session): Promise<void> => {
    await session.deleteSession();
};

export const updateSessionData = async <T>(session: Session, key: string, updater: (prev: T | undefined) => T): Promise<void> => {
    const current = await getSessionData<T>(session, key);
    const updated = updater(current);
    await setSessionData(session, key, updated);
};

// PIN Session constants
// PIN Session data interface
export interface PinSessionData {
    user_id: string;
    email: string;
    pin_verified: boolean;
    verified_at: string;
}

/**
 * Check if PIN session is valid and not expired
 * @param session - The session object
 * @returns PinSessionData if valid, null if invalid or expired
 */
export const getValidPinSession = async (session: Session): Promise<PinSessionData | null> => {
    try {
        // Get PIN session data from the session (which was loaded from cookies)
        const pinSession = await getSessionData<PinSessionData>(session, 'pin_session');

        if (!pinSession || !pinSession.pin_verified) {
            return null;
        }

        // Check if session has expired (20 minutes)
        const verifiedAt = new Date(pinSession.verified_at);
        const now = new Date();
        const sessionAge = now.getTime() - verifiedAt.getTime();

        if (sessionAge > constants.PIN_SESSION_DURATION_MS) {
            // Session expired, remove it
            await session.deleteSession();
            return null;
        }

        return pinSession;
    } catch (error) {
        return null;
    }
};

export default session