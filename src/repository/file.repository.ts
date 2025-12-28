import db from "@/config/database"
import { type FileAttributes, AccessLevel } from "@/models/File.model"
import { Op, QueryTypes, type Transaction, literal } from "sequelize";
import { type FileSystemNode, type SharedFileSystemNode } from "@/types/file.types";
import { type ShareAttributes } from "@/models/Share.model";

const createFolder = async (value: FileAttributes) => {
  const folder = await db.File.create(value);
  return folder;
}

const updateLastAccessed = async (file_id: string, owner_id: string) => {
  return await db.File.update({ last_accessed_at: new Date() }, { where: { id: file_id, owner_id: owner_id } })
}

const renameFolder = async (folderId: string, ownerId: string, newName: string) => {
  return await db.File.update({ name: newName }, { where: { id: folderId, owner_id: ownerId } });
}

// Update the file's parent_id to move it into the folder
const moveFileOrFile = async (target_folder_id: string, folderOrFileToMove: string, ownerId: string) => {
  const updatedFile = await db.File.update({ parent_id: target_folder_id }, { where: { id: folderOrFileToMove, owner_id: ownerId } });
  return updatedFile;
}

const createFile = async (file: FileAttributes, transaction: Transaction) => {
  const createdFile = await db.File.create(file, { transaction });
  return createdFile;
}

const getFileSystemTree = async (userId: string, accessLevel: AccessLevel | null = null): Promise<FileSystemNode[]> => {
  // Cast accessLevel to string to match the TEXT parameter in the function
  const accessLevelParam = accessLevel ? accessLevel.toString() : null;

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
                  'file_info', CASE 
                      WHEN f.is_folder = true THEN 
                          COALESCE(f.file_info, '{}'::jsonb) || 
                          JSON_BUILD_OBJECT('file_size', calculate_folder_size(f.id))::jsonb
                      ELSE f.file_info
                  END,
                  'description', f.description,
                  'tags', f.tags,
                  'metadata', f.metadata,
                  'last_accessed_at', f.last_accessed_at,
                  'created_at', f.created_at,
                  'updated_at', f.updated_at,
                  'children', CASE 
                      WHEN f.is_folder = true THEN build_children_recursive(f.id, $2)
                      ELSE '[]'::json
                  END
              )
              ORDER BY f.is_folder DESC, f.name ASC
          ) as file_system
      FROM files f
      WHERE f.parent_id IS NULL 
        AND f.owner_id = $1
        AND f.deleted_at IS NULL
        ${accessLevel ? "AND f.access_level::TEXT = $2" : ""}
    `;

  const result = await db.connection.query(query, {
    type: QueryTypes.RAW,
    bind: [userId, accessLevelParam]
  }) as any;

  return result[0][0]?.file_system ? result[0][0].file_system as FileSystemNode[] : [];
};

const getTrash = async (userId: string): Promise<FileSystemNode[]> => {
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
            'file_info',CASE 
                      WHEN f.is_folder = true THEN 
                          COALESCE(f.file_info, '{}'::jsonb) || 
                          JSON_BUILD_OBJECT('file_size', calculate_folder_size(f.id))::jsonb
                      ELSE f.file_info
                  END,
            'description', f.description,
            'tags', f.tags,
            'metadata', f.metadata,
            'last_accessed_at', f.last_accessed_at,
            'created_at', f.created_at,
            'updated_at', f.updated_at,
            'deleted_at', f.deleted_at,
            'children', '[]'::json
          )
          ORDER BY f.is_folder DESC, f.name ASC
        ) as file_system
      FROM files f
      WHERE f.owner_id = :userId
        AND f.deleted_at IS NOT NULL;
    `;
  const result = await db.connection.query(query, { type: QueryTypes.RAW, replacements: { userId } }) as any;
  return result[0][0].file_system ? result[0][0].file_system as FileSystemNode[] : [];
};


