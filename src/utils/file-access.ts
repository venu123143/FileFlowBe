import { Op } from 'sequelize';
import db from '@/config/database';
import { AccessLevel } from '@/models/File.model';
import { UserRole, type IUserAttributes } from '@/models/User.model';

/**
 * Checks whether a user is allowed to access all given S3 storage paths.
 * - Admins have global access.
 * - For 'write' (e.g. delete), the user must own a matching File record for every path.
 * - For 'read' (e.g. presigned URL, cache warm/refresh), each path must belong to a file
 *   the user owns, a public file, or a file actively shared with the user.
 */
export const canUserAccessStoragePaths = async (
    user: IUserAttributes | undefined,
    storagePaths: string[],
    mode: 'read' | 'write' = 'read'
): Promise<boolean> => {
    if (!user?.id) return false;
    if (user.role === UserRole.ADMIN) return true;

    const uniquePaths = Array.from(new Set(storagePaths.filter(Boolean)));
    if (uniquePaths.length === 0) return false;

    const files = await db.File.findAll({
        where: {
            deleted_at: null,
            [Op.and]: [
                db.Sequelize.where(
                    db.Sequelize.literal(`"File"."file_info"->>'storage_path'`),
                    { [Op.in]: uniquePaths }
                ),
            ],
        },
        attributes: ['id', 'owner_id', 'access_level', 'file_info'],
        raw: true,
    });

    if (files.length === 0) return false;

    const authorizedPaths = new Set<string>();
    const candidateShareFileIds: string[] = [];
    const fileIdToPath = new Map<string, string>();

    for (const file of files) {
        const storagePath = file.file_info?.storage_path;
        if (!storagePath) continue;

        if (file.owner_id === user.id) {
            authorizedPaths.add(storagePath);
            continue;
        }

        if (mode === 'read') {
            if (file.access_level === AccessLevel.PUBLIC) {
                authorizedPaths.add(storagePath);
            } else {
                candidateShareFileIds.push(file.id);
                fileIdToPath.set(file.id, storagePath);
            }
        }
    }

    if (mode === 'read' && candidateShareFileIds.length > 0 && authorizedPaths.size < uniquePaths.length) {
        const shares = await db.Share.findAll({
            where: {
                file_id: { [Op.in]: candidateShareFileIds },
                shared_with_user_id: user.id,
                [Op.or]: [
                    { expires_at: null },
                    { expires_at: { [Op.gt]: new Date() } },
                ],
            },
            attributes: ['file_id'],
            raw: true,
        });

        for (const share of shares) {
            const storagePath = fileIdToPath.get(share.file_id);
            if (storagePath) {
                authorizedPaths.add(storagePath);
            }
        }
    }

    return uniquePaths.every((p) => authorizedPaths.has(p));
};
