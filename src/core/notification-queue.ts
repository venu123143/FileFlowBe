import { Queue, Worker, QueueEvents } from 'bullmq';
import { type NotificationAttributes } from '@/models/Notification.model';
import config from "@/config/config";
import notificationService from "@/services/notification.service"

interface NotificationQueue {
    notification: NotificationAttributes;
}

// Notification queue
export const notificationQueue = new Queue<NotificationQueue>('fileflow-notification-queue', {
    connection: {
        url: config.REDIS_URL
    },
    defaultJobOptions: {
        attempts: 5,
        backoff: {
            type: 'exponential',
            delay: 5000
        },
        removeOnComplete: true,
        removeOnFail: true,
        priority: 5,
        lifo: false
    }
});

export const addToNotificationQueue = (notification: NotificationAttributes) => {
    notificationQueue.add('notification', { notification });
};

// Worker for processing notifications
const notificationWorker = new Worker<NotificationQueue>('fileflow-notification-queue',
    async (job) => {
        const { notification } = job.data;

        try {
            const startTime = Date.now();
            // Send real-time notification via socket
            await notificationService.createNotification(notification);
            const duration = Date.now() - startTime;
            console.log(`Notification job ${job.id} (${notification.type}) completed in ${duration}ms`);

            return { success: true, duration };

        } catch (error: any) {
            console.error(`Failed to process ${notification.type} notification:`, error.message);
            throw error;
        }
    },
    {
        connection: {
            url: config.REDIS_URL
        },
        concurrency: 5
    }
);

// Queue events
const queueEvents = new QueueEvents('fileflow-notification-queue', {
    connection: {
        url: config.REDIS_URL
    }
});

// Event handlers
queueEvents.on('completed', ({ jobId }) => {
    console.log(`Notification job ${jobId} completed successfully`);
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
    console.error(`Notification job ${jobId} failed with error: ${failedReason}`);
});

notificationWorker.on('error', (error) => {
    console.error('Notification worker error:', error);
});