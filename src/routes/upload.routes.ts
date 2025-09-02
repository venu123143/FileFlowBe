import { Hono } from "hono";
import Middleware from "@/middleware/auth.middleware";
import { uploadImageMiddleware } from '@/middleware/multer.middleware' // rewritten for Hono/Bun
import uploadController from "@/controllers/upload.controller";
import { validateBody, validateQuery, validateParams } from "@/utils/validation";
import uploadValidation from "@/validation/upload.validation";

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
        this.router.post('/initiate', 
            Middleware.authMiddleware, 
            validateBody(uploadValidation.initiateUploadValidation), 
            uploadController.initiateUpload
        )
        this.router.post('/chunk/file/:uploadId', 
            Middleware.authMiddleware, 
            validateParams(uploadValidation.uploadIdValidation),
            uploadController.uploadChunk
        )
        this.router.post('/complete/file/:uploadId', 
            Middleware.authMiddleware, 
            validateParams(uploadValidation.uploadIdValidation),
            validateBody(uploadValidation.completeUploadValidation), 
            uploadController.completeUpload
        )
        this.router.post('/abort/file/:uploadId', 
            Middleware.authMiddleware, 
            validateParams(uploadValidation.uploadIdValidation),
            validateBody(uploadValidation.abortUploadValidation), 
            uploadController.abortUpload
        )
        this.router.get('/parts/file/:uploadId', 
            Middleware.authMiddleware, 
            validateParams(uploadValidation.uploadIdValidation),
            validateQuery(uploadValidation.getPartsValidation), 
            uploadController.getPartsByUploadKey
        )
    }

    private UploadImagesOrFiles() {
        // Image upload (max 5 files)
        this.router.post('/file', 
            Middleware.authMiddleware, 
            uploadImageMiddleware, 
            uploadController.uploadFile
        )
        this.router.get('/file/:fileName', 
            Middleware.authMiddleware, 
            validateParams(uploadValidation.fileNameValidation),
            uploadController.getFiles
        )
        this.router.delete('/file/:fileName', 
            Middleware.authMiddleware, 
            validateParams(uploadValidation.fileNameValidation),
            uploadController.deleteFile
        )
    }

    public getRouter() {
        return this.router;
    }
}