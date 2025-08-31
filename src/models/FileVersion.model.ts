import { DataTypes, Model, type Optional, Sequelize } from 'sequelize';

// Define the attributes interface
export interface FileVersionAttributes {
    id: string;
    file_id: string;
    version_number: number;
    storage_path: string;
    file_size: number;
    checksum?: string;
    created_by_user_id: string;
    created_at: Date;
}

// Define the creation attributes
export interface FileVersionCreationAttributes extends Optional<FileVersionAttributes, 'id' | 'created_at'> {}

// Define the FileVersion model class
export class FileVersion extends Model<FileVersionAttributes, FileVersionCreationAttributes> implements FileVersionAttributes {
    public id!: string;
    public file_id!: string;
    public version_number!: number;
    public storage_path!: string;
    public file_size!: number;
    public checksum?: string;
    public created_by_user_id!: string;

    // Timestamps
    public readonly created_at!: Date;
    public readonly updated_at!: Date;
}

// Define the model function
export const FileVersionModel = (sequelize: Sequelize) => {
    FileVersion.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },
            file_id: {
                type: DataTypes.UUID,
                allowNull: false,
                references: {
                    model: 'files',
                    key: 'id',
                },
                onDelete: 'CASCADE',
            },
            version_number: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            storage_path: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            file_size: {
                type: DataTypes.BIGINT,
                allowNull: false,
            },
            checksum: {
                type: DataTypes.STRING(64),
                allowNull: true,
            },
            created_by_user_id: {
                type: DataTypes.UUID,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
            },
            created_at: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW,
                allowNull: false,
            },
        },
        {
            sequelize,
            tableName: 'file_versions',
            timestamps: false, // We only have created_at, not updated_at
            indexes: [
                {
                    fields: ['file_id'],
                },
                {
                    fields: ['created_at'],
                },
                {
                    unique: true,
                    fields: ['file_id', 'version_number'],
                },
            ],
        }
    );

    return FileVersion;
};
