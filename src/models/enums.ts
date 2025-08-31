// Database enums for the file storage application

export enum AccessAction {
    VIEW = 'view',
    DOWNLOAD = 'download',
    UPLOAD = 'upload',
    EDIT = 'edit',
    DELETE = 'delete',
    RESTORE = 'restore',
    SHARE = 'share',
    UNSHARE = 'unshare',
    PIN_ACCESS = 'pin_access',
    RENAME = 'rename',
    MOVE = 'move',
    COPY = 'copy',
    CREATE_FOLDER = 'create_folder',
    PUBLIC_LINK_CREATE = 'public_link_create',
    PUBLIC_LINK_ACCESS = 'public_link_access',
    PUBLIC_LINK_DELETE = 'public_link_delete',
}

export enum NotificationType {
    FILE_SHARED = 'file_shared',
    FILE_UPDATED = 'file_updated',
    STORAGE_QUOTA_WARNING = 'storage_quota_warning',
    STORAGE_QUOTA_EXCEEDED = 'storage_quota_exceeded',
    SHARE_EXPIRED = 'share_expired',
    FILE_COMMENTED = 'file_commented',
    PUBLIC_LINK_ACCESSED = 'public_link_accessed',
}
