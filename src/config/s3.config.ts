import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    DeleteObjectsCommand,
    CreateMultipartUploadCommand,
    ListPartsCommand,
    UploadPartCommand,
    AbortMultipartUploadCommand,
    CompleteMultipartUploadCommand,
    type PutObjectCommandInput,
    HeadObjectCommand,
    ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import config from "@/config/config";
import crypto from "crypto";
import constants from "@/global/constants";
import { type IFile } from "@/services/upload.service";
import slugify from "slugify"; // npm i slugify

export interface ChunkMetadata {
    chunkNumber: number;
    totalChunks: number;
    fileSize: number;
    originalFileName: string;
    mimeType: string;
    checksum: string
}

export enum FolderNameEnum {
    FILES = "files",
    VIDEOS = "videos",
    IMAGES = "images",
    DOCUMENTS = "documents"
}

export class S3Service {
    private s3Client: S3Client;

    constructor() {
        this.s3Client = new S3Client({
            endpoint: config.S3.ENDPOINT,
            region: config.S3.REGION,
            credentials: {
                accessKeyId: config.S3.TOKEN_ID,
                secretAccessKey: config.S3.SECRET_KEY,
                // accountId: config.S3.ACCOUNT_ID
            },
            forcePathStyle: true,
        });
    }

    public buildCDNUrl(key: string): string {
        return `https://${config.CLOUDFLARE.CDN_DOMAIN}/${key}`;
    }

    /**
     * Sanitizes metadata values to ensure they're valid for HTTP headers.
     * HTTP headers cannot contain certain characters like non-ASCII, control characters, etc.
     */
    private sanitizeMetadataValue(value: string): string {
        // Replace non-ASCII and control characters with safe equivalents
        // Keep only alphanumeric, spaces, hyphens, underscores, and periods
        return value
            .replace(/[^\x20-\x7E]/g, '') // Remove non-printable ASCII
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') // Replace invalid chars with underscore
            .substring(0, 2000); // AWS metadata value limit is 2KB
    }

    private calculateChunkChecksum(chunkBuffer: Buffer<ArrayBuffer>): string {
        const hash = crypto.createHash('sha256');
        hash.update(chunkBuffer);
        return hash.digest('hex');
    }

    public async uploadFile(file: IFile): Promise<string> {
        // Sanitize original name for HTTP header compatibility
        const sanitizedOriginalName = this.sanitizeMetadataValue(file.originalName);
        
        const params: PutObjectCommandInput = {
            Bucket: config.S3.BUCKET_NAME,
            Key: `${FolderNameEnum.FILES}/${file.filename}`,
            Body: file.buffer,
            ContentType: file.mimetype,
            Metadata: {
                originalName: sanitizedOriginalName,
                uploadedAt: new Date().toISOString(),
                size: file.size.toString(),
            },
            CacheControl: `public, max-age=${config.CLOUDFLARE.DEFAULT_TTL}`
        };

        await this.s3Client.send(new PutObjectCommand(params));
        return `${FolderNameEnum.FILES}/${file.filename}`;
    }

    public async uploadBuffer(
        key: string,
        buffer: Buffer,
        fileName: string,
        mimeType: string,
        folder: FolderNameEnum = FolderNameEnum.FILES
    ): Promise<string> {
        const path = `${folder}/${key}`;
        // Sanitize original name for HTTP header compatibility
        const sanitizedOriginalName = this.sanitizeMetadataValue(fileName);
        
        const params = {
            Bucket: config.S3.BUCKET_NAME,
            Key: path,
            Body: buffer,
            ContentType: mimeType,
            Metadata: {
                originalName: sanitizedOriginalName,
                uploadedAt: new Date().toISOString(),
                size: buffer.length.toString(),
            },
            CacheControl: 'public, max-age=31536000',
        };

        await this.s3Client.send(new PutObjectCommand(params));
        return this.buildCDNUrl(path);
    }

