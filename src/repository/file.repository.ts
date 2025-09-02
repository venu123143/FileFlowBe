import db from "@/config/database"
import { type FileAttributes } from "@/models/File.model"
import { QueryTypes, type Transaction } from "sequelize";
import { type FileSystemNode, type SharedFileSystemNode } from "@/types/file.types";
import { SharePermission, type ShareAttributes } from "@/models/Share.model";

const createFolder = async (value: FileAttributes) => {
  const folder = await db.File.create(value);
  return folder;
}

const renameFolder = async (folderId: string, ownerId: string, newName: string) => {
  return await db.File.update({ name: newName }, { where: { id: folderId, owner_id: ownerId, is_folder: true } });
}

// Update the file's parent_id to move it into the folder
const moveFileOrFile = async (target_folder_id: string, folderId: string, ownerId: string) => {
  const updatedFile = await db.File.update({ parent_id: folderId }, { where: { id: target_folder_id, owner_id: ownerId } });
  return updatedFile;
}

const createFile = async (file: FileAttributes, transaction: Transaction) => {
  const createdFile = await db.File.create(file, { transaction });
  return createdFile;
}
const getFileSystemTree = async (userId: string): Promise<FileSystemNode[]> => {
  // here build_children_recursive is the function that we created in the migration file.
  // it exists in the database.so we can use it in the query. this function is used to get the children of the folder.
  const query = `
      SELECT 
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', f.id,
            'owner_id', f.owner_id,
            'parent_id', f.parent_id,
            'name', f.name,
            'is_folder', f.is_folder,
            'access_level', f.access_level,
            'file_info', f.file_info,
            'description', f.description,
            'tags', f.tags,
            'metadata', f.metadata,
            'last_accessed_at', f.last_accessed_at,
            'created_at', f.created_at,
            'updated_at', f.updated_at,
            'children', CASE 
              WHEN f.is_folder = true THEN build_children_recursive(f.id)
              ELSE '[]'::json
            END
          )
          ORDER BY f.is_folder DESC, f.name ASC
        ) as file_system
      FROM files f
      WHERE f.parent_id IS NULL 
        AND f.owner_id = :userId
        AND f.deleted_at IS NULL;
    `;
  const result = await db.connection.query(query, { type: QueryTypes.RAW, replacements: { userId } }) as any;
  return result[0][0].file_system ? result[0][0].file_system as FileSystemNode[] : [];
};

const getTrash = async (userId: string): Promise<FileSystemNode[]> => {
  const query = `
      SELECT * FROM files WHERE owner_id = :userId AND deleted_at IS NOT NULL;
    `;
  const result = await db.connection.query(query, { type: QueryTypes.RAW, replacements: { userId } }) as any;
  return result[0][0].file_system ? result[0][0].file_system as FileSystemNode[] : [];
};

const restoreFileOrFolder = async (fileId: string, userId: string) => {
  const file = await db.File.update({ deleted_at: null }, { where: { id: fileId, owner_id: userId } });
  return file;
};

const deleteFileOrFolder = async (fileId: string, userId: string) => {
  const file = await db.File.destroy({ where: { id: fileId, owner_id: userId } });
  return file;
};

const shareFileOrFolder = async (share: ShareAttributes) => {
  const file = await db.Share.create(share);
  return file;
};

/**
 * Get all files shared with the current user (files others shared with me)
 */
