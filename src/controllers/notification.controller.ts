import { type Context } from "hono"
import res from "@/utils/response"
import notificationRepository from "@/repository/notification.repository"
import type { IUserAttributes } from "@/models/User.model"
import type { NotificationAttributes } from "@/models/Notification.model"

const getUserNotifications = async (c: Context) => {
    try {
        const user = c.get("user") as IUserAttributes
        if (!user?.id) {
            return res.FailureResponse(c, 400, { message: "User not found" })
        }

        const validatedQuery = c.get('validatedQuery') as {
            limit?: number
            offset?: number
            unreadOnly?: boolean
        }

        const { limit = 20, offset = 0, unreadOnly = false } = validatedQuery

        const result = await notificationRepository.getUserNotifications(
            user.id,
            limit,
            offset,
            unreadOnly
        )

        return res.SuccessResponse(c, 200, {
            message: "Notifications retrieved successfully",
            data: {
                notifications: result.notifications,
                totalCount: result.totalCount,
                hasMore: (offset + limit) < result.totalCount
            },
        })
    } catch (error: any) {
        return res.FailureResponse(c, 500, {
            message: "Failed to retrieve notifications",
            error: error.message,
        })
    }
}

const markNotificationAsRead = async (c: Context) => {
    try {
        const user = c.get("user") as IUserAttributes
        if (!user?.id) {
            return res.FailureResponse(c, 400, { message: "User not found" })
        }

        const validatedParams = c.get('validatedParams') as { notificationId: string }
        const { notificationId } = validatedParams

        const success = await notificationRepository.markNotificationAsRead(notificationId, user.id)

        if (!success) {
            return res.FailureResponse(c, 404, {
                message: "Notification not found or already read"
            })
        }

        return res.SuccessResponse(c, 200, {
            message: "Notification marked as read successfully",
            data: { notificationId },
        })
    } catch (error: any) {
        return res.FailureResponse(c, 500, {
            message: "Failed to mark notification as read",
            error: error.message,
        })
    }
}

const markAllNotificationsAsRead = async (c: Context) => {
    try {
        const user = c.get("user") as IUserAttributes
        if (!user?.id) {
            return res.FailureResponse(c, 400, { message: "User not found" })
        }

        const updatedCount = await notificationRepository.markAllNotificationsAsRead(user.id)

        return res.SuccessResponse(c, 200, {
            message: "All notifications marked as read successfully",
            data: { updatedCount },
        })
    } catch (error: any) {
        return res.FailureResponse(c, 500, {
            message: "Failed to mark all notifications as read",
            error: error.message,
        })
    }
}

const getUnreadNotificationsCount = async (c: Context) => {
    try {
        const user = c.get("user") as IUserAttributes
        if (!user?.id) {
            return res.FailureResponse(c, 400, { message: "User not found" })
        }

        const count = await notificationRepository.getUnreadNotificationsCount(user.id)

        return res.SuccessResponse(c, 200, {
            message: "Unread count retrieved successfully",
            data: { count },
        })
    } catch (error: any) {
        return res.FailureResponse(c, 500, {
            message: "Failed to retrieve unread count",
            error: error.message,
        })
    }
}

export default {
    getUserNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    getUnreadNotificationsCount,
}