import db from "@/config/database";
import type { FavoriteCreationAttributes } from "@/models/Favorite.model";
import { Op, type Order } from "sequelize";

type FavoriteSortBy = 'created_at' | 'name';
type SortOrder = 'ASC' | 'DESC';

type FavoriteListOptions = {
    page: number;
    limit: number;
    search?: string;
    sortBy: FavoriteSortBy;
    sortOrder: SortOrder;
    canAccessAllFiles?: boolean;
};

const favoriteInclude = (userId: string, search?: string, canAccessAllFiles: boolean = false) => ({
    model: db.File,
    as: 'file',
    required: true,
    attributes: [
        'id',
        'owner_id',
        'parent_id',
        'name',
        'is_folder',
        'access_level',
        'file_info',
        'description',
        'tags',
        'metadata',
        'last_accessed_at',
        'created_at',
        'updated_at',
    ],
    where: {
        deleted_at: null,
        ...(!canAccessAllFiles ? { owner_id: userId } : {}),
        ...(search ? { name: { [Op.iLike]: `%${search}%` } } : {}),
    },
});

const findAccessibleFileById = async (fileId: string, userId: string, canAccessAllFiles: boolean = false) => {
    return db.File.findOne({
        where: {
            id: fileId,
            deleted_at: null,
            ...(!canAccessAllFiles ? { owner_id: userId } : {}),
        },
        attributes: ['id'],
    });
};

const findAccessibleFileByStoragePath = async (storagePath: string, userId: string, canAccessAllFiles: boolean = false) => {
    return db.File.findOne({
        where: {
            deleted_at: null,
            ...(!canAccessAllFiles ? { owner_id: userId } : {}),
            file_info: {
                storage_path: storagePath,
            },
        },
        attributes: ['id'],
    });
};

const createFavorite = async (favorite: FavoriteCreationAttributes) => {
    return db.Favorite.create(favorite);
};

const getFavorites = async (userId: string, options: FavoriteListOptions) => {
    const safePage = Math.max(1, Math.trunc(options.page));
    const safeLimit = Math.min(100, Math.max(1, Math.trunc(options.limit)));
    const offset = (safePage - 1) * safeLimit;
    const order: Order = options.sortBy === 'name'
        ? [[{ model: db.File, as: 'file' }, 'name', options.sortOrder]]
        : [['created_at', options.sortOrder]];

    const { rows, count } = await db.Favorite.findAndCountAll({
        where: { user_id: userId },
        attributes: ['id', 'user_id', 'file_id', 'created_at'],
        include: [favoriteInclude(userId, options.search, options.canAccessAllFiles)],
        order,
        limit: safeLimit,
        offset,
        distinct: true,
    });

    return {
        favorites: rows,
        metadata: {
            total: count,
            page: safePage,
            limit: safeLimit,
            totalPages: Math.ceil(count / safeLimit),
        },
    };
};

const getFavoriteById = async (favoriteId: string, userId: string, canAccessAllFiles: boolean = false) => {
    return db.Favorite.findOne({
        where: {
            id: favoriteId,
            user_id: userId,
        },
        attributes: ['id', 'user_id', 'file_id', 'created_at'],
        include: [favoriteInclude(userId, undefined, canAccessAllFiles)],
    });
};

const getFavoriteByFileId = async (fileId: string, userId: string, canAccessAllFiles: boolean = false) => {
    return db.Favorite.findOne({
        where: {
            file_id: fileId,
            user_id: userId,
        },
        attributes: ['id', 'user_id', 'file_id', 'created_at'],
        include: [favoriteInclude(userId, undefined, canAccessAllFiles)],
    });
};

const updateFavorite = async (favoriteId: string, userId: string, fileId: string, canAccessAllFiles: boolean = false) => {
    const favorite = await db.Favorite.findOne({
        where: {
            id: favoriteId,
            user_id: userId,
        },
    });

    if (!favorite) {
        return null;
    }

    await favorite.update({ file_id: fileId });
    return getFavoriteById(favoriteId, userId, canAccessAllFiles);
};

const deleteFavorite = async (favoriteId: string, userId: string) => {
    return db.Favorite.destroy({
        where: {
            id: favoriteId,
            user_id: userId,
        },
    });
};

const deleteFavoriteByFileId = async (fileId: string, userId: string) => {
    return db.Favorite.destroy({
        where: {
            file_id: fileId,
            user_id: userId,
        },
    });
};

export default {
    findAccessibleFileById,
    findAccessibleFileByStoragePath,
    createFavorite,
    getFavorites,
    getFavoriteById,
    getFavoriteByFileId,
    updateFavorite,
    deleteFavorite,
    deleteFavoriteByFileId,
};
