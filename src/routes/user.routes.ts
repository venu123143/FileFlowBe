import { Hono } from "hono";
import AuthMiddleware from "@/middleware/auth.middleware";
import AuthController from "@/controllers/user.controller";
import { validateBody, validateQuery } from '@/utils/validation';
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
        this.router.post('/logout', AuthMiddleware.authMiddleware, AuthController.logout);
        this.router.post('/logout-all', AuthMiddleware.authMiddleware, AuthController.logoutAll);
        this.router.get('/user/all', AuthMiddleware.authMiddleware, validateQuery(userDtoValidation.getAllUsersValidation), AuthController.getAllUsers);
        this.router.post('/user/verify-pin', AuthMiddleware.authMiddleware, validateBody(userDtoValidation.verifyPinValidation), AuthController.verifyPin);
        this.router.post('/user/set-pin', AuthMiddleware.authMiddleware, validateBody(userDtoValidation.setPinValidation), AuthController.setPin);
        this.router.put('/user/change-pin', AuthMiddleware.authMiddleware, validateBody(userDtoValidation.changePinValidation), AuthController.changePin);
        this.router.get('/user/get-session',AuthMiddleware.authMiddleware, AuthMiddleware.pinSessionMiddleware, AuthController.getSession);
    }

    public getRouter() {
        return this.router;
    }
}