    public async getFileUrl(key: string, expiresIn: number = 3600): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: config.S3.BUCKET_NAME,
            Key: key,
        });
        return await getSignedUrl(this.s3Client, command, { expiresIn });
    }

    public async getMetadata(key: string) {
        const command = new HeadObjectCommand({
            Bucket: config.S3.BUCKET_NAME,
            Key: key,
        });
        const response = await this.s3Client.send(command);
        return {
            contentType: response.ContentType,
            contentLength: response.ContentLength,
            lastModified: response.LastModified,
            metadata: response.Metadata,
            etag: response.ETag,
        };
    }

    public async deleteFile(key: string) {
        await this.s3Client.send(new DeleteObjectCommand({
            Bucket: config.S3.BUCKET_NAME,
            Key: key,
        }));
        await this.purgeCDNCache([key]);
    }

    public async deleteFiles(keys: string[]) {
        if (keys.length === 0) return;
        await this.s3Client.send(new DeleteObjectsCommand({
            Bucket: config.S3.BUCKET_NAME,
            Delete: {
                Objects: keys.map(Key => ({ Key })),
                Quiet: true,
            },
        }));
        await this.purgeCDNCache(keys);
    }

    public async listFiles(folder?: FolderNameEnum, maxKeys: number = 1000, continuationToken?: string) {
        const command = new ListObjectsV2Command({
            Bucket: config.S3.BUCKET_NAME,
            Prefix: folder ? `${folder}/` : undefined,
            MaxKeys: maxKeys,
            ContinuationToken: continuationToken,
        });

        const response = await this.s3Client.send(command);
        return {
            files: response.Contents?.map(obj => ({
                key: obj.Key!,
                size: obj.Size!,
                lastModified: obj.LastModified!,
                etag: obj.ETag!,
                cdnUrl: this.buildCDNUrl(obj.Key!)
            })) || [],
            isTruncated: response.IsTruncated || false,
            nextContinuationToken: response.NextContinuationToken,
        };
    }

    public async initiateMultipartUpload(fileName: string, mimeType: string): Promise<{ uploadId: string | undefined; key: string }> {
        const safeName = slugify(fileName, {
            replacement: "_",  // replace invalid chars with underscore
            remove: /[<>:"/\\|?*\x00-\x1F]/g, // remove invalid S3 header characters
            lower: false,
            strict: true
        });
        const key = `${FolderNameEnum.VIDEOS}/${safeName}`;
        const { UploadId } = await this.s3Client.send(new CreateMultipartUploadCommand({
            Bucket: config.S3.BUCKET_NAME,
            Key: key,
            ContentType: mimeType,
            Metadata: {
                originalName: safeName,
                uploadStarted: new Date().toISOString(),
            },
            // CacheControl: 'public, max-age=31536000',
        }));

        return { uploadId: UploadId, key };
    }

    public async getUploadedParts(uploadId: string, key: string) {
        const response = await this.s3Client.send(new ListPartsCommand({
            Bucket: config.S3.BUCKET_NAME,
            Key: key,
            UploadId: uploadId,
        }));

        return {
            parts: response.Parts?.map(part => ({
                PartNumber: part.PartNumber!,
                ETag: part.ETag!,
                Size: part.Size!,
                LastModified: part.LastModified,
            })) || [],
            initiator: response.Initiator,
            owner: response.Owner,
            storageClass: response.StorageClass,
        };
    }

    public async uploadChunk(uploadId: string, key: string, chunkBuffer: Buffer<ArrayBuffer>, metadata: ChunkMetadata) {
        const checksum = this.calculateChunkChecksum(chunkBuffer);
        const response = await this.s3Client.send(new UploadPartCommand({
            Bucket: config.S3.BUCKET_NAME,
            Key: key,
            PartNumber: metadata.chunkNumber,
            UploadId: uploadId,
            Body: chunkBuffer,
        }));

        if (!response.ETag) throw new Error('Failed to upload chunk');

        return {
            ETag: response.ETag,
            PartNumber: metadata.chunkNumber,
            Checksum: checksum,
        };
    }

    public async completeMultipartUpload(uploadId: string, key: string, parts: { ETag: string; PartNumber: number }[]) {
        const response = await this.s3Client.send(new CompleteMultipartUploadCommand({
            Bucket: config.S3.BUCKET_NAME,
            Key: key,
            UploadId: uploadId,
            MultipartUpload: {
                Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
            }
        }));
        return response.Location;
    }

    public async abortMultipartUpload(uploadId: string, key: string) {
        await this.s3Client.send(new AbortMultipartUploadCommand({
            Bucket: config.S3.BUCKET_NAME,
            Key: key,
            UploadId: uploadId
        }));
    }

    private async purgeCDNCache(keys: string[]) {
        if (!config.CLOUDFLARE.API_TOKEN || !config.CLOUDFLARE.ZONE_ID) {
            console.warn('Cloudflare API credentials not configured');
            return;
        }

        const urls = keys.map(key => this.buildCDNUrl(key));

        const response = await fetch(
            `${constants.CLOUDFLARE_BASE_URL}/client/v4/zones/${config.CLOUDFLARE.ZONE_ID}/purge_cache`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.CLOUDFLARE.API_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ files: urls }),
            }
        );

        const result = await response.json() as { success: boolean, errors: string[] };

        if (!result.success) {
            throw new Error(`Cloudflare API error: ${JSON.stringify(result.errors)}`);
        }

        console.log('CDN cache purged successfully');
    }
}


export default new S3Service()