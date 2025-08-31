import { DataTypes, Model, type Optional, Sequelize } from 'sequelize';

// Define the attributes interface
export interface FavoriteAttributes {
    id: string;
    user_id: string;
    file_id: string;
    created_at: Date;
}

// Define the creation attributes
export interface FavoriteCreationAttributes extends Optional<FavoriteAttributes, 'id' | 'created_at'> {}

// Define the Favorite model class
export class Favorite extends Model<FavoriteAttributes, FavoriteCreationAttributes> implements FavoriteAttributes {
    declare id: string;
    declare user_id: string;
    declare file_id: string;

    // Timestamps
    declare readonly created_at: Date;
    declare readonly updated_at: Date;
}

// Define the model function
export const FavoriteModel = (sequelize: Sequelize) => {
    Favorite.init(
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
            file_id: {
                type: DataTypes.UUID,
                allowNull: false,
                references: {
                    model: 'files',
                    key: 'id',
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