const getAllSharedFiles = async (userId: string): Promise<SharedFileSystemNode[]> => {
  const query = `
    SELECT 
      JSON_AGG(
        JSON_BUILD_OBJECT(
          'id', f.id,
          'owner_id', f.owner_id,
          'parent_id', f.parent_id,
          'name', f.name,
          'is_folder', f.is_folder,
          'access_level', f.access_level,
          'file_info', f.file_info,
          'description', f.description,
          'tags', f.tags,
          'metadata', f.metadata,
          'last_accessed_at', f.last_accessed_at,
          'created_at', f.created_at,
          'updated_at', f.updated_at,
          'share_id', s.id,
          'shared_by_user_id', s.shared_by_user_id,
          'shared_with_user_id', s.shared_with_user_id,
          'permission_level', s.permission_level,
          'share_message', s.message,
          'expires_at', s.expires_at,
          'share_created_at', s.created_at,
          'children', CASE 
            WHEN f.is_folder = true THEN build_shared_children_recursive(f.id, s.id)
            ELSE '[]'::json
          END
        )
        ORDER BY f.is_folder DESC, f.name ASC
      ) as shared_files
    FROM shares s
    INNER JOIN files f ON s.file_id = f.id
    WHERE s.shared_with_user_id = :userId
      AND f.deleted_at IS NULL
      AND (s.expires_at IS NULL OR s.expires_at > NOW());
  `;

  const result = await db.connection.query(query, {
    type: QueryTypes.RAW,
    replacements: { userId }
  }) as any;

  return result[0][0].shared_files ? result[0][0].shared_files as SharedFileSystemNode[] : [];
};

/**
 * Get all files shared by the current user (files I shared with others)
 */
const getAllSharedFilesByMe = async (userId: string): Promise<SharedFileSystemNode[]> => {
  const query = `
    SELECT 
      JSON_AGG(
        JSON_BUILD_OBJECT(
          'id', f.id,
          'owner_id', f.owner_id,
          'parent_id', f.parent_id,
          'name', f.name,
          'is_folder', f.is_folder,
          'access_level', f.access_level,
          'file_info', f.file_info,
          'description', f.description,
          'tags', f.tags,
          'metadata', f.metadata,
          'last_accessed_at', f.last_accessed_at,
          'created_at', f.created_at,
          'updated_at', f.updated_at,
          'share_id', s.id,
          'shared_by_user_id', s.shared_by_user_id,
          'shared_with_user_id', s.shared_with_user_id,
          'permission_level', s.permission_level,
          'share_message', s.message,
          'expires_at', s.expires_at,
          'share_created_at', s.created_at,
          'children', CASE 
            WHEN f.is_folder = true THEN build_shared_children_recursive(f.id, s.id)
            ELSE '[]'::json
          END
        )
        ORDER BY f.is_folder DESC, f.name ASC
      ) as shared_files
    FROM shares s
    INNER JOIN files f ON s.file_id = f.id
    WHERE s.shared_by_user_id = :userId
      AND f.deleted_at IS NULL
      AND (s.expires_at IS NULL OR s.expires_at > NOW());
  `;

  const result = await db.connection.query(query, {
    type: QueryTypes.RAW,
    replacements: { userId }
  }) as any;

  return result[0][0].shared_files ? result[0][0].shared_files as SharedFileSystemNode[] : [];
};

