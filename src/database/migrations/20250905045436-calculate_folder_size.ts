import type { QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(`
    CREATE OR REPLACE FUNCTION calculate_folder_size(folder_uuid UUID)
    RETURNS BIGINT AS $$
    DECLARE
        total_size BIGINT := 0;
    BEGIN
        -- Use recursive CTE to get all descendants and sum their file sizes
        WITH RECURSIVE folder_contents AS (
            -- Base case: direct children of the folder
            SELECT 
                id, 
                is_folder, 
                file_info,
                parent_id
            FROM files 
            WHERE parent_id = folder_uuid 
              AND deleted_at IS NULL
            
            UNION ALL
            
            -- Recursive case: children of children
            SELECT 
                f.id, 
                f.is_folder, 
                f.file_info,
                f.parent_id
            FROM files f
            INNER JOIN folder_contents fc ON f.parent_id = fc.id
            WHERE f.deleted_at IS NULL
        )
        SELECT COALESCE(SUM(
            CASE 
                WHEN is_folder = false AND file_info IS NOT NULL 
                THEN (file_info->>'file_size')::BIGINT
                ELSE 0 
            END
        ), 0)
        INTO total_size
        FROM folder_contents;
        
        RETURN total_size;
    END;
    $$ LANGUAGE plpgsql;
  `);
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(`
    DROP FUNCTION IF EXISTS calculate_folder_size(UUID);
  `);
}