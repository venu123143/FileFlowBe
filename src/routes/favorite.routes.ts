import { Hono } from "hono";
import AuthMiddleware from "@/middleware/auth.middleware";
import favoriteController from "@/controllers/favorite.controller";
import { validateBody, validateParams, validateQuery } from "@/utils/validation";
import favoriteValidation from "@/validation/favorite.validation";

export class FavoriteRouter {
    private readonly router: Hono;

    constructor() {
        this.router = new Hono();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.use(AuthMiddleware.authMiddleware);

        this.router.post('/', validateBody(favoriteValidation.createFavoriteValidation), favoriteController.createFavorite);
        this.router.get('/', validateQuery(favoriteValidation.getFavoritesValidation), favoriteController.getFavorites);
        this.router.get('/file/:fileId', validateParams(favoriteValidation.favoriteFileIdValidation), favoriteController.getFavoriteByFileId);
        this.router.delete('/file/:fileId', validateParams(favoriteValidation.favoriteFileIdValidation), favoriteController.deleteFavoriteByFileId);
        this.router.get('/:favoriteId', validateParams(favoriteValidation.favoriteIdValidation), favoriteController.getFavoriteById);
        this.router.patch('/:favoriteId', validateParams(favoriteValidation.favoriteIdValidation), validateBody(favoriteValidation.updateFavoriteValidation), favoriteController.updateFavorite);
        this.router.delete('/:favoriteId', validateParams(favoriteValidation.favoriteIdValidation), favoriteController.deleteFavorite);
    }

    public getRouter() {
        return this.router;
    }
}
