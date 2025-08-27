import Redis from 'ioredis'; // Import ioredis
import LoggerService from '@/core/logger';
import config from '@/config/config';

class RedisConnectionManager {
    public client: Redis | null = null; // Use Redis from ioredis
    private reconnectTimeout: NodeJS.Timeout | null = null; // Keep if still needed for specific logic, though ioredis handles reconnection robustly
    private isConnecting: boolean = false; // ioredis manages this internally, but can keep for custom logic

    constructor() {
        this.setupClient();
    }

    private setupClient() {
        if (this.isConnecting && this.client && this.client.status === 'connecting') {
            console.log('ioredis client already connecting.');
            return;
        }

        this.isConnecting = true; // Indicate that connection is being attempted

        this.client = new Redis({
            host: new URL(config.REDIS_URL).hostname,
            port: parseInt(new URL(config.REDIS_URL).port || '6379'),
            password: new URL(config.REDIS_URL).password, // If your URL includes a password
            db: parseInt(new URL(config.REDIS_URL).pathname.slice(1) || '0'), // If your URL includes a DB number
            lazyConnect: true, // Don't connect until a command is sent or .connect() is called
            reconnectOnError: (err) => {
                const targetErrors = ['READONLY', 'ETIMEDOUT'];
                const errorMessage = err.message.toUpperCase();
                return targetErrors.some(target => errorMessage.includes(target));
            },
            retryStrategy: (times) => {
                if (times > 3) { // Max reconnection attempts
                    LoggerService.loggerInstance.logAuditEvent("Redis reconnection", { userId: "system", action: "redisReconnectionError", details: "Redis max reconnection attempts reached" });
                    return null; // Stop retrying
                }
                // Exponential backoff: 2^retries * 100ms, capped at 3 seconds
                return Math.min(2 ** times * 100, 3000);
            },
            maxRetriesPerRequest: null, // Unlimited retries for individual commands while connection is down
            enableOfflineQueue: true, // Queue commands when disconnected
            connectTimeout: 10000, // 10 seconds timeout for initial connection
        });

        this.client.on('error', (err: Error) => {
            console.error('unable to connect to redis:', err.message);
            this.isConnecting = false; // Reset connection status on error
        });

        this.client.on('connect', () => {
            console.log('ioredis Client Connected');
            this.isConnecting = false; // Connection successful
            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout);
                this.reconnectTimeout = null;
            }
        });

        this.client.on('reconnecting', (delay: number) => {
            console.log(`ioredis Client Reconnecting... next attempt in ${delay}ms`);
            this.isConnecting = true; // Indicate reconnecting
        });

        this.client.on('end', () => {
            console.log('ioredis Client Connection Closed');
            this.isConnecting = false; // Connection ended
        });

        this.client.on('ready', () => {
            console.log('ioredis Client Ready (connected and authenticated)');
        });
    }

    public async connect() {
        if (!this.client) {
            this.setupClient();
        }

        if (this.client!.status === 'ready') {
            console.log('ioredis connection already ready');
            return this.client;
        }

        // If lazyConnect is true, we need to explicitly connect or send a command.
        // Ping is a good way to ensure a connection is established.
        try {
            console.log('Attempting to connect to ioredis...');
            // ioredis connects on demand when lazyConnect is true and a command is sent.
            // Using .connect() is also an option, or simply await a .ping()
            await this.client!.connect(); // Explicitly connect the client
            await this.client!.ping(); // Send a simple command to ensure connection is live
            console.log('ioredis connection established and ping successful.');
            return this.client;
        } catch (error: any) {
            LoggerService.loggerInstance.logAuditEvent("Redis Error", { userId: "system", action: "Trying to connect ioredis", details: error.message });
            this.isConnecting = false; // Ensure status is reset on failed connection attempt
            throw error;
        }
    }

    public async disconnect(): Promise<void> {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        if (this.client) {
            console.log('Disconnecting ioredis client...');
            await this.client.quit(); // Use quit for graceful shutdown
            this.client = null;
            this.isConnecting = false;
        }
    }

    public getClient(): Redis { // Return ioredis Redis type
        if (!this.client) {
            throw new Error('ioredis client not initialized');
        }
        return this.client;
    }

    public async exists(key: string): Promise<boolean> {
        const result = await this.client?.exists(key);
        return result === 1; // ioredis also returns 0 or 1 for exists
    }

    // Graceful shutdown method
    public async shutdown(): Promise<void> {
        console.log('Initiating graceful ioredis shutdown...');
        await this.disconnect();
        console.log('ioredis connection closed gracefully');
    }
}

export default new RedisConnectionManager();

