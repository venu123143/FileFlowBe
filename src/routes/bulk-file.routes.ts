import { Hono } from "hono";
import AuthMiddleware from "@/middleware/auth.middleware";
import BulkFileController from "@/controllers/bulk-file.controller";
import { validateBody } from "@/utils/validation";
import bulkFileDtoValidation from "@/validation/bulk-file.validation";

/**
 * Bulk counterparts of the single-item file operations.
 * Each endpoint is all-or-nothing: if any ID in the batch is rejected, the
 * transaction rolls back and nothing is changed.
 *
 * Mounted at /api/v1/file-flow-bulk (a sibling of /file-flow, so the existing
 * FileRouter auth middleware does not run a second time on these paths).
 *
 * POST is used throughout (rather than DELETE/PATCH) because every operation
 * carries a JSON body, which proxies and clients are free to strip from a DELETE.
 */
export class BulkFileRouter {
    /** Each router owns its own Hono instance */
    private readonly router: Hono;

    constructor() {
        this.router = new Hono();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        // Apply authentication middleware to all routes
        this.router.use(AuthMiddleware.authMiddleware);
        this.router.post('/delete', validateBody(bulkFileDtoValidation.bulkDeleteValidation), BulkFileController.bulkDeleteFilesOrFolders);
        this.router.post('/move', validateBody(bulkFileDtoValidation.bulkMoveValidation), BulkFileController.bulkMoveFilesOrFolders);
        this.router.post('/share', validateBody(bulkFileDtoValidation.bulkShareValidation), BulkFileController.bulkShareFilesOrFolders);
    }

    public getRouter() {
        return this.router;
    }
}
