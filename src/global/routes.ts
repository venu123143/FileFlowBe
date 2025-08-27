import type { Hono } from "hono";
// import { AuthRouter } from "@/services/auth-service/routes/auth.route";

export class MainRouter {
    private readonly router: Hono;

    constructor(app: Hono) {
        this.router = app;
        this.initializeRoutes();
    }

    private initializeRoutes() {
        // this.router.route("/auth", new AuthRouter().getRouter());
    }

    /** Return the configured Hono instance */
    public getRouter(): Hono {
        return this.router;
    }
}