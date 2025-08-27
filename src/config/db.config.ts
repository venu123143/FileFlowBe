// src/config/dbConfig.ts

interface IConfig {
    username: string;
    password: string;
    database: string;
    host: string;
    dialect: 'postgres';
    port: number;
    timezone: string;
}

interface DBConfig {
    development: IConfig;
    test: IConfig;
    production: IConfig;
}

const dbConfig: DBConfig = {
    development: {
        username: Bun.env.DEV_DB_USERNAME!,
        password: Bun.env.DEV_DB_PASSWORD!,
        database: Bun.env.DEV_DB_DATABASE!,
        host: Bun.env.DEV_DB_HOST!,
        dialect: 'postgres',
        port: parseInt(Bun.env.DEV_DB_PORT || '5432', 10),
        timezone: '+00:00',
    },
    test: {
        username: Bun.env.TEST_DB_USERNAME!,
        password: Bun.env.TEST_DB_PASSWORD!,
        database: Bun.env.TEST_DB_DATABASE!,
        host: Bun.env.TEST_DB_HOST!,
        dialect: 'postgres',
        port: parseInt(Bun.env.TEST_DB_PORT || '5432', 10),
        timezone: '+00:00',
    },
    production: {
        username: Bun.env.PROD_DB_USERNAME!,
        password: Bun.env.PROD_DB_PASSWORD!,
        database: Bun.env.PROD_DB_DATABASE!,
        host: Bun.env.PROD_DB_HOST!,
        dialect: 'postgres',
        port: parseInt(Bun.env.PROD_DB_PORT || '5432', 10),
        timezone: '+00:00',
    },
};

export default dbConfig;