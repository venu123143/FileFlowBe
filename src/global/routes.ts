import { Hono } from "hono";
import { AuthRouter } from "@/routes/user.routes";
import { FileRouter } from "@/routes/file.routes";
import { UploadRouter } from "@/routes/upload.routes";
import { NotificationRouter } from "@/routes/notification.routes";

export class MainRouter {
    private readonly router: Hono;

    constructor() {
        this.router = new Hono();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.route("/auth", new AuthRouter().getRouter());
        this.router.route("/file-flow", new FileRouter().getRouter());
        this.router.route("/upload", new UploadRouter().getRouter());
        this.router.route("/notification", new NotificationRouter().getRouter());
    }

    /** Return the configured Hono instance */
    public getRouter(): Hono {
        return this.router;
    }
}