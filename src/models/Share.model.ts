import { DataTypes, Model, type Optional, Sequelize } from 'sequelize';

export enum SharePermission {
    VIEW = 'view',
    EDIT = 'edit',
    ADMIN = 'admin',
}

// Define the attributes interface
export interface ShareAttributes {
    id?: string;
    file_id: string;
    shared_by_user_id: string;
    shared_with_user_id: string;
    permission_level: SharePermission;
    message?: string | null;
    expires_at?: Date | null;
    last_accessed_at?: Date;
}

// Define the creation attributes
export interface ShareCreationAttributes extends Optional<ShareAttributes, 'id'> { }

// Define the Share model class
export class Share extends Model<ShareAttributes, ShareCreationAttributes> implements ShareAttributes {
    declare id: string;
    declare file_id: string;
    declare shared_by_user_id: string;
    declare shared_with_user_id: string;
    declare permission_level: SharePermission;
    declare message?: string;
    declare expires_at?: Date;
    declare last_accessed_at?: Date;

    // Timestamps
    declare readonly created_at: Date;
    declare readonly updated_at: Date;
}

// Define the model function
export const ShareModel = (sequelize: Sequelize) => {
    Share.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
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
            shared_by_user_id: {
                type: DataTypes.UUID,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
                onDelete: 'CASCADE',
            },
            shared_with_user_id: {
                type: DataTypes.UUID,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
                onDelete: 'CASCADE',
            },
            permission_level: {
                type: DataTypes.ENUM(...Object.values(SharePermission)),
                defaultValue: SharePermission.VIEW,
                allowNull: false,
            },
            message: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            expires_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            last_accessed_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        {
            sequelize,
            tableName: 'shares',
            timestamps: true, // We only have created_at, not updated_at
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                {
                    fields: ['file_id'],
                },
                {
                    fields: ['shared_with_user_id'],
                },
                {
                    fields: ['shared_by_user_id'],
                },
                {
                    fields: ['expires_at'],
                },
                {
                    unique: true,
                    fields: ['file_id', 'shared_by_user_id', 'shared_with_user_id'],
                },
            ],
            validate: {
                noSelfShare() {
                    if (this.shared_by_user_id === this.shared_with_user_id) {
                        throw new Error('Users cannot share files with themselves');
                    }
                },
            },
        }
    );

    return Share;
};
