import { Hono } from "hono";
import AuthMiddleware from "@/middleware/auth.middleware";
import FileController from "@/controllers/file.controller";
import { validateBody } from "@/utils/validation";
import fileDtoValidation from "@/validation/file.validation";

export class FileRouter {
    /** Each router owns its own Hono instance */
    private readonly router: Hono;

    constructor() {
        this.router = new Hono();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        // Apply authentication middleware to all routes
        this.router.use(AuthMiddleware.authMiddleware);

        this.router.post('/folder', validateBody(fileDtoValidation.createFolderValidation), FileController.createFolder);
        this.router.patch('/folder/:id/rename', validateBody(fileDtoValidation.renameFolderValidation), FileController.renameFolder);
        this.router.patch('/folder/:id/move', validateBody(fileDtoValidation.moveFileValidation), FileController.moveFileOrFolder);
        this.router.post('/file', validateBody(fileDtoValidation.createFileValidation), FileController.createFile);
        this.router.post('/share/file/:id',validateBody(fileDtoValidation.shareFileValidation), FileController.shareFileOrFolder);
        this.router.get('/share/file/all-shared-files', FileController.getAllSharedFiles);
        this.router.get('/share/file/shared-by-me', FileController.getAllSharedFilesByMe);
        this.router.get('/share/file/shared-with-me', FileController.getAllSharedFilesWithMe);
        this.router.get('/file-system-tree', FileController.getFileSystemTree);
        this.router.get('/trash', FileController.getTrash);
        this.router.post('/file/:id/restore', FileController.restoreFileOrFolder);
        this.router.delete('/file/:id', FileController.deleteFileOrFolder);
    }

    public getRouter() {
        return this.router;
    }
}
