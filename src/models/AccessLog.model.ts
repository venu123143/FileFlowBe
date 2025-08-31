import { DataTypes, Model, type Optional, Sequelize } from 'sequelize';
import { AccessAction } from './enums';

// Define the attributes interface
export interface AccessLogAttributes {
    id: string;
    file_id?: string;
    user_id?: string;
    action: AccessAction;
    ip_address?: string;
    user_agent?: string;
    access_time: Date;
    metadata: Record<string, any>;
    success: boolean;
    error_message?: string;
    referrer?: string;
    session_id?: string;
}

// Define the creation attributes
export interface AccessLogCreationAttributes extends Optional<AccessLogAttributes, 'id' | 'access_time' | 'metadata' | 'success'> { }

// Define the AccessLog model class
export class AccessLog extends Model<AccessLogAttributes, AccessLogCreationAttributes> implements AccessLogAttributes {
    declare id: string;
    declare file_id?: string;
    declare user_id?: string;
    declare action: AccessAction;
    declare ip_address?: string;
    declare user_agent?: string;
    declare access_time: Date;
    declare metadata: Record<string, any>;
    declare success: boolean;
    declare error_message?: string;
    declare referrer?: string;
    declare session_id?: string;

    // Timestamps
    declare readonly created_at: Date;
    declare readonly updated_at: Date;
}

// Define the model function
export const AccessLogModel = (sequelize: Sequelize) => {
    AccessLog.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
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
            user_id: {
                type: DataTypes.UUID,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'id',
                },
                onDelete: 'SET NULL',
            },
            action: {
                type: DataTypes.ENUM(...Object.values(AccessAction)),
                allowNull: false,
            },
            ip_address: {
                type: DataTypes.INET,
                allowNull: true,
            },
            user_agent: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            access_time: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW,
                allowNull: false,
            },
            metadata: {
                type: DataTypes.JSONB,
                defaultValue: {},
                allowNull: false,
            },
            success: {
                type: DataTypes.BOOLEAN,
                defaultValue: true,
                allowNull: false,
            },
            error_message: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            referrer: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            session_id: {
                type: DataTypes.STRING(64),
                allowNull: true,
            },
        },
        {
            sequelize,
            tableName: 'access_logs',
            timestamps: false, // We only have access_time, not created_at/updated_at
            indexes: [
                {
                    fields: ['file_id'],
                },
                {
                    fields: ['user_id'],
                },
                {
                    fields: ['access_time'],
                },
                {
                    fields: ['action'],
                },
                {
                    fields: ['session_id'],
                },
            ],
        }
    );

    return AccessLog;
};
