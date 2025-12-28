import { DataTypes, Model, type Optional, Sequelize } from 'sequelize';

export interface IApiTokenAttributes {
    id: string;
    user_id: string;
    name: string;
    token_hash: string;
    last_used_at?: Date;
    expires_at?: Date;
    is_active: boolean;
    usage_count: number;
}

export interface ApiTokenCreationAttributes extends Optional<IApiTokenAttributes, 'id' | 'last_used_at' | 'expires_at' | 'is_active' | 'usage_count'> { }

export class ApiToken extends Model<IApiTokenAttributes, ApiTokenCreationAttributes> implements IApiTokenAttributes {
    declare id: string;
    declare user_id: string;
    declare name: string;
    declare token_hash: string;
    declare last_used_at?: Date;
    declare expires_at?: Date;
    declare is_active: boolean;
    declare usage_count: number;

    declare readonly created_at: Date;
    declare readonly updated_at: Date;
}

export const ApiTokenModel = (sequelize: Sequelize) => {
    ApiToken.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },
            user_id: {
                type: DataTypes.UUID,
                allowNull: false,
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            token_hash: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            last_used_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            expires_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                defaultValue: true,
                allowNull: false,
            },
            usage_count: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
                allowNull: false,
            },
        },
        {
            sequelize,
            tableName: 'api_tokens',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                {
                    fields: ['user_id'],
                },
                {
                    fields: ['token_hash'],
                },
            ],
        }
    );

    return ApiToken;
};
