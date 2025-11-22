import { Hono } from "hono";
import AuthMiddleware from "@/middleware/auth.middleware";
import ApiTokenController from "@/controllers/api-token.controller";

export class ApiTokenRouter {
    private readonly router: Hono;

    constructor() {
        this.router = new Hono();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        // Apply authentication middleware to all routes
        this.router.use(AuthMiddleware.authMiddleware);

        this.router.post("/generate", ApiTokenController.generateToken);
        this.router.get("/list", ApiTokenController.listTokens);
        this.router.delete("/:id", ApiTokenController.revokeToken);
    }

    public getRouter() {
        return this.router;
    }
}
