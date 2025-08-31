import { DataTypes, Model, type Optional, Sequelize } from 'sequelize';

// Interface for UserSession attributes
export interface IUserSessionAttributes {
    id?: string;
    user_id: string;
    session_token: string;
    created_at?: Date;
    expires_at: Date;
    is_active?: boolean;
    metadata?: object | null;
    device_token?: string | null;
}

// Optional attributes for creation
type IUserSessionCreationAttributes = Optional<IUserSessionAttributes, 'id' | 'created_at' | 'is_active'>;

// Sequelize Model class for UserSession
export class UserSession extends Model<IUserSessionAttributes, IUserSessionCreationAttributes> implements IUserSessionAttributes {
    declare id: string;
    declare user_id: string;
    declare session_token: string;
    declare created_at: Date;
    declare expires_at: Date;
    declare is_active: boolean;
    declare metadata: object | null;
    declare device_token: string | null;
}

// Model initialization function
export const UserSessionModel = (sequelize: Sequelize): typeof UserSession => {
    UserSession.init({
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
        },
        session_token: {
            type: DataTypes.TEXT,
            allowNull: false,
            unique: true,
        },
        expires_at: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
        },
        metadata: {
            type: DataTypes.JSONB,
            allowNull: true,
        },
        device_token: {
            type: DataTypes.STRING,
            allowNull: true,
        },
    }, {
        sequelize,
        tableName: "user_sessions",
        freezeTableName: true,
        timestamps: true, // `createdAt` and `updatedAt` are auto-generated
        underscored: true,
        createdAt: 'created_at',
        updatedAt: false, // The original schema doesn't have an updatedAt column
        indexes: [
            {
                fields: ['user_id'],
                name: 'idx_user_sessions_user_id',
            },
            {
                fields: ['session_token'],
                name: 'idx_user_sessions_session_token',
                unique: true,
            },
        ],
    });

    return UserSession;
};
