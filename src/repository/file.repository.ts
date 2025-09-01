import db from "@/config/database"
import { type FileAttributes } from "@/models/File.model"
import type { Transaction } from "sequelize";

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

export default {
    createFolder,
    renameFolder,
    moveFileOrFile,
    createFile
}