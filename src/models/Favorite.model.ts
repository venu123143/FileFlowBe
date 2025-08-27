import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

// Define the attributes interface
export interface FavoriteAttributes {
    favorite_id: string;
    user_id: string;
    file_id: string;
    created_at: Date;
}

// Define the creation attributes
export interface FavoriteCreationAttributes extends Optional<FavoriteAttributes, 'favorite_id' | 'created_at'> {}

// Define the Favorite model class
export class Favorite extends Model<FavoriteAttributes, FavoriteCreationAttributes> implements FavoriteAttributes {
    public favorite_id!: string;
    public user_id!: string;
    public file_id!: string;
    public created_at!: Date;

    // Timestamps
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

// Define the model function
export const FavoriteModel = (sequelize: Sequelize) => {
    Favorite.init(
        {
            favorite_id: {
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
            file_id: {
                type: DataTypes.UUID,
                allowNull: false,
                references: {
                    model: 'files',
                    key: 'file_id',
                },
                onDelete: 'CASCADE',
            },
            created_at: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW,
                allowNull: false,
            },
        },
        {
            sequelize,
            tableName: 'favorites',
            timestamps: false, // We only have created_at, not updated_at
            indexes: [
                {
                    fields: ['user_id'],
                },
                {
                    fields: ['file_id'],
                },
                {
                    unique: true,
                    fields: ['user_id', 'file_id'],
                },
            ],
        }
    );

    return Favorite;
};
