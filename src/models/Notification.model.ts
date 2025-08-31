import { DataTypes, Model, type Optional, Sequelize } from 'sequelize';
import { NotificationType } from './enums';

// Define the attributes interface
export interface NotificationAttributes {
    id: string;
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
export interface NotificationCreationAttributes extends Optional<NotificationAttributes, 'id' | 'created_at' | 'is_read' | 'data'> { }

// Define the Notification model class
export class Notification extends Model<NotificationAttributes, NotificationCreationAttributes> implements NotificationAttributes {
    declare id: string;
    declare user_id: string;
    declare type: NotificationType;
    declare title: string;
    declare message: string;
    declare file_id?: string;
    declare related_user_id?: string;
    declare is_read: boolean;
    declare data: Record<string, any>;

    // Timestamps
    declare readonly created_at: Date;
    declare readonly updated_at: Date;
}

// Define the model function
export const NotificationModel = (sequelize: Sequelize) => {
    Notification.init(
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
                    key: 'id',
                },
                onDelete: 'CASCADE',
            },
            related_user_id: {
                type: DataTypes.UUID,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'id',
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
