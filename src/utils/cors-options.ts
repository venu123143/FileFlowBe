import type { Context, Next } from "hono";
import { csrf } from "hono/csrf";


export const corsOptions = {
    origin: [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5000",
        "http://localhost:5173",
    ],
    credentials: true,
    exposedHeaders: ["sessionid", "logintoken", "resettoken", "ratelimit-remaining"],
    allowedHeaders: ["sessionid", "resettoken", "logintoken", "Content-Type", "Authorization", "token", "locale", "x-device-token"],
};


export const csrfMiddleware = async (c: Context, next: Next) => {
    if (c.req.path.startsWith('/api/v1/upload/')) {
        await next();
    } else {
        await csrf({ origin: corsOptions.origin })(c, next);
    }
};
