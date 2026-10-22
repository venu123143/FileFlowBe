import { Hono } from "hono";
import AuthMiddleware from "@/middleware/auth.middleware";
import analyticsController from "@/controllers/analytics.controller";

export class AnalyticsRouter {
    /** Each router owns its own Hono instance */
    private readonly router: Hono;

    constructor() {
        this.router = new Hono();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        // Apply authentication middleware to all routes
        this.router.use(AuthMiddleware.authMiddleware);

        // Get analytics summary (last 30 days)
        this.router.get('/summary', analyticsController.getAnalyticsSummary);

        // Get analytics by date range
        this.router.get('/date-range', analyticsController.getAnalyticsByDateRange);

        // Get current storage overview
        this.router.get('/storage', analyticsController.getStorageOverview);
    }

    public getRouter() {
        return this.router;
    }
}

