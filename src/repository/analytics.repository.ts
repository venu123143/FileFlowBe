import { StorageAnalytics, type StorageAnalyticsAttributes } from "@/models/StorageAnalytics.model";
import { File } from "@/models/File.model";
import { Op } from "sequelize";

/**
 * Get or create today's analytics record for a user
 */
const getTodaysAnalytics = async (userId: string, date: Date = new Date()): Promise<StorageAnalytics> => {
    const today = new Date(date);
    today.setHours(0, 0, 0, 0); // Start of day

    const [analytics] = await StorageAnalytics.findOrCreate({
        where: {
            user_id: userId,
            date: today
        },
        defaults: {
            user_id: userId,
            date: today,
            total_files: 0,
            total_folders: 0,
            total_size: 0,
            images_count: 0,
            images_size: 0,
            videos_count: 0,
            videos_size: 0,
            audio_count: 0,
            audio_size: 0,
            documents_count: 0,
            documents_size: 0,
            other_count: 0,
            other_size: 0,
            uploads_today: 0,
            downloads_today: 0,
            shares_created_today: 0,
            public_links_created_today: 0,
        }
    });

    return analytics;
};

/**
 * Calculate total storage used by user
 */
const calculateUserStorage = async (userId: string): Promise<{
    totalFiles: number;
    totalFolders: number;
    totalSize: number;
    imageCount: number;
    imageSize: number;
    videoCount: number;
    videoSize: number;
    audioCount: number;
    audioSize: number;
    documentCount: number;
    documentSize: number;
    otherCount: number;
    otherSize: number;
}> => {
    const files = await File.findAll({
        where: {
            owner_id: userId,
            deleted_at: null
        },
        attributes: ['is_folder', 'file_info']
    });

    let totalFiles = 0;
    let totalFolders = 0;
    let totalSize = 0;
    let imageCount = 0;
    let imageSize = 0;
    let videoCount = 0;
    let videoSize = 0;
    let audioCount = 0;
    let audioSize = 0;
    let documentCount = 0;
    let documentSize = 0;
    let otherCount = 0;
    let otherSize = 0;

    files.forEach(file => {
        if (file.is_folder) {
            totalFolders++;
        } else {
            totalFiles++;
            const fileInfo = file.file_info;
            if (fileInfo) {
                const size = fileInfo.file_size || 0;
                const type = fileInfo.file_type || '';

                totalSize += size;

                // Categorize by type
                if (type.startsWith('image/')) {
                    imageCount++;
                    imageSize += size;
                } else if (type.startsWith('video/')) {
                    videoCount++;
                    videoSize += size;
                } else if (type.startsWith('audio/')) {
                    audioCount++;
                    audioSize += size;
                } else if (
                    type === 'application/pdf' ||
                    type.includes('document') ||
                    type.includes('text') ||
                    type.includes('sheet') ||
                    type.includes('presentation')
                ) {
                    documentCount++;
                    documentSize += size;
                } else {
                    otherCount++;
                    otherSize += size;
                }
            }
        }
    });

    return {
        totalFiles,
        totalFolders,
        totalSize,
        imageCount,
        imageSize,
        videoCount,
        videoSize,
        audioCount,
        audioSize,
        documentCount,
        documentSize,
        otherCount,
        otherSize
    };
};

/**
 * Update analytics for file upload
 */
const recordFileUpload = async (userId: string, fileSize: number, fileType: string): Promise<void> => {
    const analytics = await getTodaysAnalytics(userId);
    const storage = await calculateUserStorage(userId);

    const updates: Partial<StorageAnalyticsAttributes> = {
        uploads_today: analytics.uploads_today + 1,
        total_files: storage.totalFiles,
        total_folders: storage.totalFolders,
        total_size: storage.totalSize,
        images_count: storage.imageCount,
        images_size: storage.imageSize,
        videos_count: storage.videoCount,
        videos_size: storage.videoSize,
        audio_count: storage.audioCount,
        audio_size: storage.audioSize,
        documents_count: storage.documentCount,
        documents_size: storage.documentSize,
        other_count: storage.otherCount,
        other_size: storage.otherSize,
    };

    await analytics.update(updates);
};

