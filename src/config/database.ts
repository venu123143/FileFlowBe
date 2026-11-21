import { Sequelize } from "sequelize";
import db_config from "@/config/db.config";
import config from "@/config/config";
import { initializeModels } from "@/models";

// Get current environment (default to development)
const env = config.ENVIRONMENT as keyof typeof db_config;
const dbConfig = db_config[env];

// Initialize the Sequelize connection
const connection = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password,
    {
        host: dbConfig.host,
        dialect: dbConfig.dialect,
        port: dbConfig.port,
        logging: false,
        pool: {
            max: 20,
            min: 2,
            acquire: 60000,
            idle: 30000,
            evict: 5000,
        },
        // Connection retry and health check configuration
        retry: {
            max: 3,
            match: [
                /ConnectionError/,
                /ConnectionRefusedError/,
                /HostNotFoundError/,
                /HostNotReachableError/,
                /InvalidConnectionError/,
                /ConnectionTimedOutError/,
                /Connection terminated unexpectedly/,
                /Connection reset by peer/,
                /Broken pipe/,
                /ECONNRESET/,
                /ETIMEDOUT/,
                /ENOTFOUND/,
            ],
        },
        // Keep-alive to prevent idle connection termination
        dialectOptions: {
            keepAlive: true,
            keepAliveInitialDelayMillis: 10000,
            // TCP keepalive settings
            socketTimeout: 60000,
            connectionTimeout: 60000,
        },
        // Disable automatic reconnection handling - we'll handle it manually
        // to have better control over connection lifecycle
        // timezone: "+05:30" // Indian Standard Time (IST)
    }
);

// Test the database connection
connection.authenticate()
    .then(() => {
        console.log("Connection has been established successfully.");
    })
    .catch((error: Error) => {
        console.error("Unable to connect to the database:", error.message);
    });

// Add connection health check and event listeners for better connection management
connection.addHook('afterConnect', async (connection: any, config: any) => {
    // Set TCP keepalive on the underlying connection
    if (connection.stream && connection.stream.socket) {
        connection.stream.socket.setKeepAlive(true, 10000);
    }
});

connection.addHook('beforeQuery', async (options: any) => {
    // Log slow queries in development
    if (process.env.NODE_ENV === 'development') {
        options.logging = (sql: string, timing?: number) => {
            if (timing && timing > 1000) {
                console.warn(`Slow query (${timing}ms):`, sql.substring(0, 200));
            }
        };
    }
});

// Initialize all models with associations
const models = initializeModels(connection);

const db = {
    Sequelize,
    connection,
    ...models,
}

// Sync database tables. don't use this in production
// connection.sync({ alter: true })
//     .then(() => console.log('Database tables synced.'))
//     .catch((error: unknown) => console.error('Error syncing database:', error));

export default db;