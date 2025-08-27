import type { Context, Next } from 'hono';
import fs from 'fs';
import path from 'path';

//  // Hono provides cookie helpers
import winston, { format } from 'winston';
// import { ElasticsearchTransport } from 'winston-elasticsearch'; 
// import WinstonCloudWatch from 'winston-cloudwatch';
import config from '@/config/config';

interface LoggerConfig {
    logLevel?: 'info' | 'warn' | 'error' | 'critical' | 'debug';
    environment?: string;
    elasticsearch?: {
        url: string;
        username: string;
        password: string;
        indexPrefix?: string;
    };
    cloudwatch?: {
        logGroupName: string;
        logStreamPrefix: string;
        region: string;
        credentials?: any;
        retentionInDays?: number;
    };
}

interface AuditEvent {
    userId: string;
    action?: string;
    routes?: string; // Consider if 'routes' is still relevant in Hono context, 'path' might be more direct
    resource?: string;
    details: string;
    status?: string;
    ipAddress?: string;
    userAgent?: string;
}

interface SecurityEvent {
    userId: string;
    event: string;
    severity?: string;
    details: string;
    ipAddress?: string;
}

interface DataAccessEvent {
    userId: string;
    dataType: string;
    operation: string;
    recordId: string;
    details: string;
}

class AuditLogger {
    private logger: winston.Logger;

    constructor(config: LoggerConfig) {
        // ✅ Ensure logs directory exists
        const logDir = path.join(process.cwd(), 'logs');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        this.logger = winston.createLogger({
            level: config.logLevel || 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json(),
                winston.format.metadata()
            ),
            defaultMeta: {
                environment: config.environment || 'development'
            },
        });

        if (config.environment !== 'production') {
            this.logger.add(new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.colorize(),
                    winston.format.simple()
                )
            }));
            this.logger.add(new winston.transports.File({
                filename: path.join(logDir, 'development.log'),
                format: format.combine(
                    format.timestamp(),
                    format.json()
                )
            }));
        }

        // if (config.elasticsearch) {
        //     const esTransport = new ElasticsearchTransport({
        //         level: 'info',
        //         clientOpts: {
        //             node: config.elasticsearch.url,
        //             auth: {
        //                 username: config.elasticsearch.username,
        //                 password: config.elasticsearch.password
        //             }
        //         },
        //         indexPrefix: config.elasticsearch.indexPrefix || 'audit-logs'
        //     });
        //     this.logger.add(esTransport);
        // }

        // if (config.cloudwatch) {
        //     const cloudWatchConfig: any = {
        //         logGroupName: config.cloudwatch.logGroupName,
        //         logStreamName: `${config.cloudwatch.logStreamPrefix}-${Date.now()}`,
        //         awsRegion: config.cloudwatch.region,
        //         messageFormatter: ({ level, message, metadata }: any) => {
        //             return JSON.stringify({
        //                 level,
        //                 message,
        //                 ...metadata,
        //                 timestamp: new Date().toISOString()
        //             });
        //         }
        //     };

        //     if (config.cloudwatch.credentials) {
        //         cloudWatchConfig.credentials = config.cloudwatch.credentials;
        //     }

        //     if (config.cloudwatch.retentionInDays) {
        //         cloudWatchConfig.retentionInDays = config.cloudwatch.retentionInDays;
        //     }

        //     const cloudwatchTransport = new WinstonCloudWatch(cloudWatchConfig);

        //     cloudwatchTransport.on('error', (error: Error) => {
        //         console.error('CloudWatch transport error:', error);
        //     });

        //     this.logger.add(cloudwatchTransport);
        // }
    }

    public debug(message: string, metadata?: any): void {
        this.logger.debug(message, metadata);
    }

    public info(message: string, metadata?: any): void {
        this.logger.info(message, metadata);
    }

    public warn(message: string, metadata?: any): void {
        this.logger.warn(message, metadata);
    }

    public error(message: string, error?: any): void {
        const metadata: any = {};

        if (error) {
            if (error instanceof Error) {
                metadata.errorMessage = error.message;
                // const stackLines = error.stack?.split('\n') ?? [];
                // metadata.errorStack = stackLines.slice(0, 3).join('\n') + '\n... (stack truncated)';
            } else {
                metadata.error = error;
            }
        }

        this.logger.error(message, metadata);
    }

    logAuditEvent(eventName: string, metadata: AuditEvent) {
        this.logger.info(eventName, metadata);
    }

    logSecurityEvent(event: SecurityEvent) {
        this.logger.warn('Security Event', {
            metadata: {
                eventType: 'security',
                ...event,
                timestamp: new Date().toISOString()
            }
        });
    }

    logDataAccess(event: DataAccessEvent) {
        this.logger.info('Data Access', {
            metadata: {
                eventType: 'data_access',
                ...event,
                timestamp: new Date().toISOString()
            }
        });
    }

    async close() {
        await new Promise((resolve) => {
            this.logger.on('finish', resolve);
            this.logger.end();
        });
    }
}

// Middleware for Hono
const createAuditMiddleware = (auditLogger: AuditLogger) => {
    return async (c: Context, next: Next) => {
        // Proceed to the next middleware or route handler
        await next();

        const userId = c.get('userId') || 'anonymous'; // Assuming you might set userId on the context via another middleware
        // Alternatively, if userId is in a cookie or header:
        // const userId = getCookie(c, 'user_id') || 'anonymous';

        const status = c.res.status.toString();
        const ipAddress = c.req.header('x-forwarded-for');
        const userAgent = c.req.header('user-agent') || '';

        // Log the audit event after the response has been sent (or at least status is known)
        auditLogger.logAuditEvent("Request", {
            userId,
            action: c.req.method,
            resource: c.req.path, // Hono uses c.req.path for the route path
            status: status,
            ipAddress: ipAddress,
            userAgent: userAgent,
            details: JSON.stringify({
                query: c.req.query(), // Hono's way to get query parameters
                params: c.req.param(), // Hono's way to get path parameters (if defined in route)
                statusCode: status,
                // Add response body details if needed, but be cautious with large responses
            })
        });
    };
};

const loggerInstance = new AuditLogger({
    environment: config.ENVIRONMENT,
    logLevel: 'info',
});

export default { loggerInstance, createAuditMiddleware };