import { sessionMiddleware, MemoryStore, type Session } from 'hono-sessions';
import config from '@/config/config';


const session = sessionMiddleware({
    store: new MemoryStore(),
    sessionCookieName: 'ridewave_session',
    encryptionKey: config.SESSION_SECRET,
    cookieOptions: {
        // domain: config.SESSION_DOMAIN,
        path: '/',
        sameSite: 'lax',
        httpOnly: true,
        secure: true,
        maxAge: 60 * 60 * 24 * 1, // 1 day
    },
})

// Set any data to session by key
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

export default session