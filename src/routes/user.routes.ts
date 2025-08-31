import { Hono } from "hono";
import AuthMiddleware from "@/middleware/auth.middleware";
import AuthController from "@/controllers/user.controller";
import { validateBody } from '@/utils/validation';
import userDtoValidation from '@/validation/user.validation';

export class AuthRouter {
    /** Each router owns its own Hono instance */
    private readonly router: Hono;

    constructor() {
        this.router = new Hono();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.post('/signup', validateBody(userDtoValidation.signupValidation), AuthController.Signup);
        this.router.post('/login', validateBody(userDtoValidation.loginValidation), AuthController.Login);
        // this.router.put('/update-profile', AuthMiddleware.authMiddleware, validateBody(updateProfileSchema), AuthController.updateProfile);
        // this.router.post('/logout', AuthMiddleware.authMiddleware, AuthController.logout);
        // this.router.post('/logout-all', AuthMiddleware.authMiddleware, AuthController.logoutAll);
        // this.router.get('/user/:id', AuthController.getUser);
    }

    public getRouter() {
        return this.router;
    }
}