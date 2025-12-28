import db from "@/config/database"
import type { NotificationAttributes } from "@/models/Notification.model"
import { Op } from "sequelize"

/**
 * Get user notifications with cursor-based pagination and filtering
 */
async function getUserNotifications(
    userId: string,
    limit: number = 20,
    cursor?: string,
    unreadOnly: boolean = false
) {
    const whereClause: any = {
        user_id: userId
    }

    if (unreadOnly) {
        whereClause.is_read = false
    }

    // If cursor is provided, parse it and add to where clause
    if (cursor) {
        try {
            const decodedCursor = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'))
            const { created_at, id } = decodedCursor

            // For DESC ordering, we want records BEFORE the cursor
            // Using composite comparison: (created_at, id) < (cursor_created_at, cursor_id)
            whereClause[Op.or] = [
                { created_at: { [Op.lt]: created_at } },
                {
                    [Op.and]: [
                        { created_at: created_at },
                        { id: { [Op.lt]: id } }
                    ]
                }
            ]
        } catch (error) {
            // Invalid cursor, ignore it and start from beginning
            console.error('Invalid cursor format:', error)
        }
    }

    // Fetch one extra record to determine if there are more pages
    const rows = await db.Notification.findAll({
        where: whereClause,
        order: [
            ['created_at', 'DESC'],
            ['id', 'DESC']
        ],
        limit: limit + 1,
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

    // Check if there are more records
    const hasMore = rows.length > limit

    // Remove the extra record if it exists
    const notifications = hasMore ? rows.slice(0, limit) : rows

    // Generate next cursor from the last record
    let nextCursor: string | null = null
    if (hasMore && notifications.length > 0) {
        const lastRecord = notifications[notifications.length - 1]
        if (lastRecord) {
            const cursorData = {
                created_at: lastRecord.created_at,
                id: lastRecord.id
            }
            nextCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64')
        }
    }

    return {
        notifications,
        nextCursor,
        hasMore
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