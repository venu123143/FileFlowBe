import { type Context } from "hono";
import res from "@/utils/response";
import { AccessLevel, type FileAttributes } from "@/models/File.model";
import type { InferSchemaType } from "@/utils/validation";
import fileDtoValidation from "@/validation/file.validation";
import fileRepository from "@/repository/file.repository";
import type { IUserAttributes } from "@/models/User.model";
import { ForeignKeyConstraintError, UniqueConstraintError, type Transaction } from "sequelize";
import db from "@/config/database";
import type { ShareAttributes } from "@/models/Share.model";
import { addToNotificationQueue } from "@/core/notification-queue";
import { NotificationType } from "@/models/Notification.model";


const createFolder = async (c: Context) => {
    try {
        type CreateFolderBody = InferSchemaType<typeof fileDtoValidation.createFolderValidation>;
        const value = c.get<CreateFolderBody>('validated');
        const user = c.get('user') as IUserAttributes;

        const folder: FileAttributes = {
            owner_id: user.id,
            name: value.name,
            parent_id: value.parent_id ?? null,
            access_level: value.access_level ?? AccessLevel.PROTECTED,
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

const moveFileOrFolder = async (c: Context) => {
    try {
        type MoveFileBody = InferSchemaType<typeof fileDtoValidation.moveFileValidation>;
        const value = c.get<MoveFileBody>('validated');
        const user = c.get('user') as IUserAttributes;
        const folderOrFileToMove = c.req.param('id');

        const [affectedCount] = await fileRepository.moveFileOrFile(value.target_folder_id, folderOrFileToMove, user.id);
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
        return res.FailureResponse(c, 500, { message: "Internal server error", error: error.message });
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

const getFileSystemTree = async (c: Context) => {
    try {
        const user = c.get('user') as IUserAttributes;
        const accessLevel = c.req.query('accessLevel');
        const fileSystem = await fileRepository.getFileSystemTree(user.id, accessLevel as AccessLevel | null);
        return res.SuccessResponse(c, 200, { message: "File system tree retrieved successfully", data: fileSystem });

    } catch (error) {
        console.log(error);
        return res.FailureResponse(c, 500, { message: "Internal server error" });
    }
}

const getTrash = async (c: Context) => {
    try {
        const user = c.get('user') as IUserAttributes;
        const trash = await fileRepository.getTrash(user.id);
        return res.SuccessResponse(c, 200, { message: "Trash retrieved successfully", data: trash });
    } catch (error) {
        console.log(error);
        return res.FailureResponse(c, 500, { message: "Internal server error" });
    }
}

const restoreFileOrFolder = async (c: Context) => {
    try {
        const user = c.get('user') as IUserAttributes;
        const fileId = c.req.param('id');
        const restoredFile = await fileRepository.restoreFileOrFolder(fileId, user.id);

        addToNotificationQueue({
            user_id: user.id,
            type: NotificationType.FILE_UPDATED,
            title: "You restored a file/folder",
            message: `File/folder has been restored successfully`,
            is_read: false,
            created_at: new Date(),
            data: { restoredFile },
            related_user_id: user.id,
        })
        return res.SuccessResponse(c, 200, { message: "File/folder restored successfully", data: {} });
    } catch (error) {
        console.log(error);
        return res.FailureResponse(c, 500, { message: "Internal server error" });
    }
}

const deleteFileOrFolder = async (c: Context) => {
    try {
        const user = c.get('user') as IUserAttributes;
        const fileId = c.req.param('id');
        const deletedFile = await fileRepository.deleteFileOrFolder(fileId, user.id);

        addToNotificationQueue({
            user_id: user.id,
            type: NotificationType.FILE_DELETED,
            title: "You deleted a file/folder",
            message: `File/folder has been deleted successfully`,
            is_read: false,
            created_at: new Date(),
            data: { deletedFile },
            related_user_id: user.id,
        })
        return res.SuccessResponse(c, 200, { message: "File/folder deleted successfully", data: { deletedFile } });
    } catch (error) {
        console.log(error);
        return res.FailureResponse(c, 500, { message: "Internal server error" });
    }
}

const shareFileOrFolder = async (c: Context) => {
    try {
        type ShareFileBody = InferSchemaType<typeof fileDtoValidation.shareFileValidation>;
        const value = c.get<ShareFileBody>('validated');
        const user = c.get('user') as IUserAttributes;
        const fileId = c.req.param('id');

        const share: ShareAttributes = {
            file_id: fileId,
            shared_by_user_id: user.id,
            shared_with_user_id: value.shared_with_user_id,
            permission_level: value.permission_level,
            message: value.message,
            expires_at: value.expires_at
        };
        const sharedFile = await fileRepository.shareFileOrFolder(share);

        addToNotificationQueue({
            user_id: value.shared_with_user_id,
            type: NotificationType.FILE_SHARED,
            title: `${user.display_name} shared a file with you`,
            message: `File(s) have been shared successfully`,
            is_read: false,
            created_at: new Date(),
            data: { sharedFile },
            related_user_id: user.id,
        })

        return res.SuccessResponse(c, 200, { message: "File/folder shared successfully", data: { sharedFile } });
    } catch (error) {
        console.log(error);
        return res.FailureResponse(c, 500, { message: "Internal server error" });
    }
}

const getAllSharedFiles = async (c: Context) => {
    try {
        const user = c.get('user') as IUserAttributes;
        const sharedFiles = await fileRepository.getAllSharedFiles(user.id);
        return res.SuccessResponse(c, 200, { message: "All shared files retrieved successfully", data: sharedFiles });
    } catch (error) {
        console.log(error);
        return res.FailureResponse(c, 500, { message: "Internal server error" });
    }
}


const getAllSharedFilesByMe = async (c: Context) => {
    try {
        const user = c.get('user') as IUserAttributes;
        const sharedFiles = await fileRepository.getAllSharedFilesByMe(user.id);
        return res.SuccessResponse(c, 200, { message: "All shared files by me retrieved successfully", data: sharedFiles });
    } catch (error) {
        console.log(error);
        return res.FailureResponse(c, 500, { message: "Internal server error" });
    }
}

const getAllSharedFilesWithMe = async (c: Context) => {
    try {
        const user = c.get('user') as IUserAttributes;
        const sharedFiles = await fileRepository.getAllSharedFilesWithMe(user.id);
        return res.SuccessResponse(c, 200, { message: "All shared files with me retrieved successfully", data: sharedFiles });
    } catch (error) {
        console.log(error);
        return res.FailureResponse(c, 500, { message: "Internal server error" });
    }
}

const emptyTrash = async (c: Context) => {
    try {
        const user = c.get('user') as IUserAttributes;
        const deletedFiles = await fileRepository.emptyTrash(user.id);
        addToNotificationQueue({
            user_id: user.id,
            type: NotificationType.FILE_DELETED,
            title: "Trash emptied",
            message: `Trash has been emptied successfully`,
            is_read: false,
            created_at: new Date(),
            data: { deletedFiles },
            related_user_id: user.id,
        })
        return res.SuccessResponse(c, 200, { message: "Trash emptied successfully", data: { deletedFiles } });
    } catch (error) {
        console.log(error);
        return res.FailureResponse(c, 500, { message: "Internal server error" });
    }
}

const getRecents = async (c: Context) => {
    try {
        const user = c.get('user') as IUserAttributes;
        const page = Number(c.req.query('page') ?? '1');
        const limit = Number(c.req.query('limit') ?? '20');
        const result = await fileRepository.getRecents(user.id, page, limit);
        return res.SuccessResponse(c, 200, { message: "Recents retrieved successfully", data: result });
    } catch (error) {
        console.log(error);
        return res.FailureResponse(c, 500, { message: "Internal server error" });
    }
}

const updateFileAccessLevel = async (c: Context) => {
    try {
        // Update the file's access level, you can only update the access level of the file if you are the owner of the file.
        type UpdateFileAccessLevelBody = InferSchemaType<typeof fileDtoValidation.updateFileAccessLevelValidation>;
        const value = c.get<UpdateFileAccessLevelBody>('validated');
        const user = c.get('user') as IUserAttributes;
        const fileId = c.req.param('id');
        const updatedFile = await fileRepository.updateFileAccessLevel(fileId, user.id, value.access_level);
        return res.SuccessResponse(c, 200, { message: "File access level updated successfully", data: updatedFile });

    } catch (error) {
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
    moveFileOrFolder,
    createFile,
    getFileSystemTree,
    getTrash,
    restoreFileOrFolder,
    deleteFileOrFolder,
    shareFileOrFolder,
    getAllSharedFiles,
    getAllSharedFilesByMe,
    getAllSharedFilesWithMe,
    emptyTrash,
    getRecents,
    updateFileAccessLevel
};
