import type { QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(`
    CREATE OR REPLACE FUNCTION build_children_recursive(parent_uuid UUID, filter_access_level TEXT DEFAULT NULL)
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
                    WHEN f.is_folder = true THEN build_children_recursive(f.id, filter_access_level)
                    ELSE '[]'::json
                END
            )
            ORDER BY f.is_folder DESC, f.name ASC
        ) INTO result
        FROM files f
        WHERE f.parent_id = parent_uuid 
          AND f.deleted_at IS NULL
          AND (filter_access_level IS NULL OR f.access_level::TEXT = filter_access_level);
        
        RETURN COALESCE(result, '[]'::json);
    END;
    $$ LANGUAGE plpgsql;
  `);
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query('DROP FUNCTION IF EXISTS build_children_recursive(UUID, TEXT);');
}