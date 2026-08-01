import analyticsRepository from "@/repository/analytics.repository";
import { type AnalyticsEventType } from "@/core/analytics-queue";

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

/**
 * Process analytics event
 */
const processAnalyticsEvent = async (event: AnalyticsEvent): Promise<void> => {
    const { userId, eventType, metadata } = event;

    try {
        switch (eventType) {
            case 'file_uploaded':
                if (metadata.fileSize && metadata.fileType) {
                    await analyticsRepository.recordFileUpload(
                        userId,
                        metadata.fileSize,
                        metadata.fileType
                    );
                }
                break;

            case 'file_deleted':
                await analyticsRepository.recordFileDelete(userId);
                break;

            case 'folder_created':
                await analyticsRepository.recordFolderCreate(userId);
                break;

            case 'file_downloaded':
                await analyticsRepository.recordFileDownload(userId);
                break;

            case 'file_shared':
                await analyticsRepository.recordFileShare(userId);
                break;

            case 'public_link_created':
                await analyticsRepository.recordPublicLinkCreate(userId);
                break;

            default:
                console.warn(`Unknown analytics event type: ${eventType}`);
        }
    } catch (error: any) {
        console.error(`Error processing analytics event ${eventType}:`, error.message);
        throw error;
    }
};

/**
 * Get analytics summary for user
 */
const getAnalyticsSummary = async (userId: string) => {
    return await analyticsRepository.getAnalyticsSummary(userId);
};

/**
 * Get analytics by date range
 */
const getAnalyticsByDateRange = async (
    userId: string,
    startDate: Date,
    endDate: Date
) => {
    return await analyticsRepository.getAnalyticsByDateRange(userId, startDate, endDate);
};

/**
 * Get current storage overview
 */
const getCurrentStorageOverview = async (userId: string) => {
    const storage = await analyticsRepository.calculateUserStorage(userId);
    const todayAnalytics = await analyticsRepository.getTodaysAnalytics(userId);

    return {
        storage,
        todayActivity: {
            uploads: todayAnalytics.uploads_today,
            downloads: todayAnalytics.downloads_today,
            shares: todayAnalytics.shares_created_today,
            publicLinks: todayAnalytics.public_links_created_today
        }
    };
};

export default {
    processAnalyticsEvent,
    getAnalyticsSummary,
    getAnalyticsByDateRange,
    getCurrentStorageOverview
};

