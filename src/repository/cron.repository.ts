import db from "@/config/database"
import { Op } from "sequelize";
import constants from "@/global/constants";
import s3Service from "@/config/s3.config";
import fileService from "@/services/file.service";

async function removeAllExpiredTokens() {
    const expirationTime = new Date();
    expirationTime.setDate(expirationTime.getDate() - constants.FILE_TRASH_EXPIRY_TIME);

    const count = await db.UserSession.destroy({
        where: {
            expires_at: {
                [Op.lt]: expirationTime, // Expired before cutoff
            },
        },
    });

    return count; // Returns number of deleted records
}


async function removeAllExpiredShares() {
    const now = new Date();

    const count = await db.Share.destroy({
        where: {
            expires_at: {
                [Op.lt]: now, // Expired already
            },
        },
    });

    return count; // Returns number of deleted records
}

/**
 * Recursively find all descendant file IDs of a parent folder
 */
async function getAllChildFileIds(parentIds: string[]): Promise<string[]> {
    const children = await db.File.findAll({
        where: {
            parent_id: {
                [Op.in]: parentIds,
            },
        },
        attributes: ["id"],
        raw: true,
    });

    if (!children.length) return [];

    const childIds = children.map(c => c.id);
    const grandChildIds = await getAllChildFileIds(childIds);

    return [...childIds, ...grandChildIds];
}

/**
 * Remove all files/folders that have been in trash for > 30 days
 */
async function removeOldDeletedFiles(): Promise<string[]> {
    const cutoffDate = new Date();

    cutoffDate.setDate(cutoffDate.getDate() - constants.FILE_TRASH_EXPIRY_TIME);

    // 1. Get all root files/folders that are expired in trash
    const expiredFiles = await db.File.findAll({
        where: {
            deleted_at: {
                [Op.lt]: cutoffDate,
            },
        },
        attributes: ["id"],
        paranoid: false,
        raw: true,
    });

    if (!expiredFiles.length) {
        return [];
    }

    // 2. Get root IDs
    const rootIds: string[] = expiredFiles.map((file) => file.id);

    // 3. Get all children recursively
    const childIds = await getAllChildFileIds(rootIds);

    // 4. Combine roots + children and remove duplicates
    const allToDelete: string[] = [
        ...new Set([...rootIds, ...childIds]),
    ];

    console.log(`[${fileService.getISTTime()}] Found ${rootIds.length} expired root items and ${childIds.length} child items`);

    // 5. Get only actual files for S3 deletion
    const filesToDelete = await db.File.findAll({
        where: {
            id: {
                [Op.in]: allToDelete,
            },
            is_folder: false,
        },
        attributes: ["file_info"],
        paranoid: false,
        raw: true,
    });

    // 6. Extract S3 storage paths
    const s3Keys = filesToDelete.map((file) => file.file_info?.storage_path).filter(Boolean) as string[];

    // 7. Delete physical files from S3/storage
    if (s3Keys.length) {
        await s3Service.deleteFiles(s3Keys);

        console.log(`[${fileService.getISTTime()}] Deleted ${s3Keys.length} files from storage`);
    }

    // 8. Permanently delete ALL database records
    //    This includes both files AND folders.
    const deletedCount = await db.File.destroy({
        where: {
            id: {
                [Op.in]: allToDelete,
            },
        },
        force: true,
    });

    console.log(`[${fileService.getISTTime()}] Permanently deleted ${deletedCount} database records`);

    return allToDelete;
}

async function removeOldReadNotifications() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);

    const result = await db.Notification.destroy({
        where: {
            created_at: {
                [Op.lt]: cutoffDate,
            },
            is_read: true,
        },
    });

    return result; // Returns count of deleted rows
}

// Add to export
export default {
    removeAllExpiredTokens,
    removeAllExpiredShares,
    removeOldDeletedFiles,
    removeOldReadNotifications,
};