import { Notification, NotificationType, type NotificationCreationAttributes } from '@/models/Notification.model';
import socketService from './socket.service';
import type { IFileInfo } from '@/models';

interface CreateNotificationParams {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    fileId?: string;
    relatedUserId?: string;
    data?: Record<string, any>;
}

interface FileUploadNotificationData {
    fileName: string;
    fileSize: number;
    fileType: string;
    uploadType: 'single' | 'multipart';
    error?: string;
}

class NotificationService {
    /**
     * Create a new notification
     */
    public async createNotification(params: CreateNotificationParams): Promise<Notification> {
        try {
            const notification = await Notification.create({
                user_id: params.userId,
                type: params.type,
                title: params.title,
                message: params.message,
                file_id: params.fileId,
                related_user_id: params.relatedUserId,
                data: params.data || {},
            });

            // Send real-time notification
            await this.sendRealTimeNotification(notification);

            return notification;
        } catch (error) {
            console.error('Error creating notification:', error);
            throw new Error('Failed to create notification');
        }
    }

    /**
     * Send real-time notification via Socket.IO
     */
    private async sendRealTimeNotification(notification: Notification): Promise<void> {
        const payload = {
            id: notification.id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            data: notification.data,
            created_at: notification.created_at,
            file_id: notification.file_id,
        };
        console.log(payload)
        // await socketService.sendNotificationToUser(notification.user_id, payload);
    }

    /**
     * Create file upload success notification
     */
    public async createFileUploadSuccessNotification(
        userId: string,
        fileInfo: IFileInfo & { fileName?: string },
        uploadType: 'single' | 'multipart' = 'single'
    ): Promise<Notification> {
        const fileName = fileInfo.fileName || fileInfo.storage_path.split('/').pop() || 'Unknown file';
        const fileSize = this.formatFileSize(fileInfo.file_size);

        const notificationData: FileUploadNotificationData = {
            fileName,
            fileSize: fileInfo.file_size,
            fileType: fileInfo.file_type,
            uploadType,
        };

        const type = uploadType === 'multipart'
            ? NotificationType.MULTIPART_UPLOAD_COMPLETED
            : NotificationType.FILE_UPLOAD_COMPLETED;

        return await this.createNotification({
            userId,
            type,
            title: 'File Upload Completed',
            message: `"${fileName}" (${fileSize}) has been uploaded successfully.`,
            data: notificationData,
        });
    }

    /**
     * Create file upload failure notification
     */
    public async createFileUploadFailureNotification(
        userId: string,
        fileName: string,
        error: string,
        uploadType: 'single' | 'multipart' = 'single',
        fileInfo?: Partial<IFileInfo>
    ): Promise<Notification> {
        const notificationData: FileUploadNotificationData = {
            fileName,
            fileSize: fileInfo?.file_size || 0,
            fileType: fileInfo?.file_type || 'unknown',
            uploadType,
            error,
        };

        const type = uploadType === 'multipart'
            ? NotificationType.MULTIPART_UPLOAD_FAILED
            : NotificationType.FILE_UPLOAD_FAILED;

        return await this.createNotification({
            userId,
            type,
            title: 'File Upload Failed',
            message: `Failed to upload "${fileName}". ${error}`,
            data: notificationData,
        });
    }

    /**
     * Create file deletion notification
     */
    public async createFileDeletedNotification(
        userId: string,
        fileName: string,
        fileId?: string
    ): Promise<Notification> {
        return await this.createNotification({
            userId,
            type: NotificationType.FILE_DELETED,
            title: 'File Deleted',
            message: `"${fileName}" has been deleted successfully.`,
            fileId,
            data: { fileName },
        });
    }

    /**
     * Create storage quota warning notification
     */
    public async createStorageQuotaWarningNotification(
        userId: string,
        usedPercentage: number,
        totalStorage: string
    ): Promise<Notification> {
        return await this.createNotification({
            userId,
            type: NotificationType.STORAGE_QUOTA_WARNING,
            title: 'Storage Quota Warning',
            message: `You have used ${usedPercentage}% of your ${totalStorage} storage quota.`,
            data: { usedPercentage, totalStorage },
        });
    }

    /**
     * Get notifications for a user
     */
    public async getUserNotifications(
        userId: string,
        limit: number = 20,
        offset: number = 0,
        unreadOnly: boolean = false
    ): Promise<{ notifications: Notification[]; totalCount: number }> {
        const whereClause: any = { user_id: userId };

        if (unreadOnly) {
            whereClause.is_read = false;
        }

        const [notifications, totalCount] = await Promise.all([
            Notification.findAll({
                where: whereClause,
                order: [['created_at', 'DESC']],
                limit,
                offset,
            }),
            Notification.count({ where: whereClause }),
        ]);

        return { notifications, totalCount };
    }

    /**
     * Mark notification as read
     */
    public async markAsRead(notificationId: string, userId: string): Promise<boolean> {
        try {
            const [updatedCount] = await Notification.update(
                { is_read: true },
                {
                    where: {
                        id: notificationId,
                        user_id: userId,
                        is_read: false,
                    },
                }
            );

            return updatedCount > 0;
        } catch (error) {
            console.error('Error marking notification as read:', error);
            return false;
        }
    }

    /**
     * Mark all notifications as read for a user
     */
    public async markAllAsRead(userId: string): Promise<number> {
        try {
            const [updatedCount] = await Notification.update(
                { is_read: true },
                {
                    where: {
                        user_id: userId,
                        is_read: false,
                    },
                }
            );

            return updatedCount;
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
            return 0;
        }
    }

    /**
     * Get unread notifications count
     */
    public async getUnreadCount(userId: string): Promise<number> {
        try {
            return await Notification.count({
                where: {
                    user_id: userId,
                    is_read: false,
                },
            });
        } catch (error) {
            console.error('Error getting unread count:', error);
            return 0;
        }
    }

    /**
     * Delete old notifications (cleanup job)
     */
    public async cleanupOldNotifications(daysOld: number = 30): Promise<number> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            const deletedCount = await Notification.destroy({
                where: {
                    created_at: {
                        $lt: cutoffDate,
                    },
                    is_read: true,
                },
            });

            console.log(`Cleaned up ${deletedCount} old notifications`);
            return deletedCount;
        } catch (error) {
            console.error('Error cleaning up old notifications:', error);
            return 0;
        }
    }

    /**
     * Format file size in human readable format
     */
    private formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Send bulk notifications (for system announcements)
     */
    public async sendBulkNotification(
        userIds: string[],
        type: NotificationType,
        title: string,
        message: string,
        data?: Record<string, any>
    ): Promise<Notification[]> {
        try {
            const notifications = await Promise.all(
                userIds.map(userId =>
                    this.createNotification({
                        userId,
                        type,
                        title,
                        message,
                        data,
                    })
                )
            );

            return notifications;
        } catch (error) {
            console.error('Error sending bulk notifications:', error);
            throw new Error('Failed to send bulk notifications');
        }
    }
}

export default new NotificationService();