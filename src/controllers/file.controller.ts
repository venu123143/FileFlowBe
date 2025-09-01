import { type Context } from "hono";
import res from "@/utils/response";
import { type FileAttributes } from "@/models/File.model";
import type { InferSchemaType } from "@/utils/validation";
import fileDtoValidation from "@/validation/file.validation";
import fileRepository from "@/repository/file.repository";
import type { IUserAttributes } from "@/models/User.model";
import { ForeignKeyConstraintError, UniqueConstraintError, type Transaction } from "sequelize";
import db from "@/config/database";

// add this in the migration file, to have the unique constraint on the folder name (root level).
// CREATE UNIQUE INDEX unique_folder_name_per_parent
//       ON files (
//         owner_id,
//         is_folder,
//         name,
//         COALESCE(parent_id, '00000000-0000-0000-0000-000000000000')
//       )
const createFolder = async (c: Context) => {
    try {
        type CreateFolderBody = InferSchemaType<typeof fileDtoValidation.createFolderValidation>;
        const value = c.get<CreateFolderBody>('validated');
        const user = c.get('user') as IUserAttributes;

        const folder: FileAttributes = {
            owner_id: user.id,
            name: value.name,
            parent_id: value.parent_id ?? null,
            access_level: value.access_level,
            description: value.description,
            tags: value.tags,
            is_folder: true,
            metadata: null,
        };

        const createdFolder = await fileRepository.createFolder(folder);
        return res.SuccessResponse(c, 201, { message: "Folder created successfully", data: createdFolder });

    } catch (error: any) {
        // Custom handling for invalid parent_id (FK violation)
        if (error instanceof ForeignKeyConstraintError && error.index === "files_parent_id_fkey") {
            return res.FailureResponse(c, 422, {
                message: "Invalid parent folder ID. The specified folder does not exist."
            });
        }
        if (error instanceof UniqueConstraintError) {
            return res.FailureResponse(c, 409, {
                message: "A folder with this name already exists in the same location."
            });
        }
        return res.FailureResponse(c, 500, { message: "Internal server error" });
    }
};

const renameFolder = async (c: Context) => {
    try {
        type RenameFolderBody = InferSchemaType<typeof fileDtoValidation.renameFolderValidation>;
        const value = c.get<RenameFolderBody>('validated');
        const user = c.get('user') as IUserAttributes;
        const folderId = c.req.param('id');

        const updatedFolder = await fileRepository.renameFolder(folderId, user.id, value.name);
        return res.SuccessResponse(c, 200, {
            message: "Folder renamed successfully",
            data: updatedFolder
        });

    } catch (error: any) {
        if (error instanceof UniqueConstraintError) {
            return res.FailureResponse(c, 409, {
                message: "A folder with this name already exists in the same location."
            });
        }
        return res.FailureResponse(c, 500, { message: "Internal server error" });
    }
};

const moveFileOrFile = async (c: Context) => {
    try {
        type MoveFileBody = InferSchemaType<typeof fileDtoValidation.moveFileValidation>;
        const value = c.get<MoveFileBody>('validated');
        const user = c.get('user') as IUserAttributes;
        const folderId = c.req.param('id');

        const [affectedCount] = await fileRepository.moveFileOrFile(value.target_folder_id, folderId, user.id);
        if (affectedCount === 0) {
            return res.SuccessResponse(c, 200, {
                message: "File is already in this folder",
                data: {}
            });
        }

        return res.SuccessResponse(c, 200, {
            message: "File moved to folder successfully",
            data: {}
        });

    } catch (error: any) {
        return res.FailureResponse(c, 500, { message: "Internal server error" });
    }
};

const createFile = async (c: Context) => {
    const transaction: Transaction = await db.connection.transaction();
    try {
        type CreateFileBody = InferSchemaType<typeof fileDtoValidation.createFileValidation>;
        const value = c.get<CreateFileBody>('validated');
        const user = c.get('user') as IUserAttributes;

        const file: FileAttributes = {
            owner_id: user.id,
            name: value.name,
            parent_id: value.parent_id,
            access_level: value.access_level,
            description: value.description,
            tags: value.tags,
            is_folder: false,
            metadata: null,
            file_info: value.file_info,
        };
        const createdFile = await fileRepository.createFile(file, transaction);
        await transaction.commit();
        return res.SuccessResponse(c, 201, { message: "File created successfully", data: createdFile });

    } catch (error) {
        await transaction.rollback();
        if (error instanceof ForeignKeyConstraintError && error.index === "files_parent_id_fkey") {
            return res.FailureResponse(c, 422, {
                message: "Invalid parent folder ID. The specified folder does not exist."
            });
        }
        if (error instanceof UniqueConstraintError) {
            return res.FailureResponse(c, 409, {
                message: "A folder/file with this name already exists in the same location."
            });
        }
        return res.FailureResponse(c, 500, { message: "Internal server error" });

    }
}

export default {
    createFolder,
    renameFolder,
    moveFileOrFile,
    createFile
};
