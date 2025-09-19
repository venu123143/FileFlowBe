import { Hono } from "hono";
import Middleware from "@/middleware/auth.middleware";
import notificationController from "@/controllers/notification.controller";
import { validateQuery, validateParams } from "@/utils/validation";
import notificationValidation from "@/validation/notification.validation";

export class NotificationRouter {
    private readonly router: Hono;

    constructor() {
        this.router = new Hono();
        this.setupRoutes();
    }

    private setupRoutes() {
        // Get user notifications with pagination and filters
        this.router.get('/',
            Middleware.authMiddleware,
            validateQuery(notificationValidation.getNotificationsValidation),
            notificationController.getUserNotifications
        );

        // Get unread notifications count
        this.router.get('/unread-count',
            Middleware.authMiddleware,
            notificationController.getUnreadNotificationsCount
        );

        // Mark specific notification as read
        this.router.patch('/:notificationId/read',
            Middleware.authMiddleware,
            validateParams(notificationValidation.notificationIdValidation),
            notificationController.markNotificationAsRead
        );

        // Mark all notifications as read
        this.router.patch('/mark-all-read',
            Middleware.authMiddleware,
            notificationController.markAllNotificationsAsRead
        );
    }

    public getRouter() {
        return this.router;
    }
}