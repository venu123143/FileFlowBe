import db from "@/config/database"
import { Op } from "sequelize";
import constants from "@/global/constants";
async function removeAllExpiredTokens() {
    const expirationTime = new Date();
    expirationTime.setDate(expirationTime.getDate() - constants.FILE_TRASH_EXPIRY_TIME);

    const expiredTokens = await db.UserSession.findAll({
        where: {
            expires_at: {
                [Op.lt]: expirationTime, // Expired before cutoff
            },
        },
    });

    for (const token of expiredTokens) {
        await token.destroy();
    }

    return expiredTokens;
}

async function removeAllExpiredShares() {
    const now = new Date();

    const expiredShares = await db.Share.findAll({
        where: {
            expires_at: {
                [Op.lt]: now, // Expired already
            },
        },
    });

    for (const share of expiredShares) {
        await share.destroy();
    }

    return expiredShares;
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
async function removeOldDeletedFiles() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - constants.FILE_TRASH_EXPIRY_TIME);

    // Find expired "trashed" files/folders
    const expiredFiles = await db.File.findAll({
        where: {
            deleted_at: {
                [Op.lt]: cutoffDate,
            },
        },
        attributes: ["id"],
        raw: true,
    });

    if (!expiredFiles.length) return [];

    let allToDelete: string[] = expiredFiles.map(f => f.id);

    // Fetch children recursively
    for (const file of expiredFiles) {
        const childIds = await getAllChildFileIds([file.id]);
        allToDelete = [...allToDelete, ...childIds];
    }

    // Remove duplicates
    allToDelete = [...new Set(allToDelete)];

    // Hard delete (skip paranoid)
    await db.File.destroy({
        where: {
            id: {
                [Op.in]: allToDelete,
            },
        },
        force: true, // ensures permanent delete
    });

    return allToDelete;
}

export default {
    removeAllExpiredTokens,
    removeAllExpiredShares,
    removeOldDeletedFiles,

};
