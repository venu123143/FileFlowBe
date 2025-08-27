import { DataTypes, Model, type Optional, Sequelize } from 'sequelize';
import { NotificationType } from './enums';

// Define the attributes interface
export interface NotificationAttributes {
    notification_id: string;
    user_id: string;
    type: NotificationType;
    title: string;
    message: string;
    file_id?: string;
    related_user_id?: string;
    is_read: boolean;
    created_at: Date;
    data: Record<string, any>;
}

// Define the creation attributes
export interface NotificationCreationAttributes extends Optional<NotificationAttributes, 'notification_id' | 'created_at' | 'is_read' | 'data'> { }

// Define the Notification model class
export class Notification extends Model<NotificationAttributes, NotificationCreationAttributes> implements NotificationAttributes {
    public notification_id!: string;
    public user_id!: string;
    public type!: NotificationType;
    public title!: string;
    public message!: string;
    public file_id?: string;
    public related_user_id?: string;
    public is_read!: boolean;
    public created_at!: Date;
    public data!: Record<string, any>;

    // Timestamps
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

// Define the model function
export const NotificationModel = (sequelize: Sequelize) => {
    Notification.init(
        {
            notification_id: {
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
            type: {
                type: DataTypes.ENUM(...Object.values(NotificationType)),
                allowNull: false,
            },
            title: {
                type: DataTypes.STRING(255),
                allowNull: false,
            },
            message: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            file_id: {
                type: DataTypes.UUID,
                allowNull: true,
                references: {
                    model: 'files',
                    key: 'file_id',
                },
                onDelete: 'CASCADE',
            },
            related_user_id: {
                type: DataTypes.UUID,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'user_id',
                },
                onDelete: 'CASCADE',
            },
            is_read: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
                allowNull: false,
            },
            created_at: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW,
                allowNull: false,
            },
            data: {
                type: DataTypes.JSONB,
                defaultValue: {},
                allowNull: false,
            },
        },
        {
            sequelize,
            tableName: 'notifications',
            timestamps: false, // We only have created_at, not updated_at
            indexes: [
                {
                    fields: ['user_id'],
                },
                {
                    fields: ['is_read'],
                },
                {
                    fields: ['created_at'],
                },
            ],
        }
    );

    return Notification;
};
