// src/app.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { requestId } from "hono/request-id";
import { csrf } from "hono/csrf";
import { secureHeaders } from "hono/secure-headers";
import { corsOptions, csrfMiddleware } from "@/utils/cors-options";
import session from "@/core/session";
import { MainRouter } from "@/global/routes";
import "@/config/database";
import RedisConnectionManager from "@/config/redis.config";
import winston from "@/core/logger"
import "@/controllers/cron.controller";

export class App {
    private readonly app: Hono;

    constructor() {
        this.app = new Hono();
        this.registerMiddlewares();
        this.registerRoutes();
        this.registerErrorHandler();
        RedisConnectionManager.connect();
    }

    private registerMiddlewares() {
        this.app.use("*", logger());
        this.app.use("*", cors(corsOptions));
        this.app.use("*", secureHeaders());
        this.app.use("*", session);
        this.app.use("*", csrfMiddleware);
        this.app.use("*", requestId());
        this.app.use("*", winston.createAuditMiddleware(winston.loggerInstance));

    }

    private registerRoutes() {
        this.app.get("/", (c) => c.text("👋 Welcome to a Bun + Hono API!"));
        this.app.route("/api/v1", new MainRouter().getRouter());
    }

    private registerErrorHandler() {
        this.app.onError((err, c) => {
            console.log(err);
            console.error("❗ Unhandled error:", err.message);
            return c.text("Internal Server Error", 500);
        });
    }

    public getHandler() {
        return this.app.fetch.bind(this.app);
    }
}
