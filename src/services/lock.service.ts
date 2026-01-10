import RedisConnectionManager from '@/config/redis.config';
import LoggerService from '@/core/logger';

class LockService {
    private readonly LOCK_PREFIX = 'cron:lock:';
    private readonly DEFAULT_TTL = 300; // 5 minutes in seconds

    /**
     * Acquire a distributed lock
     * @param lockKey - Unique identifier for the lock
     * @param ttl - Time to live in seconds (default: 5 minutes)
     * @returns true if lock was acquired, false otherwise
     */
    async acquireLock(lockKey: string, ttl: number = this.DEFAULT_TTL): Promise<boolean> {
        try {
            const client = RedisConnectionManager.getClient();
            const fullKey = `${this.LOCK_PREFIX}${lockKey}`;

            // SET with NX (only if not exists) and EX (expiration)
            const result = await client.set(fullKey, Date.now().toString(), 'EX', ttl, 'NX');

            return result === 'OK';
        } catch (error: any) {
            LoggerService.loggerInstance.logAuditEvent("Lock Acquisition Error", {
                userId: "system",
                action: "acquireLock",
                details: `Failed to acquire lock for ${lockKey}: ${error.message}`
            });
            return false;
        }
    }

    /**
     * Release a distributed lock
     * @param lockKey - Unique identifier for the lock
     */
    async releaseLock(lockKey: string): Promise<void> {
        try {
            const client = RedisConnectionManager.getClient();
            const fullKey = `${this.LOCK_PREFIX}${lockKey}`;

            await client.del(fullKey);
        } catch (error: any) {
            LoggerService.loggerInstance.logAuditEvent("Lock Release Error", {
                userId: "system",
                action: "releaseLock",
                details: `Failed to release lock for ${lockKey}: ${error.message}`
            });
        }
    }

    /**
     * Execute a function with a distributed lock
     * @param lockKey - Unique identifier for the lock
     * @param fn - Function to execute
     * @param ttl - Time to live in seconds (default: 5 minutes)
     */
    async executeWithLock<T>(lockKey: string, fn: () => Promise<T>, ttl: number = this.DEFAULT_TTL): Promise<T | null> {
        const acquired = await this.acquireLock(lockKey, ttl);
        if (!acquired) {
            LoggerService.loggerInstance.logAuditEvent("Lock Already Held", {
                userId: "system",
                action: "executeWithLock",
                details: `Lock for ${lockKey} is already held by another process`
            });
            return null;
        }

        try {
            const result = await fn();
            return result;
        } catch (error: any) {
            LoggerService.loggerInstance.logAuditEvent("Lock Execution Error", {
                userId: "system",
                action: "executeWithLock",
                details: `Error executing locked function for ${lockKey}: ${error.message}`
            });
            throw error;
        } finally {
            await this.releaseLock(lockKey);
        }
    }
}

export default new LockService();

