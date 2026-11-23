import { type Context } from "hono";
import res from "@/utils/response";
import analyticsService from "@/services/analytics.service";
import type { IUserAttributes } from "@/models/User.model";

/**
 * Get analytics summary (last 30 days)
 */
const getAnalyticsSummary = async (c: Context) => {
    try {
        const user = c.get('user') as IUserAttributes;
        const summary = await analyticsService.getAnalyticsSummary(user.id);

        return res.SuccessResponse(c, 200, {
            message: "Analytics summary retrieved successfully",
            data: summary
        });
    } catch (error: any) {
        console.error('Error getting analytics summary:', error);
        return res.FailureResponse(c, 500, {
            message: "Failed to retrieve analytics summary",
            error: error.message
        });
    }
};

/**
 * Get analytics by date range
 */
const getAnalyticsByDateRange = async (c: Context) => {
    try {
        const user = c.get('user') as IUserAttributes;
        const startDateStr = c.req.query('startDate');
        const endDateStr = c.req.query('endDate');

        if (!startDateStr || !endDateStr) {
            return res.FailureResponse(c, 400, {
                message: "startDate and endDate are required"
            });
        }

        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.FailureResponse(c, 400, {
                message: "Invalid date format. Use ISO 8601 format (YYYY-MM-DD)"
            });
        }

        const analytics = await analyticsService.getAnalyticsByDateRange(
            user.id,
            startDate,
            endDate
        );

        return res.SuccessResponse(c, 200, {
            message: "Analytics retrieved successfully",
            data: analytics
        });
    } catch (error: any) {
        console.error('Error getting analytics by date range:', error);
        return res.FailureResponse(c, 500, {
            message: "Failed to retrieve analytics",
            error: error.message
        });
    }
};

/**
 * Get current storage overview
 */
const getStorageOverview = async (c: Context) => {
    try {
        const user = c.get('user') as IUserAttributes;
        const overview = await analyticsService.getCurrentStorageOverview(user.id);

        return res.SuccessResponse(c, 200, {
            message: "Storage overview retrieved successfully",
            data: {
                ...overview,
                storageQuota: user.storage_quota,
                storageUsed: overview.storage.totalSize,
                storageRemaining: user.storage_quota - overview.storage.totalSize,
                storageUsedPercentage: ((overview.storage.totalSize / user.storage_quota) * 100).toFixed(2)
            }
        });
    } catch (error: any) {
        console.error('Error getting storage overview:', error);
        return res.FailureResponse(c, 500, {
            message: "Failed to retrieve storage overview",
            error: error.message
        });
    }
};

export default {
    getAnalyticsSummary,
    getAnalyticsByDateRange,
    getStorageOverview
};