/**
 * Update analytics for file deletion
 */
const recordFileDelete = async (userId: string): Promise<void> => {
    const analytics = await getTodaysAnalytics(userId);
    const storage = await calculateUserStorage(userId);

    const updates: Partial<StorageAnalyticsAttributes> = {
        total_files: storage.totalFiles,
        total_folders: storage.totalFolders,
        total_size: storage.totalSize,
        images_count: storage.imageCount,
        images_size: storage.imageSize,
        videos_count: storage.videoCount,
        videos_size: storage.videoSize,
        audio_count: storage.audioCount,
        audio_size: storage.audioSize,
        documents_count: storage.documentCount,
        documents_size: storage.documentSize,
        other_count: storage.otherCount,
        other_size: storage.otherSize,
    };

    await analytics.update(updates);
};

/**
 * Update analytics for folder creation
 */
const recordFolderCreate = async (userId: string): Promise<void> => {
    const analytics = await getTodaysAnalytics(userId);
    const storage = await calculateUserStorage(userId);

    await analytics.update({
        total_folders: storage.totalFolders,
    });
};

/**
 * Update analytics for file download
 */
const recordFileDownload = async (userId: string): Promise<void> => {
    const analytics = await getTodaysAnalytics(userId);
    await analytics.increment('downloads_today');
};

/**
 * Update analytics for file share
 */
const recordFileShare = async (userId: string): Promise<void> => {
    const analytics = await getTodaysAnalytics(userId);
    await analytics.increment('shares_created_today');
};

/**
 * Update analytics for public link creation
 */
const recordPublicLinkCreate = async (userId: string): Promise<void> => {
    const analytics = await getTodaysAnalytics(userId);
    await analytics.increment('public_links_created_today');
};

/**
 * Get analytics for a specific date range
 */
const getAnalyticsByDateRange = async (
    userId: string,
    startDate: Date,
    endDate: Date
): Promise<StorageAnalytics[]> => {
    return await StorageAnalytics.findAll({
        where: {
            user_id: userId,
            date: {
                [Op.between]: [startDate, endDate]
            }
        },
        order: [['date', 'ASC']]
    });
};

/**
 * Get latest analytics for a user
 */
const getLatestAnalytics = async (userId: string): Promise<StorageAnalytics | null> => {
    return await StorageAnalytics.findOne({
        where: {
            user_id: userId
        },
        order: [['date', 'DESC']]
    });
};

/**
 * Get analytics summary (last 30 days)
 */
const getAnalyticsSummary = async (userId: string): Promise<{
    current: StorageAnalytics | null;
    last30Days: StorageAnalytics[];
    totalUploads: number;
    totalDownloads: number;
    totalShares: number;
}> => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const [current, last30Days] = await Promise.all([
        getTodaysAnalytics(userId),
        getAnalyticsByDateRange(userId, thirtyDaysAgo, today)
    ]);

    const totalUploads = last30Days.reduce((sum, day) => sum + day.uploads_today, 0);
    const totalDownloads = last30Days.reduce((sum, day) => sum + day.downloads_today, 0);
    const totalShares = last30Days.reduce((sum, day) => sum + day.shares_created_today, 0);

    return {
        current,
        last30Days,
        totalUploads,
        totalDownloads,
        totalShares
    };
};

export default {
    getTodaysAnalytics,
    calculateUserStorage,
    recordFileUpload,
    recordFileDelete,
    recordFolderCreate,
    recordFileDownload,
    recordFileShare,
    recordPublicLinkCreate,
    getAnalyticsByDateRange,
    getLatestAnalytics,
    getAnalyticsSummary
};

