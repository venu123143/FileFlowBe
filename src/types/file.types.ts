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
