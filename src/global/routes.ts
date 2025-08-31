import { Hono } from "hono";
import { AuthRouter } from "@/routes/user.routes";
import { FileRouter } from "@/routes/file.routes";

export class MainRouter {
    private readonly router: Hono;

    constructor() {
        this.router = new Hono();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.route("/auth", new AuthRouter().getRouter());
        this.router.route("/file-flow", new FileRouter().getRouter());
    }

    /** Return the configured Hono instance */
    public getRouter(): Hono {
        return this.router;
    }
}