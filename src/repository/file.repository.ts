import db from "@/config/database"
import { type FileAttributes } from "@/models/File.model"

const createFolder = async (value: FileAttributes) => {
    const folder = await db.File.create(value);
    return folder;
}


export default {
    createFolder
}