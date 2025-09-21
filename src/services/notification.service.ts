import { Notification, type NotificationAttributes } from '@/models/Notification.model';
import socketService from '@/services/socket.service';

/**
 * Format file size in human readable format
 */
function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Create a new notification and send it in real time.
 */
async function createNotification(params: NotificationAttributes): Promise<Notification> {
    const notification = await Notification.create(params, { returning: true, raw: true });
    await socketService.sendNotification(notification.user_id, notification.toJSON());
    return notification;
}


export default {
    formatFileSize,
    createNotification
}