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
