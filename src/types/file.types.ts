export interface FileInfo {
    file_type: string;
    file_size: number;
    storage_path: string;
    thumbnail_path?: string;
    duration?: number;
}

export interface FileSystemNode {
    id: string;
    owner_id: string;
    parent_id: string | null;
    name: string;
    is_folder: boolean;
    access_level: string;
    file_info: FileInfo | null;
    description: string | null;
    tags: string[];
    metadata: any | null;
    last_accessed_at: Date | null;
    created_at: Date;
    updated_at: Date;
    children: FileSystemNode[];
}


export interface SharedFileSystemNode {
    id: string;
    owner_id: string;
    parent_id?: string;
    name: string;
    is_folder: boolean;
    access_level: string;
    file_info?: any;
    description?: string;
    tags: string[];
    metadata: any;
    last_accessed_at?: Date;
    created_at: Date;
    updated_at: Date;
    children: SharedFileSystemNode[];
    // Share-specific fields
    share_id: string;
    shared_by_user_id: string;
    shared_with_user_id: string;
    permission_level: string;
    share_message?: string;
    expires_at?: Date;
    share_created_at: Date;
}