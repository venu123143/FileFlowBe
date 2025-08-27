import { DataTypes, Model,type Optional, Sequelize } from 'sequelize';

// Define the attributes interface
export interface UserAttributes {
    user_id: string;
    username: string;
    email: string;
    password_hash: string;
    display_name?: string;
    avatar_url?: string;
    storage_quota: number;
    is_premium: boolean;
    created_at: Date;
    updated_at: Date;
    last_login?: Date;
    is_active: boolean;
    email_verified: boolean;
    two_factor_enabled: boolean;
    preferences: Record<string, any>;
}

// Define the creation attributes (optional fields for creation)
export interface UserCreationAttributes extends Optional<UserAttributes, 'user_id' | 'created_at' | 'updated_at' | 'storage_quota' | 'is_premium' | 'is_active' | 'email_verified' | 'two_factor_enabled' | 'preferences'> {}

// Define the User model class
export class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
    public user_id!: string;
    public username!: string;
    public email!: string;
    public password_hash!: string;
    public display_name?: string;
    public avatar_url?: string;
    public storage_quota!: number;
    public is_premium!: boolean;
    public created_at!: Date;
    public updated_at!: Date;
    public last_login?: Date;
    public is_active!: boolean;
    public email_verified!: boolean;
    public two_factor_enabled!: boolean;
    public preferences!: Record<string, any>;

    // Timestamps
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

// Define the model function
export const UserModel = (sequelize: Sequelize) => {
    User.init(
        {
            user_id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },
            username: {
                type: DataTypes.STRING(50),
                allowNull: false,
                unique: true,
            },
            email: {
                type: DataTypes.STRING(255),
                allowNull: false,
                unique: true,
                validate: {
                    isEmail: true,
                },
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
            is_premium: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
                allowNull: false,
            },
            created_at: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW,
                allowNull: false,
            },
            updated_at: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW,
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
                    fields: ['username'],
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
