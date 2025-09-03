import { DataTypes, Model, type Optional, Sequelize } from 'sequelize';

export enum UserRole {
    USER = 'USER',
    ADMIN = 'ADMIN',
}

// Define the attributes interface
export interface IUserAttributes {
    id: string;
    email: string;
    role: UserRole;
    password_hash: string;
    display_name?: string;
    avatar_url?: string;
    storage_quota: number;
    last_login?: Date;
    is_active: boolean;
    email_verified: boolean;
    two_factor_enabled: boolean;
    preferences: Record<string, any>;
}

// Define the creation attributes (optional fields for creation)
export interface UserCreationAttributes extends Optional<IUserAttributes, 'id' | 'storage_quota' | 'is_active' | 'email_verified' | 'two_factor_enabled' | 'preferences'> { }

// Define the User model class
export class User extends Model<IUserAttributes, UserCreationAttributes> implements IUserAttributes {
    declare id: string;
    declare email: string;
    declare role: UserRole;
    declare password_hash: string;
    declare display_name?: string;
    declare avatar_url?: string;
    declare storage_quota: number;
    declare last_login?: Date;
    declare is_active: boolean;
    declare email_verified: boolean;
    declare two_factor_enabled: boolean;
    declare preferences: Record<string, any>;

    // Timestamps
    declare readonly created_at: Date;
    declare readonly updated_at: Date;
}

// Define the model function
export const UserModel = (sequelize: Sequelize) => {
    User.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },
            email: {
                type: DataTypes.STRING(255),
                allowNull: false,
                unique: true,
                validate: {
                    isEmail: true,
                },
            },
            role: {
                type: DataTypes.ENUM,
                values: Object.values(UserRole),
                defaultValue: UserRole.USER,
                allowNull: false,
            },
            password_hash: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            display_name: {
                type: DataTypes.STRING(100),
                allowNull: true,
            },
            avatar_url: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            storage_quota: {
                type: DataTypes.BIGINT,
                defaultValue: 107374182400, // 100GB in bytes
                allowNull: false,
            },
            last_login: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                defaultValue: true,
                allowNull: false,
            },
            email_verified: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
                allowNull: false,
            },
            two_factor_enabled: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
                allowNull: false,
            },
            preferences: {
                type: DataTypes.JSONB,
                defaultValue: {},
                allowNull: false,
            },
        },
        {
            sequelize,
            tableName: 'users',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                {
                    fields: ['email'],
                },
                {
                    fields: ['is_active'],
                },
                {
                    fields: ['created_at'],
                },
            ],
        }
    );

    return User;
};
