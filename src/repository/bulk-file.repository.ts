import db from "@/config/database";
import { Op, QueryTypes, type Transaction } from "sequelize";
import { type SharePermission, type ShareCreationAttributes } from "@/models/Share.model";

/**
 * Error raised when a bulk operation cannot be applied to the whole batch.
 * Every bulk operation is all-or-nothing: throwing this rolls the transaction
 * back, and `details` tells the caller exactly which IDs were at fault.
 */
export class BulkOperationError extends Error {
  public readonly status: 404 | 409 | 422;
  public readonly details: Record<string, any>;

  constructor(status: 404 | 409 | 422, message: string, details: Record<string, any> = {}) {
    super(message);
    this.name = "BulkOperationError";
    this.status = status;
    this.details = details;
  }
}

export interface BulkFileSummary {
  id: string;
  name: string;
  is_folder: boolean;
}

/**
 * Load every requested file/folder, asserting the caller owns all of them.
 * The default (paranoid) scope excludes trashed rows, so an already-deleted
 * ID is reported as missing rather than silently skipped.
 */
const findOwnedFilesOrThrow = async (fileIds: string[], ownerId: string, transaction: Transaction): Promise<BulkFileSummary[]> => {
  const files = await db.File.findAll({
    where: { id: { [Op.in]: fileIds }, owner_id: ownerId },
    attributes: ["id", "name", "is_folder"],
    transaction,
    raw: true,
  });

  if (files.length !== fileIds.length) {
    const found = new Set(files.map(f => f.id));
    throw new BulkOperationError(404, "Some files/folders were not found or you do not have permission to access them", {
      missing_file_ids: fileIds.filter(id => !found.has(id)),
    });
  }

  return files.map(f => ({ id: f.id, name: f.name, is_folder: f.is_folder }));
};

/**
 * Soft delete multiple files/folders in one transaction.
 * Mirrors the single-item delete: only the named rows get `deleted_at`, and the
 * descendants stay intact so restore and empty-trash keep working on the subtree.
 */
const bulkDeleteFilesOrFolders = async (fileIds: string[], ownerId: string) => {
  const transaction = await db.connection.transaction();
  try {
    const files = await findOwnedFilesOrThrow(fileIds, ownerId, transaction);

    const deletedCount = await db.File.destroy({
      where: { id: { [Op.in]: fileIds }, owner_id: ownerId },
      transaction,
    });

    await transaction.commit();
    return { deletedCount, files };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Reject a move target that does not exist, is not a folder, or sits inside the
 * set being moved -- any of which would orphan a subtree into a cycle.
 */
const assertValidMoveTarget = async (targetFolderId: string, fileIds: string[], ownerId: string, transaction: Transaction) => {
  if (fileIds.includes(targetFolderId)) {
    throw new BulkOperationError(422, "A folder cannot be moved into itself", { target_folder_id: targetFolderId });
  }

  const target = await db.File.findOne({
    where: { id: targetFolderId, owner_id: ownerId },
    attributes: ["id", "is_folder"],
    transaction,
    raw: true,
  });

  if (!target) {
    throw new BulkOperationError(404, "Target folder not found or you do not have permission to access it", { target_folder_id: targetFolderId });
  }

  if (!target.is_folder) {
    throw new BulkOperationError(422, "Target must be a folder", { target_folder_id: targetFolderId });
  }

  const query = `
    WITH RECURSIVE descendants AS (
      SELECT f.id
      FROM files f
      WHERE f.id IN (:fileIds) AND f.owner_id = :ownerId AND f.deleted_at IS NULL

      UNION ALL

      SELECT f.id
      FROM files f
      INNER JOIN descendants d ON f.parent_id = d.id
      WHERE f.owner_id = :ownerId AND f.deleted_at IS NULL
    )
    SELECT id FROM descendants WHERE id = :targetFolderId LIMIT 1;
  `;

  const cycle = await db.connection.query(query, {
    type: QueryTypes.SELECT,
    replacements: { fileIds, ownerId, targetFolderId },
    transaction,
  });

  if (cycle.length > 0) {
    throw new BulkOperationError(422, "A folder cannot be moved into one of its own subfolders", { target_folder_id: targetFolderId });
  }
};

/**
 * Re-parent multiple files/folders in one transaction.
 * `targetFolderId` of null moves the items to the root.
 * A name clash in the destination trips the (parent_id, name, owner_id, is_folder)
 * unique index, which rolls the whole batch back.
 */
const bulkMoveFilesOrFolders = async (fileIds: string[], targetFolderId: string | null, ownerId: string) => {
  const transaction = await db.connection.transaction();
  try {
    const files = await findOwnedFilesOrThrow(fileIds, ownerId, transaction);

    if (targetFolderId !== null) {
      await assertValidMoveTarget(targetFolderId, fileIds, ownerId, transaction);
    }

    const [movedCount] = await db.File.update(
      // parent_id is typed as optional string, but the column is nullable and
      // null is what moves an item back to the root.
      { parent_id: targetFolderId as unknown as string },
      { where: { id: { [Op.in]: fileIds }, owner_id: ownerId }, transaction }
    );

    await transaction.commit();
    return { movedCount, files, targetFolderId };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

export interface BulkShareParams {
  fileIds: string[];
  sharedWithUserIds: string[];
  sharedByUserId: string;
  permissionLevel: SharePermission;
  message?: string | null;
  expiresAt?: Date | null;
}

/**
 * Share every requested file/folder with every requested recipient in one
 * transaction (the N x M cross product). An existing share for a pair has its
 * permission/message/expiry updated rather than failing the batch.
 */
const bulkShareFilesOrFolders = async (params: BulkShareParams) => {
  const { fileIds, sharedWithUserIds, sharedByUserId, permissionLevel, message, expiresAt } = params;
  const transaction = await db.connection.transaction();
  try {
    const files = await findOwnedFilesOrThrow(fileIds, sharedByUserId, transaction);

    if (sharedWithUserIds.includes(sharedByUserId)) {
      throw new BulkOperationError(422, "You cannot share files with yourself", {
        shared_with_user_ids: [sharedByUserId],
      });
    }

    const recipients = await db.User.findAll({
      where: { id: { [Op.in]: sharedWithUserIds }, is_active: true },
      attributes: ["id", "email", "display_name"],
      transaction,
      raw: true,
    });

    if (recipients.length !== sharedWithUserIds.length) {
      const found = new Set(recipients.map(u => u.id));
      throw new BulkOperationError(404, "Some recipient users were not found", {
        missing_user_ids: sharedWithUserIds.filter(id => !found.has(id)),
      });
    }

    const rows: ShareCreationAttributes[] = fileIds.flatMap(fileId =>
      sharedWithUserIds.map(recipientId => ({
        file_id: fileId,
        shared_by_user_id: sharedByUserId,
        shared_with_user_id: recipientId,
        permission_level: permissionLevel,
        message: message ?? null,
        expires_at: expiresAt ?? null,
      }))
    );

    const shares = await db.Share.bulkCreate(rows, {
      transaction,
      validate: true,
      conflictAttributes: ["file_id", "shared_by_user_id", "shared_with_user_id"],
      updateOnDuplicate: ["permission_level", "message", "expires_at"],
    });

    await transaction.commit();
    return {
      shares,
      files,
      recipients: recipients.map(u => ({ id: u.id, email: u.email, display_name: u.display_name })),
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

export default {
  bulkDeleteFilesOrFolders,
  bulkMoveFilesOrFolders,
  bulkShareFilesOrFolders,
}