const getAllSharedFilesWithMe = async (userId: string): Promise<SharedFileSystemNode[]> => {
  const query = `
    WITH RECURSIVE shared_files_recursive AS (
      -- Base case: files/folders I shared
      SELECT DISTINCT
        f.id, f.owner_id, f.parent_id, f.name, f.is_folder, f.access_level,
        f.file_info, f.description, f.tags, f.metadata, f.last_accessed_at,
        f.created_at, f.updated_at,
        s.id as share_id, s.shared_by_user_id, s.shared_with_user_id,
        s.permission_level, s.message as share_message, s.expires_at,
        s.created_at as share_created_at,
        0 as depth
      FROM shares s
      INNER JOIN files f ON s.file_id = f.id
      WHERE s.shared_by_user_id = :userId
        AND f.deleted_at IS NULL
        AND (s.expires_at IS NULL OR s.expires_at > NOW())
      
      UNION ALL
      
      -- Recursive case: children of shared folders
      SELECT DISTINCT
        f.id, f.owner_id, f.parent_id, f.name, f.is_folder, f.access_level,
        f.file_info, f.description, f.tags, f.metadata, f.last_accessed_at,
        f.created_at, f.updated_at,
        sfr.share_id, sfr.shared_by_user_id, sfr.shared_with_user_id,
        sfr.permission_level, sfr.share_message, sfr.expires_at,
        sfr.share_created_at,
        sfr.depth + 1
      FROM shared_files_recursive sfr
      INNER JOIN files f ON f.parent_id = sfr.id
      WHERE sfr.is_folder = true
        AND f.deleted_at IS NULL
        AND sfr.depth < 50 -- Prevent infinite recursion
    )
    SELECT 
      JSON_AGG(
        JSON_BUILD_OBJECT(
          'id', sfr.id,
          'owner_id', sfr.owner_id,
          'parent_id', sfr.parent_id,
          'name', sfr.name,
          'is_folder', sfr.is_folder,
          'access_level', sfr.access_level,
          'file_info', sfr.file_info,
          'description', sfr.description,
          'tags', sfr.tags,
          'metadata', sfr.metadata,
          'last_accessed_at', sfr.last_accessed_at,
          'created_at', sfr.created_at,
          'updated_at', sfr.updated_at,
          'share_id', sfr.share_id,
          'shared_by_user_id', sfr.shared_by_user_id,
          'shared_with_user_id', sfr.shared_with_user_id,
          'permission_level', sfr.permission_level,
          'share_message', sfr.share_message,
          'expires_at', sfr.expires_at,
          'share_created_at', sfr.share_created_at,
          'children', CASE 
            WHEN sfr.is_folder = true THEN build_shared_children_recursive(sfr.id, sfr.share_id)
            ELSE '[]'::json
          END
        )
        ORDER BY sfr.is_folder DESC, sfr.name ASC
      ) as shared_files
    FROM shared_files_recursive sfr
    WHERE sfr.depth = 0; -- Only root level shared items
  `;

  const result = await db.connection.query(query, {
    type: QueryTypes.RAW,
    replacements: { userId }
  }) as any;

  return result[0][0].shared_files ? result[0][0].shared_files as SharedFileSystemNode[] : [];
};


/**
 * Alternative implementation for getAllSharedFiles using a single query
 */
