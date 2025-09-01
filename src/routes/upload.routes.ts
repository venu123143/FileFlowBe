import { Hono } from "hono";
import Middleware from "@/middleware/auth.middleware";
import { uploadImageMiddleware } from '@/middleware/multer.middleware' // rewritten for Hono/Bun
import uploadController from "@/controllers/upload.controller";

export class UploadRouter {
    /** Each router owns its own Hono instance */
    private readonly router: Hono;

    constructor() {
        this.router = new Hono();
        this.MultipartUpload();
        this.UploadImagesOrFiles();
    }

    private MultipartUpload() {
        // Multipart upload
        this.router.post('/initiate', Middleware.authMiddleware, uploadController.initiateUpload)
        this.router.post('/chunk/file/:uploadId', Middleware.authMiddleware, uploadController.uploadChunk)
        this.router.post('/complete/file/:uploadId', Middleware.authMiddleware, uploadController.completeUpload)
        this.router.post('/abort/file/:uploadId', Middleware.authMiddleware, uploadController.abortUpload)
        this.router.get('/parts/file/:uploadId', Middleware.authMiddleware, uploadController.getPartsByUploadKey)
    }

    private UploadImagesOrFiles() {
        // Image upload (max 5 files)
        this.router.post('/file', Middleware.authMiddleware, uploadImageMiddleware, uploadController.uploadFile)
        this.router.get('/file/:fileName', Middleware.authMiddleware, uploadController.getFiles)
        this.router.delete('/file/:fileName', Middleware.authMiddleware, uploadController.deleteFile)
    }

    public getRouter() {
        return this.router;
    }
}