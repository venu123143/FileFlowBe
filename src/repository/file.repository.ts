import db from "@/config/database"
import { type FileAttributes } from "@/models/File.model"
import { QueryTypes, type Transaction } from "sequelize";

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

const getFileSystemTree = async (userId: string) => {
    const query = `
        -- Simple recursive query without the problematic CTE approach
        -- This approach is cleaner and avoids type conflicts

        -- Recommended approach using PostgreSQL function
        -- Create the recursive function first:

        CREATE OR REPLACE FUNCTION build_children_recursive(parent_uuid UUID)
        RETURNS JSON AS $$
        DECLARE
            result JSON;
        BEGIN
            SELECT JSON_AGG(
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
            ) INTO result
            FROM files f
            WHERE f.parent_id = parent_uuid 
            AND f.deleted_at IS NULL;
            
            RETURN COALESCE(result, '[]'::json);
        END;
        $$ LANGUAGE plpgsql;

        -- Simplified query using the function:
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
        AND f.deleted_at IS NULL;

        -- Query for specific user's file system:
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
    const result = await db.connection.query(query, { type: QueryTypes.RAW, replacements: { userId } });
    return result;
};


export default {
    createFolder,
    renameFolder,
    moveFileOrFile,
    createFile,
    getFileSystemTree
}