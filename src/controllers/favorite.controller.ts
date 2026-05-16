import { type Context } from "hono";
import { UniqueConstraintError } from "sequelize";
import res from "@/utils/response";
import type { IUserAttributes } from "@/models/User.model";
import type { InferSchemaType } from "@/utils/validation";
import favoriteValidation from "@/validation/favorite.validation";
import favoriteRepository from "@/repository/favorite.repository";

const createFavorite = async (c: Context) => {
    try {
        type CreateFavoriteBody = InferSchemaType<typeof favoriteValidation.createFavoriteValidation>;
        const value = c.get<CreateFavoriteBody>('validated');
        const user = c.get('user') as IUserAttributes;

        const file = value.file_id
            ? await favoriteRepository.findOwnedFileById(value.file_id, user.id)
            : await favoriteRepository.findOwnedFileByStoragePath(value.storage_path, user.id);

        if (!file) {
            return res.FailureResponse(c, 404, { message: "File not found or you do not have permission to favorite it" });
        }

        const favorite = await favoriteRepository.createFavorite({
            user_id: user.id,
            file_id: file.id,
        });

        const favoriteWithFile = await favoriteRepository.getFavoriteById(favorite.id, user.id);
        return res.SuccessResponse(c, 201, { message: "Favorite created successfully", data: { favorite: favoriteWithFile } });
    } catch (error: any) {
        if (error instanceof UniqueConstraintError) {
            return res.FailureResponse(c, 409, { message: "File is already in favorites" });
        }

        return res.FailureResponse(c, 500, { message: "Internal server error" });
    }
};

const getFavorites = async (c: Context) => {
    try {
        const user = c.get('user') as IUserAttributes;
        const query = c.get('validatedQuery') as {
            page: number;
            limit: number;
            search?: string;
            sortBy: 'created_at' | 'name';
            sortOrder: 'ASC' | 'DESC' | 'asc' | 'desc';
        };

        const result = await favoriteRepository.getFavorites(user.id, {
            ...query,
            sortOrder: query.sortOrder.toUpperCase() as 'ASC' | 'DESC',
        });

        return res.SuccessResponse(c, 200, { message: "Favorites retrieved successfully", data: result });
    } catch (error: any) {
        return res.FailureResponse(c, 500, { message: "Internal server error" });
    }
};

const getFavoriteById = async (c: Context) => {
    try {
        const user = c.get('user') as IUserAttributes;
        const params = c.get('validatedParams') as { favoriteId: string };

        const favorite = await favoriteRepository.getFavoriteById(params.favoriteId, user.id);
        if (!favorite) {
            return res.FailureResponse(c, 404, { message: "Favorite not found" });
        }

        return res.SuccessResponse(c, 200, { message: "Favorite retrieved successfully", data: { favorite } });
    } catch (error: any) {
        return res.FailureResponse(c, 500, { message: "Internal server error" });
    }
};

const getFavoriteByFileId = async (c: Context) => {
    try {
        const user = c.get('user') as IUserAttributes;
        const params = c.get('validatedParams') as { fileId: string };

        const favorite = await favoriteRepository.getFavoriteByFileId(params.fileId, user.id);
        return res.SuccessResponse(c, 200, {
            message: "Favorite status retrieved successfully",
            data: {
                is_favorite: Boolean(favorite),
                favorite,
            },
        });
    } catch (error: any) {
        return res.FailureResponse(c, 500, { message: "Internal server error" });
    }
};

const updateFavorite = async (c: Context) => {
    try {
        type UpdateFavoriteBody = InferSchemaType<typeof favoriteValidation.updateFavoriteValidation>;
        const value = c.get<UpdateFavoriteBody>('validated');
        const params = c.get('validatedParams') as { favoriteId: string };
        const user = c.get('user') as IUserAttributes;

        const file = await favoriteRepository.findOwnedFileById(value.file_id, user.id);
        if (!file) {
            return res.FailureResponse(c, 404, { message: "File not found or you do not have permission to favorite it" });
        }

        const favorite = await favoriteRepository.updateFavorite(params.favoriteId, user.id, value.file_id);
        if (!favorite) {
            return res.FailureResponse(c, 404, { message: "Favorite not found" });
        }

        return res.SuccessResponse(c, 200, { message: "Favorite updated successfully", data: { favorite } });
    } catch (error: any) {
        if (error instanceof UniqueConstraintError) {
            return res.FailureResponse(c, 409, { message: "File is already in favorites" });
        }

        return res.FailureResponse(c, 500, { message: "Internal server error" });
    }
};

const deleteFavorite = async (c: Context) => {
    try {
        const user = c.get('user') as IUserAttributes;
        const params = c.get('validatedParams') as { favoriteId: string };

        const deletedCount = await favoriteRepository.deleteFavorite(params.favoriteId, user.id);
        if (deletedCount === 0) {
            return res.FailureResponse(c, 404, { message: "Favorite not found" });
        }

        return res.SuccessResponse(c, 200, { message: "Favorite deleted successfully", data: { deletedCount } });
    } catch (error: any) {
        return res.FailureResponse(c, 500, { message: "Internal server error" });
    }
};

const deleteFavoriteByFileId = async (c: Context) => {
    try {
        const user = c.get('user') as IUserAttributes;
        const params = c.get('validatedParams') as { fileId: string };

        const deletedCount = await favoriteRepository.deleteFavoriteByFileId(params.fileId, user.id);
        if (deletedCount === 0) {
            return res.FailureResponse(c, 404, { message: "Favorite not found" });
        }

        return res.SuccessResponse(c, 200, { message: "Favorite deleted successfully", data: { deletedCount } });
    } catch (error: any) {
        return res.FailureResponse(c, 500, { message: "Internal server error" });
    }
};

export default {
    createFavorite,
    getFavorites,
    getFavoriteById,
    getFavoriteByFileId,
    updateFavorite,
    deleteFavorite,
    deleteFavoriteByFileId,
};
