import type { QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX unique_folder_name_per_parent
      ON files (
        owner_id,
        is_folder,
        name,
        COALESCE(parent_id, '00000000-0000-0000-0000-000000000000')
      );
  `);
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(`
    DROP INDEX unique_folder_name_per_parent ON files;
  `);
}