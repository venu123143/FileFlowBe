import { DataTypes, Model, type Optional, Sequelize } from 'sequelize';

// Define the attributes interface
export interface StorageAnalyticsAttributes {
    id: string;
    user_id: string;
    date: Date;
    total_files: number;
    total_folders: number;
    total_size: number;
    images_count: number;
    images_size: number;
    videos_count: number;
    videos_size: number;
    audio_count: number;
    audio_size: number;
    documents_count: number;
    documents_size: number;
    other_count: number;
    other_size: number;
    uploads_today: number;
    downloads_today: number;
    shares_created_today: number;
    public_links_created_today: number;
    created_at: Date;
}

// Define the creation attributes
export interface StorageAnalyticsCreationAttributes extends Optional<StorageAnalyticsAttributes, 'id' | 'created_at' | 'total_files' | 'total_folders' | 'total_size' | 'images_count' | 'images_size' | 'videos_count' | 'videos_size' | 'audio_count' | 'audio_size' | 'documents_count' | 'documents_size' | 'other_count' | 'other_size' | 'uploads_today' | 'downloads_today' | 'shares_created_today' | 'public_links_created_today'> {}

// Define the StorageAnalytics model class
export class StorageAnalytics extends Model<StorageAnalyticsAttributes, StorageAnalyticsCreationAttributes> implements StorageAnalyticsAttributes {
    declare id: string;
    declare user_id: string;
    declare date: Date;
    declare total_files: number;
    declare total_folders: number;
    declare total_size: number;
    declare images_count: number;
    declare images_size: number;
    declare videos_count: number;
    declare videos_size: number;
    declare audio_count: number;
    declare audio_size: number;
    declare documents_count: number;
    declare documents_size: number;
    declare other_count: number;
    declare other_size: number;
    declare uploads_today: number;
    declare downloads_today: number;
    declare shares_created_today: number;
    declare public_links_created_today: number;

    // Timestamps
    declare readonly created_at: Date;
    declare readonly updated_at: Date;
}

// Define the model function
export const StorageAnalyticsModel = (sequelize: Sequelize) => {
    StorageAnalytics.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },
            user_id: {
                type: DataTypes.UUID,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
                onDelete: 'CASCADE',
            },
            date: {
                type: DataTypes.DATEONLY,
                defaultValue: DataTypes.NOW,
                allowNull: false,
            },
            total_files: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
                allowNull: false,
            },
            total_folders: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
                allowNull: false,
            },
            total_size: {
                type: DataTypes.BIGINT,
                defaultValue: 0,
                allowNull: false,
            },
            images_count: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
                allowNull: false,
            },
            images_size: {
                type: DataTypes.BIGINT,
                defaultValue: 0,
                allowNull: false,
            },
            videos_count: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
                allowNull: false,
            },
            videos_size: {
                type: DataTypes.BIGINT,
                defaultValue: 0,
                allowNull: false,
            },
            audio_count: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
                allowNull: false,
            },
            audio_size: {
                type: DataTypes.BIGINT,
                defaultValue: 0,
                allowNull: false,
            },
            documents_count: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
                allowNull: false,
            },
            documents_size: {
                type: DataTypes.BIGINT,
                defaultValue: 0,
                allowNull: false,
            },
            other_count: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
                allowNull: false,
            },
            other_size: {
                type: DataTypes.BIGINT,
                defaultValue: 0,
                allowNull: false,
            },
            uploads_today: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
                allowNull: false,
            },
            downloads_today: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
                allowNull: false,
            },
            shares_created_today: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
                allowNull: false,
            },
            public_links_created_today: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
                allowNull: false,
            },
            created_at: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW,
                allowNull: false,
            },
        },
        {
            sequelize,
            tableName: 'storage_analytics',
            timestamps: false, // We only have created_at, not updated_at
            indexes: [
                {
                    fields: ['date'],
                },
                {
                    unique: true,
                    fields: ['user_id', 'date'],
                },
            ],
        }
    );

    return StorageAnalytics;
};
