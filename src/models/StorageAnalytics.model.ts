import { DataTypes, Model, type Optional, Sequelize } from 'sequelize';

// Define the attributes interface
export interface StorageAnalyticsAttributes {
    analytics_id: string;
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
export interface StorageAnalyticsCreationAttributes extends Optional<StorageAnalyticsAttributes, 'analytics_id' | 'created_at' | 'total_files' | 'total_folders' | 'total_size' | 'images_count' | 'images_size' | 'videos_count' | 'videos_size' | 'audio_count' | 'audio_size' | 'documents_count' | 'documents_size' | 'other_count' | 'other_size' | 'uploads_today' | 'downloads_today' | 'shares_created_today' | 'public_links_created_today'> {}

// Define the StorageAnalytics model class
export class StorageAnalytics extends Model<StorageAnalyticsAttributes, StorageAnalyticsCreationAttributes> implements StorageAnalyticsAttributes {
    public analytics_id!: string;
    public user_id!: string;
    public date!: Date;
    public total_files!: number;
    public total_folders!: number;
    public total_size!: number;
    public images_count!: number;
    public images_size!: number;
    public videos_count!: number;
    public videos_size!: number;
    public audio_count!: number;
    public audio_size!: number;
    public documents_count!: number;
    public documents_size!: number;
    public other_count!: number;
    public other_size!: number;
    public uploads_today!: number;
    public downloads_today!: number;
    public shares_created_today!: number;
    public public_links_created_today!: number;
    public created_at!: Date;

    // Timestamps
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

// Define the model function
export const StorageAnalyticsModel = (sequelize: Sequelize) => {
    StorageAnalytics.init(
        {
            analytics_id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },
            user_id: {
                type: DataTypes.UUID,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'user_id',
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
