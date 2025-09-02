import type { QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  // Create the shared children recursive function
  await queryInterface.sequelize.query(`
    CREATE OR REPLACE FUNCTION build_shared_children_recursive(parent_uuid UUID, share_id_param UUID)
    RETURNS JSON AS $
    DECLARE
        result JSON;
        share_info RECORD;
    BEGIN
        -- Get share information once for this tree
        SELECT s.shared_by_user_id, s.shared_with_user_id, s.permission_level, 
               s.message, s.expires_at, s.created_at as share_created_at
        INTO share_info
        FROM shares s
        WHERE s.id = share_id_param;
        
        -- If share not found, return empty array
        IF NOT FOUND THEN
            RETURN '[]'::json;
        END IF;
        
        -- Build the children recursively
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
                'share_id', share_id_param,
                'shared_by_user_id', share_info.shared_by_user_id,
                'shared_with_user_id', share_info.shared_with_user_id,
                'permission_level', share_info.permission_level,
                'share_message', share_info.message,
                'expires_at', share_info.expires_at,
                'share_created_at', share_info.share_created_at,
                'children', CASE 
                    WHEN f.is_folder = true THEN build_shared_children_recursive(f.id, share_id_param)
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
    $ LANGUAGE plpgsql;
  `);

  // -- Create an index to improve performance for share lookups
  await queryInterface.sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_shares_composite_lookup 
    ON shares(shared_with_user_id, shared_by_user_id, expires_at, created_at);
  `);

  // -- Create an index for file parent lookups in sharing context  
  await queryInterface.sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_files_parent_deleted_lookup 
    ON files(parent_id, deleted_at, is_folder, name) WHERE deleted_at IS NULL;
  `);
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query('DROP FUNCTION IF EXISTS build_shared_children_recursive(UUID, UUID);');
  await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_shares_composite_lookup;');
  await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_files_parent_deleted_lookup;');
}