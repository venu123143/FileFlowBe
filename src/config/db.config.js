
import dotenv from 'dotenv';
dotenv.config();

const dbConfig = {
  development: {
    username: process.env.DEV_DB_USERNAME,
    password: process.env.DEV_DB_PASSWORD,
    database: process.env.DEV_DB_DATABASE,
    host: process.env.DEV_DB_HOST,
    dialect: 'postgres',
    port: parseInt(process.env.DEV_DB_PORT || '5432', 10),
    timezone: '+00:00',
  },
  test: {
    username: process.env.TEST_DB_USERNAME,
    password: process.env.TEST_DB_PASSWORD,
    database: process.env.TEST_DB_DATABASE,
    host: process.env.TEST_DB_HOST,
    dialect: 'postgres',
    port: parseInt(process.env.TEST_DB_PORT || '5432', 10),
    timezone: '+00:00',
  },
  production: {
    username: process.env.PROD_DB_USERNAME,
    password: process.env.PROD_DB_PASSWORD,
    database: process.env.PROD_DB_DATABASE,
    host: process.env.PROD_DB_HOST,
    dialect: 'postgres',
    port: parseInt(process.env.PROD_DB_PORT || '5432', 10),
    timezone: '+00:00',
  },
};

export default dbConfig;
