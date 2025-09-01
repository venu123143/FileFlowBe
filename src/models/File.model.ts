import { DataTypes, Model, type Optional, Sequelize } from 'sequelize';

// Access control enum
export enum AccessLevel {
    PUBLIC = "public",
    PRIVATE = "private",
    PROTECTED = "protected",
}

export interface IFileInfo {
    file_type: string;        // e.g. "image/png", "video/mp4"
    file_size: number;        // in bytes
    storage_path: string;     // internal storage path
    thumbnail_path?: string;   // path to generated thumbnail (if image/video)
    duration?: number;         // media duration in seconds (for audio/video)                        // image/video dimensions
}


// Define the attributes interface
export interface FileAttributes {
    id?: string;
    owner_id: string;
    parent_id?: string;
    name: string;
    is_folder: boolean;
    access_level: AccessLevel;
    file_info?: IFileInfo | null;
    description?: string;
    tags: string[];
    metadata: Record<string, any> | null;
    last_accessed_at?: Date;
}

// Define the creation attributes
export interface FileCreationAttributes extends Optional<FileAttributes, 'id' | 'is_folder' | 'access_level' | 'file_info' | 'tags' | 'metadata'> { }

// Define the File model class
export class File extends Model<FileAttributes, FileCreationAttributes> implements FileAttributes {
    declare id: string;
    declare owner_id: string;
    declare parent_id?: string;
    declare name: string;
    declare is_folder: boolean;
    declare access_level: AccessLevel;
    declare file_info?: IFileInfo | null;
    declare description?: string;
    declare tags: string[];
    declare metadata: Record<string, any> | null;
    declare last_accessed_at?: Date;

    // Timestamps
    declare readonly created_at: Date;
    declare readonly updated_at: Date;
    declare readonly deleted_at: Date; // comes from paranoid: true
}

// Define the model function
export const FileModel = (sequelize: Sequelize) => {
    File.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },
            owner_id: {
                type: DataTypes.UUID,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
                onDelete: 'CASCADE',
            },
            parent_id: {
                type: DataTypes.UUID,
                allowNull: true,
                references: {
                    model: 'files',
                    key: 'id',
                },
                onDelete: 'CASCADE',
            },
            name: {
                type: DataTypes.STRING(255),
                allowNull: false,
            },
            is_folder: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
                allowNull: false,
            },
            access_level: {
                type: DataTypes.ENUM(...Object.values(AccessLevel)),
                defaultValue: AccessLevel.PRIVATE,
                allowNull: false,
            },
            file_info: {
                type: DataTypes.JSONB,
                allowNull: true,
                comment: "Holds file-specific properties (size, type, duration, etc.)",
            },
            description: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            tags: {
                type: DataTypes.ARRAY(DataTypes.TEXT),
                defaultValue: [],
                allowNull: false,
            },
            metadata: {
                type: DataTypes.JSONB,
                defaultValue: null,
                allowNull: true,
            },
            last_accessed_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        {
            sequelize,
            tableName: 'files',
            timestamps: true,
            paranoid: true, // enables soft deletes with deleted_at
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            deletedAt: 'deleted_at',
            indexes: [
                { fields: ['owner_id'] },
                { fields: ['parent_id'] },
                { fields: ['access_level'] },
                { fields: ['is_folder'] },
                { fields: ['name'] },
                { fields: ['created_at'] },
                { fields: ['tags'], using: 'gin' },
                { fields: ['metadata'], using: 'gin' },
                {
                    unique: true,
                    fields: ['parent_id', 'name', 'owner_id', 'is_folder'], // composite unique
                },
            ],
        }
    );

    return File;
};
