import { type Context } from "hono";
import res from "@/utils/response";
import type { InferSchemaType } from "@/utils/validation";
import bulkFileDtoValidation from "@/validation/bulk-file.validation";
import bulkFileRepository, { BulkOperationError, type BulkFileSummary } from "@/repository/bulk-file.repository";
import type { IUserAttributes } from "@/models/User.model";
import { ForeignKeyConstraintError, UniqueConstraintError } from "sequelize";
import { addToNotificationQueue } from "@/core/notification-queue";
import { NotificationType } from "@/models/Notification.model";
import { addToAnalyticsQueue, AnalyticsEventType } from "@/core/analytics-queue";

/** Keeps notification copy readable when a batch touches many items. */
const describeItems = (files: BulkFileSummary[]) => {
    const names = files.map(f => f.name);
    if (names.length <= 3) return names.join(", ");
    return `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`;
};

/**
 * Every bulk handler is all-or-nothing, so a thrown error means nothing was
 * committed. Translate it into the status the repository asked for.
 */
const handleBulkError = (c: Context, error: any, fallbackMessage: string) => {
    if (error instanceof BulkOperationError) {
        return res.FailureResponse(c, error.status, { message: error.message, ...error.details });
    }
    if (error instanceof UniqueConstraintError) {
        return res.FailureResponse(c, 409, {
            message: "A file/folder with the same name already exists in the destination. No items were changed."
        });
    }
    if (error instanceof ForeignKeyConstraintError) {
        return res.FailureResponse(c, 422, {
            message: "One of the referenced records does not exist. No items were changed."
        });
    }
    console.error(fallbackMessage, error);
    return res.FailureResponse(c, 500, { message: "Internal server error" });
};

const bulkDeleteFilesOrFolders = async (c: Context) => {
    try {
        type BulkDeleteBody = InferSchemaType<typeof bulkFileDtoValidation.bulkDeleteValidation>;
        const value = c.get<BulkDeleteBody>('validated');
        const user = c.get('user') as IUserAttributes;

        const { deletedCount, files } = await bulkFileRepository.bulkDeleteFilesOrFolders(value.file_ids, user.id);

        addToNotificationQueue({
            user_id: user.id,
            type: NotificationType.FILE_DELETED,
            title: `You deleted ${deletedCount} item(s)`,
            message: `${describeItems(files)} moved to trash`,
            is_read: false,
            created_at: new Date(),
            data: { deletedCount, files },
            related_user_id: user.id,
        });

        for (const file of files) {
            addToAnalyticsQueue({
                userId: user.id,
                eventType: AnalyticsEventType.FILE_DELETED,
                metadata: { fileName: file.name, isFolder: file.is_folder }
            });
        }

        return res.SuccessResponse(c, 200, {
            message: `${deletedCount} item(s) deleted successfully`,
            data: { deletedCount, files }
        });
    } catch (error: any) {
        return handleBulkError(c, error, 'Error bulk deleting files:');
    }
};

const bulkMoveFilesOrFolders = async (c: Context) => {
    try {
        type BulkMoveBody = InferSchemaType<typeof bulkFileDtoValidation.bulkMoveValidation>;
        const value = c.get<BulkMoveBody>('validated');
        const user = c.get('user') as IUserAttributes;

        const { movedCount, files, targetFolderId } = await bulkFileRepository.bulkMoveFilesOrFolders(
            value.file_ids,
            value.target_folder_id,
            user.id
        );

        addToNotificationQueue({
            user_id: user.id,
            type: NotificationType.FILE_UPDATED,
            title: `You moved ${movedCount} item(s)`,
            message: `${describeItems(files)} moved to ${targetFolderId ? 'a new folder' : 'the root folder'}`,
            is_read: false,
            created_at: new Date(),
            data: { movedCount, files, target_folder_id: targetFolderId },
            related_user_id: user.id,
        });

        return res.SuccessResponse(c, 200, {
            message: `${movedCount} item(s) moved successfully`,
            data: { movedCount, files, target_folder_id: targetFolderId }
        });
    } catch (error: any) {
        return handleBulkError(c, error, 'Error bulk moving files:');
    }
};

const bulkShareFilesOrFolders = async (c: Context) => {
    try {
        type BulkShareBody = InferSchemaType<typeof bulkFileDtoValidation.bulkShareValidation>;
        const value = c.get<BulkShareBody>('validated');
        const user = c.get('user') as IUserAttributes;

        const { shares, files, recipients } = await bulkFileRepository.bulkShareFilesOrFolders({
            fileIds: value.file_ids,
            sharedWithUserIds: value.shared_with_user_ids,
            sharedByUserId: user.id,
            permissionLevel: value.permission_level,
            message: value.message,
            expiresAt: value.expires_at,
        });

        for (const recipient of recipients) {
            addToNotificationQueue({
                user_id: recipient.id,
                type: NotificationType.FILE_SHARED,
                title: `${user.display_name} shared ${files.length} item(s) with you`,
                message: `${describeItems(files)} shared with you`,
                is_read: false,
                created_at: new Date(),
                data: { files, permission_level: value.permission_level, expires_at: value.expires_at },
                related_user_id: user.id,
            });
        }

        // One event per file rather than per share row: the cross product can be
        // thousands of rows, and the analytics counter tracks files shared.
        for (const file of files) {
            addToAnalyticsQueue({
                userId: user.id,
                eventType: AnalyticsEventType.FILE_SHARED,
                metadata: {
                    fileId: file.id,
                    fileName: file.name,
                    isFolder: file.is_folder,
                    sharedWithUserIds: value.shared_with_user_ids
                }
            });
        }

        return res.SuccessResponse(c, 200, {
            message: `${files.length} item(s) shared with ${recipients.length} user(s) successfully`,
            data: { sharedCount: shares.length, files, recipients }
        });
    } catch (error: any) {
        return handleBulkError(c, error, 'Error bulk sharing files:');
    }
};

export default {
    bulkDeleteFilesOrFolders,
    bulkMoveFilesOrFolders,
    bulkShareFilesOrFolders,
};
