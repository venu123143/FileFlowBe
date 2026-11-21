import { Hono } from "hono";
import AuthMiddleware from "@/middleware/auth.middleware";
import cacheController from "@/controllers/cache.controller";
import { validateBody, validateParams, validateQuery } from "@/utils/validation";
import {
    warmVideoSchema,
    refreshVideoSchema,
    getJobStatusSchema,
    listJobsSchema,
} from "@/validation/cache.validation";

export class CacheRouter {
    private readonly router: Hono;

    constructor() {
        this.router = new Hono();
        this.setupRoutes();
    }

    private setupRoutes() {
        // All cache routes require authentication
        this.router.use("*", AuthMiddleware.authMiddleware);

        // POST /cache/warm - Queue a cache warming job
        this.router.post(
            "/warm",
            validateBody(warmVideoSchema),
            cacheController.warmVideo
        );

        // POST /cache/refresh - Queue a cache refresh job (purge + warm)
        this.router.post(
            "/refresh",
            validateBody(refreshVideoSchema),
            cacheController.refreshVideo
        );

        // GET /cache/job/:jobId - Get cache job status
        this.router.get(
            "/job/:jobId",
            validateParams(getJobStatusSchema),
            cacheController.getJobStatus
        );

        // GET /cache/jobs - List cache jobs with filters
        this.router.get(
            "/jobs",
            validateQuery(listJobsSchema),
            cacheController.listJobs
        );

        // DELETE /cache/job/:jobId - Cancel a cache job
        this.router.delete(
            "/job/:jobId",
            validateParams(getJobStatusSchema),
            cacheController.cancelJob
        );

        // GET /cache/metrics - Get cache queue metrics
        this.router.get(
            "/metrics",
            cacheController.getQueueMetrics
        );
    }

    public getRouter(): Hono {
        return this.router;
    }
}