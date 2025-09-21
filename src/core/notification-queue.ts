import { Queue, Worker, QueueEvents, type JobsOptions } from "bullmq";
import { type NotificationAttributes } from '@/models/Notification.model';
import config from "@/config/config";
import notificationService from "@/services/notification.service"

interface NotificationQueue {
    notification: NotificationAttributes;
}
const QUEUE_NAME = "fileflow-notification-queue";
// Shared Redis connection config
const connection = {
    url: config.REDIS_URL,
};
const defaultJobOptions: JobsOptions = {
    attempts: 5,
    backoff: {
        type: "exponential",
        delay: 5000, // retry after 5s, then grows exponentially
    },
    removeOnComplete: true,
    removeOnFail: 10, // keep last 10 failed jobs for debugging
    priority: 5,
    lifo: false,
};

// Notification queue
export const notificationQueue = new Queue<NotificationQueue>(QUEUE_NAME, {
    connection,
    defaultJobOptions,
});


export const addToNotificationQueue = (notification: NotificationAttributes) => {
    return notificationQueue.add('notification', { notification });
};

// Worker for processing notifications
const notificationWorker = new Worker<NotificationQueue>(QUEUE_NAME,
    async (job) => {
        const { notification } = job.data;
        try {
            const startTime = Date.now();
            // Send real-time notification via socket
            await notificationService.createNotification(notification);
            const duration = Date.now() - startTime;

            return { success: true, duration };

        } catch (error: any) {
            console.error(`Failed to process ${notification.type} notification:`, error.message);
            throw error;
        }
    },
    {
        connection,
        concurrency: 5
    }
);

// Queue events
const queueEvents = new QueueEvents(QUEUE_NAME, { connection });
// ✅ prevent MaxListenersExceededWarning
queueEvents.setMaxListeners(1);

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