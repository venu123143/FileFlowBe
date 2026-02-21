import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    DeleteObjectsCommand,
    ListObjectsV2Command,
    type PutObjectCommandInput,
    HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { FolderNameEnum } from "@/config/s3.config";

// export enum SecondaryFolderNameEnum {
//     FILES = "files",
//     VIDEOS = "videos",
//     IMAGES = "images",
//     DOCUMENTS = "documents",
//     RECORDINGS = "recordings"
// }

export class SecondaryS3Service {
    private s3Client: S3Client;
    private bucketName: string;

    constructor() {
        this.bucketName = process.env.SECONDARY_S3_BUCKET_NAME!;

        this.s3Client = new S3Client({
            endpoint: process.env.SECONDARY_S3_ENDPOINT!,
            region: process.env.SECONDARY_S3_REGION || 'auto',
            credentials: {
                accessKeyId: process.env.SECONDARY_S3_TOKEN_ID!,
                secretAccessKey: process.env.SECONDARY_S3_SECRET_KEY!,
            },
            forcePathStyle: true,
            requestHandler: {
                requestTimeout: 300000, // 5 minutes timeout
            } as any,
        });
    }

    public async listFiles(folder?: FolderNameEnum, maxKeys: number = 1000, continuationToken?: string) {
        const command = new ListObjectsV2Command({
            Bucket: this.bucketName,
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
            })) || [],
            isTruncated: response.IsTruncated || false,
            nextContinuationToken: response.NextContinuationToken,
        };
    }

    public async getFile(key: string): Promise<Buffer> {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key,
        });

        const response = await this.s3Client.send(command);

        if (!response.Body) {
            throw new Error(`No body returned for key: ${key}`);
        }

        // Convert stream to buffer
        const chunks: Uint8Array[] = [];
        for await (const chunk of response.Body as any) {
            chunks.push(chunk);
        }
        return Buffer.concat(chunks);
    }

    public async getFileStream(key: string) {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key,
        });

        const response = await this.s3Client.send(command);

        if (!response.Body) {
            throw new Error(`No body returned for key: ${key}`);
        }

        return response.Body;
    }

    public async getMetadata(key: string) {
        const command = new HeadObjectCommand({
            Bucket: this.bucketName,
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
}

export default new SecondaryS3Service();

