import { DataTypes, Model, type Optional, Sequelize } from 'sequelize';

// Interface for RefreshToken attributes
export interface IRefreshTokenAttributes {
    id?: string;
    user_id: string;
    token_hash: string;
    revoked: boolean;
    expires_at: Date;
    created_at?: Date;
    replaced_by?: string | null;
    ip?: string | null;
    user_agent?: string | null;
    last_used_at?: Date | null;
}

// Optional attributes for creation
type IRefreshTokenCreationAttributes = Optional<IRefreshTokenAttributes, 'id' | 'revoked' | 'created_at' | 'replaced_by' | 'last_used_at'>;

// Sequelize Model class for RefreshToken
export class RefreshToken extends Model<IRefreshTokenAttributes, IRefreshTokenCreationAttributes> implements IRefreshTokenAttributes {
    declare id: string;
    declare user_id: string;
    declare token_hash: string;
    declare revoked: boolean;
    declare expires_at: Date;
    declare created_at: Date;
    declare replaced_by: string | null;
    declare ip: string | null;
    declare user_agent: string | null;
    declare last_used_at: Date | null;
}

// Model initialization function
export const RefreshTokenModel = (sequelize: Sequelize): typeof RefreshToken => {
    RefreshToken.init({
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
        token_hash: {
            type: DataTypes.STRING(512),
            allowNull: false,
        },
        revoked: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        expires_at: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        replaced_by: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        ip: {
            type: DataTypes.STRING(50),
            allowNull: true,
        },
        user_agent: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        last_used_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
    }, {
        sequelize,
        tableName: "refresh_tokens",
        freezeTableName: true,
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: false,
        indexes: [
            {
                fields: ['user_id'],
                name: 'idx_refresh_tokens_user_id',
            },
            {
                fields: ['token_hash'],
                name: 'idx_refresh_tokens_token_hash',
            },
            {
                fields: ['expires_at'],
                name: 'idx_refresh_tokens_expires_at',
            },
        ],
    });

    return RefreshToken;
};
