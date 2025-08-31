import { DataTypes, Model, Op, type Optional, Sequelize } from 'sequelize';

// Define the attributes interface
export interface FileAttributes {
    id: string;
    owner_id: string;
    parent_id?: string;
    name: string;
    is_folder: boolean;
    file_type?: string;
    file_size: number;
    storage_path?: string;
    thumbnail_path?: string;
    duration?: number;
    dimensions?: Record<string, any>;
    is_public: boolean;
    public_link_token?: string;
    public_link_password_hash?: string;
    public_link_expires_at?: Date;
    pin_hash?: string;
    is_deleted: boolean;
    deleted_at?: Date;
    deleted_by_user_id?: string;
    auto_delete_at?: Date;
    version: number;
    description?: string;
    tags: string[];
    metadata: Record<string, any>;
    last_accessed_at?: Date;
}

// Define the creation attributes
export interface FileCreationAttributes extends Optional<FileAttributes, 'id' | 'is_folder' | 'file_size' | 'is_public' | 'is_deleted' | 'version' | 'tags' | 'metadata'> { }

// Define the File model class
export class File extends Model<FileAttributes, FileCreationAttributes> implements FileAttributes {
    declare id: string;
    declare owner_id: string;
    declare parent_id?: string;
    declare name: string;
    declare is_folder: boolean;
    declare file_type?: string;
    declare file_size: number;
    declare storage_path?: string;
    declare thumbnail_path?: string;
    declare duration?: number;
    declare dimensions?: Record<string, any>;
    declare is_public: boolean;
    declare public_link_token?: string;
    declare public_link_password_hash?: string;
    declare public_link_expires_at?: Date;
    declare pin_hash?: string;
    declare is_deleted: boolean;
    declare deleted_at?: Date;
    declare deleted_by_user_id?: string;
    declare auto_delete_at?: Date;
    declare version: number;
    declare description?: string;
    declare tags: string[];
    declare metadata: Record<string, any>;
    declare last_accessed_at?: Date;

    // Timestamps
    declare readonly created_at: Date;
    declare readonly updated_at: Date;
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
            file_type: {
                type: DataTypes.STRING(100),
                allowNull: true,
            },
            file_size: {
                type: DataTypes.BIGINT,
                defaultValue: 0,
                allowNull: false,
            },
            storage_path: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            thumbnail_path: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            duration: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            dimensions: {
                type: DataTypes.JSONB,
                allowNull: true,
            },
            is_public: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
                allowNull: false,
            },
            public_link_token: {
                type: DataTypes.STRING(64),
                allowNull: true,
                unique: true,
            },
            public_link_password_hash: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            public_link_expires_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            pin_hash: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            is_deleted: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
                allowNull: false,
            },
            deleted_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            deleted_by_user_id: {
                type: DataTypes.UUID,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'id',
                },
            },
            auto_delete_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            version: {
                type: DataTypes.INTEGER,
                defaultValue: 1,
                allowNull: false,
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            tags: {
                type: DataTypes.ARRAY(DataTypes.TEXT),
                defaultValue: [],
                allowNull: false,
            },
            metadata: {
                type: DataTypes.JSONB,
                defaultValue: {},
                allowNull: false,
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
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                {
                    fields: ['owner_id'],
                },
                {
                    fields: ['parent_id'],
                },
                {
                    fields: ['is_public'],
                    where: {
                        is_public: true,
                    },
                },
                {
                    fields: ['is_folder'],
                },
                {
                    fields: ['name'],
                },
                {
                    fields: ['created_at'],
                },
                {
                    fields: ['file_type'],
                },
                {
                    fields: ['is_deleted'],
                },
                {
                    fields: ['public_link_token'],
                    where: {
                        public_link_token: {
                            [Op.ne]: null,
                        },
                    },
                },
                {
                    fields: ['auto_delete_at'],
                    where: {
                        auto_delete_at: {
                            [Op.ne]: null,
                        },
                    },
                },
                {
                    fields: ['tags'],
                    using: 'gin',
                },
                {
                    fields: ['metadata'],
                    using: 'gin',
                },
            ],
            validate: {
                uniqueNamePerParent() {
                    // This validation will be handled at the database level
                },
                checkFolderNoFileData() {
                    if (this.is_folder && (this.file_type || this.storage_path)) {
                        throw new Error('Folders cannot have file_type or storage_path');
                    }
                },
                checkDeletedMetadata() {
                    if (this.is_deleted) {
                        if (!this.deleted_at || !this.auto_delete_at) {
                            throw new Error('Deleted files must have deleted_at and auto_delete_at');
                        }
                    } else {
                        if (this.deleted_at || this.auto_delete_at) {
                            throw new Error('Non-deleted files cannot have deleted_at or auto_delete_at');
                        }
                    }
                },
            },
        }
    );

    return File;
};
