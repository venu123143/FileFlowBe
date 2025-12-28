import { Hono } from "hono";
import AuthMiddleware from "@/middleware/auth.middleware";
import AuthController from "@/controllers/user.controller";
import TokenAuthController from "@/controllers/auth.controller";
import { validateBody, validateQuery } from '@/utils/validation';
import userDtoValidation from '@/validation/user.validation';
import authDtoValidation from '@/validation/auth.validation';

export class AuthRouter {
    /** Each router owns its own Hono instance */
    private readonly router: Hono;

    constructor() {
        this.router = new Hono();
        this.initializeRoutes();
        this.initializeAuthTokenRoutes();
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
        this.router.get('/user/get-session', AuthMiddleware.authMiddleware, AuthMiddleware.pinSessionMiddleware, AuthController.getSession);
    }

    /**
     * Initialize authentication token management routes
     * Handles refresh tokens, token revocation, and session management
     */
    private initializeAuthTokenRoutes() {
        // POST /auth/refresh - Refresh access token using refresh token
        this.router.post('/refresh', validateBody(authDtoValidation.refreshTokenValidation), TokenAuthController.refreshToken);

        // POST /auth/revoke - Revoke a specific refresh token (logout from single device)
        this.router.post('/revoke', validateBody(authDtoValidation.revokeTokenValidation), TokenAuthController.revokeToken);

        // POST /auth/revoke-all - Revoke all refresh tokens (logout from all devices)
        this.router.post('/revoke-all', AuthMiddleware.authMiddleware, TokenAuthController.revokeAllTokens);

        // GET /auth/sessions - Get all active sessions for the authenticated user
        this.router.get('/sessions', AuthMiddleware.authMiddleware, TokenAuthController.getActiveSessions);
    }

    public getRouter() {
        return this.router;
    }
}