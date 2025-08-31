import { type Context } from "hono";
import res from "@/utils/response";
import { type FileAttributes } from "@/models/File.model";
import type { InferSchemaType } from "@/utils/validation";
import fileDtoValidation from "@/validation/file.validation";
import fileRepository from "@/repository/file.repository";
import type { IUserAttributes } from "@/models/User.model";
import { ForeignKeyConstraintError, UniqueConstraintError } from "sequelize";

// add this in the migration file, to have the unique constraint on the folder name (root level).
// CREATE UNIQUE INDEX unique_folder_name_per_parent
//       ON files (
//         owner_id,
//         is_folder,
//         name,
//         COALESCE(parent_id, '00000000-0000-0000-0000-000000000000')
//       )
const createFolder = async (c: Context) => {
    try {
        type CreateFolderBody = InferSchemaType<typeof fileDtoValidation.createFolderValidation>;
        const value = c.get<CreateFolderBody>('validated');
        const user = c.get('user') as IUserAttributes;

        const folder: FileAttributes = {
            owner_id: user.id,
            name: value.name,
            parent_id: value.parent_id ?? null,
            access_level: value.access_level,
            description: value.description,
            tags: value.tags,
            is_folder: true,
            metadata: null,
        };

        const createdFolder = await fileRepository.createFolder(folder);
        return res.SuccessResponse(c, 201, { message: "Folder created successfully", data: createdFolder });

    } catch (error: any) {
        // Custom handling for invalid parent_id (FK violation)
        if (error instanceof ForeignKeyConstraintError && error.index === "files_parent_id_fkey") {
            return res.FailureResponse(c, 422, {
                message: "Invalid parent folder ID. The specified folder does not exist."
            });
        }
        if (error instanceof UniqueConstraintError) {
            return res.FailureResponse(c, 409, {
                message: "A folder with this name already exists in the same location."
            });
        }
        return res.FailureResponse(c, 500, { message: "Internal server error" });
    }
};

export default {
    createFolder
};
