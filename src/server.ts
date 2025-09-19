// src/app.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { Server } from "socket.io";
import { instrument } from "@socket.io/admin-ui";
import { Server as Engine } from "@socket.io/bun-engine";
import { corsOptions, csrfMiddleware } from "@/utils/cors-options";
import { MainRouter } from "@/global/routes";
import "@/config/database";
import RedisConnectionManager from "@/config/redis.config";
import winston from "@/core/logger";
import "@/controllers/cron.controller";

export class App {
    private readonly app: Hono;
    private readonly io: Server;
    private readonly engine: Engine;

    constructor() {
        this.app = new Hono();

        // Initialize Socket.IO components
        this.io = new Server({ cors: corsOptions });
        this.engine = new Engine({ path: "/socket.io/" });
        this.io.bind(this.engine);

        this.registerMiddlewares();
        this.registerRoutes();
        this.registerSocketHandlers();
        this.registerErrorHandler();
        RedisConnectionManager.connect();
        instrument(this.io, {
            auth: false, // or true if you want to protect with credentials
        });
    }

    private registerMiddlewares() {
        this.app.use("*", logger());
        this.app.use("*", cors(corsOptions));
        this.app.use("*", secureHeaders());
        this.app.use("*", csrfMiddleware);
        this.app.use("*", requestId());
        this.app.use("*", winston.createAuditMiddleware(winston.loggerInstance));
    }

    private registerRoutes() {
        this.app.get("/", (c) => c.text("👋 Welcome to a Bun + Hono API!"));
        this.app.route("/api/v1", new MainRouter().getRouter());
    }

    private registerSocketHandlers() {
        this.io.on("connection", (socket) => {
            console.log("A user connected!", socket.id);

            socket.on("chat message", (msg) => {
                console.log("message:", msg);
                this.io.emit("chat message", msg);
            });

            socket.on("disconnect", () => {
                console.log("A user disconnected!");
            });
        });
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

    public getSocketEngine() {
        return this.engine;
    }

    public getSocketIO() {
        return this.io;
    }
}
