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

// Initialize all models with associations
const models = initializeModels(connection);

const db = {
    Sequelize,
    connection,
    ...models,
}

// Sync database tables. don't use this in production
// connection.sync({ alter: true,})
//     .then(() => console.log('Database tables synced.'))
//     .catch((error: unknown) => console.error('Error syncing database:', error));

export default db;