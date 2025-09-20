import db from "@/config/database"
import type { NotificationAttributes } from "@/models/Notification.model"

/**
 * Get user notifications with pagination and filtering
 */
async function getUserNotifications(
    userId: string,
    limit: number = 20,
    offset: number = 0,
    unreadOnly: boolean = false
) {
    const whereClause: any = {
        user_id: userId
    }

    if (unreadOnly) {
        whereClause.is_read = false
    }

    const { count, rows } = await db.Notification.findAndCountAll({
        where: whereClause,
        order: [['created_at', 'DESC']],
        limit,
        offset,
        attributes: [
            'id',
            'user_id',
            'type',
            'title',
            'message',
            'file_id',
            'related_user_id',
            'is_read',
            'created_at',
            'data'
        ]
    })

    return {
        notifications: rows,
        totalCount: count
    }
}

/**
 * Mark a specific notification as read
 */
async function markNotificationAsRead(notificationId: string, userId: string): Promise<boolean> {
    const [updatedCount] = await db.Notification.update(
        { is_read: true },
        {
            where: {
                id: notificationId,
                user_id: userId
            }
        }
    )

    return updatedCount > 0
}

/**
 * Mark all notifications as read for a user
 */
async function markAllNotificationsAsRead(userId: string): Promise<number> {
    const [updatedCount] = await db.Notification.update(
        { is_read: true },
        {
            where: {
                user_id: userId,
                is_read: false
            }
        }
    )

    return updatedCount
}

/**
 * Get count of unread notifications for a user
 */
async function getUnreadNotificationsCount(userId: string): Promise<number> {
    const count = await db.Notification.count({
        where: {
            user_id: userId,
            is_read: false
        }
    })

    return count
}

export default {
    getUserNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    getUnreadNotificationsCount,
}