const getAllSharedFilesSingleQuery = async (userId: string): Promise<{
  sharedWithMe: SharedFileSystemNode[];
  sharedByMe: SharedFileSystemNode[];
}> => {
  const query = `
    WITH RECURSIVE all_shared_files AS (
      -- Files shared with me
      SELECT DISTINCT
        f.id, f.owner_id, f.parent_id, f.name, f.is_folder, f.access_level,
        f.file_info, f.description, f.tags, f.metadata, f.last_accessed_at,
        f.created_at, f.updated_at,
        s.id as share_id, s.shared_by_user_id, s.shared_with_user_id,
        s.permission_level, s.message as share_message, s.expires_at,
        s.created_at as share_created_at,
        'shared_with_me' as share_type,
        0 as depth
      FROM shares s
      INNER JOIN files f ON s.file_id = f.id
      WHERE s.shared_with_user_id = :userId
        AND f.deleted_at IS NULL
        AND (s.expires_at IS NULL OR s.expires_at > NOW())
      
      UNION ALL
      
      -- Files shared by me
      SELECT DISTINCT
        f.id, f.owner_id, f.parent_id, f.name, f.is_folder, f.access_level,
        f.file_info, f.description, f.tags, f.metadata, f.last_accessed_at,
        f.created_at, f.updated_at,
        s.id as share_id, s.shared_by_user_id, s.shared_with_user_id,
        s.permission_level, s.message as share_message, s.expires_at,
        s.created_at as share_created_at,
        'shared_by_me' as share_type,
        0 as depth
      FROM shares s
      INNER JOIN files f ON s.file_id = f.id
      WHERE s.shared_by_user_id = :userId
        AND f.deleted_at IS NULL
        AND (s.expires_at IS NULL OR s.expires_at > NOW())
      
      UNION ALL
      
      -- Recursive case: children of shared folders
      SELECT DISTINCT
        f.id, f.owner_id, f.parent_id, f.name, f.is_folder, f.access_level,
        f.file_info, f.description, f.tags, f.metadata, f.last_accessed_at,
        f.created_at, f.updated_at,
        asf.share_id, asf.shared_by_user_id, asf.shared_with_user_id,
        asf.permission_level, asf.share_message, asf.expires_at,
        asf.share_created_at,
        asf.share_type,
        asf.depth + 1
      FROM all_shared_files asf
      INNER JOIN files f ON f.parent_id = asf.id
      WHERE asf.is_folder = true
        AND f.deleted_at IS NULL
        AND asf.depth < 50
    )
    SELECT 
      JSON_BUILD_OBJECT(
        'sharedWithMe', (
          SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', asf.id,
              'owner_id', asf.owner_id,
              'parent_id', asf.parent_id,
              'name', asf.name,
              'is_folder', asf.is_folder,
              'access_level', asf.access_level,
              'file_info', asf.file_info,
              'description', asf.description,
              'tags', asf.tags,
              'metadata', asf.metadata,
              'last_accessed_at', asf.last_accessed_at,
              'created_at', asf.created_at,
              'updated_at', asf.updated_at,
              'share_id', asf.share_id,
              'shared_by_user_id', asf.shared_by_user_id,
              'shared_with_user_id', asf.shared_with_user_id,
              'permission_level', asf.permission_level,
              'share_message', asf.share_message,
              'expires_at', asf.expires_at,
              'share_created_at', asf.share_created_at,
              'children', CASE 
                WHEN asf.is_folder = true THEN build_shared_children_recursive(asf.id, asf.share_id)
                ELSE '[]'::json
              END
            )
            ORDER BY asf.is_folder DESC, asf.name ASC
          )
          FROM all_shared_files asf
          WHERE asf.share_type = 'shared_with_me' AND asf.depth = 0
        ),
        'sharedByMe', (
          SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', asf.id,
              'owner_id', asf.owner_id,
              'parent_id', asf.parent_id,
              'name', asf.name,
              'is_folder', asf.is_folder,
              'access_level', asf.access_level,
              'file_info', asf.file_info,
              'description', asf.description,
              'tags', asf.tags,
              'metadata', asf.metadata,
              'last_accessed_at', asf.last_accessed_at,
              'created_at', asf.created_at,
              'updated_at', asf.updated_at,
              'share_id', asf.share_id,
              'shared_by_user_id', asf.shared_by_user_id,
              'shared_with_user_id', asf.shared_with_user_id,
              'permission_level', asf.permission_level,
              'share_message', asf.share_message,
              'expires_at', asf.expires_at,
              'share_created_at', asf.share_created_at,
              'children', CASE 
                WHEN asf.is_folder = true THEN build_shared_children_recursive(asf.id, asf.share_id)
                ELSE '[]'::json
              END
            )
            ORDER BY asf.is_folder DESC, asf.name ASC
          )
          FROM all_shared_files asf
          WHERE asf.share_type = 'shared_by_me' AND asf.depth = 0
        )
      ) as result
    FROM all_shared_files
    LIMIT 1;
  `;

  const result = await db.connection.query(query, {
    type: QueryTypes.RAW,
    replacements: { userId }
  }) as any;

  const data = result[0][0].result;
  return {
    sharedWithMe: data.sharedWithMe || [],
    sharedByMe: data.sharedByMe || []
  };
};


export default {
  createFolder,
  renameFolder,
  moveFileOrFile,
  createFile,
  getFileSystemTree,
  getTrash,
  restoreFileOrFolder,
  deleteFileOrFolder,
  shareFileOrFolder,
  getAllSharedFiles,
  getAllSharedFilesByMe,
  getAllSharedFilesWithMe,
  getAllSharedFilesSingleQuery
}