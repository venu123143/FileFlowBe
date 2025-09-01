import { QueryInterface } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';

export default {
  async up(queryInterface: QueryInterface) {
    const files = [];
    const folderIds = [];
    let counter = 0;

    // Create root level folders
    for (let i = 0; i < 5; i++) {
      const id = uuidv4();
      folderIds.push(id);
      files.push({
        id,
        owner_id: '82bf41b7-9f53-4045-8cfa-5d525323b997',
        name: `Root Folder ${counter++}`,
        is_folder: true,
        access_level: 'private',
        tags: ['tag1'],
        metadata: null,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    // Create level 1 folders and files
    for (let i = 0; i < 10; i++) {
      const id = uuidv4();
      const parentId = folderIds[Math.floor(Math.random() * folderIds.length)];
      files.push({
        id,
        owner_id: '82bf41b7-9f53-4045-8cfa-5d525323b997',
        parent_id: parentId,
        name: `Folder/File ${counter++}`,
        is_folder: i % 2 === 0,
        access_level: 'private',
        tags: ['tag1'],
        metadata: null,
        created_at: new Date(),
        updated_at: new Date(),
      });
      if (i % 2 === 0) {
        folderIds.push(id);
      }
    }

    // Create level 2-5 folders and files
    for (let i = 0; i < 35; i++) {
      const id = uuidv4();
      const parentId = folderIds[Math.floor(Math.random() * folderIds.length)];
      files.push({
        id,
        owner_id: '82bf41b7-9f53-4045-8cfa-5d525323b997',
        parent_id: parentId,
        name: `Folder/File ${counter++}`,
        is_folder: i % 2 === 0,
        access_level: 'private',
        tags: ['tag1'],
        metadata: null,
        created_at: new Date(),
        updated_at: new Date(),
      });
      if (i % 2 === 0) {
        folderIds.push(id);
      }
    }

    await queryInterface.bulkInsert('files', files);
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.bulkDelete('files', {}, {});
  }
};