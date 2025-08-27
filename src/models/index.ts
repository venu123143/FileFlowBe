import { Sequelize } from 'sequelize';
// Export all models and enums
export * from './enums';
export * from './User.model';
export * from './File.model';
export * from './FileVersion.model';
export * from './Share.model';
export * from './StorageAnalytics.model';
export * from './AccessLog.model';
export * from './Favorite.model';
export * from './Notification.model';
// Import all model functions
import { UserModel } from './User.model';
import { FileModel } from './File.model';
import { FileVersionModel } from './FileVersion.model';
import { ShareModel } from './Share.model';
import { StorageAnalyticsModel } from './StorageAnalytics.model';
import { AccessLogModel } from './AccessLog.model';
import { FavoriteModel } from './Favorite.model';
import { NotificationModel } from './Notification.model';

// Function to initialize all models with associations
export const initializeModels = (sequelize: Sequelize) => {
    // Initialize all models
    const User = UserModel(sequelize);
    const File = FileModel(sequelize);
    const FileVersion = FileVersionModel(sequelize);
    const Share = ShareModel(sequelize);
    const StorageAnalytics = StorageAnalyticsModel(sequelize);
    const AccessLog = AccessLogModel(sequelize);
    const Favorite = FavoriteModel(sequelize);
    const Notification = NotificationModel(sequelize);

    // Define associations
    // User associations
    User.hasMany(File, { foreignKey: 'owner_id', as: 'ownedFiles' });
    User.hasMany(File, { foreignKey: 'deleted_by_user_id', as: 'deletedFiles' });
    User.hasMany(FileVersion, { foreignKey: 'created_by_user_id', as: 'createdVersions' });
    User.hasMany(Share, { foreignKey: 'shared_by_user_id', as: 'sharedFiles' });
    User.hasMany(Share, { foreignKey: 'shared_with_user_id', as: 'receivedShares' });
    User.hasMany(StorageAnalytics, { foreignKey: 'user_id', as: 'storageAnalytics' });
    User.hasMany(AccessLog, { foreignKey: 'user_id', as: 'accessLogs' });
    User.hasMany(Favorite, { foreignKey: 'user_id', as: 'favorites' });
    User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });
    User.hasMany(Notification, { foreignKey: 'related_user_id', as: 'relatedNotifications' });

    // File associations
    File.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });
    File.belongsTo(User, { foreignKey: 'deleted_by_user_id', as: 'deletedBy' });
    File.belongsTo(File, { foreignKey: 'parent_id', as: 'parent' });
    File.hasMany(File, { foreignKey: 'parent_id', as: 'children' });
    File.hasMany(FileVersion, { foreignKey: 'file_id', as: 'versions' });
    File.hasMany(Share, { foreignKey: 'file_id', as: 'shares' });
    File.hasMany(AccessLog, { foreignKey: 'file_id', as: 'accessLogs' });
    File.hasMany(Favorite, { foreignKey: 'file_id', as: 'favorites' });
    File.hasMany(Notification, { foreignKey: 'file_id', as: 'notifications' });

    // FileVersion associations
    FileVersion.belongsTo(File, { foreignKey: 'file_id', as: 'file' });
    FileVersion.belongsTo(User, { foreignKey: 'created_by_user_id', as: 'createdBy' });

    // Share associations
    Share.belongsTo(File, { foreignKey: 'file_id', as: 'file' });
    Share.belongsTo(User, { foreignKey: 'shared_by_user_id', as: 'sharedBy' });
    Share.belongsTo(User, { foreignKey: 'shared_with_user_id', as: 'sharedWith' });

    // StorageAnalytics associations
    StorageAnalytics.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

    // AccessLog associations
    AccessLog.belongsTo(File, { foreignKey: 'file_id', as: 'file' });
    AccessLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

    // Favorite associations
    Favorite.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
    Favorite.belongsTo(File, { foreignKey: 'file_id', as: 'file' });

    // Notification associations
    Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
    Notification.belongsTo(User, { foreignKey: 'related_user_id', as: 'relatedUser' });
    Notification.belongsTo(File, { foreignKey: 'file_id', as: 'file' });

    return {
        User,
        File,
        FileVersion,
        Share,
        StorageAnalytics,
        AccessLog,
        Favorite,
        Notification,
    };
};
