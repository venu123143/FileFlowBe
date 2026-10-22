import { Queue, Worker, QueueEvents, type JobsOptions } from "bullmq";
import config from "@/config/config";
import analyticsService from "@/services/analytics.service"

export enum AnalyticsEventType {
    FILE_UPLOADED = 'file_uploaded',
    FILE_DELETED = 'file_deleted',
    FILE_DOWNLOADED = 'file_downloaded',
    FILE_SHARED = 'file_shared',
    PUBLIC_LINK_CREATED = 'public_link_created',
    FOLDER_CREATED = 'folder_created',
}

interface AnalyticsEvent {
    userId: string;
    eventType: AnalyticsEventType;
    metadata: {
        fileSize?: number;
        fileType?: string;
        fileName?: string;
        isFolder?: boolean;
        [key: string]: any;
    };
}

interface AnalyticsQueue {
    event: AnalyticsEvent;
}

const QUEUE_NAME = "fileflow-analytics-queue";

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

// Analytics queue
export const analyticsQueue = new Queue<AnalyticsQueue>(QUEUE_NAME, {
    connection,
    defaultJobOptions,
});

export const addToAnalyticsQueue = (event: AnalyticsEvent) => {
    return analyticsQueue.add('analytics-event', { event });
};

// Worker for processing analytics
const analyticsWorker = new Worker<AnalyticsQueue>(
    QUEUE_NAME,
    async (job) => {
        const { event } = job.data;
        try {
            const startTime = Date.now();
            
            // Process analytics event
            await analyticsService.processAnalyticsEvent(event);
            
            const duration = Date.now() - startTime;
            return { success: true, duration };

        } catch (error: any) {
            console.error(`Failed to process ${event.eventType} analytics event:`, error.message);
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
    console.log(`Analytics job ${jobId} completed successfully`);
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
    console.error(`Analytics job ${jobId} failed with error: ${failedReason}`);
});

analyticsWorker.on('error', (error) => {
    console.error('Analytics worker error:', error);
});