const restoreFileOrFolder = async (fileId: string, userId: string) => {
  const file = await db.File.restore({ where: { id: fileId, owner_id: userId } });
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
 * Get ALL shared files (both files shared BY me and files shared WITH me)
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
          'shared_by_user', JSON_BUILD_OBJECT(
            'id', u_by.id,
            'email', u_by.email,
            'display_name', u_by.display_name,
            'avatar_url', u_by.avatar_url
          ),
          'shared_with_user', JSON_BUILD_OBJECT(
            'id', u_with.id,
            'email', u_with.email,
            'display_name', u_with.display_name,
            'avatar_url', u_with.avatar_url
          ),
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
    LEFT JOIN users u_by ON s.shared_by_user_id = u_by.id
    LEFT JOIN users u_with ON s.shared_with_user_id = u_with.id
    WHERE (s.shared_with_user_id = :userId OR s.shared_by_user_id = :userId)
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
          'shared_by_user', JSON_BUILD_OBJECT(
            'id', u_by.id,
            'email', u_by.email,
            'display_name', u_by.display_name,
            'avatar_url', u_by.avatar_url
          ),
          'shared_with_user', JSON_BUILD_OBJECT(
            'id', u_with.id,
            'email', u_with.email,
            'display_name', u_with.display_name,
            'avatar_url', u_with.avatar_url
          ),
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
    LEFT JOIN users u_by ON s.shared_by_user_id = u_by.id
    LEFT JOIN users u_with ON s.shared_with_user_id = u_with.id
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

/**
 * Get all files shared with the current user (files others shared with me)
 */
const getAllSharedFilesWithMe = async (userId: string): Promise<SharedFileSystemNode[]> => {
  const query = `
    WITH RECURSIVE shared_files_recursive AS (
      -- Base case: files/folders shared with me
      SELECT DISTINCT
        f.id, f.owner_id, f.parent_id, f.name, f.is_folder, f.access_level,
        f.file_info, f.description, f.tags, f.metadata, f.last_accessed_at,
        f.created_at, f.updated_at,
        s.id as share_id, s.shared_by_user_id, s.shared_with_user_id,
        s.permission_level, s.message as share_message, s.expires_at,
        s.created_at as share_created_at,
        u_by.id as shared_by_id, u_by.email as shared_by_email, 
        u_by.display_name as shared_by_display_name, u_by.avatar_url as shared_by_avatar_url,
        u_with.id as shared_with_id, u_with.email as shared_with_email,
        u_with.display_name as shared_with_display_name, u_with.avatar_url as shared_with_avatar_url,
        0 as depth
      FROM shares s
      INNER JOIN files f ON s.file_id = f.id
      LEFT JOIN users u_by ON s.shared_by_user_id = u_by.id
      LEFT JOIN users u_with ON s.shared_with_user_id = u_with.id
      WHERE s.shared_with_user_id = :userId
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
        sfr.shared_by_id, sfr.shared_by_email, sfr.shared_by_display_name, sfr.shared_by_avatar_url,
        sfr.shared_with_id, sfr.shared_with_email, sfr.shared_with_display_name, sfr.shared_with_avatar_url,
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
          'shared_by_user', JSON_BUILD_OBJECT(
            'id', sfr.shared_by_id,
            'email', sfr.shared_by_email,
            'display_name', sfr.shared_by_display_name,
            'avatar_url', sfr.shared_by_avatar_url
          ),
          'shared_with_user', JSON_BUILD_OBJECT(
            'id', sfr.shared_with_id,
            'email', sfr.shared_with_email,
            'display_name', sfr.shared_with_display_name,
            'avatar_url', sfr.shared_with_avatar_url
          ),
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

const emptyTrash = async (userId: string) => {
  const deletedFiles = await db.File.destroy({
    where: {
      owner_id: userId,
      deleted_at: { [Op.ne]: null }
    },
    force: true
  });
  return deletedFiles;
};

const getRecents = async (userId: string, page: number = 1, limit: number = 20) => {
  const safePage = Number.isFinite(page) && page > 0 ? Math.trunc(page) : 1;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.trunc(limit) : 20;
  const offset = (safePage - 1) * safeLimit;

  const { rows, count } = await db.File.findAndCountAll({
    where: { owner_id: userId, deleted_at: null, [Op.and]: [literal('last_accessed_at IS NOT NULL')] },
    order: [["last_accessed_at", "DESC"]],
    attributes: [
      'id',
      'name',
      'access_level',
      'file_info',
      'created_at',
      'last_accessed_at'
    ],
    limit: safeLimit,
    offset
  });

  return {
    files: rows,
    metadata: {
      total: count,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(count / safeLimit)
    }
  };
};

/**
 * Update the file's access level recursively
 * When a folder's access level is changed, all its children (files and subfolders) 
 * will also have their access level updated to match the parent's new access level.
 */
const updateFileAccessLevel = async (fileId: string, userId: string, accessLevel: AccessLevel) => {
  // First, verify the file exists and user is the owner
  const targetFile = await db.File.findOne({
    where: { id: fileId, owner_id: userId },
    attributes: ['id', 'is_folder', 'access_level']
  });

  if (!targetFile) {
    throw new Error('File not found or you do not have permission to update it');
  }

  // Use a recursive query to update the target file and all its descendants
  const query = `
    WITH RECURSIVE file_tree AS (
      -- Base case: the target file/folder
      SELECT id, parent_id, is_folder
      FROM files
      WHERE id = :fileId AND owner_id = :userId AND deleted_at IS NULL
      
      UNION ALL
      
      -- Recursive case: all descendants
      SELECT f.id, f.parent_id, f.is_folder
      FROM files f
      INNER JOIN file_tree ft ON f.parent_id = ft.id
      WHERE f.owner_id = :userId AND f.deleted_at IS NULL
    )
    UPDATE files
    SET access_level = :accessLevel, updated_at = NOW()
    FROM file_tree
    WHERE files.id = file_tree.id
    RETURNING files.id;
  `;

  const result = await db.connection.query(query, {
    type: QueryTypes.UPDATE,
    replacements: { fileId, userId, accessLevel }
  });

  // Return the count of updated files
  return result[1] || 0;
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
  getAllSharedFilesSingleQuery,
  emptyTrash,
  updateLastAccessed,
  getRecents,
  updateFileAccessLevel
}