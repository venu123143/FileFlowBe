
export enum Environment {
    Development = 'development',
    Production = 'production',
    Testing = 'testing',
    Local = 'local'
}

const isEnvironment = (env: string): env is Environment => {
    return Object.values(Environment).includes(env as Environment);
};

const getEnvironment = (): Environment => {
    const env = process.env.NODE_ENV || Environment.Development;
    return isEnvironment(env) ? env : Environment.Development;
};


interface Config {
    PORT: number;
    ENVIRONMENT: Environment,
    JWT_SECRET: string;
    SESSION_SECRET: string;
    OTP_SECRET_KEY: string;
    REDIS_URL: string;
    KAFKA_BROKERS: string[];
    KAFKA_CLIENT_ID: string,
    FRONTEND_URLS: {
        BASE: string;
        SUCCESS: string;
        ERROR: string;
    };
    S3: {
        ACCOUNT_ID: string;
        TOKEN_ID: string;
        SECRET_KEY: string;
        ENDPOINT: string;
        BUCKET_NAME: string;
        REGION: string;
    };
    CLOUDFLARE: {
        CDN_DOMAIN: string;
        API_TOKEN: string;
        ZONE_ID: string;
        DEFAULT_TTL: string;
    };
    HTTP2: {
        ENABLED: boolean;
        SSL: {
            ENABLED: boolean;
            CERT_PATH?: string;
            KEY_PATH?: string;
        };
    };
}


const config: Config = {
    PORT: parseInt(process.env.PORT || '3000'),
    ENVIRONMENT: getEnvironment(),
    JWT_SECRET: process.env.JWT_SECRET!,
    SESSION_SECRET: process.env.SESSION_SECRET!,
    OTP_SECRET_KEY: process.env.OTP_SECRET_KEY!,
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    KAFKA_BROKERS: process.env.KAFKA_BROKERS?.split(',') || ['localhost:29092'],
    KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID || 'BOOKINGS_APP_CLIENT',
    FRONTEND_URLS: {
        BASE: process.env.FRONTEND_URL!,
        SUCCESS: `${process.env.FRONTEND_URL}${process.env.FRONTEND_SUCCESS_PATH}`,
        ERROR: `${process.env.FRONTEND_URL}${process.env.FRONTEND_ERROR_PATH}`,
    },
    S3: {
        ACCOUNT_ID: process.env.S3_ACCOUNT_ID!,
        TOKEN_ID: process.env.S3_TOKEN_ID!,
        SECRET_KEY: process.env.S3_SECRET_KEY!,
        ENDPOINT: process.env.S3_ENDPOINT!,
        BUCKET_NAME: process.env.S3_BUCKET_NAME!,
        REGION: process.env.S3_REGION!,
    },
    CLOUDFLARE: {
        CDN_DOMAIN: process.env.CLOUDFLARE_CDN_DOMAIN!,
        API_TOKEN: process.env.CLOUDFLARE_API_TOKEN!,
        ZONE_ID: process.env.CLOUDFLARE_ZONE_ID!,
        DEFAULT_TTL: process.env.CLOUDFLARE_CACHE_TTL!
    },
    HTTP2: {
        ENABLED: process.env.HTTP2_ENABLED === 'true' || false,
        SSL: {
            ENABLED: process.env.SSL_ENABLED === 'true' || false,
            CERT_PATH: process.env.SSL_CERT_PATH,
            KEY_PATH: process.env.SSL_KEY_PATH,
        },
    },

};

export default config;